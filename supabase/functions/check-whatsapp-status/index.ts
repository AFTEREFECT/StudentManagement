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

function mapHealthToStatus(data: any): "CONNECTED" | "SCANNING" | "DISCONNECTED" {
  const rawStatus = String(data?.status || data?.session?.status || "").toLowerCase();
  const rawState = String(
    data?.clientState || data?.state || data?.session?.clientState || ""
  ).toLowerCase();

  if (
    data?.connected === true ||
    data?.isConnected === true ||
    data?.healthy === true ||
    rawStatus === "ready" ||
    rawStatus === "connected" ||
    rawState === "connected"
  ) {
    return "CONNECTED";
  }

  if (
    rawStatus === "qr_received" ||
    rawStatus === "authenticated" ||
    rawStatus === "pairing" ||
    rawStatus === "connecting" ||
    rawState === "opening" ||
    rawState === "pairing"
  ) {
    return "SCANNING";
  }

  return "DISCONNECTED";
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
      return jsonResponse({ success: false, error: "institutionId required" }, 400);
    }

    const upstreamRes = await fetch(
      `${WAAPI_BASE_URL}/api/sessions/${encodeURIComponent(institutionId)}/health`,
      {
        method: "GET",
        headers: {
          "x-api-key": WAAPI_KEY,
        },
      }
    );

    const upstreamText = await upstreamRes.text().catch(() => "");
    let data: any = {};
    try {
      data = upstreamText ? JSON.parse(upstreamText) : {};
    } catch {
      data = { raw: upstreamText };
    }

    if (!upstreamRes.ok) {
      return jsonResponse({
        success: true,
        status: "DISCONNECTED",
        instanceName: institutionId,
        phoneNumber: null,
        qr: null,
        source: "waapi_health_http_error",
        upstreamStatus: upstreamRes.status,
        raw: data,
      });
    }

    const status = mapHealthToStatus(data);
    const instanceName = String(
      data?.id || data?.session?.id || institutionId
    );

    const phoneNumber =
      data?.phone ||
      data?.phoneNumber ||
      data?.session?.phone ||
      data?.session?.phoneNumber ||
      null;

    await supabaseAdmin
      .from("institutions")
      .update({
        whatsapp_session_id: instanceName,
        whatsapp_session_status: status,
        whatsapp_phone_number: phoneNumber,
        whatsapp_last_checked: new Date().toISOString(),
      })
      .eq("id", institutionId);

    return jsonResponse({
      success: true,
      status,
      instanceName,
      phoneNumber,
      qr: null,
      source: "waapi.progtalamid.com/health",
      raw: data,
    });
  } catch (error) {
    return jsonResponse({
      success: true,
      status: "DISCONNECTED",
      instanceName: null,
      phoneNumber: null,
      qr: null,
      source: "function_catch",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});