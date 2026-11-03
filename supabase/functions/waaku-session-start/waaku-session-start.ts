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

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const institutionId = body?.id;

    if (!institutionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Institution ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ تأكد من ENV
    const baseUrl = Deno.env.get("EVOLUTION_BASE_URL");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!baseUrl || !apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing secrets",
          details: {
            EVOLUTION_BASE_URL: !!baseUrl,
            EVOLUTION_API_KEY: !!apiKey,
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ جلب المؤسسة
    const { data: inst, error: fetchError } = await supabaseAdmin
      .from("institutions")
      .select("id, name, whatsapp_instance_name")
      .eq("id", institutionId)
      .single();

    if (fetchError || !inst) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Institution not found",
          details: fetchError?.message ?? null,
          institutionId,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instanceName = inst.whatsapp_instance_name || `${inst.id}`;

    // ✅ helper لطلبات Evolution
    const evo = async (path: string, init: RequestInit = {}) => {
      const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
      const res = await fetch(url, {
        ...init,
        headers: {
          ...(init.headers || {}),
          apikey: apiKey,
        },
      });
      return { res, url, text: await safeText(res) };
    };

    // 1) حذف instance إن وجدت (قد يفشل = لا مشكلة)
    const del = await evo(`/instance/delete/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
    });

    // 2) إنشاء instance
    const create = await evo(`/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    if (!create.res.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create instance",
          instanceName,
          debug: {
            deleteCall: { url: del.url, status: del.res.status, body: del.text },
            createCall: { url: create.url, status: create.res.status, body: create.text },
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) جلب connect (QR/status)
    const conn = await evo(`/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: "GET",
    });

    // حاول parse
    let connJson: any = null;
    try {
      connJson = JSON.parse(conn.text || "{}");
    } catch {
      connJson = null;
    }

    const connectionStatus =
      connJson?.connectionStatus || connJson?.status || connJson?.state || "connecting";

    // تحديث DB
    await supabaseAdmin
      .from("institutions")
      .update({
        whatsapp_instance_name: instanceName,
        whatsapp_session_id: instanceName, // ✅ نخزن instanceName هنا مؤقتاً لتوافق الواجهة
        whatsapp_session_status:
          String(connectionStatus).toLowerCase().includes("open") ||
          String(connectionStatus).toLowerCase().includes("connected")
            ? "CONNECTED"
            : "SCANNING",
        whatsapp_last_checked: new Date().toISOString(),
      })
      .eq("id", institutionId);

    return new Response(
      JSON.stringify({
        success: true,
        instanceName,
        connectionStatus,
        connectRaw: connJson ?? conn.text,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
