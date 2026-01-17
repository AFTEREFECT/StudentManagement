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
  if (!rawStatus) return "DISCONNECTED";
  const s = rawStatus.toUpperCase();
  if (s === "CONNECTED" || s === "READY" || s === "WORKING") return "CONNECTED";
  if (s.includes("SCANNING") || s.includes("CONNECTING") || s.includes("STARTING") || s.includes("QR")) return "SCANNING";
  return "DISCONNECTED";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id: institutionId } = await req.json();
    
    console.log('🔍 [waaku-check-status] Request for institution:', institutionId);
    
    if (!institutionId) {
      console.error('❌ [waaku-check-status] No institution ID provided');
      return new Response(
        JSON.stringify({ status: "DISCONNECTED", sessionId: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1️⃣ جلب معلومات المؤسسة
    const { data: institution, error } = await supabaseAdmin
      .from("institutions")
      .select("whatsapp_session_id, whatsapp_session_status, whatsapp_phone_number, greza, name")
      .eq("id", institutionId)
      .single();

    if (error || !institution) {
      console.error('❌ [waaku-check-status] Institution not found:', error);
      return new Response(
        JSON.stringify({ status: "DISCONNECTED", sessionId: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2️⃣ استخدام GREZA كـ sessionId إذا لم يكن موجود في DB
    const sessionId = institution.whatsapp_session_id || institution.greza;
    
    console.log('📋 [waaku-check-status] Institution:', institution.name);
    console.log('🔑 [waaku-check-status] SessionId:', sessionId);
    console.log('📊 [waaku-check-status] Current DB status:', institution.whatsapp_session_status);

    // ⚡ إذا كانت الحالة في DB متصلة، لا نتحقق من الخادم (تجنب التعارض)
    if (institution.whatsapp_session_status === 'CONNECTED') {
      console.log('✅ [waaku-check-status] Status is CONNECTED in DB - skipping server check');
      return new Response(
        JSON.stringify({ 
          status: "CONNECTED", 
          sessionId,
          phoneNumber: institution.whatsapp_phone_number || null,
          source: "db_cache",
          message: "Using cached status"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3️⃣ فقط تحقق من الخادم إذا لم تكن الحالة متصلة
    const waakuUrl = `${WAAKU_SERVER_URL}/api/sessions/${sessionId}`;
    console.log('🌐 [waaku-check-status] Fetching from:', waakuUrl);
    
    const waakuResponse = await fetch(waakuUrl, {
      headers: { "X-Api-Key": WAAKU_API_KEY },
    });

    console.log('📊 [waaku-check-status] Waaku Response Status:', waakuResponse.status);

    // 4️⃣ إذا لم توجد الجلسة على الخادم (404)
    if (waakuResponse.status === 404) {
      console.log('❌ [waaku-check-status] Session not found on server (404)');
      
      // ⚠️ فقط حدّث إذا كانت الحالة الحالية ليست DISCONNECTED
      if (institution.whatsapp_session_status !== 'DISCONNECTED') {
        console.log('🔄 [waaku-check-status] Updating DB to DISCONNECTED');
        await supabaseAdmin
          .from("institutions")
          .update({ 
            whatsapp_session_id: null, 
            whatsapp_session_status: "DISCONNECTED",
            whatsapp_phone_number: null,
            whatsapp_last_checked: new Date().toISOString()
          })
          .eq("id", institutionId);
      }
      
      return new Response(
        JSON.stringify({ 
          status: "DISCONNECTED", 
          sessionId: null,
          source: "waaku_404"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5️⃣ إذا فشل الاتصال بالخادم
    if (!waakuResponse.ok) {
      const errorText = await waakuResponse.text().catch(() => "Unknown");
      console.error('❌ [waaku-check-status] Server error:', waakuResponse.status, errorText);
      
      // ⚠️ لا تُحدّث DB عند خطأ في الخادم
      return new Response(
        JSON.stringify({ 
          status: institution.whatsapp_session_status || "DISCONNECTED", 
          sessionId,
          source: "error_fallback",
          message: `Server error: ${waakuResponse.status}`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6️⃣ جلب الحالة الحقيقية من الخادم
    const waakuData = await waakuResponse.json();
    console.log('✅ [waaku-check-status] Waaku data:', JSON.stringify(waakuData));
    
    const realStatus = normalizeStatus(waakuData.status);
    const phoneNumber = waakuData.phone || waakuData.phoneNumber || waakuData.me?.id || null;

    console.log('📱 [waaku-check-status] Real Status:', realStatus);
    console.log('📞 [waaku-check-status] Phone:', phoneNumber);

    // 7️⃣ ⚡ فقط حدّث DB إذا تغيرت الحالة
    if (institution.whatsapp_session_status !== realStatus) {
      console.log(`🔄 [waaku-check-status] Status changed: ${institution.whatsapp_session_status} → ${realStatus}`);
      
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
        console.error('⚠️ [waaku-check-status] DB update error:', updateError);
      } else {
        console.log('✅ [waaku-check-status] DB updated successfully');
      }
    } else {
      console.log('✅ [waaku-check-status] Status unchanged, skipping DB update');
      
      // فقط حدّث timestamp
      await supabaseAdmin
        .from("institutions")
        .update({ whatsapp_last_checked: new Date().toISOString() })
        .eq("id", institutionId);
    }

    // 8️⃣ إرجاع الحالة الحقيقية
    const response = {
      status: realStatus,
      sessionId,
      phoneNumber,
      source: "waaku_server",
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ [waaku-check-status] Returning:', JSON.stringify(response));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error('❌ [waaku-check-status] Unexpected error:', e);
    return new Response(
      JSON.stringify({ 
        error: (e as Error).message,
        status: "DISCONNECTED",
        source: "exception"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
