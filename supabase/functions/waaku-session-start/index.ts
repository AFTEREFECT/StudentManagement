import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method Not Allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const institutionId = body.id || body.institutionId;

    if (!institutionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Institution ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: institution, error } = await supabaseAdmin
      .from("institutions")
      .select("id, name, whatsapp_session_id")
      .eq("id", institutionId)
      .single();

    if (error || !institution) {
      return new Response(
        JSON.stringify({ success: false, error: "Institution not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = Deno.env.get("WAAKU_BASE_URL");
    const apiKey = Deno.env.get("WAAKU_API_KEY");
    const cfClientId = Deno.env.get("CF_ACCESS_CLIENT_ID");
    const cfClientSecret = Deno.env.get("CF_ACCESS_CLIENT_SECRET");

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing WAAKU_BASE_URL" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanBase = baseUrl.replace(/\/+$/, "");
    const sessionId = String(institution.whatsapp_session_id || institution.id);

    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cfClientId && cfClientSecret) {
      authHeaders["CF-Access-Client-Id"] = cfClientId;
      authHeaders["CF-Access-Client-Secret"] = cfClientSecret;
    } else if (apiKey) {
      authHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing Waaku authentication secrets",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const createRes = await fetch(`${cleanBase}/api/sessions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ id: sessionId }),
    });

    const createText = await createRes.text().catch(() => "");
    let createData: any = {};

    try {
      createData = createText ? JSON.parse(createText) : {};
    } catch {
      createData = { raw: createText };
    }

    if (!createRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create session",
          status: createRes.status,
          details: createData,
          sessionId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let qr: string | null = null;
    let status: "SCANNING" | "CONNECTED" | "DISCONNECTED" = "DISCONNECTED";

    const qrRes = await fetch(
      `${cleanBase}/api/sessions/${encodeURIComponent(sessionId)}/qr`,
      {
        method: "GET",
        headers: authHeaders,
      }
    );

    const qrText = await qrRes.text().catch(() => "");
    let qrData: any = {};

    try {
      qrData = qrText ? JSON.parse(qrText) : {};
    } catch {
      qrData = { raw: qrText };
    }

    qr =
      qrData?.qr ||
      qrData?.qrcode ||
      qrData?.base64 ||
      qrData?.data ||
      null;

    status = qr ? "SCANNING" : "DISCONNECTED";

    const { error: updateError } = await supabaseAdmin
      .from("institutions")
      .update({
        whatsapp_session_id: sessionId,
        whatsapp_session_status: status,
        whatsapp_phone_number: null,
        whatsapp_last_checked: new Date().toISOString(),
      })
      .eq("id", institutionId);

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to update institution session",
          details: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        status,
        qr,
        createData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});