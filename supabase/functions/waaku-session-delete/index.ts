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
      `${WAAPI_BASE_URL}/api/sessions/${encodeURIComponent(institutionId)}`,
      {
        method: "DELETE",
        headers: {
          "x-api-key": WAAPI_KEY,
        },
      }
    );

    const upstreamText = await upstreamRes.text().catch(() => "");
    let upstreamData: any = {};
    try {
      upstreamData = upstreamText ? JSON.parse(upstreamText) : {};
    } catch {
      upstreamData = { raw: upstreamText };
    }

    const notFound =
      upstreamRes.status === 404 ||
      String(upstreamData?.error || "").toLowerCase().includes("session not found");

    if (!upstreamRes.ok && !notFound) {
      return jsonResponse(
        {
          success: false,
          error: upstreamData?.error || "Delete failed",
          details: upstreamData,
          upstreamStatus: upstreamRes.status,
        },
        upstreamRes.status || 400,
      );
    }

    await supabaseAdmin
      .from("institutions")
      .update({
        whatsapp_session_id: null,
        whatsapp_session_status: "DISCONNECTED",
        whatsapp_phone_number: null,
        whatsapp_last_checked: new Date().toISOString(),
      })
      .eq("id", institutionId);

    return jsonResponse({
      success: true,
      sessionId: institutionId,
      upstreamStatus: upstreamRes.status,
      details: upstreamData,
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