/*
  Multi-institution desktop foundation (pilot, opt-in).
  Does not migrate legacy students/absences: those tables currently have permissive
  policies and must NOT be used for tenant data until a separately reviewed migration.
  Run after 20251113022422_add_whatsapp_session_to_institutions.sql.
*/

-- Existing "institutions" migration grants PUBLIC access, including write access.
-- Tighten that table before introducing institution identities.
DROP POLICY IF EXISTS "Allow public read access to institutions" ON public.institutions;
DROP POLICY IF EXISTS "Allow public insert to institutions" ON public.institutions;
DROP POLICY IF EXISTS "Allow public update to institutions" ON public.institutions;
DROP POLICY IF EXISTS "Allow public delete from institutions" ON public.institutions;

CREATE TABLE IF NOT EXISTS public.desktop_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('institution_admin','staff','teacher')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id,user_id)
);
CREATE INDEX IF NOT EXISTS desktop_memberships_user_idx
  ON public.desktop_memberships (user_id,institution_id);

CREATE TABLE IF NOT EXISTS public.desktop_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','revoked')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  UNIQUE (id,institution_id,user_id)
);
CREATE INDEX IF NOT EXISTS desktop_devices_institution_idx
  ON public.desktop_devices (institution_id,status);

-- Pilot synchronization scope: harmless admin notes / institution preferences.
-- Student records and attendance must use distinct validated domain RPCs later.
CREATE TABLE IF NOT EXISTS public.desktop_documents (
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('administrative_note','institution_preferences')),
  document_id uuid NOT NULL,
  revision bigint NOT NULL DEFAULT 0 CHECK(revision >= 0),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(content)='object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  PRIMARY KEY(institution_id,kind,document_id)
);
CREATE TABLE IF NOT EXISTS public.desktop_sync_receipts (
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.desktop_devices(id),
  kind text NOT NULL,
  document_id uuid NOT NULL,
  applied_revision bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(institution_id,operation_id)
);
CREATE INDEX IF NOT EXISTS desktop_receipts_created_idx
  ON public.desktop_sync_receipts (institution_id,created_at);

-- Role lookup executes as table owner to avoid recursive membership RLS.
CREATE OR REPLACE FUNCTION public.desktop_has_role(
  p_institution uuid, p_roles text[] DEFAULT ARRAY['institution_admin','staff','teacher']::text[]
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.desktop_memberships AS m
    WHERE m.institution_id = p_institution AND m.user_id = auth.uid()
      AND m.active AND m.role = ANY(p_roles)
  );
$$;
REVOKE ALL ON FUNCTION public.desktop_has_role(uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desktop_has_role(uuid,text[]) TO authenticated;

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_sync_receipts ENABLE ROW LEVEL SECURITY;

-- The only way to provision institutions / memberships is a trusted backend
-- using service_role (never embedded in the desktop bundle).
DROP POLICY IF EXISTS desktop_institutions_read ON public.institutions;
CREATE POLICY desktop_institutions_read ON public.institutions
  FOR SELECT TO authenticated USING (public.desktop_has_role(id));
DROP POLICY IF EXISTS desktop_memberships_read ON public.desktop_memberships;
CREATE POLICY desktop_memberships_read ON public.desktop_memberships
  FOR SELECT TO authenticated USING (public.desktop_has_role(institution_id));

DROP POLICY IF EXISTS desktop_devices_read ON public.desktop_devices;
CREATE POLICY desktop_devices_read ON public.desktop_devices
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR
    public.desktop_has_role(institution_id,ARRAY['institution_admin']::text[])
  );
DROP POLICY IF EXISTS desktop_devices_request ON public.desktop_devices;
CREATE POLICY desktop_devices_request ON public.desktop_devices
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND status = 'pending'
    AND public.desktop_has_role(institution_id,ARRAY['institution_admin','staff']::text[])
  );

DROP POLICY IF EXISTS desktop_documents_read ON public.desktop_documents;
CREATE POLICY desktop_documents_read ON public.desktop_documents
  FOR SELECT TO authenticated USING (
    public.desktop_has_role(institution_id,ARRAY['institution_admin','staff']::text[])
  );
DROP POLICY IF EXISTS desktop_receipts_read ON public.desktop_sync_receipts;
CREATE POLICY desktop_receipts_read ON public.desktop_sync_receipts
  FOR SELECT TO authenticated USING (
    public.desktop_has_role(institution_id,ARRAY['institution_admin','staff']::text[])
  );

-- RLS filters rows; SQL privileges still need to be granted explicitly.
GRANT SELECT ON public.institutions,public.desktop_memberships,
  public.desktop_devices,public.desktop_documents,public.desktop_sync_receipts TO authenticated;
GRANT INSERT ON public.desktop_devices TO authenticated;

-- Even clients with arbitrary SQL/PostgREST access cannot directly update
-- the pilot documents or change a device from pending to approved.
REVOKE INSERT,UPDATE,DELETE ON public.institutions FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.desktop_memberships FROM anon,authenticated;
REVOKE UPDATE,DELETE ON public.desktop_devices FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.desktop_documents FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.desktop_sync_receipts FROM anon,authenticated;

-- Approval is an explicit authenticated admin action with AAL2 MFA.
CREATE OR REPLACE FUNCTION public.desktop_review_device(
  p_institution uuid,p_device uuid,p_approve boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2'
     OR NOT public.desktop_has_role(p_institution,ARRAY['institution_admin']::text[]) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  UPDATE public.desktop_devices
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'revoked' END,
         reviewed_at = now(),reviewed_by = auth.uid()
   WHERE id=p_device AND institution_id=p_institution AND status IN ('pending','approved');
  IF NOT FOUND THEN RAISE EXCEPTION 'device not found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.desktop_review_device(uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desktop_review_device(uuid,uuid,boolean) TO authenticated;

-- A batch is one RPC / transaction. If a document was changed elsewhere,
-- return conflict WITHOUT overwriting it. Duplicated operation_id is idempotent.
-- Maximum 50 operations, maximum 100 KiB total payload per request.
CREATE OR REPLACE FUNCTION public.desktop_apply_batch(
  p_institution uuid,p_device uuid,p_operations jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  item jsonb;
  result jsonb := '[]'::jsonb;
  op uuid; doc uuid; k text; expected bigint; next_revision bigint;
  prior_revision bigint; current_content jsonb; already bigint;
BEGIN
  IF auth.uid() IS NULL OR (auth.jwt()->>'aal') IS DISTINCT FROM 'aal2'
     OR NOT public.desktop_has_role(p_institution,ARRAY['institution_admin','staff']::text[])
     OR NOT EXISTS (SELECT 1 FROM public.desktop_devices d
       WHERE d.id=p_device AND d.institution_id=p_institution AND d.user_id=auth.uid()
         AND d.status='approved') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_operations) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_operations) NOT BETWEEN 1 AND 50
     OR pg_column_size(p_operations) > 102400 THEN
    RAISE EXCEPTION 'invalid batch';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_operations)
  LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
       OR COALESCE(item->>'kind','') NOT IN ('administrative_note','institution_preferences')
       OR jsonb_typeof(item->'content') IS DISTINCT FROM 'object'
       OR COALESCE(item->>'expected_revision','') !~ '^[0-9]{1,16}$'
       OR COALESCE(item->>'operation_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR COALESCE(item->>'document_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR pg_column_size(item->'content') > 16384 THEN
      RAISE EXCEPTION 'invalid operation';
    END IF;
    op := (item->>'operation_id')::uuid;
    doc := (item->>'document_id')::uuid;
    k := item->>'kind';
    expected := (item->>'expected_revision')::bigint;

    SELECT r.applied_revision INTO already FROM public.desktop_sync_receipts r
      WHERE r.institution_id=p_institution AND r.operation_id=op;
    IF FOUND THEN
      result := result || jsonb_build_array(jsonb_build_object('operation_id',op,'status','duplicate','revision',already));
      CONTINUE;
    END IF;

    -- Lock the tenant document. New documents start at revision 0.
    INSERT INTO public.desktop_documents(institution_id,kind,document_id,revision,content)
      VALUES (p_institution,k,doc,0,'{}'::jsonb)
      ON CONFLICT DO NOTHING;
    SELECT d.revision,d.content INTO prior_revision,current_content
      FROM public.desktop_documents d WHERE d.institution_id=p_institution
      AND d.kind=k AND d.document_id=doc FOR UPDATE;
    IF prior_revision <> expected THEN
      result := result || jsonb_build_array(jsonb_build_object('operation_id',op,'status','conflict','revision',prior_revision));
      CONTINUE;
    END IF;
    next_revision := prior_revision+1;
    UPDATE public.desktop_documents SET revision=next_revision,content=item->'content',
      updated_at=now(),updated_by=auth.uid()
    WHERE institution_id=p_institution AND kind=k AND document_id=doc;
    INSERT INTO public.desktop_sync_receipts
      (institution_id,operation_id,device_id,kind,document_id,applied_revision)
      VALUES(p_institution,op,p_device,k,doc,next_revision);
    result := result || jsonb_build_array(jsonb_build_object('operation_id',op,'status','applied','revision',next_revision));
  END LOOP;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.desktop_apply_batch(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desktop_apply_batch(uuid,uuid,jsonb) TO authenticated;

-- Provision the first admin only from a trusted deployment environment:
-- INSERT INTO public.desktop_memberships(institution_id,user_id,role)
-- VALUES (...institution uuid..., ...existing auth.users uuid..., 'institution_admin');
-- Never ship the service_role key or an admin provisioning password in the client.
