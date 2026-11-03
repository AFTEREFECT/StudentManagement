import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function normalizePhone(input: string) {
  let p = (input || "").replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("212")) p = "212" + p;
  return p;
}

async function readText(res: Response) {
  try { return await res.text(); } catch { return ""; }
}

async function trySend(baseUrl: string, apiKey: string, instanceName: string, number: string, text: string) {
  const cleanBase = baseUrl.replace(/\/+$/, "");

  const candidates = [
    // الأكثر شيوعاً في Evolution
    {
      url: `${cleanBase}/message/sendText/${encodeURIComponent(instanceName)}`,
      body: { number, text },
    },
    // بعض النسخ تستعمل message بدل text
    {
      url: `${cleanBase}/message/sendText/${encodeURIComponent(instanceName)}`,
      body: { number, message: text },
    },
    // بعض النسخ تستعمل sendMessage
    {
      url: `${cleanBase}/message/sendMessage/${encodeURIComponent(instanceName)}`,
      body: { number, text },
    },
    {
      url: `${cleanBase}/message/sendMessage/${encodeURIComponent(instanceName)}`,
      body: { number, message: text },
    },
    // بعض النسخ تعتمد /chat/sendText
    {
      url: `${cleanBase}/chat/sendText/${encodeURIComponent(instanceName)}`,
      body: { number, text },
    },
  ];

  for (const c of candidates) {
    const res = await fetch(c.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(c.body),
    });

    const raw = await readText(res);
    let json: any = null;
    try { json = JSON.parse(raw || "{}"); } catch { json = { raw }; }

    if (res.ok) {
      return { ok: true, used: c.url, requestBody: c.body, status: res.status, response: json };
    }
  }

  // إذا فشلت كلها، نرجع آخر محاولة
  const last = candidates[candidates.length - 1];
  return {
    ok: false,
    tried: candidates.map(x => x.url),
    note: "All send endpoints failed. Check instanceName/connection and API compatibility.",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const institutionId = body.id || body.institutionId;
    const to = body.to;
    const message = body.message;

    if (!institutionId || !to || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "id/to/message are required", received: body }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = Deno.env.get("EVOLUTION_BASE_URL");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!baseUrl || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing EVOLUTION secrets", details: { baseUrl: !!baseUrl, apiKey: !!apiKey } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: inst, error } = await supabaseAdmin
      .from("institutions")
      .select("id, name, whatsapp_session_status, whatsapp_session_id")
      .eq("id", institutionId)
      .single();

    if (error || !inst) {
      return new Response(
        JSON.stringify({ success: false, error: "Institution not found", details: error?.message, institutionId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instanceName = inst.whatsapp_session_id;
    if (!instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "No whatsapp_session_id found in DB (instanceName missing)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (String(inst.whatsapp_session_status || "").toUpperCase() !== "CONNECTED") {
      return new Response(
        JSON.stringify({ success: false, error: "Session not CONNECTED", status: inst.whatsapp_session_status, instanceName }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const number = normalizePhone(to);

    const result = await trySend(baseUrl, apiKey, instanceName, number, message);

    if (!result.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send message via Evolution",
          instanceName,
          number,
          ...result,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message sent",
        instanceName,
        number,
        usedEndpoint: (result as any).used,
        requestBody: (result as any).requestBody,
        details: (result as any).response,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
