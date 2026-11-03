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
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, ok: false, error: "Method Not Allowed" },
      405
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const channelId = String(body?.channelId || "").trim();
    const text = String(body?.text || "").trim();
    const media = body?.media && typeof body.media === "object" ? body.media : null;

    if (!channelId) {
      return jsonResponse(
        { success: false, ok: false, error: "channelId مطلوب" },
        400
      );
    }

    if (!media) {
      return jsonResponse(
        { success: false, ok: false, error: "media مطلوب" },
        400
      );
    }

    const rawDataUrl = String(media?.dataUrl || media?.data || "").trim();
    const base64Data = rawDataUrl.includes(",")
      ? rawDataUrl.split(",")[1]
      : rawDataUrl;

    if (!base64Data) {
      return jsonResponse(
        { success: false, ok: false, error: "media.data أو media.dataUrl مطلوب" },
        400
      );
    }

    const upstreamRes = await fetch("https://channels.progtalamid.com/channel/send-media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId,
        message: text,
        media: {
          mimetype: String(media?.mimeType || media?.mimetype || "").trim(),
          filename: String(media?.fileName || media?.filename || "file").trim(),
          data: base64Data,
          caption: String(media?.caption || text || "").trim(),
        },
      }),
    });

    const upstreamData = await safeJson(upstreamRes);

    return jsonResponse(
      {
        success: upstreamRes.ok,
        ok: upstreamRes.ok,
        upstreamStatus: upstreamRes.status,
        upstreamResponse: upstreamData,
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