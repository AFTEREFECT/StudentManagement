DROP POLICY IF EXISTS attendance_timetable_teacher_read ON public.attendance_timetable;
CREATE POLICY attendance_timetable_teacher_read ON public.attendance_timetable
FOR SELECT TO authenticated
USING (
  institution_id = public.attendance_current_institution()
  AND teacher_id = auth.uid()
  AND active
);

DROP POLICY IF EXISTS attendance_students_teacher_read ON public.attendance_students;
CREATE POLICY attendance_students_teacher_read ON public.attendance_students
FOR SELECT TO authenticated
USING (
  institution_id = public.attendance_current_institution()
  AND active
  AND EXISTS (
    SELECT 1 FROM public.attendance_timetable t
    WHERE t.institution_id = attendance_students.institution_id
      AND t.class_name = attendance_students.class_name
      AND t.teacher_id = auth.uid()
      AND t.active
  )
);

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
    AND t.active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson is not assigned to this teacher';
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
