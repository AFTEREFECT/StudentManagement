import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WAAKU_SERVER_URL = Deno.env.get("WA_SERVER_URL")!;
const WAAKU_API_KEY = Deno.env.get("WA_MASTER_API_KEY")!;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log('📥 [waaku-send-message] New request received');

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // استخدام SERVICE_ROLE_KEY للأمان
    );

    // Parse request body
    const body = await req.json();
    console.log('📦 [waaku-send-message] Request body:', JSON.stringify(body));

    // قبول كلا من 'id' و 'institutionId'
    const institutionId = body.id || body.institutionId;
    const { to, message } = body;

    // Validate inputs
    if (!institutionId) {
      console.error('❌ [waaku-send-message] Missing institution ID');
      return new Response(
        JSON.stringify({ 
          error: 'Institution ID is required',
          hint: 'Please provide either "id" or "institutionId" in the request body'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!to || !message) {
      console.error('❌ [waaku-send-message] Missing required fields');
      return new Response(
        JSON.stringify({ 
          error: 'Recipient (to) and message are required',
          received: { to: !!to, message: !!message }
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔍 [waaku-send-message] Institution ID: ${institutionId}`);
    console.log(`📞 [waaku-send-message] Recipient: ${to}`);

    // Fetch institution from database
    const { data: institution, error: fetchError } = await supabaseClient
      .from('institutions')
      .select('whatsapp_session_id, whatsapp_session_status, name')
      .eq('id', institutionId)
      .single();

    if (fetchError || !institution) {
      console.error('❌ [waaku-send-message] Institution not found:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Institution not found',
          institutionId,
          details: fetchError?.message 
        }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ [waaku-send-message] Found institution: ${institution.name}`);

    // Check session exists
    if (!institution.whatsapp_session_id) {
      console.error('❌ [waaku-send-message] No session ID');
      return new Response(
        JSON.stringify({ 
          error: 'No WhatsApp session found for this institution',
          hint: 'Please create a WhatsApp session first'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔑 [waaku-send-message] Session ID: ${institution.whatsapp_session_id}`);

    // Check session is connected
    if (institution.whatsapp_session_status !== 'CONNECTED') {
      console.error('❌ [waaku-send-message] Session not connected:', institution.whatsapp_session_status);
      return new Response(
        JSON.stringify({ 
          error: 'WhatsApp session is not connected',
          status: institution.whatsapp_session_status,
          hint: 'Please connect your WhatsApp session first'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ [waaku-send-message] Session is CONNECTED');

    // Format phone number
    let formattedPhone = to.replace(/\D/g, '');
    
    // إزالة 0 من البداية
    if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }
    
    // إضافة رمز الدولة (212 للمغرب)
    if (!formattedPhone.startsWith('212')) {
      formattedPhone = '212' + formattedPhone;
    }
    
    // تنسيق WhatsApp
    const whatsappNumber = formattedPhone + '@c.us';

    console.log(`📱 [waaku-send-message] Formatted number: ${whatsappNumber}`);

    // Send message via Waaku
    const waakuUrl = `${WAAKU_SERVER_URL}/api/sessions/${institution.whatsapp_session_id}/send`;
    
    console.log(`🚀 [waaku-send-message] Sending to Waaku: ${waakuUrl}`);

    const waakuResponse = await fetch(waakuUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'X-Api-Key': WAAKU_API_KEY 
      },
      body: JSON.stringify({
        to: whatsappNumber,
        message: message
      }),
    });

    console.log(`📊 [waaku-send-message] Waaku response status: ${waakuResponse.status}`);

    const responseText = await waakuResponse.text();
    console.log(`📄 [waaku-send-message] Waaku response body: ${responseText}`);

    let waakuData;
    try {
      waakuData = JSON.parse(responseText);
    } catch (e) {
      console.warn('⚠️ [waaku-send-message] Could not parse response as JSON');
      waakuData = { raw: responseText };
    }

    // Check Waaku response
    if (!waakuResponse.ok) {
      console.error('❌ [waaku-send-message] Waaku returned error');
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send message via Waaku',
          status: waakuResponse.status,
          details: waakuData 
        }),
        { 
          status: waakuResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ [waaku-send-message] Message sent successfully!');

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message sent successfully',
        messageId: waakuData.id || waakuData.messageId || null,
        details: waakuData
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [waaku-send-message] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
