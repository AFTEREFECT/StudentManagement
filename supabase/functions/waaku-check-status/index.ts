import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
 "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
 if (req.method === "OPTIONS") {
  return new Response("ok", {
    status: 200,
    headers: corsHeaders,
  });
}

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method Not Allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const institutionId = body.id || body.institutionId;

    if (!institutionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Institution ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = `https://wa.progtalamid.com/api/sessions/${encodeURIComponent(String(institutionId))}/status`;

    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "CF-Access-Client-Id": Deno.env.get("CF_ACCESS_CLIENT_ID")!,
        "CF-Access-Client-Secret": Deno.env.get("CF_ACCESS_CLIENT_SECRET")!,
      },
    });

    const text = await res.text().catch(() => "");
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data?.error || "Status request failed",
          details: data,
        }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status = data?.status || "DISCONNECTED";
    const instanceName = data?.instanceName || String(institutionId);
    const phoneNumber = data?.phoneNumber || null;
    const qr = data?.qr || null;

    await supabaseAdmin
      .from("institutions")
      .update({
        whatsapp_session_id: instanceName,
        whatsapp_session_status: status,
        whatsapp_phone_number: phoneNumber,
        whatsapp_last_checked: new Date().toISOString(),
      })
      .eq("id", institutionId);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        instanceName,
        phoneNumber,
        qr,
        source: "wa.progtalamid.com",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});