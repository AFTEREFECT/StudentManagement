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

function normalizePhone(input: string) {
  let p = String(input || "").replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("212")) p = "212" + p;
  return p;
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
    const to = String(body?.to || "").trim();
    const message = String(body?.message || "").trim();

    if (!institutionId || !to || !message) {
      return jsonResponse(
        { success: false, error: "institutionId, to, message are required" },
        400,
      );
    }

    const chatId = `${normalizePhone(to)}@c.us`;

    const upstreamRes = await fetch(
      `${WAAPI_BASE_URL}/api/sessions/${encodeURIComponent(institutionId)}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": WAAPI_KEY,
        },
        body: JSON.stringify({
          to: chatId,
          message,
        }),
      },
    );

    const upstreamText = await upstreamRes.text().catch(() => "");
    let upstreamData: any = {};
    try {
      upstreamData = upstreamText ? JSON.parse(upstreamText) : {};
    } catch {
      upstreamData = { raw: upstreamText };
    }

    if (!upstreamRes.ok) {
      return jsonResponse(
        {
          success: false,
          error: upstreamData?.error || upstreamData?.message || "Send failed",
          details: upstreamData,
          upstreamStatus: upstreamRes.status,
        },
        upstreamRes.status || 400,
      );
    }

    return jsonResponse({
      success: true,
      message: "تم الإرسال بنجاح",
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