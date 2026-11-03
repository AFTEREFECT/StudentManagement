import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const { instanceName, phone, message } = await req.json();

    if (!instanceName || !phone || !message) {
      return new Response(
        JSON.stringify({ error: "instanceName, phone and message are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const baseUrl = Deno.env.get("EVOLUTION_BASE_URL");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!baseUrl || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("📤 Sending WhatsApp message:", { instanceName, phone });

    // إزالة + إن وجدت (Evolution لا يقبلها)
    const cleanPhone = phone.replace("+", "");

    const response = await fetch(
      `${baseUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey,
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message,
        }),
      }
    );

    const result = await response.json();

    console.log("📊 Evolution response:", result);

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    console.error("❌ Send message error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
