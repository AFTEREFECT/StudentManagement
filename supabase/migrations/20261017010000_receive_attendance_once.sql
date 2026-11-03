-- Startup delivery uses exact per-session revisions, never a date watermark.
ALTER TABLE public.attendance_sessions
  ADD COLUMN sync_revision bigint NOT NULL DEFAULT 1,
  ADD COLUMN acknowledged_revision bigint,
  ADD COLUMN acknowledged_at timestamptz;

CREATE INDEX attendance_sessions_pending_delivery_idx
  ON public.attendance_sessions (institution_id, id)
  WHERE acknowledged_revision IS DISTINCT FROM sync_revision;

CREATE OR REPLACE FUNCTION public.attendance_track_session_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['sync_revision', 'acknowledged_revision', 'acknowledged_at'])
      IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['sync_revision', 'acknowledged_revision', 'acknowledged_at'])
     OR NEW.sync_revision IS DISTINCT FROM OLD.sync_revision THEN
    NEW.sync_revision := OLD.sync_revision + 1;
    NEW.acknowledged_revision := NULL;
    NEW.acknowledged_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_session_revision BEFORE UPDATE ON public.attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.attendance_track_session_revision();

CREATE OR REPLACE FUNCTION public.attendance_track_mark_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE public.attendance_sessions SET sync_revision = sync_revision + 1 WHERE id = OLD.session_id;
  END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.session_id IS DISTINCT FROM OLD.session_id) THEN
    UPDATE public.attendance_sessions SET sync_revision = sync_revision + 1 WHERE id = NEW.session_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER attendance_mark_revision AFTER INSERT OR UPDATE OR DELETE ON public.attendance_marks
FOR EACH ROW EXECUTE FUNCTION public.attendance_track_mark_revision();

-- All identity is derived from auth.uid() on the server. No institution argument.
CREATE OR REPLACE FUNCTION public.attendance_pull_pending(p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_institution uuid;
  v_rows jsonb;
BEGIN
  IF NOT public.attendance_is_admin() THEN
    RAISE EXCEPTION 'Only institution administrators can receive attendance' USING ERRCODE = '42501';
  END IF;
  v_institution := public.attendance_current_institution();
  SELECT COALESCE(jsonb_agg(snapshot ORDER BY id), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT s.id, (to_jsonb(s) - ARRAY['acknowledged_at', 'acknowledged_revision'])
      || jsonb_build_object(
        'sync_revision', s.sync_revision::text,
        'teacherName', COALESCE(p.display_name, ''),
        'lesson', jsonb_build_object('id', t.id, 'class_name', t.class_name,
          'subject_name', t.subject_name, 'start_time', t.start_time, 'end_time', t.end_time),
        'marks', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id,
          'student_id', m.student_id, 'display_name', st.display_name) ORDER BY m.id)
          FROM public.attendance_marks m
          JOIN public.attendance_students st ON st.id = m.student_id AND st.institution_id = v_institution
          WHERE m.session_id = s.id AND m.institution_id = v_institution), '[]'::jsonb)
      ) AS snapshot
    FROM public.attendance_sessions s
    JOIN public.attendance_timetable t ON t.id = s.timetable_id AND t.institution_id = v_institution
    JOIN public.attendance_profiles p ON p.user_id = s.teacher_id AND p.institution_id = v_institution
    WHERE s.institution_id = v_institution
      AND s.acknowledged_revision IS DISTINCT FROM s.sync_revision
      AND (p_after IS NULL OR s.id > p_after)
    ORDER BY s.id LIMIT 200
  ) page;
  RETURN jsonb_build_object('institution_id', v_institution, 'user_id', auth.uid(), 'records', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_acknowledge(p_receipts jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.attendance_is_admin() THEN
    RAISE EXCEPTION 'Only institution administrators can acknowledge attendance' USING ERRCODE = '42501';
  END IF;
  IF p_receipts IS NULL OR jsonb_typeof(p_receipts) <> 'array' OR jsonb_array_length(p_receipts) > 200 THEN
    RAISE EXCEPTION 'Invalid receipt batch';
  END IF;
  UPDATE public.attendance_sessions s
  SET acknowledged_revision = s.sync_revision,
      acknowledged_at = COALESCE(s.acknowledged_at, clock_timestamp())
  FROM jsonb_to_recordset(p_receipts) AS receipt(id uuid, revision bigint)
  WHERE s.id = receipt.id AND s.sync_revision = receipt.revision
    AND s.institution_id = public.attendance_current_institution();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_received_attendance()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  -- Cron runs in UTC; eligibility is always evaluated in Casablanca civil time,
  -- including Ramadan/DST changes. No client-provided timestamp can enable deletion.
  IF (clock_timestamp() AT TIME ZONE 'Africa/Casablanca')::time >= time '02:00' THEN
    RETURN 0;
  END IF;
  WITH eligible AS (
    SELECT id FROM public.attendance_sessions
    WHERE acknowledged_revision = sync_revision
      AND acknowledged_at <= clock_timestamp() - interval '2 hours'
      AND edit_deadline < clock_timestamp()
    ORDER BY id LIMIT 1000 FOR UPDATE SKIP LOCKED
  ), removed AS (
    DELETE FROM public.attendance_sessions s USING eligible e
    WHERE s.id = e.id RETURNING s.id
  ) SELECT count(*)::integer INTO v_count FROM removed;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_track_session_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_track_mark_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_pull_pending(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.attendance_acknowledge(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_received_attendance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_pull_pending(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_acknowledge(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_received_attendance() TO service_role;

-- Supabase provides pg_cron. Failing to install/schedule aborts this migration;
-- a deployment must never silently omit its required nightly cleanup.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('cleanup-received-attendance', '*/10 * * * *',
  'SELECT public.cleanup_received_attendance()');
