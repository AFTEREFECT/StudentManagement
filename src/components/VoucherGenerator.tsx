import { useEffect, useState } from "react"
import { dbManager } from "../utils/database"
import QRCode from "qrcode"
import { supabase } from "../lib/supabaseClient"

const SUPABASE_FUNCTION_URL =
  "https://benjzaxxkcjwnrfllvel.supabase.co/functions/v1/issue-voucher"

type Student = {
  id?: string
  name: string
  nationalId: string
  level?: string
  section?: string
}

type GeneratedVoucher = {
  name: string
  massar: string
  voucher: string
}

export default function VoucherGenerator() {
  const [institutionId, setInstitutionId] = useState("")
  const [levels, setLevels] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])
  const [selectedLevel, setSelectedLevel] = useState("")
  const [selectedSection, setSelectedSection] = useState("")
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [results, setResults] = useState<GeneratedVoucher[]>([])
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [qrLoading, setQrLoading] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      await dbManager.initialize()
      const studs = await dbManager.getStudents()

      setAllStudents(studs)

      const uniqueLevels = Array.from(
        new Set(studs.map((s: Student) => s.level).filter(Boolean))
      ) as string[]

      setLevels(uniqueLevels)

      const inst = localStorage.getItem("institutionId")
      if (inst) setInstitutionId(inst)
    }

    loadData()
  }, [])

  useEffect(() => {
    if (!selectedLevel) {
      setSections([])
      return
    }

    const levelSections = Array.from(
      new Set(
        allStudents
          .filter((s) => s.level === selectedLevel)
          .map((s) => s.section)
          .filter(Boolean)
      )
    ) as string[]

    setSections(levelSections)
  }, [selectedLevel, allStudents])

  useEffect(() => {
    if (!selectedLevel || !selectedSection) {
      setStudents([])
      return
    }

    const filtered = allStudents.filter(
      (s) => s.level === selectedLevel && s.section === selectedSection
    )

    setStudents(filtered)
  }, [selectedLevel, selectedSection, allStudents])

  const generateVouchers = async () => {
    if (!institutionId || !selectedLevel || !selectedSection) {
      alert("املأ جميع الحقول")
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const accessToken = session?.access_token

    if (!accessToken) {
      alert("يجب تسجيل الدخول أولاً")
      return
    }

    setLoading(true)
    setResults([])

    try {
      const generated: GeneratedVoucher[] = []

      for (const student of students) {
        const res = await fetch(SUPABASE_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            institutionId,
            massarCode: student.nationalId,
            hours: 72,
          }),
        })

        const payload = await res.json().catch(() => ({}))

        if (!res.ok) {
          console.error("issue-voucher failed:", payload)
          continue
        }

        if (!payload?.voucher) {
          continue
        }

        generated.push({
          name: student.name,
          massar: student.nationalId,
          voucher: payload.voucher,
        })
      }

      setResults(generated)
      alert(`تم توليد ${generated.length} رمز بنجاح`)
    } catch (err) {
      console.error(err)
      alert("حدث خطأ أثناء التوليد")
    } finally {
      setLoading(false)
    }
  }

  const generatePhoneQR = async () => {
    if (!institutionId || !selectedSection) {
      alert("اختر القسم أولاً")
      return
    }

    setQrLoading(true)

    try {
      const qrUrl = `https://progtalamid.com/#phone-activation?inst=${institutionId}&class=${selectedSection}`

      const qrData = await QRCode.toDataURL(qrUrl, {
        width: 256,
        margin: 1,
      })

      setQrDataUrl(qrData)

      const printWindow = window.open("", "_blank")
      printWindow?.document.write(`
        <html>
          <body style="font-family:Arial;text-align:center;padding:40px">
            <h1>QR تفعيل الهواتف</h1>
            <h2>القسم ${selectedSection}</h2>
            <img src="${qrData}" style="width:280px"/>
            <p>عدد التلاميذ ${students.length}</p>
            <button onclick="window.print()">طباعة</button>
          </body>
        </html>
      `)
    } catch (e) {
      console.error(e)
      alert("خطأ في توليد QR")
    } finally {
      setQrLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          background: "linear-gradient(135deg,#667eea,#764ba2)",
          padding: "2rem",
          borderRadius: "24px",
          color: "white",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>
          🎫 توليد رموز التفعيل
        </h1>

        <p>اختر القسم → توليد رموز → QR لتفعيل الهواتف</p>
      </div>

      <div
        style={{
          background: "white",
          padding: "2rem",
          borderRadius: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <label>المستوى</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "10px" }}
          >
            <option value="">اختر المستوى</option>
            {levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label>القسم</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "10px" }}
          >
            <option value="">اختر القسم</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            onClick={generateVouchers}
            disabled={loading}
            style={{
              flex: 1,
              padding: "14px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "12px",
            }}
          >
            {loading ? "جاري التوليد..." : `🎫 توليد رموز (${students.length})`}
          </button>

          <button
            onClick={generatePhoneQR}
            disabled={qrLoading}
            style={{
              flex: 1,
              padding: "14px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "12px",
            }}
          >
            📱 QR تفعيل الهواتف
          </button>
        </div>

        {results.length > 0 && (
          <div>
            <h3 style={{ marginBottom: 16 }}>النتائج</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>الاسم</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>مسار</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Voucher</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, idx) => (
                  <tr key={`${row.massar}-${idx}`}>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{row.name}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{row.massar}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8, fontWeight: "bold" }}>
                      {row.voucher}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {qrDataUrl && (
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <img src={qrDataUrl} alt="QR" style={{ width: 220 }} />
          </div>
        )}
      </div>
    </div>
  )
}