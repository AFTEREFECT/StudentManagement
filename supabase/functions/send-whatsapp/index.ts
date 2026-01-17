import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { instanceId, apiKey, phone, message } = await req.json();

    console.log('📤 إرسال رسالة واتساب:', { instanceId, phone });

    // استخدام API ultramsg
    const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: apiKey,
        to: phone,
        body: message
      })
    });

    const result = await response.json();
    console.log('📊 نتيجة الإرسال:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: response.status
      }
    );

  } catch (error) {
    console.error('❌ خطأ في إرسال الرسالة:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500
      }
    );
  }
});
