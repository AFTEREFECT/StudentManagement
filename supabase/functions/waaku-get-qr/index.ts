import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const sessionId = String(
      body?.instanceName || body?.sessionId || body?.institutionId || body?.id || ""
    ).trim();

    if (!sessionId) {
      return jsonResponse({ success: false, qr: null, error: "sessionId required" }, 400);
    }

    const response = await fetch(
      `${WAAPI_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/qr`,
      {
        method: "GET",
        headers: {
          "x-api-key": WAAPI_KEY,
        },
      }
    );

    const text = await response.text().catch(() => "");
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return jsonResponse(
        {
          success: false,
          qr: null,
          error: data?.error || "QR request failed",
          upstreamStatus: response.status,
          details: data,
        },
        response.status || 400,
      );
    }

    return jsonResponse({
      success: true,
      qr: data?.qr || null,
      source: "waapi.progtalamid.com",
    });
  } catch (e) {
    return jsonResponse(
      {
        success: false,
        qr: null,
        error: e instanceof Error ? e.message : String(e),
      },
      500,
    );
  }
});