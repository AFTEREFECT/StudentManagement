import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNELS_PUBLISH_URL = "https://channels.progtalamid.com/channel/send";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function safeJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
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

    const channelId = String(body?.channelId || "").trim();
    const text = String(body?.text || "").trim();
    const media = body?.media && typeof body.media === "object" ? body.media : null;

    if (!channelId) {
      return jsonResponse({ success: false, error: "channelId مطلوب" }, 400);
    }

    if (!text && !media) {
      return jsonResponse({ success: false, error: "text أو media مطلوب" }, 400);
    }

    const upstreamBody = {
      channelId,
      message: text,
      media: media
        ? {
            fileName: String(media?.fileName || "").trim(),
            mimeType: String(media?.mimeType || "").trim(),
            dataUrl: String(media?.dataUrl || "").trim(),
            caption: String(media?.caption || text || "").trim(),
          }
        : null,
    };

    const upstreamRes = await fetch(CHANNELS_PUBLISH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
    });

    const data = await safeJson(upstreamRes);

    return jsonResponse(
      {
        success: upstreamRes.ok,
        ok: upstreamRes.ok,
        upstreamStatus: upstreamRes.status,
        upstreamBodySent: upstreamBody,
        upstreamResponse: data,
      },
      upstreamRes.ok ? 200 : upstreamRes.status || 500
    );
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});