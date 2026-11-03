import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }
  return null;
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export async function parseBody(req: Request): Promise<Record<string, any>> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function buildSessionId(institutionId: string | number) {
  return String(institutionId);
}

export function extractQr(data: any): string | null {
  return (
    data?.qr ||
    data?.qrcode ||
    data?.qrCode ||
    data?.result?.qr ||
    data?.result?.qrcode ||
    data?.result?.qrCode ||
    null
  );
}

export async function getInstitutionOrFail(institutionId: string | number) {
  const { data, error } = await supabaseAdmin
    .from("institutions")
    .select("id, institution")
    .eq("id", institutionId)
    .single();

  if (error || !data) {
    throw new Error("Institution not found");
  }

  return data;
}

export async function saveInstitutionWhatsappState(params: {
  institutionId: string | number;
  sessionId: string | null;
  status: string;
  phoneNumber?: string | null;
}) {
  const { error } = await supabaseAdmin
    .from("institutions")
    .update({
      whatsapp_session_id: params.sessionId,
      whatsapp_session_status: params.status,
      whatsapp_phone_number: params.phoneNumber ?? null,
      whatsapp_last_checked: new Date().toISOString(),
    })
    .eq("id", params.institutionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function waakuFetch(
  path: string,
  init: RequestInit = {},
): Promise<{
  ok: boolean;
  status: number;
  text: string;
  json: any;
}> {
  const baseUrl = Deno.env.get("WAAKU_BASE_URL") || "https://wa.progtalamid.com";

  const headers = new Headers(init.headers || {});
  const cfId = Deno.env.get("CF_ACCESS_CLIENT_ID");
  const cfSecret = Deno.env.get("CF_ACCESS_CLIENT_SECRET");

  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  if (cfId) headers.set("CF-Access-Client-Id", cfId);
  if (cfSecret) headers.set("CF-Access-Client-Secret", cfSecret);

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text().catch(() => "");
  let json: any = {};

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    text,
    json,
  };
}
 