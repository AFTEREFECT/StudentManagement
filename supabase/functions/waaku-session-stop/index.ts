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

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method Not Allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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

    const { data: inst, error } = await supabaseAdmin
      .from("institutions")
      .select("id, whatsapp_session_id")
      .eq("id", institutionId)
      .single();

    if (error || !inst) {
      return new Response(
        JSON.stringify({ success: false, error: "Institution not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const dbSessionId = (inst.whatsapp_session_id as string | null) ?? null;

    // fallback مهم جدًا: إذا كان الـ DB فارغًا، استعمل institutionId
    const sessionId = dbSessionId || String(institutionId);

    let waakuResult: {
      attempted: boolean;
      success: boolean;
      status?: number;
      raw?: string;
    } = {
      attempted: false,
      success: false,
    };

    try {
      const waakuRes = await fetch(
        `https://progtalamid.com/api/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "DELETE",
          headers: {
            "CF-Access-Client-Id": Deno.env.get("CF_ACCESS_CLIENT_ID")!,
            "CF-Access-Client-Secret": Deno.env.get("CF_ACCESS_CLIENT_SECRET")!,
          },
        }
      );

      const txt = await waakuRes.text().catch(() => "");

      waakuResult = {
        attempted: true,
        success: waakuRes.ok,
        status: waakuRes.status,
        raw: txt,
      };

      if (!waakuRes.ok) {
        const rawLower = txt.toLowerCase();
        const sessionNotFound =
          rawLower.includes("session not found") ||
          rawLower.includes('"error":"session not found"') ||
          rawLower.includes("not found");

        if (!sessionNotFound) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Waaku delete failed",
              details: txt,
              sessionId,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          error: e instanceof Error ? e.message : "Delete request failed",
          sessionId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        message: "Session deleted successfully",
        institutionId,
        sessionId,
        waakuResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});