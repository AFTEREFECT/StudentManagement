import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    if (!accessToken || accessToken === authorization) {
      return Response.json({ error: "يجب تسجيل الدخول أولًا." }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return Response.json({ error: "أدخل بريدًا إلكترونيًا صحيحًا." }, { status: 400, headers: corsHeaders });
    }
    if (password.length < 12 || new TextEncoder().encode(password).length > 72) {
      return Response.json({ error: "يجب أن تكون كلمة المرور بين 12 و72 بايتًا." }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Test administrator password change is not configured on the server");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return Response.json({ error: "انتهت الجلسة؛ سجّل الدخول مجددًا." }, { status: 401, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("attendance_profiles")
      .select("role, must_change_password")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin" || !profile.must_change_password) {
      return Response.json({ error: "لا يوجد تغيير كلمة مرور إداري مطلوب لهذا الحساب." }, { status: 403, headers: corsHeaders });
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(authData.user.id, {
      email,
      email_confirm: true,
      password,
      user_metadata: { ...authData.user.user_metadata, attendance_test_admin: false, must_change_password: false },
    });
    if (authUpdateError) {
      if (authUpdateError.code === "email_exists") {
        return Response.json({ error: "هذا البريد مرتبط بحساب Supabase آخر. اختر بريدًا آخر لحساب بوابة الغياب." }, { status: 409, headers: corsHeaders });
      }
      throw authUpdateError;
    }

    const { error: profileUpdateError } = await admin
      .from("attendance_profiles")
      .update({ must_change_password: false })
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .eq("must_change_password", true);
    if (profileUpdateError) throw profileUpdateError;

    return Response.json({ success: true, email }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Test administrator password change failed:", error);
    return Response.json(
      { error: "تعذر تغيير كلمة المرور. يرجى إعادة المحاولة." },
      { status: 500, headers: corsHeaders },
    );
  }
});
