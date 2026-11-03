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

function normalizeStatus(rawStatus?: string): "CONNECTED" | "SCANNING" | "DISCONNECTED" {
  if (!rawStatus) return "DISCONNECTED";

  const s = rawStatus.toLowerCase();

  if (s === "open" || s === "connected") return "CONNECTED";
  if (s.includes("connecting") || s.includes("qr")) return "SCANNING";

  return "DISCONNECTED";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id: institutionId } = await req.json();

    if (!institutionId) {
      return new Response(
        JSON.stringify({ status: "DISCONNECTED", instanceName: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1️⃣ جلب المؤسسة
    const { data: institution, error } = await supabaseAdmin
      .from("institutions")
      .select("whatsapp_instance_name, whatsapp_session_status, whatsapp_phone_number, name")
      .eq("id", institutionId)
      .single();

    if (error || !institution) {
      return new Response(
        JSON.stringify({ status: "DISCONNECTED", instanceName: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instanceName = institution.whatsapp_instance_name;

    if (!instanceName) {
      return new Response(
        JSON.stringify({ status: "DISCONNECTED", instanceName: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 Checking Evolution status for: ${instanceName}`);

    const baseUrl = Deno.env.get("EVOLUTION_BASE_URL")!;
    const apiKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const evolutionResponse = await fetch(
      `${baseUrl}/instance/connect/${instanceName}`,
      {
        headers: { apikey: apiKey },
      }
    );

    // إذا instance غير موجودة (404)
    if (evolutionResponse.status === 404) {
      await supabaseAdmin
        .from("institutions")
        .update({
          whatsapp_instance_name: null,
          whatsapp_session_status: "DISCONNECTED",
          whatsapp_phone_number: null,
          whatsapp_last_checked: new Date().toISOString(),
        })
        .eq("id", institutionId);

      return new Response(
        JSON.stringify({
          status: "DISCONNECTED",
          instanceName: null,
          source: "evolution_404",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!evolutionResponse.ok) {
      return new Response(
        JSON.stringify({
          status: institution.whatsapp_session_status || "DISCONNECTED",
          instanceName,
          source: "error_fallback",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evolutionData = await evolutionResponse.json();

    const realStatus = normalizeStatus(evolutionData.connectionStatus);
    const phoneNumber = evolutionData.phoneNumber || null;

    // 2️⃣ تحديث DB فقط إذا تغيرت الحالة
    if (institution.whatsapp_session_status !== realStatus) {
      await supabaseAdmin
        .from("institutions")
        .update({
          whatsapp_session_status: realStatus,
          whatsapp_phone_number: phoneNumber,
          whatsapp_last_checked: new Date().toISOString(),
        })
        .eq("id", institutionId);
    } else {
      await supabaseAdmin
        .from("institutions")
        .update({
          whatsapp_last_checked: new Date().toISOString(),
        })
        .eq("id", institutionId);
    }

    return new Response(
      JSON.stringify({
        status: realStatus,
        instanceName,
        phoneNumber,
        source: "evolution_server",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("❌ evolution-check-status error:", e);

    return new Response(
      JSON.stringify({
        status: "DISCONNECTED",
        error: (e as Error).message,
        source: "exception",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
