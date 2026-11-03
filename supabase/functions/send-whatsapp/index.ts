import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function normalizePhone(input: string) {
  let p = (input || "").replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("212")) p = "212" + p;
  return p;
}

async function readText(res: Response) {
  try { return await res.text(); } catch { return ""; }
}

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
    const { instanceName, phone, message } = await req.json();

    if (!instanceName || !phone || !message) {
      return new Response(
        JSON.stringify({ error: "instanceName, phone and message are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanPhone = normalizePhone(phone);

    console.log("📤 Sending WhatsApp message via Waaku:", {
      instanceName,
      cleanPhone,
    });

    const response = await fetch(
      `https://progtalamid.com/api/messages/${instanceName}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Access-Client-Id": Deno.env.get("CF_ACCESS_CLIENT_ID")!,
          "CF-Access-Client-Secret": Deno.env.get("CF_ACCESS_CLIENT_SECRET")!,
        },
        body: JSON.stringify({
          to: cleanPhone,
          message,
        }),
      }
    );

    const raw = await readText(response);
    let result: any = {};
    try { result = JSON.parse(raw || "{}"); } catch { result = { raw }; }

    console.log("📊 Waaku response:", result);

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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
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