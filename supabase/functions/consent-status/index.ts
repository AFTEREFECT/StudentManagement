import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function normalizePhone(phone: string): string {
  const v = String(phone || "").replace(/\D/g, "")
  if (v.startsWith("212") && v.length === 12) return v
  if (v.startsWith("0") && v.length === 10) return "212" + v.slice(1)
  if (v.length === 9) return "212" + v
  return v
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(
  supabaseUrl ?? "",
  serviceRoleKey ?? ""
)

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "GET") {
    return jsonResponse(
      {
        success: false,
        error: "METHOD_NOT_ALLOWED",
      },
      405
    )
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          success: false,
          error: "MISSING_SUPABASE_ENV",
          details: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured",
        },
        500
      )
    }

    const url = new URL(req.url)
    const voucher = String(url.searchParams.get("voucher") || "").trim()
    const phone = normalizePhone(url.searchParams.get("phone") || "")

    if (!voucher || !phone) {
      return jsonResponse(
        {
          success: false,
          error: "MISSING_VOUCHER_OR_PHONE",
        },
        400
      )
    }

    const { data: code, error: codeError } = await supabase
      .from("activation_codes")
      .select("institution_id")
      .eq("activation_code", voucher)
      .maybeSingle()

    if (codeError) {
      console.error("activation_codes error:", codeError)
      return jsonResponse(
        {
          success: false,
          error: "DB_CODE_ERROR",
          details: codeError.message,
        },
        500
      )
    }

    if (!code) {
      return jsonResponse(
        {
          success: false,
          error: "INVALID_VOUCHER",
        },
        400
      )
    }

    const { data, error } = await supabase
      .from("phone_verifications")
      .select("id, consent_whatsapp, consent_whatsapp_at, expires_at")
      .eq("institution_id", code.institution_id)
      .eq("phone", phone)
      .maybeSingle()

    if (error) {
      console.error("phone_verifications error:", error)
      return jsonResponse(
        {
          success: false,
          error: "DB_STATUS_ERROR",
          details: error.message,
        },
        500
      )
    }

    return jsonResponse({
      success: true,
      found: !!data,
      consent_whatsapp: data?.consent_whatsapp ?? false,
      consent_whatsapp_at: data?.consent_whatsapp_at ?? null,
      expires_at: data?.expires_at ?? null,
    })
  } catch (e) {
    console.error("CONSENT_STATUS_FATAL_ERROR:", e)

    return jsonResponse(
      {
        success: false,
        error: e instanceof Error ? e.message : "UNKNOWN_ERROR",
      },
      500
    )
  }
})