import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const WAAKU_SERVER_URL = Deno.env.get("WA_SERVER_URL")!;
const WAAKU_API_KEY = Deno.env.get("WA_MASTER_API_KEY")!;
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function normalizeStatus(rawStatus?: string): "CONNECTED" | "SCANNING" | "DISCONNECTED" {
  if (!rawStatus) return "SCANNING";
  const s = rawStatus.toUpperCase();
  if (s === "CONNECTED" || s === "READY") return "CONNECTED";
  if (s.includes("SCANNING") || s.includes("CONNECTING")) return "SCANNING";
  return "DISCONNECTED";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id: institutionId } = await req.json();
    if (!institutionId) throw new Error("Institution ID is required");

    // 1️⃣ جلب معلومات المؤسسة
    const { data: inst, error: fetchError } = await supabaseAdmin
      .from("institutions")
      .select("greza")
      .eq("id", institutionId)
      .single();
    
    if (fetchError || !inst || !inst.greza) {
      throw new Error("Institution or GREZA not found.");
    }

    const sessionId = inst.greza;

    // 2️⃣ التحقق من حالة الجلسة الحالية على الخادم
    console.log(`🔍 Checking existing session on Waaku: ${sessionId}`);
    const checkResponse = await fetch(`${WAAKU_SERVER_URL}/api/sessions/${sessionId}`, {
      headers: { "X-Api-Key": WAAKU_API_KEY },
    });

    // 3️⃣ إذا كانت موجودة، حذفها أولاً
    if (checkResponse.ok) {
      console.log("🗑️ Deleting existing session...");
      await fetch(`${WAAKU_SERVER_URL}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { "X-Api-Key": WAAKU_API_KEY },
      });
      
      // انتظار قليل للسماح للخادم بالتنظيف
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 4️⃣ إنشاء جلسة جديدة
    console.log("🆕 Creating new session...");
    const createResponse = await fetch(`${WAAKU_SERVER_URL}/api/sessions`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "X-Api-Key": WAAKU_API_KEY 
      },
      body: JSON.stringify({ id: sessionId }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create session: ${createResponse.status}`);
    }

    // 5️⃣ ✅ التحقق من الحالة الفعلية من الخادم مباشرة
    console.log("🔄 Verifying session status from server...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    const verifyResponse = await fetch(`${WAAKU_SERVER_URL}/api/sessions/${sessionId}`, {
      headers: { "X-Api-Key": WAAKU_API_KEY },
    });

    let realStatus = "SCANNING";
    let phoneNumber = null;
    
    if (verifyResponse.ok) {
      const sessionData = await verifyResponse.json();
      console.log("📊 Real session data:", sessionData);
      
      realStatus = normalizeStatus(sessionData.status);
      phoneNumber = sessionData.phone || sessionData.phoneNumber || null;
    }

    // 6️⃣ تحديث قاعدة البيانات بالحالة الحقيقية
    const { error: updateError } = await supabaseAdmin
      .from("institutions")
      .update({ 
        whatsapp_session_id: sessionId, 
        whatsapp_session_status: realStatus,
        whatsapp_phone_number: phoneNumber,
        whatsapp_last_checked: new Date().toISOString()
      })
      .eq("id", institutionId);
    
    if (updateError) {
      console.error("⚠️ DB update warning:", updateError.message);
    }

    console.log(`✅ Session created with real status: ${realStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId,
        status: realStatus,
        phoneNumber,
        source: "waaku_server"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("❌ Error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
