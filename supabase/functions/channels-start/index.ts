import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const upstreamRes = await fetch("https://wa.progtalamid.com/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const upstreamText = await upstreamRes.text().catch(() => "");
    let data: any = {};
    try {
      data = upstreamText ? JSON.parse(upstreamText) : {};
    } catch {
      data = { raw: upstreamText };
    }

    return jsonResponse(
      {
        success: upstreamRes.ok,
        ok: upstreamRes.ok,
        ...data,
      },
      upstreamRes.ok ? 200 : upstreamRes.status || 500
    );
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});