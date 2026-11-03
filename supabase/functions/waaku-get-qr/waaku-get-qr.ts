import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { instanceName } = await req.json();

    if (!instanceName) {
      return new Response(
        JSON.stringify({ error: "instanceName is required" }),
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

    console.log(`🔍 Fetching QR for instance: ${instanceName}`);

    const response = await fetch(
      `${baseUrl}/instance/connect/${instanceName}`,
      {
        method: "GET",
        headers: {
          "apikey": apiKey,
        },
      }
    );

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      console.error(`❌ QR fetch failed: ${response.status} ${txt}`);

      return new Response(
        JSON.stringify({ qr: null, error: txt }),
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();

    console.log("✅ QR fetched successfully");

    return new Response(
      JSON.stringify({
        qr: data?.qrcode || data?.base64 || null,
        connectionStatus: data?.connectionStatus || null,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("❌ Error fetching QR:", error);

    return new Response(
      JSON.stringify({ qr: null, error: error.message }),
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
