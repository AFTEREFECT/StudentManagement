CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.attendance_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'teacher')),
  display_name text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id)
);
ALTER TABLE public.attendance_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.attendance_admin_bootstrap (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  user_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_admin_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_admin_bootstrap FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.attendance_admin_bootstrap TO service_role;

CREATE TABLE IF NOT EXISTS public.attendance_settings (
  institution_id uuid PRIMARY KEY,
  correction_window_hours integer NOT NULL DEFAULT 6 CHECK (correction_window_hours BETWEEN 0 AND 168),
  correction_window_from text NOT NULL DEFAULT 'lesson_end'
    CHECK (correction_window_from IN ('lesson_end', 'submission')),
  timezone text NOT NULL DEFAULT 'Africa/Casablanca'
    CHECK (timezone IN ('Africa/Casablanca'))
);

CREATE TABLE IF NOT EXISTS public.attendance_students (
  id uuid PRIMARY KEY,
  institution_id uuid NOT NULL,
  class_name text NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id)
);

CREATE TABLE IF NOT EXISTS public.attendance_timetable (
  id uuid PRIMARY KEY,
  institution_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  class_name text NOT NULL,
  subject_code text NOT NULL DEFAULT '',
  subject_name text NOT NULL DEFAULT '',
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  room text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, teacher_id)
    REFERENCES public.attendance_profiles(institution_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  timetable_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  lesson_date date NOT NULL DEFAULT current_date,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  edit_deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'confirmed', 'cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  UNIQUE (timetable_id, lesson_date),
  FOREIGN KEY (institution_id, timetable_id)
    REFERENCES public.attendance_timetable(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, teacher_id)
    REFERENCES public.attendance_profiles(institution_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, reviewed_by)
    REFERENCES public.attendance_profiles(institution_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.attendance_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.attendance_students(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'absent' CHECK (status = 'absent'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.attendance_teacher_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  teacher_id uuid NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id uuid NOT NULL,
  actor_id uuid REFERENCES public.attendance_profiles(user_id),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_students_institution_class_idx
  ON public.attendance_students (institution_id, class_name);
CREATE INDEX IF NOT EXISTS attendance_timetable_teacher_day_idx
  ON public.attendance_timetable (teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS attendance_sessions_teacher_date_idx
  ON public.attendance_sessions (teacher_id, lesson_date);
CREATE INDEX IF NOT EXISTS attendance_marks_session_idx
  ON public.attendance_marks (session_id);
CREATE INDEX IF NOT EXISTS attendance_audit_institution_created_idx
  ON public.attendance_audit_log (institution_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.attendance_current_institution()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id
  FROM public.attendance_profiles
  WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.attendance_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance_profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND NOT must_change_password
  )
$$;

CREATE OR REPLACE FUNCTION public.attendance_local_date(p_institution_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT timezone(
    COALESCE((
      SELECT s.timezone FROM public.attendance_settings s
      WHERE s.institution_id = p_institution_id
    ), 'Africa/Casablanca'),
    now()
  )::date
$$;

CREATE OR REPLACE FUNCTION public.attendance_local_day_of_week(p_institution_id uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXTRACT(DOW FROM public.attendance_local_date(p_institution_id))::smallint
$$;

CREATE OR REPLACE FUNCTION public.create_attendance_teacher_invite(p_display_name text)
RETURNS TABLE (teacher_id uuid, username text, activation_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher_id uuid := gen_random_uuid();
  v_username text := 'teacher-' || encode(gen_random_bytes(6), 'hex');
  v_code text := upper(encode(gen_random_bytes(8), 'hex'));
BEGIN
  IF NOT public.attendance_is_admin() THEN
    RAISE EXCEPTION 'Only institution administrators can issue teacher invitations';
  END IF;
  IF trim(COALESCE(p_display_name, '')) = '' THEN
    RAISE EXCEPTION 'Teacher name is required';
  END IF;

  INSERT INTO public.attendance_teacher_invites (
    institution_id, teacher_id, username, display_name, code_hash
  )
  VALUES (
    public.attendance_current_institution(),
    v_teacher_id,
    v_username,
    trim(p_display_name),
    encode(digest(v_code, 'sha256'), 'hex')
  );

  RETURN QUERY SELECT v_teacher_id, v_username, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_attendance_teacher_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_attendance_teacher_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_attendance_for_lesson(
  p_timetable_id uuid,
  p_student_ids uuid[]
)
RETURNS TABLE (session_id uuid, edit_deadline timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid := auth.uid();
  v_institution_id uuid;
  v_class_name text;
  v_end_time time;
  v_lesson_date date;
  v_timezone text := 'Africa/Casablanca';
  v_window_hours integer := 6;
  v_window_from text := 'lesson_end';
  v_session public.attendance_sessions%ROWTYPE;
  v_deadline timestamptz;
BEGIN
  IF public.attendance_is_admin() THEN
    RAISE EXCEPTION 'Administrators cannot submit attendance from the teacher portal';
  END IF;

  SELECT t.institution_id, t.class_name, t.end_time
    INTO v_institution_id, v_class_name, v_end_time
  FROM public.attendance_timetable t
  WHERE t.id = p_timetable_id
    AND t.teacher_id = v_teacher_id
    AND t.active
    AND t.day_of_week = public.attendance_local_day_of_week(t.institution_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson is not assigned to this teacher for today';
  END IF;

  SELECT s.correction_window_hours, s.correction_window_from
    INTO v_window_hours, v_window_from
  FROM public.attendance_settings s
  WHERE s.institution_id = v_institution_id;

  SELECT COALESCE((
    SELECT s.timezone FROM public.attendance_settings s
    WHERE s.institution_id = v_institution_id
  ), 'Africa/Casablanca') INTO v_timezone;
  v_lesson_date := public.attendance_local_date(v_institution_id);

  v_deadline := CASE
    WHEN v_window_from = 'submission' THEN now() + make_interval(hours => v_window_hours)
    ELSE ((v_lesson_date + v_end_time) AT TIME ZONE v_timezone) + make_interval(hours => v_window_hours)
  END;

  INSERT INTO public.attendance_sessions (
    institution_id, timetable_id, teacher_id, lesson_date, edit_deadline
  )
  VALUES (v_institution_id, p_timetable_id, v_teacher_id, v_lesson_date, v_deadline)
  ON CONFLICT (timetable_id, lesson_date) DO NOTHING;

  SELECT * INTO v_session
  FROM public.attendance_sessions s
  WHERE s.timetable_id = p_timetable_id AND s.lesson_date = v_lesson_date
  FOR UPDATE;

  IF v_session.teacher_id <> v_teacher_id
    OR v_session.status <> 'submitted'
    OR now() > v_session.edit_deadline THEN
    RAISE EXCEPTION 'Attendance correction window has expired or the record is locked';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_student_ids, ARRAY[]::uuid[])) requested(id)
    LEFT JOIN public.attendance_students st
      ON st.id = requested.id
      AND st.institution_id = v_institution_id
      AND st.class_name = v_class_name
    WHERE st.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more selected students are outside this teacher lesson';
  END IF;

  DELETE FROM public.attendance_marks m WHERE m.session_id = v_session.id;
  INSERT INTO public.attendance_marks (institution_id, session_id, student_id)
  SELECT v_institution_id, v_session.id, selected.id
  FROM (
    SELECT DISTINCT id FROM unnest(COALESCE(p_student_ids, ARRAY[]::uuid[])) valueset(id)
  ) selected;

  RETURN QUERY SELECT v_session.id, v_session.edit_deadline;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_attendance_for_lesson(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_attendance_for_lesson(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_correct_attendance(
  p_session_id uuid,
  p_student_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.attendance_sessions%ROWTYPE;
  v_class_name text;
BEGIN
  IF NOT public.attendance_is_admin() THEN
    RAISE EXCEPTION 'Only institution administrators can correct attendance';
  END IF;

  SELECT * INTO v_session
  FROM public.attendance_sessions s
  WHERE s.id = p_session_id
    AND s.institution_id = public.attendance_current_institution()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;

  SELECT t.class_name INTO v_class_name
  FROM public.attendance_timetable t
  WHERE t.id = v_session.timetable_id
    AND t.institution_id = v_session.institution_id;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_student_ids, ARRAY[]::uuid[])) requested(id)
    LEFT JOIN public.attendance_students st
      ON st.id = requested.id
      AND st.institution_id = v_session.institution_id
      AND st.class_name = v_class_name
    WHERE st.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more selected students are outside this lesson';
  END IF;

  DELETE FROM public.attendance_marks m WHERE m.session_id = v_session.id;
  INSERT INTO public.attendance_marks (institution_id, session_id, student_id)
  SELECT v_session.institution_id, v_session.id, selected.id
  FROM (
    SELECT DISTINCT id FROM unnest(COALESCE(p_student_ids, ARRAY[]::uuid[])) valueset(id)
  ) selected;

  UPDATE public.attendance_sessions
  SET reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = v_session.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_correct_attendance(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_correct_attendance(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_attendance(
  p_session_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.attendance_is_admin() THEN
    RAISE EXCEPTION 'Only institution administrators can review attendance';
  END IF;
  IF p_status NOT IN ('confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  UPDATE public.attendance_sessions
  SET status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_session_id
    AND institution_id = public.attendance_current_institution();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_attendance(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_attendance(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.attendance_write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_institution uuid;
  v_record_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;
  v_institution := COALESCE((v_new ->> 'institution_id')::uuid, (v_old ->> 'institution_id')::uuid);
  v_record_id := COALESCE(v_new ->> 'id', v_old ->> 'id');

  INSERT INTO public.attendance_audit_log (
    institution_id, actor_id, table_name, record_id, action, before_data, after_data
  )
  VALUES (v_institution, auth.uid(), TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_sessions_audit ON public.attendance_sessions;
CREATE TRIGGER attendance_sessions_audit
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.attendance_write_audit_log();

DROP TRIGGER IF EXISTS attendance_marks_audit ON public.attendance_marks;
CREATE TRIGGER attendance_marks_audit
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_marks
FOR EACH ROW EXECUTE FUNCTION public.attendance_write_audit_log();

ALTER TABLE public.attendance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_teacher_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_profiles_read ON public.attendance_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (public.attendance_is_admin()
  AND institution_id = public.attendance_current_institution()));

CREATE POLICY attendance_settings_read ON public.attendance_settings
FOR SELECT TO authenticated
USING (institution_id = public.attendance_current_institution());
CREATE POLICY attendance_settings_admin_manage ON public.attendance_settings
FOR ALL TO authenticated
USING (public.attendance_is_admin() AND institution_id = public.attendance_current_institution())
WITH CHECK (public.attendance_is_admin() AND institution_id = public.attendance_current_institution());

CREATE POLICY attendance_students_admin_manage ON public.attendance_students
FOR ALL TO authenticated
USING (public.attendance_is_admin() AND institution_id = public.attendance_current_institution())
WITH CHECK (public.attendance_is_admin() AND institution_id = public.attendance_current_institution());
CREATE POLICY attendance_students_teacher_read ON public.attendance_students
FOR SELECT TO authenticated
USING (
  institution_id = public.attendance_current_institution()
  AND EXISTS (
    SELECT 1 FROM public.attendance_timetable t
    WHERE t.institution_id = attendance_students.institution_id
      AND t.class_name = attendance_students.class_name
      AND t.teacher_id = auth.uid()
      AND t.active
      AND t.day_of_week = public.attendance_local_day_of_week(attendance_students.institution_id)
  )
  AND attendance_students.active
);

CREATE POLICY attendance_timetable_admin_manage ON public.attendance_timetable
FOR ALL TO authenticated
USING (public.attendance_is_admin() AND institution_id = public.attendance_current_institution())
WITH CHECK (public.attendance_is_admin() AND institution_id = public.attendance_current_institution());
CREATE POLICY attendance_timetable_teacher_read ON public.attendance_timetable
FOR SELECT TO authenticated
USING (
  institution_id = public.attendance_current_institution()
  AND teacher_id = auth.uid()
  AND active
  AND day_of_week = public.attendance_local_day_of_week(institution_id)
);

CREATE POLICY attendance_sessions_admin_manage ON public.attendance_sessions
FOR ALL TO authenticated
USING (public.attendance_is_admin() AND institution_id = public.attendance_current_institution())
WITH CHECK (public.attendance_is_admin() AND institution_id = public.attendance_current_institution());
CREATE POLICY attendance_sessions_teacher_read ON public.attendance_sessions
FOR SELECT TO authenticated
USING (institution_id = public.attendance_current_institution() AND teacher_id = auth.uid());

CREATE POLICY attendance_marks_admin_manage ON public.attendance_marks
FOR ALL TO authenticated
USING (public.attendance_is_admin() AND institution_id = public.attendance_current_institution())
WITH CHECK (public.attendance_is_admin() AND institution_id = public.attendance_current_institution());
CREATE POLICY attendance_marks_teacher_read ON public.attendance_marks
FOR SELECT TO authenticated
USING (
  institution_id = public.attendance_current_institution()
  AND EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = session_id AND s.teacher_id = auth.uid()
  )
);

CREATE POLICY attendance_invites_admin_read ON public.attendance_teacher_invites
FOR SELECT TO authenticated
USING (public.attendance_is_admin() AND institution_id = public.attendance_current_institution());
CREATE POLICY attendance_audit_admin_read ON public.attendance_audit_log
FOR SELECT TO authenticated
USING (public.attendance_is_admin() AND institution_id = public.attendance_current_institution());

REVOKE INSERT, UPDATE, DELETE ON public.attendance_sessions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_marks FROM authenticated;
