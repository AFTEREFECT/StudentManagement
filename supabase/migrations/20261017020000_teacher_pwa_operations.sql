-- Keep attendance delivery/cleanup untouched. These receipts are operation
-- metadata only; year recovery comes from the institution's local archive.
ALTER TABLE public.attendance_settings
  ADD COLUMN academic_year_start_month integer NOT NULL DEFAULT 9 CHECK (academic_year_start_month BETWEEN 1 AND 12),
  ADD COLUMN second_semester_month integer NOT NULL DEFAULT 2 CHECK (second_semester_month BETWEEN 1 AND 12);

CREATE FUNCTION public.attendance_school_year(p_date date, p_start_month integer DEFAULT 9)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (extract(year FROM p_date)::integer - CASE WHEN extract(month FROM p_date) < p_start_month THEN 1 ELSE 0 END)::text
    || '-' || (extract(year FROM p_date)::integer + CASE WHEN extract(month FROM p_date) < p_start_month THEN 0 ELSE 1 END)::text
$$;

CREATE TABLE public.attendance_teacher_operations (
  operation_id uuid PRIMARY KEY,
  institution_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  payload_hash text NOT NULL,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_teacher_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_teacher_operations FROM PUBLIC, anon, authenticated;

CREATE TABLE public.attendance_archive_public_keys (
  institution_id uuid NOT NULL,
  key_id uuid NOT NULL,
  public_jwk jsonb NOT NULL,
  registered_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, key_id)
);
ALTER TABLE public.attendance_archive_public_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_archive_public_keys FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.register_attendance_archive_key(p_key_id uuid, p_public_jwk jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.attendance_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE = '42501'; END IF;
  IF p_public_jwk->>'kty' IS DISTINCT FROM 'EC' OR p_public_jwk->>'crv' IS DISTINCT FROM 'P-256'
    OR COALESCE(p_public_jwk->>'x', '') !~ '^[A-Za-z0-9_-]{43}$'
    OR COALESCE(p_public_jwk->>'y', '') !~ '^[A-Za-z0-9_-]{43}$' OR p_public_jwk ? 'd' THEN
    RAISE EXCEPTION 'Invalid public signing key';
  END IF;
  IF EXISTS (SELECT 1 FROM public.attendance_archive_public_keys
    WHERE institution_id = public.attendance_current_institution() AND key_id = p_key_id
      AND public_jwk IS DISTINCT FROM p_public_jwk) THEN RAISE EXCEPTION 'Signing key cannot be replaced'; END IF;
  INSERT INTO public.attendance_archive_public_keys (institution_id, key_id, public_jwk, registered_by)
  VALUES (public.attendance_current_institution(), p_key_id, p_public_jwk, auth.uid()) ON CONFLICT DO NOTHING;
END;
$$;

CREATE FUNCTION public.set_attendance_academic_calendar(p_start_month integer, p_second_semester integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.attendance_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE = '42501'; END IF;
  IF p_start_month NOT BETWEEN 1 AND 12 OR p_second_semester NOT BETWEEN 1 AND 12 OR p_start_month = p_second_semester THEN
    RAISE EXCEPTION 'Invalid academic calendar';
  END IF;
  INSERT INTO public.attendance_settings (institution_id, academic_year_start_month, second_semester_month)
  VALUES (public.attendance_current_institution(), p_start_month, p_second_semester)
  ON CONFLICT (institution_id) DO UPDATE SET academic_year_start_month = excluded.academic_year_start_month,
    second_semester_month = excluded.second_semester_month;
END;
$$;

CREATE FUNCTION public.teacher_attendance_bundle(p_year text DEFAULT NULL, p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile public.attendance_profiles%ROWTYPE; v_start integer; v_term integer; v_year text; v_sessions jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.attendance_profiles WHERE user_id = auth.uid() AND role = 'teacher' AND NOT must_change_password;
  IF NOT FOUND THEN RAISE EXCEPTION 'Teacher required' USING ERRCODE = '42501'; END IF;
  SELECT academic_year_start_month, second_semester_month INTO v_start, v_term
    FROM public.attendance_settings WHERE institution_id = v_profile.institution_id;
  v_start := COALESCE(v_start, 9); v_term := COALESCE(v_term, 2);
  v_year := COALESCE(p_year, public.attendance_school_year(public.attendance_local_date(v_profile.institution_id), v_start));
  IF v_year !~ '^[0-9]{4}-[0-9]{4}$' OR split_part(v_year, '-', 2)::integer <> split_part(v_year, '-', 1)::integer + 1 THEN
    RAISE EXCEPTION 'Invalid school year';
  END IF;
  SELECT COALESCE(jsonb_agg(snapshot ORDER BY id), '[]') INTO v_sessions FROM (
    SELECT s.id, jsonb_build_object('id', s.id, 'revision', s.sync_revision::text,
      'lessonDate', s.lesson_date, 'timetableId', s.timetable_id, 'status', s.status,
      'submittedAt', s.submitted_at, 'editDeadline', s.edit_deadline,
      'lesson', jsonb_build_object('id', t.id, 'class_name', t.class_name, 'subject_code', t.subject_code,
        'subject_name', t.subject_name, 'day_of_week', t.day_of_week, 'start_time', t.start_time, 'end_time', t.end_time, 'room', t.room),
      'absentStudentIds', COALESCE((SELECT jsonb_agg(m.student_id ORDER BY m.student_id)
        FROM public.attendance_marks m WHERE m.session_id = s.id AND m.institution_id = v_profile.institution_id), '[]')) AS snapshot
    FROM public.attendance_sessions s JOIN public.attendance_timetable t ON t.id = s.timetable_id
    WHERE s.institution_id = v_profile.institution_id AND s.teacher_id = auth.uid()
      AND public.attendance_school_year(s.lesson_date, v_start) = v_year
      AND (p_after IS NULL OR s.id > p_after) ORDER BY s.id LIMIT 200
  ) records;
  RETURN jsonb_build_object('userId', auth.uid(), 'institutionId', v_profile.institution_id,
    'year', v_year, 'startMonth', v_start, 'secondSemesterMonth', v_term, 'sessions', v_sessions,
    'archiveKeys', COALESCE((SELECT jsonb_agg(jsonb_build_object('keyId', key_id, 'jwk', public_jwk))
      FROM public.attendance_archive_public_keys WHERE institution_id = v_profile.institution_id), '[]'));
END;
$$;

CREATE FUNCTION public.teacher_submit_attendance_operation(
  p_operation_id uuid, p_timetable_id uuid, p_lesson_date date,
  p_student_ids uuid[], p_expected_revision bigint DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_profile public.attendance_profiles%ROWTYPE; v_hash text; v_previous public.attendance_teacher_operations%ROWTYPE;
  v_session public.attendance_sessions%ROWTYPE; v_receipt jsonb; v_start integer; v_day integer;
BEGIN
  SELECT * INTO v_profile FROM public.attendance_profiles WHERE user_id = auth.uid() AND role = 'teacher' AND NOT must_change_password;
  IF NOT FOUND THEN RAISE EXCEPTION 'Teacher required' USING ERRCODE = '42501'; END IF;
  IF p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN RAISE EXCEPTION 'Invalid operation'; END IF;
  SELECT encode(digest(jsonb_build_array(p_timetable_id, p_lesson_date, p_expected_revision,
    (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]') FROM (SELECT DISTINCT unnest(COALESCE(p_student_ids, ARRAY[]::uuid[])) id) ids))::text,
    'sha256'), 'hex') INTO v_hash;
  -- Serialize duplicate operation IDs and edits to the same lesson/date across devices.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  SELECT * INTO v_previous FROM public.attendance_teacher_operations WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_previous.teacher_user_id <> auth.uid() OR v_previous.institution_id <> v_profile.institution_id
      OR v_previous.payload_hash <> v_hash THEN RAISE EXCEPTION 'Operation identity or payload mismatch' USING ERRCODE = '42501'; END IF;
    RETURN jsonb_build_object('outcome', 'accepted', 'receipt', v_previous.receipt);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_timetable_id::text || ':' || p_lesson_date::text, 1));
  SELECT day_of_week INTO v_day FROM public.attendance_timetable WHERE id = p_timetable_id
    AND institution_id = v_profile.institution_id AND teacher_id = public.attendance_current_teacher_id() AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lesson is not authorized' USING ERRCODE = '42501'; END IF;
  IF p_lesson_date IS NULL OR p_lesson_date <> public.attendance_local_date(v_profile.institution_id)
    OR extract(dow FROM p_lesson_date)::integer <> v_day THEN
    RAISE EXCEPTION 'Lesson date is not authorized; retain the draft and contact the institution' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_session FROM public.attendance_sessions WHERE timetable_id = p_timetable_id AND lesson_date = p_lesson_date FOR UPDATE;
  IF (FOUND AND v_session.sync_revision <> p_expected_revision) OR (NOT FOUND AND p_expected_revision <> 0) THEN
    RETURN jsonb_build_object('outcome', 'conflict', 'current', CASE WHEN v_session.id IS NULL THEN NULL ELSE
      jsonb_build_object('id', v_session.id, 'revision', v_session.sync_revision::text, 'lessonDate', v_session.lesson_date,
        'timetableId', v_session.timetable_id, 'status', v_session.status, 'submittedAt', v_session.submitted_at,
        'editDeadline', v_session.edit_deadline, 'absentStudentIds', COALESCE((SELECT jsonb_agg(student_id ORDER BY student_id)
          FROM public.attendance_marks WHERE session_id = v_session.id), '[]')) END);
  END IF;
  -- Reuse the existing authorization, student validation and correction-window implementation.
  PERFORM public.submit_attendance_for_lesson(p_timetable_id, p_student_ids);
  SELECT * INTO v_session FROM public.attendance_sessions WHERE timetable_id = p_timetable_id AND lesson_date = p_lesson_date;
  SELECT COALESCE(academic_year_start_month, 9) INTO v_start FROM public.attendance_settings WHERE institution_id = v_profile.institution_id;
  v_receipt := jsonb_build_object('id', v_session.id, 'revision', v_session.sync_revision::text,
    'lessonDate', v_session.lesson_date, 'timetableId', v_session.timetable_id, 'status', v_session.status,
    'submittedAt', v_session.submitted_at, 'editDeadline', v_session.edit_deadline,
    'academicYear', public.attendance_school_year(v_session.lesson_date, COALESCE(v_start, 9)));
  INSERT INTO public.attendance_teacher_operations (operation_id, institution_id, teacher_user_id, payload_hash, receipt)
  VALUES (p_operation_id, v_profile.institution_id, auth.uid(), v_hash, v_receipt);
  RETURN jsonb_build_object('outcome', 'accepted', 'receipt', v_receipt);
END;
$$;

REVOKE ALL ON FUNCTION public.register_attendance_archive_key(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_attendance_academic_calendar(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_attendance_bundle(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_submit_attendance_operation(uuid, uuid, date, uuid[], bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_attendance_archive_key(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_attendance_academic_calendar(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_attendance_bundle(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_submit_attendance_operation(uuid, uuid, date, uuid[], bigint) TO authenticated;
