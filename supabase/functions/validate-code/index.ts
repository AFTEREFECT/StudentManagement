import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  try {
    const { phone, slug } = await req.json()

    if (!phone || !slug) {
      return new Response(
        JSON.stringify({ error: "Missing phone or slug" }),
        { status: 400 }
      )
    }

    if (!/^\+?[0-9]{8,15}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format" }),
        { status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // التحقق من التوكن
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401 }
      )
    }

    // جلب المؤسسة عبر slug
    const { data: institution, error: instError } =
      await supabase
        .from("institutions")
        .select("id")
        .eq("slug", slug)
        .single()

    if (instError || !institution) {
      return new Response(
        JSON.stringify({ error: "Invalid institution" }),
        { status: 400 }
      )
    }

    // منع التلاعب بالمؤسسة
    if (user.user_metadata?.institution_id !== institution.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403 }
      )
    }

    // إدخال الرقم
    const { error: insertError } = await supabase
      .from("phone_updates")
      .insert({
        user_id: user.id,
        institution_id: institution.id,
        phone: phone
      })

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500 }
    )
  }
})