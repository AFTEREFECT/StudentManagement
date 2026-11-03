-- Administrators can issue a new single-use activation code without replacing the account.
CREATE OR REPLACE FUNCTION public.reissue_attendance_teacher_invite(p_teacher_id uuid)
RETURNS TABLE (teacher_id uuid, username text, activation_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_institution_id uuid := public.attendance_current_institution();
  v_name text;
  v_username text;
  v_code text := upper(encode(gen_random_bytes(8), 'hex'));
BEGIN
  IF NOT public.attendance_is_admin() THEN
    RAISE EXCEPTION 'Only institution administrators can reissue teacher invitations';
  END IF;

  SELECT d.display_name, d.username INTO v_name, v_username
  FROM public.attendance_teacher_directory d
  WHERE d.institution_id = v_institution_id AND d.teacher_id = p_teacher_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Teacher not found in this institution';
  END IF;

  SELECT COALESCE(i.username, v_username) INTO v_username
  FROM public.attendance_teacher_invites i
  WHERE i.institution_id = v_institution_id AND i.teacher_id = p_teacher_id;
  IF v_username IS NULL THEN
    SELECT d.username INTO v_username FROM public.attendance_teacher_directory d
    WHERE d.institution_id = v_institution_id AND d.teacher_id = p_teacher_id;
  END IF;
  v_username := COALESCE(v_username, 'teacher-' || encode(gen_random_bytes(6), 'hex'));

  INSERT INTO public.attendance_teacher_invites (
    institution_id, teacher_id, username, display_name, code_hash, expires_at, claimed_at
  ) VALUES (
    v_institution_id, p_teacher_id, v_username, v_name,
    encode(digest(v_code, 'sha256'), 'hex'), now() + interval '7 days', NULL
  )
  ON CONFLICT ON CONSTRAINT attendance_teacher_invites_institution_teacher_id_key DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    claimed_at = NULL;

  UPDATE public.attendance_teacher_directory d
  SET username = v_username, updated_at = now()
  WHERE d.institution_id = v_institution_id AND d.teacher_id = p_teacher_id;

  RETURN QUERY SELECT p_teacher_id, v_username, v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.reissue_attendance_teacher_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reissue_attendance_teacher_invite(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
