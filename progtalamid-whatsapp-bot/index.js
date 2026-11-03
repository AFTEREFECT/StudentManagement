import 'dotenv/config'
import express from 'express'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(express.json())

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// تطبيع مغربي: 06 / 212 / +212 -> +212XXXXXXXXX
function normalizeMoroccanNumber(n) {
  if (!n) return null
  const digits = String(n).replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('212')) return '+212' + digits.slice(3)
  if (digits.startsWith('0')) return '+212' + digits.slice(1)
  if (digits.length === 9) return '+212' + digits
  return '+212' + digits
}

// Parse: "123456 0612345678"
function parseStudentMsg(text) {
  const t = (text || '').trim()
  const m = t.match(/^(\d{6})\s+(\+?\d{8,15}|0\d{9})$/)
  if (!m) return null
  return { code: m[1], phoneRaw: m[2] }
}

/**
 * هذا Webhook يستقبل من مزود الواتساب عندك
 * body المتوقع:
 * {
 *   "toNumber": "2126.... أو +2126....",     // رقم المؤسسة الذي استقبل الرسالة
 *   "fromNumber": "2126.... أو +2126....",   // رقم التلميذ
 *   "text": "123456 0612345678"
 * }
 */
app.post('/webhook', async (req, res) => {
  try {
    const { toNumber, fromNumber, text } = req.body || {}

    const parsed = parseStudentMsg(text)
    if (!parsed) {
      return res.json({ reply: 'أرسل: 6 أرقام + رقم الهاتف. مثال: 123456 0612345678' })
    }

    const toNorm = normalizeMoroccanNumber(toNumber)
    const phoneNorm = normalizeMoroccanNumber(parsed.phoneRaw)

    if (!toNorm || !phoneNorm) {
      return res.json({ reply: 'رقم غير صالح. أعد المحاولة.' })
    }

    // 1) تحديد المؤسسة من whatsapp_phone_number
    const { data: inst, error: ie } = await supabase
      .from('institutions')
      .select('id')
      .eq('whatsapp_phone_number', toNorm)
      .single()

    if (ie || !inst) {
      return res.json({ reply: 'تعذر تحديد المؤسسة (تحقق من whatsapp_phone_number في institutions).' })
    }

    // 2) استهلاك الفوتشر واستخراج رقم مسار
    const { data: rows, error: ce } = await supabase.rpc('consume_claim_by_code_6d', {
      p_institution_id: inst.id,
      p_claim_code: parsed.code
    })

    if (ce || !rows?.length || !rows[0].ok) {
      return res.json({ reply: 'الكود غير صحيح/منتهي/تم استعماله أو مقفول. اطلب كود جديد.' })
    }

    const massar_code = rows[0].massar_code

    // 3) تسجيل التحديث
    const { error: pe } = await supabase.from('phone_updates').insert({
      institution_id: inst.id,
      massar_code,
      phone: phoneNorm,
      // اختياري للتتبع:
      // whatsapp_sender: normalizeMoroccanNumber(fromNumber)
    })

    if (pe) {
      return res.json({ reply: 'وقع خطأ أثناء الحفظ. حاول لاحقًا.' })
    }

    return res.json({ reply: 'تم حفظ رقم هاتفك بنجاح ✅' })
  } catch (e) {
    return res.json({ reply: 'Server error' })
  }
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => console.log(`Webhook listening on :${port}`))