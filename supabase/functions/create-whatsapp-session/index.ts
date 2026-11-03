import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WAAPI_BASE_URL = "https://waapi.progtalamid.com";
const WAAPI_KEY = "my-secret-key";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractQr(data: any): string | null {
  return (
    data?.qr ||
    data?.qrcode ||
    data?.qrCode ||
    data?.result?.qr ||
    data?.result?.qrcode ||
    data?.result?.qrCode ||
    null
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const institutionId = String(body?.institutionId || body?.id || "").trim();

    if (!institutionId) {
      return jsonResponse(
        {
          success: false,
          error: "institutionId is required",
        },
        400,
      );
    }

    const sessionId = institutionId;

    const commonHeaders = {
      "Content-Type": "application/json",
      "x-api-key": WAAPI_KEY,
    };

    const createRes = await fetch(`${WAAPI_BASE_URL}/api/sessions`, {
      method: "POST",
      headers: commonHeaders,
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
      await supabaseAdmin
        .from("institutions")
        .update({
          whatsapp_session_status: "DISCONNECTED",
          whatsapp_session_id: null,
          whatsapp_phone_number: null,
          whatsapp_last_checked: new Date().toISOString(),
        })
        .eq("id", institutionId);

      return jsonResponse(
        {
          success: false,
          error: createData?.error || createData?.message || "Failed to create session",
          details: createData,
          upstreamStatus: createRes.status,
          institutionId,
          sessionId,
        },
        createRes.status || 400,
      );
    }

    // waapi أثبت عندك أن GET /api/sessions يعيد لائحة sessions
    const listRes = await fetch(`${WAAPI_BASE_URL}/api/sessions`, {
      method: "GET",
      headers: {
        "x-api-key": WAAPI_KEY,
      },
    });

    const listText = await listRes.text().catch(() => "");
    let listData: any = [];
    try {
      listData = listText ? JSON.parse(listText) : [];
    } catch {
      listData = [];
    }

    const session = Array.isArray(listData)
      ? listData.find((s: any) => String(s?.id || "") === sessionId)
      : null;

    const qr = extractQr(session);
    const phoneNumber =
      session?.phone ||
      session?.phoneNumber ||
      null;

    const status =
      String(session?.status || "").toUpperCase() === "CONNECTED"
        ? "CONNECTED"
        : "SCANNING";

    await supabaseAdmin
      .from("institutions")
      .update({
        whatsapp_session_id: sessionId,
        whatsapp_session_status: status,
        whatsapp_phone_number: phoneNumber,
        whatsapp_last_checked: new Date().toISOString(),
      })
      .eq("id", institutionId);

    return jsonResponse({
      success: true,
      institutionId,
      sessionId,
      instanceName: sessionId,
      status,
      qr,
      phoneNumber,
      createResult: createData,
      sessionsResult: listData,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});