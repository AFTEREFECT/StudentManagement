import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  try {
    const { slug, massar_code, claim_code, phone } = await req.json()

    if (!slug || !massar_code || !claim_code || !phone) {
      return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 })
    }

    if (!/^[0-9]{6}$/.test(claim_code)) {
      return new Response(JSON.stringify({ error: "Invalid claim code" }), { status: 400 })
    }

    if (!/^\+?[0-9]{8,15}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    const token = authHeader.replace("Bearer ", "")

    const { data: u, error: ue } = await supabase.auth.getUser(token)
    if (ue || !u?.user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 })
    const user = u.user

    // 1) جلب المؤسسة بالـ slug
    const { data: inst, error: ie } = await supabase
      .from("institutions")
      .select("id")
      .eq("slug", slug)
      .single()

    if (ie || !inst) return new Response(JSON.stringify({ error: "Invalid institution" }), { status: 400 })

    // 2) استهلاك الفوتشر
    const { data: ok, error: ce } = await supabase.rpc("consume_student_claim_6d", {
      p_institution_id: inst.id,
      p_massar_code: massar_code,
      p_claim_code: claim_code
    })

    if (ce || !ok) {
      return new Response(JSON.stringify({ error: "Invalid/expired/locked claim" }), { status: 403 })
    }

    // 3) اربط المستخدم نهائياً (metadata)
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        institution_id: inst.id,
        massar_code: massar_code
      }
    })

    // 4) خزّن تحديث الهاتف (الآن مربوط بمسار)
    const { error: pe } = await supabase.from("phone_updates").insert({
      institution_id: inst.id,
      user_id: user.id,
      massar_code,
      phone
    })
    if (pe) return new Response(JSON.stringify({ error: pe.message }), { status: 400 })

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
  }
})