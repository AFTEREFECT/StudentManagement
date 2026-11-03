import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function normalizePhone(phone: string): string {
  const v = String(phone || "").replace(/\D/g, "")
  if (v.startsWith("212") && v.length === 12) return v
  if (v.startsWith("0") && v.length === 10) return "212" + v.slice(1)
  if (v.length === 9) return "212" + v
  return v
}

function normalizeWhatsAppNumber(phone: string): string {
  return String(phone || "").replace(/\D/g, "")
}

function generateConsentToken(voucher: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${voucher}-${rand}`
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "METHOD_NOT_ALLOWED",
      }),
      { status: 405, headers: corsHeaders }
    )
  }

  try {
    const body = await req.json().catch(() => null)

    if (!body?.voucher || !body?.phone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "MISSING_VOUCHER_OR_PHONE",
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const voucher = String(body.voucher).trim()
    const formattedPhone = normalizePhone(body.phone)

    if (!formattedPhone || formattedPhone.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_PHONE",
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const { data: code, error: codeError } = await supabase
      .from("activation_codes")
      .select("id, institution_id, massar_code, used")
      .eq("activation_code", voucher)
      .maybeSingle()

    if (codeError) {
      console.error("activation_codes error:", codeError)
      return new Response(
        JSON.stringify({
          success: false,
          error: "DB_CODE_ERROR",
          details: codeError.message,
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!code) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_VOUCHER",
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (code.used === true) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "USED_VOUCHER",
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const { data: inst, error: instError } = await supabase
      .from("institutions")
      .select("id, whatsapp_optin_number")
      .eq("id", code.institution_id)
      .maybeSingle()

    if (instError) {
      console.error("institutions error:", instError)
      return new Response(
        JSON.stringify({
          success: false,
          error: "INSTITUTION_LOOKUP_FAILED",
          details: instError.message,
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    if (!inst?.whatsapp_optin_number) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "NO_WHATSAPP_OPTIN_NUMBER",
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const consentToken = generateConsentToken(voucher)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { error: deleteOldError } = await supabase
      .from("phone_verifications")
      .delete()
      .eq("institution_id", code.institution_id)
      .eq("phone", formattedPhone)

    if (deleteOldError) {
      console.error("delete old verification error:", deleteOldError)
      return new Response(
        JSON.stringify({
          success: false,
          error: "DELETE_OLD_VERIFICATION_FAILED",
          details: deleteOldError.message,
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    const { data: inserted, error: insertVerificationError } = await supabase
      .from("phone_verifications")
      .insert({
        institution_id: code.institution_id,
        phone: formattedPhone,
        otp: "000000",
        massar_code: code.massar_code,
        verified: false,
        expires_at: expiresAt,
        consent_token: consentToken,
        consent_whatsapp: false,
        consent_whatsapp_at: null,
      })
      .select("id, phone, consent_token")
      .single()

    if (insertVerificationError) {
      console.error("insert verification error:", insertVerificationError)
      return new Response(
        JSON.stringify({
          success: false,
          error: "INSERT_VERIFICATION_FAILED",
          details: insertVerificationError.message,
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    const waNumber = normalizeWhatsAppNumber(inst.whatsapp_optin_number)
    const message = `أوافق على استقبال إشعارات المؤسسة عبر واتساب - ${consentToken}`
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`

    return new Response(
      JSON.stringify({
        success: true,
        wa_url: waUrl,
        phone: formattedPhone,
        consent_token: consentToken,
        verification_id: inserted.id,
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (e) {
    console.error("CONSENT_START_FATAL_ERROR:", e)

    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "UNKNOWN_ERROR",
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})