CREATE TABLE IF NOT EXISTS public.attendance_teacher_directory (
  institution_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  display_name text NOT NULL,
  username text,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, teacher_id)
);

INSERT INTO public.attendance_teacher_directory (
  institution_id, teacher_id, display_name, username, activated_at
)
SELECT
  i.institution_id,
  i.teacher_id,
  i.display_name,
  i.username,
  p.created_at
FROM public.attendance_teacher_invites i
LEFT JOIN public.attendance_profiles p
  ON p.institution_id = i.institution_id
  AND p.teacher_id = i.teacher_id
ON CONFLICT (institution_id, teacher_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  username = EXCLUDED.username,
  activated_at = COALESCE(public.attendance_teacher_directory.activated_at, EXCLUDED.activated_at),
  updated_at = now();

ALTER TABLE public.attendance_teacher_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_teacher_directory_admin_manage
ON public.attendance_teacher_directory
FOR ALL TO authenticated
USING (
  public.attendance_is_admin()
  AND institution_id = public.attendance_current_institution()
)
WITH CHECK (
  public.attendance_is_admin()
  AND institution_id = public.attendance_current_institution()
);

CREATE POLICY attendance_teacher_directory_teacher_read
ON public.attendance_teacher_directory
FOR SELECT TO authenticated
USING (
  institution_id = public.attendance_current_institution()
  AND teacher_id = public.attendance_current_teacher_id()
);

CREATE OR REPLACE FUNCTION public.create_attendance_teacher_invite(
  p_teacher_id uuid,
  p_display_name text
)
RETURNS TABLE (teacher_id uuid, username text, activation_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_institution_id uuid := public.attendance_current_institution();
  v_username text;
  v_code text := upper(encode(gen_random_bytes(8), 'hex'));
  v_activated boolean;
BEGIN
  IF NOT public.attendance_is_admin() THEN
    RAISE EXCEPTION 'Only institution administrators can issue teacher invitations';
  END IF;
  IF p_teacher_id IS NULL OR trim(COALESCE(p_display_name, '')) = '' THEN
    RAISE EXCEPTION 'Teacher ID and name are required';
  END IF;

  INSERT INTO public.attendance_teacher_directory (
    institution_id, teacher_id, display_name
  )
  VALUES (v_institution_id, p_teacher_id, trim(p_display_name))
  ON CONFLICT (institution_id, teacher_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = now();

  SELECT d.activated_at IS NOT NULL, d.username
    INTO v_activated, v_username
  FROM public.attendance_teacher_directory d
  WHERE d.institution_id = v_institution_id
    AND d.teacher_id = p_teacher_id
  FOR UPDATE;

  IF v_activated THEN
    RAISE EXCEPTION 'Teacher account is already activated';
  END IF;

  v_username := COALESCE(v_username, 'teacher-' || encode(gen_random_bytes(6), 'hex'));

  INSERT INTO public.attendance_teacher_invites (
    institution_id, teacher_id, username, display_name, code_hash, expires_at, claimed_at
  )
  VALUES (
    v_institution_id,
    p_teacher_id,
    v_username,
    trim(p_display_name),
    encode(digest(v_code, 'sha256'), 'hex'),
    now() + interval '7 days',
    NULL
  )
  ON CONFLICT (teacher_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    claimed_at = NULL;

  UPDATE public.attendance_teacher_directory d
  SET display_name = trim(p_display_name),
      username = v_username,
      updated_at = now()
  WHERE d.institution_id = v_institution_id
    AND d.teacher_id = p_teacher_id;

  RETURN QUERY SELECT p_teacher_id, v_username, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_attendance_teacher_invite(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_attendance_teacher_invite(uuid, text) TO authenticated;
