-- Timetables belong to imported teachers, including those without login invites.
-- Named constraints avoid conflicts with the function's RETURNS TABLE variables.
INSERT INTO public.attendance_teacher_directory (
  institution_id, teacher_id, display_name, username, activated_at
)
SELECT i.institution_id, i.teacher_id, i.display_name, i.username, p.created_at
FROM public.attendance_teacher_invites i
LEFT JOIN public.attendance_profiles p
  ON p.institution_id = i.institution_id AND p.teacher_id = i.teacher_id
ON CONFLICT ON CONSTRAINT attendance_teacher_directory_pkey DO UPDATE SET
  username = COALESCE(public.attendance_teacher_directory.username, EXCLUDED.username),
  activated_at = COALESCE(public.attendance_teacher_directory.activated_at, EXCLUDED.activated_at),
  updated_at = now();

INSERT INTO public.attendance_teacher_directory (
  institution_id, teacher_id, display_name, activated_at
)
SELECT p.institution_id, p.teacher_id, p.display_name, p.created_at
FROM public.attendance_profiles p
WHERE p.role = 'teacher' AND p.teacher_id IS NOT NULL
ON CONFLICT ON CONSTRAINT attendance_teacher_directory_pkey DO UPDATE SET
  activated_at = COALESCE(public.attendance_teacher_directory.activated_at, EXCLUDED.activated_at),
  updated_at = now();

ALTER TABLE public.attendance_timetable
  DROP CONSTRAINT IF EXISTS attendance_timetable_institution_id_teacher_id_fkey,
  DROP CONSTRAINT IF EXISTS attendance_timetable_institution_teacher_invite_fkey,
  DROP CONSTRAINT IF EXISTS attendance_timetable_institution_teacher_directory_fkey;
ALTER TABLE public.attendance_timetable
  ADD CONSTRAINT attendance_timetable_institution_teacher_directory_fkey
  FOREIGN KEY (institution_id, teacher_id)
  REFERENCES public.attendance_teacher_directory(institution_id, teacher_id)
  ON DELETE RESTRICT;

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
  v_invite_username text;
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
  ON CONFLICT ON CONSTRAINT attendance_teacher_directory_pkey DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = now();

  SELECT d.activated_at IS NOT NULL, d.username
    INTO v_activated, v_username
  FROM public.attendance_teacher_directory d
  WHERE d.institution_id = v_institution_id AND d.teacher_id = p_teacher_id
  FOR UPDATE;

  IF v_activated OR EXISTS (
    SELECT 1 FROM public.attendance_profiles p
    WHERE p.institution_id = v_institution_id AND p.teacher_id = p_teacher_id
      AND p.role = 'teacher'
  ) OR EXISTS (
    SELECT 1 FROM public.attendance_teacher_invites i
    WHERE i.institution_id = v_institution_id AND i.teacher_id = p_teacher_id
      AND i.claimed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Teacher account is already activated';
  END IF;

  SELECT i.username INTO v_invite_username
  FROM public.attendance_teacher_invites i
  WHERE i.institution_id = v_institution_id AND i.teacher_id = p_teacher_id;
  v_username := COALESCE(v_invite_username, v_username, 'teacher-' || encode(gen_random_bytes(6), 'hex'));

  INSERT INTO public.attendance_teacher_invites (
    institution_id, teacher_id, username, display_name, code_hash, expires_at, claimed_at
  )
  VALUES (
    v_institution_id, p_teacher_id, v_username, trim(p_display_name),
    encode(digest(v_code, 'sha256'), 'hex'), now() + interval '7 days', NULL
  )
  ON CONFLICT ON CONSTRAINT attendance_teacher_invites_institution_teacher_id_key DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    claimed_at = NULL;

  UPDATE public.attendance_teacher_directory d
  SET display_name = trim(p_display_name), username = v_username, updated_at = now()
  WHERE d.institution_id = v_institution_id AND d.teacher_id = p_teacher_id;

  RETURN QUERY SELECT p_teacher_id, v_username, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_attendance_teacher_invite(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_attendance_teacher_invite(uuid, text) TO authenticated;
