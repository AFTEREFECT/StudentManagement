import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_ATTEMPTS = 5;
let failedAttempts = 0;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ valid: false, message: "Method Not Allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { password } = await req.json();

    const correctPassword = Deno.env.get("DEVELOPER_PASSWORD");

    if (!correctPassword) {
      return new Response(
        JSON.stringify({ valid: false, message: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ valid: false, message: "كلمة المرور مطلوبة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (failedAttempts >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ valid: false, message: "Too many failed attempts" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isValid = password === correctPassword;

    if (!isValid) {
      failedAttempts++;
      console.log(`Developer password verification: FAILED (${failedAttempts})`);
      return new Response(
        JSON.stringify({ valid: false, message: "كلمة المرور غير صحيحة" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    failedAttempts = 0;

    const sessionToken = crypto.randomUUID();

    console.log("Developer password verification: SUCCESS");

    return new Response(
      JSON.stringify({
        valid: true,
        message: "تم التحقق بنجاح",
        sessionToken: sessionToken,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in verify-developer-password:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        message: "خطأ في الخادم",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});