import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const WAAKU_SERVER_URL = Deno.env.get("WA_SERVER_URL")!;
const WAAKU_API_KEY = Deno.env.get("WA_MASTER_API_KEY")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { id: institutionId } = await req.json();
    if (!institutionId) throw new Error("Institution ID is required");

    const { data } = await supabaseAdmin
      .from("institutions")
      .select("whatsapp_session_id")
      .eq("id", institutionId)
      .single();

    if (data && data.whatsapp_session_id) {
      const sessionId = data.whatsapp_session_id;

      console.log(`🗑️ Deleting session from Waaku: ${sessionId}`);
      
      // إرسال طلب الحذف إلى Waaku
      await fetch(`${WAAKU_SERVER_URL}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { "X-Api-Key": WAAKU_API_KEY },
      });
    }

    // تنظيف قاعدة البيانات دائمًا
    await supabaseAdmin
      .from("institutions")
      .update({ 
        whatsapp_session_id: null,
        whatsapp_session_status: "DISCONNECTED",
        whatsapp_phone_number: null
      })
      .eq("id", institutionId);

    console.log("✅ Session stopped and cleaned up");

    return new Response(
      JSON.stringify({ success: true, message: "Session stopped and cleaned up." }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
