import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const { institutionId, id } = await req.json();
    const finalInstitutionId = institutionId || id;

    if (!finalInstitutionId) {
      return new Response(
        JSON.stringify({ error: "Institution ID is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 🔍 جلب instance من قاعدة البيانات
    const { data: institution, error } = await supabase
      .from("institutions")
      .select("whatsapp_instance_name")
      .eq("id", finalInstitutionId)
      .single();

    if (error || !institution) {
      return new Response(
        JSON.stringify({ error: "Institution not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (!institution.whatsapp_instance_name) {
      return new Response(
        JSON.stringify({ error: "No WhatsApp instance found for this institution" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const instanceName = institution.whatsapp_instance_name;

    const baseUrl = Deno.env.get("EVOLUTION_BASE_URL")!;
    const apiKey = Deno.env.get("EVOLUTION_API_KEY")!;

    console.log(`🗑 Deleting Evolution instance: ${instanceName}`);

    const evolutionRes = await fetch(
      `${baseUrl}/instance/delete/${instanceName}`,
      {
        method: "DELETE",
        headers: {
          "apikey": apiKey,
        },
      }
    );

    const responseText = await evolutionRes.text();

    let evolutionData;
    try {
      evolutionData = JSON.parse(responseText);
    } catch {
      evolutionData = { raw: responseText };
    }

    if (!evolutionRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to delete instance in Evolution",
          details: evolutionData,
        }),
        { status: evolutionRes.status, headers: corsHeaders }
      );
    }

    // 🧹 تحديث قاعدة البيانات بعد الحذف
    await supabase
      .from("institutions")
      .update({
        whatsapp_instance_name: null,
        whatsapp_session_status: "DISCONNECTED",
      })
      .eq("id", finalInstitutionId);

    console.log("✅ Instance deleted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "WhatsApp instance deleted successfully",
        details: evolutionData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Unexpected error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
