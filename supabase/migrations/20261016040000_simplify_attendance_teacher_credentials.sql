ALTER TABLE public.attendance_teacher_invites
  ADD COLUMN IF NOT EXISTS activation_code text;

ALTER TABLE public.attendance_teacher_invites
  DROP CONSTRAINT IF EXISTS attendance_teacher_invites_activation_code_format;
ALTER TABLE public.attendance_teacher_invites
  ADD CONSTRAINT attendance_teacher_invites_activation_code_format
  CHECK (activation_code IS NULL OR activation_code ~ '^[0-9]{6}$');

CREATE OR REPLACE FUNCTION public.attendance_generate_teacher_username()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_digits text := '';
  v_byte integer;
  v_index integer;
BEGIN
  FOR v_index IN 1..4 LOOP
    LOOP
      v_byte := get_byte(gen_random_bytes(1), 0);
      EXIT WHEN v_byte < 250;
    END LOOP;
    v_digits := v_digits || (v_byte % 10)::text;
  END LOOP;

  LOOP
    v_byte := get_byte(gen_random_bytes(1), 0);
    EXIT WHEN v_byte < 234;
  END LOOP;

  RETURN 'prof-' || v_digits || chr(97 + (v_byte % 26));
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_generate_teacher_activation_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_bytes bytea;
  v_value bigint;
BEGIN
  LOOP
    v_bytes := gen_random_bytes(4);
    v_value :=
      get_byte(v_bytes, 0)::bigint * 16777216 +
      get_byte(v_bytes, 1)::bigint * 65536 +
      get_byte(v_bytes, 2)::bigint * 256 +
      get_byte(v_bytes, 3)::bigint;
    IF v_value < 4294000000 THEN
      RETURN lpad((v_value % 1000000)::text, 6, '0');
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_generate_teacher_username() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_generate_teacher_activation_code() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_invite record;
  v_code text;
  v_username text;
  v_attempt integer;
BEGIN
  FOR v_invite IN
    SELECT i.id, i.institution_id, i.teacher_id, i.username
    FROM public.attendance_teacher_invites i
    WHERE i.claimed_at IS NULL
    ORDER BY i.created_at, i.id
  LOOP
    v_code := public.attendance_generate_teacher_activation_code();
    v_username := v_invite.username;

    IF v_username IS NULL OR v_username !~ '^prof-[0-9]{4}[a-z]$'
      OR EXISTS (
        SELECT 1 FROM public.attendance_teacher_invites other
        WHERE other.username = v_username AND other.id <> v_invite.id
      )
    THEN
      v_username := NULL;
      FOR v_attempt IN 1..100 LOOP
        v_username := public.attendance_generate_teacher_username();
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.attendance_teacher_invites other
          WHERE other.username = v_username AND other.id <> v_invite.id
        );
        v_username := NULL;
      END LOOP;
      IF v_username IS NULL THEN
        RAISE EXCEPTION 'Could not generate a unique attendance teacher username';
      END IF;
    END IF;

    UPDATE public.attendance_teacher_invites
    SET username = v_username,
        code_hash = encode(digest(v_code, 'sha256'), 'hex'),
        activation_code = v_code,
        expires_at = now() + interval '7 days'
    WHERE id = v_invite.id;

    UPDATE public.attendance_teacher_directory
    SET username = v_username, updated_at = now()
    WHERE institution_id = v_invite.institution_id AND teacher_id = v_invite.teacher_id;
  END LOOP;
END;
$$;

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
  v_code text := public.attendance_generate_teacher_activation_code();
  v_activated boolean;
  v_attempt integer;
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
  v_username := COALESCE(v_invite_username, v_username);
  IF v_username IS NULL OR v_username !~ '^prof-[0-9]{4}[a-z]$'
    OR EXISTS (
      SELECT 1 FROM public.attendance_teacher_invites i
      WHERE i.username = v_username AND i.teacher_id <> p_teacher_id
    )
  THEN
    v_username := NULL;
    FOR v_attempt IN 1..100 LOOP
      v_username := public.attendance_generate_teacher_username();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.attendance_teacher_invites i
        WHERE i.username = v_username AND i.teacher_id <> p_teacher_id
      );
      v_username := NULL;
    END LOOP;
    IF v_username IS NULL THEN
      RAISE EXCEPTION 'Could not generate a unique attendance teacher username';
    END IF;
  END IF;

  INSERT INTO public.attendance_teacher_invites (
    institution_id, teacher_id, username, display_name, code_hash, activation_code, expires_at, claimed_at
  )
  VALUES (
    v_institution_id, p_teacher_id, v_username, trim(p_display_name),
    encode(digest(v_code, 'sha256'), 'hex'), v_code, now() + interval '7 days', NULL
  )
  ON CONFLICT ON CONSTRAINT attendance_teacher_invites_institution_teacher_id_key DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    code_hash = EXCLUDED.code_hash,
    activation_code = EXCLUDED.activation_code,
    expires_at = EXCLUDED.expires_at,
    claimed_at = NULL;

  UPDATE public.attendance_teacher_directory d
  SET display_name = trim(p_display_name), username = v_username, updated_at = now()
  WHERE d.institution_id = v_institution_id AND d.teacher_id = p_teacher_id;

  RETURN QUERY SELECT p_teacher_id, v_username, v_code;
END;
$$;

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
  v_code text := public.attendance_generate_teacher_activation_code();
  v_attempt integer;
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

  SELECT i.username INTO v_username
  FROM public.attendance_teacher_invites i
  WHERE i.institution_id = v_institution_id AND i.teacher_id = p_teacher_id;

  IF v_username IS NULL OR v_username !~ '^prof-[0-9]{4}[a-z]$'
    OR EXISTS (
      SELECT 1 FROM public.attendance_teacher_invites i
      WHERE i.username = v_username AND i.teacher_id <> p_teacher_id
    )
  THEN
    v_username := NULL;
    FOR v_attempt IN 1..100 LOOP
      v_username := public.attendance_generate_teacher_username();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.attendance_teacher_invites i
        WHERE i.username = v_username AND i.teacher_id <> p_teacher_id
      );
      v_username := NULL;
    END LOOP;
    IF v_username IS NULL THEN
      RAISE EXCEPTION 'Could not generate a unique attendance teacher username';
    END IF;
  END IF;

  INSERT INTO public.attendance_teacher_invites (
    institution_id, teacher_id, username, display_name, code_hash, activation_code, expires_at, claimed_at
  ) VALUES (
    v_institution_id, p_teacher_id, v_username, v_name,
    encode(digest(v_code, 'sha256'), 'hex'), v_code, now() + interval '7 days', NULL
  )
  ON CONFLICT ON CONSTRAINT attendance_teacher_invites_institution_teacher_id_key DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    code_hash = EXCLUDED.code_hash,
    activation_code = EXCLUDED.activation_code,
    expires_at = EXCLUDED.expires_at,
    claimed_at = NULL;

  UPDATE public.attendance_teacher_directory d
  SET username = v_username, updated_at = now()
  WHERE d.institution_id = v_institution_id AND d.teacher_id = p_teacher_id;

  RETURN QUERY SELECT p_teacher_id, v_username, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_attendance_teacher_invite(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_attendance_teacher_invite(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.reissue_attendance_teacher_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reissue_attendance_teacher_invite(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
