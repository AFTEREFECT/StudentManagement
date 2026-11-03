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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const institutionId = body.id || body.institutionId;

    if (!institutionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Institution ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: institution, error } = await supabaseAdmin
      .from("institutions")
      .select("id, whatsapp_session_id")
      .eq("id", institutionId)
      .single();

    if (error || !institution) {
      return new Response(
        JSON.stringify({ success: false, error: "Institution not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const instanceName = institution.whatsapp_session_id as string | null;

    const baseUrl = Deno.env.get("EVOLUTION_BASE_URL");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");

    let logoutResult: any = null;
    let deleteResult: any = null;

    if (instanceName && baseUrl && apiKey) {
      const cleanBase = baseUrl.replace(/\/+$/, "");

      try {
        const logoutRes = await fetch(
          `${cleanBase}/instance/logout/${encodeURIComponent(instanceName)}`,
          {
            method: "DELETE",
            headers: { apikey: apiKey },
          }
        );

        logoutResult = {
          status: logoutRes.status,
          raw: await logoutRes.text().catch(() => ""),
        };
      } catch (e) {
        logoutResult = { error: e instanceof Error ? e.message : String(e) };
      }

      try {
        const deleteRes = await fetch(
          `${cleanBase}/instance/delete/${encodeURIComponent(instanceName)}`,
          {
            method: "DELETE",
            headers: { apikey: apiKey },
          }
        );

        deleteResult = {
          status: deleteRes.status,
          raw: await deleteRes.text().catch(() => ""),
        };
      } catch (e) {
        deleteResult = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("institutions")
      .update({
        whatsapp_session_id: null,
        whatsapp_session_status: "DISCONNECTED",
        whatsapp_phone_number: null,
        whatsapp_last_checked: new Date().toISOString(),
      })
      .eq("id", institutionId);

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "DB cleanup failed",
          details: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Institution session deleted successfully",
        institutionId,
        instanceName,
        logoutResult,
        deleteResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});