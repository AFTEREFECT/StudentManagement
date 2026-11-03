import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNELS_HEALTH_URL = "https://channels.progtalamid.com/health";
const CHANNELS_QR_URL = "https://channels.progtalamid.com/qr";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function safeJson(url: string) {
  const res = await fetch(url, { method: "GET" });
  const text = await res.text().catch(() => "");
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const [healthRes, qrRes] = await Promise.all([
      safeJson(CHANNELS_HEALTH_URL),
      safeJson(CHANNELS_QR_URL),
    ]);

    const health = healthRes.data || {};
    const qrData = qrRes.data || {};

    const qr =
      qrData?.qr ||
      qrData?.data?.qr ||
      qrData?.result?.qr ||
      null;

    return jsonResponse({
      success: true,
      ready: !!health?.ready,
      authenticated: !!health?.authenticated,
      waState: health?.waState || null,
      clientState: health?.clientState || null,
      hasQr: !!qr,
      qr,
      lastError: health?.lastError || null,
      raw: {
        health,
        qr: qrData,
      },
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      ready: false,
      authenticated: false,
      waState: null,
      clientState: null,
      hasQr: false,
      qr: null,
      lastError: error instanceof Error ? error.message : String(error),
    });
  }
});