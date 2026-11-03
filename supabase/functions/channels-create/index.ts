import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNELS_HEALTH_URL = "https://channels.progtalamid.com/health";
const CHANNELS_CREATE_URL = "https://channels.progtalamid.com/channel/create";

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
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return data;
}

function extractChannelId(data: any): string | null {
  const value =
    data?.channelId ||
    data?.id ||
    data?.jid ||
    data?.result?.channelId ||
    data?.result?.id ||
    data?.result?.jid ||
    data?.result?.nid?.user ||
    data?.result?.nid?._serialized ||
    data?.result?.result?.nid?.user ||
    data?.result?.result?.nid?._serialized ||
    data?.channel?.id ||
    data?.channel?.jid ||
    null;

  if (!value) return null;
  return String(value).replace(/@newsletter$/, "").trim() || null;
}

function extractInviteLink(data: any): string | null {
  return (
    data?.inviteLink ||
    data?.link ||
    data?.result?.inviteLink ||
    data?.result?.link ||
    data?.result?.result?.inviteLink ||
    data?.result?.result?.link ||
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
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim();

    if (!title) {
      return jsonResponse({ success: false, error: "title is required" }, 400);
    }

    const healthRes = await fetch(CHANNELS_HEALTH_URL, { method: "GET" });
    const healthData = await safeJson(healthRes);

    if (!healthRes.ok || !healthData?.ready) {
      return jsonResponse(
        {
          success: false,
          error: "طبقة الشنلات غير جاهزة",
          health: healthData,
        },
        400
      );
    }

    const upstreamRes = await fetch(CHANNELS_CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
      }),
    });

    const data = await safeJson(upstreamRes);
    const channelId = extractChannelId(data);
    const inviteLink = extractInviteLink(data);

    if (!upstreamRes.ok) {
      return jsonResponse(
        {
          success: false,
          error:
            data?.error?.error ||
            data?.error ||
            data?.message ||
            "فشل إنشاء الشانل من الخادم",
          upstreamStatus: upstreamRes.status,
          details: data,
        },
        upstreamRes.status || 400
      );
    }

    if (!channelId) {
      return jsonResponse(
        {
          success: false,
          error: "لم يتم العثور على channelId في الرد",
          upstreamStatus: upstreamRes.status,
          details: data,
        },
        400
      );
    }

    return jsonResponse({
      success: true,
      channelId,
      jid: `${channelId}@newsletter`,
      inviteLink,
      details: data,
    });
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