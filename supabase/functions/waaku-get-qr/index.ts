import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const WAAKU_SERVER_URL = Deno.env.get("WA_SERVER_URL")!;
const WAAKU_API_KEY = Deno.env.get("WA_MASTER_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId is required");

    console.log(`🔍 Fetching QR for session: ${sessionId}`);

    const response = await fetch(`${WAAKU_SERVER_URL}/api/sessions/${sessionId}/qr`, {
      headers: { 'X-Api-Key': WAAKU_API_KEY },
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      console.error(`❌ QR fetch failed: ${response.status} ${txt}`);
      throw new Error(`Failed to get QR from Waaku: ${response.status} ${txt}`);
    }

    const data = await response.json();
    console.log("✅ QR fetched successfully");
    
    return new Response(JSON.stringify({ qr: data.qr }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("❌ Error:", e);
    return new Response(JSON.stringify({ qr: null, error: (e as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
