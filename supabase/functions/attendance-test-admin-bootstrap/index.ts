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
  if (Deno.env.get("ATTENDANCE_ENABLE_TEST_ADMIN") !== "true") {
    return Response.json({ error: "إنشاء حساب الإدارة التجريبي غير مفعّل على هذا الخادم." }, { status: 403, headers: corsHeaders });
  }

  let claimed = false;
  let createdUserId = "";
  let institutionId = "";

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.displayName ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !displayName || displayName.length > 120) {
      return Response.json({ error: "أدخل بريدًا إلكترونيًا واسمًا صحيحين." }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Test administrator bootstrap is not configured on the server");
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: claimError } = await admin
      .from("attendance_admin_bootstrap")
      .insert({ id: true });
    if (claimError?.code === "23505") {
      return Response.json({ error: "تم إنشاء حساب الإدارة الأول مسبقًا؛ لا يمكن إعادة تهيئة حساب التجربة." }, { status: 409, headers: corsHeaders });
    }
    if (claimError) throw claimError;
    claimed = true;

    const { count, error: profileError } = await admin
      .from("attendance_profiles")
      .select("user_id", { count: "exact", head: true });
    if (profileError) throw profileError;
    if ((count ?? 0) > 0) {
      const { error: releaseError } = await admin
        .from("attendance_admin_bootstrap")
        .delete()
        .eq("id", true);
      if (releaseError) throw releaseError;
      claimed = false;
      return Response.json({ error: "توجد حسابات بوابة مسبقًا؛ لا يمكن إنشاء مدير تجريبي." }, { status: 409, headers: corsHeaders });
    }

    institutionId = crypto.randomUUID();
    const userOptions = {
      password: "123456",
      email_confirm: true,
      user_metadata: { attendance_test_admin: true, must_change_password: true },
    };
    let accountEmail = email;
    let { data: created, error: createError } = await admin.auth.admin.createUser({
      ...userOptions,
      email: accountEmail,
    });
    const emailAlreadyRegistered = (error: typeof createError) =>
      Boolean(error && (
        error.code === "email_exists" ||
        /already (been )?registered|email.{0,20}(already )?exists/i.test(error.message)
      ));

    if (emailAlreadyRegistered(createError)) {
      const [localPart, domain] = email.split("@");
      accountEmail = `${localPart}+attendance-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}@${domain}`;
      const retry = await admin.auth.admin.createUser({ ...userOptions, email: accountEmail });
      created = retry.data;
      createError = retry.error;
    }
    if (createError || !created.user) throw createError ?? new Error("Could not create the test administrator");
    createdUserId = created.user.id;

    const { error: insertProfileError } = await admin.from("attendance_profiles").insert({
      user_id: createdUserId,
      institution_id: institutionId,
      role: "admin",
      display_name: displayName,
      must_change_password: true,
    });
    if (insertProfileError) throw insertProfileError;

    const { error: settingsError } = await admin.from("attendance_settings").insert({
      institution_id: institutionId,
    });
    if (settingsError) throw settingsError;

    const { error: completeError } = await admin
      .from("attendance_admin_bootstrap")
      .update({ user_id: createdUserId, completed_at: new Date().toISOString() })
      .eq("id", true);
    if (completeError) throw completeError;

    return Response.json({ success: true, email: accountEmail }, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error("Test administrator bootstrap failed:", error);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      let rollbackFailed = false;
      if (institutionId) {
        const { error } = await admin.from("attendance_settings").delete().eq("institution_id", institutionId);
        if (error) {
          rollbackFailed = true;
          console.error("Could not roll back test administrator settings:", error);
        }
      }
      if (createdUserId) {
        const { error } = await admin.auth.admin.deleteUser(createdUserId);
        if (error) {
          rollbackFailed = true;
          console.error("Could not roll back test administrator auth user:", error);
        }
      }
      if (claimed && !rollbackFailed) {
        const { error } = await admin.from("attendance_admin_bootstrap").delete().eq("id", true);
        if (error) console.error("Could not release test administrator bootstrap claim:", error);
      }
    }
    return Response.json({ error: "تعذر إنشاء حساب الإدارة التجريبي. تحقق من إعدادات الخادم وحاول مجددًا." }, { status: 500, headers: corsHeaders });
  }
});
