import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeAttendanceUsername } from "../_shared/attendanceIdentity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "بيانات التفعيل غير صالحة" }, { status: 400, headers: corsHeaders });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "بيانات التفعيل غير صالحة" }, { status: 400, headers: corsHeaders });
    }
    const { username, activationCode, password } = body as Record<string, unknown>;
    const cleanUsername = normalizeAttendanceUsername(typeof username === "string" ? username : "");
    const cleanCode = (typeof activationCode === "string" ? activationCode : "").replace(/\s+/g, "").toUpperCase();
    const cleanPassword = typeof password === "string" ? password : "";
    const validUsername = /^prof-[0-9]{4}[a-z]$/.test(cleanUsername) || /^teacher-[a-f0-9]{12}$/.test(cleanUsername);
    if (!validUsername || !/^[0-9]{6}$/.test(cleanCode)) {
      return Response.json({ error: "اسم المستخدم أو رمز التفعيل غير صالح" }, { status: 400, headers: corsHeaders });
    }
    if (!/^[0-9]{4,}$/.test(cleanPassword)) {
      return Response.json({ error: "يجب أن تتكون كلمة المرور السرية من 4 أرقام على الأقل" }, { status: 400, headers: corsHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Attendance activation is not configured on the server");
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const codeHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cleanCode));
    const codeHash = Array.from(new Uint8Array(codeHashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { data: invite, error: inviteError } = await admin.from("attendance_teacher_invites")
      .select("id, institution_id, teacher_id, display_name, activation_code").eq("username", cleanUsername)
      .eq("code_hash", codeHash).is("claimed_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) return Response.json({ error: "رمز التفعيل غير صحيح أو منتهي الصلاحية أو سبق استعماله" }, { status: 400, headers: corsHeaders });

    // Claim the exact code before creating an account or changing a password.
    const { data: claimed, error: claimError } = await admin.from("attendance_teacher_invites")
      .update({ claimed_at: new Date().toISOString(), activation_code: null }).eq("id", invite.id).eq("code_hash", codeHash)
      .is("claimed_at", null).gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) {
      return Response.json({ error: "انتهت صلاحية هذا الرمز أو استُبدل برمز أحدث. اطلب من الإدارة إصدار رمز جديد." }, { status: 409, headers: corsHeaders });
    }

    let createdUserId: string | null = null;
    try {
      const { data: profile, error: profileReadError } = await admin.from("attendance_profiles")
        .select("user_id").eq("institution_id", invite.institution_id).eq("teacher_id", invite.teacher_id)
        .eq("role", "teacher").maybeSingle();
      if (profileReadError) throw profileReadError;
      let email = `${cleanUsername}@attendance.progtalamid.invalid`;
      if (profile) {
        const { data, error } = await admin.auth.admin.getUserById(profile.user_id);
        if (error || !data.user?.email) throw error ?? new Error("Teacher auth account is missing");
        email = data.user.email;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email, password: cleanPassword, email_confirm: true,
          user_metadata: { attendance_username: cleanUsername },
        });
        if (error || !data.user) throw error ?? new Error("Could not create teacher account");
        createdUserId = data.user.id;
        const { error: profileError } = await admin.from("attendance_profiles").insert({
          user_id: createdUserId, institution_id: invite.institution_id, teacher_id: invite.teacher_id,
          role: "teacher", display_name: invite.display_name,
        });
        if (profileError) throw profileError;
      }
      const { error: directoryError } = await admin.from("attendance_teacher_directory").upsert({
        institution_id: invite.institution_id, teacher_id: invite.teacher_id,
        display_name: invite.display_name, username: cleanUsername, activated_at: new Date().toISOString(),
      }, { onConflict: "institution_id,teacher_id" });
      if (directoryError) throw directoryError;
      if (profile) {
        // Keep the same auth ID, timetable links, and historical attendance.
        const { error } = await admin.auth.admin.updateUserById(profile.user_id, {
          email, password: cleanPassword, email_confirm: true,
        });
        if (error) throw error;
      }
      return Response.json({ success: true, username: cleanUsername, email }, { status: 200, headers: corsHeaders });
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      if (createdUserId) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(createdUserId);
        if (deleteError) cleanupErrors.push(deleteError);
      }
      const { error: inviteResetError } = await admin.from("attendance_teacher_invites")
        .update({ claimed_at: null, activation_code: invite.activation_code })
        .eq("id", invite.id).eq("code_hash", codeHash);
      if (inviteResetError) cleanupErrors.push(inviteResetError);
      if (cleanupErrors.length) {
        console.error("Teacher invitation rollback was incomplete:", { cleanupErrors });
      }
      throw error;
    }
  } catch (error) {
    console.error("Teacher invitation redemption failed:", error);
    return Response.json({ error: "تعذر تفعيل الحساب. أعد المحاولة أو اطلب رمزًا جديدًا من الإدارة." }, { status: 500, headers: corsHeaders });
  }
});
