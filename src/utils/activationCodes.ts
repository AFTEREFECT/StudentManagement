import QRCode from "qrcode";
import { supabase } from "./supabase";
import { dbManager } from "./database";
import { getEncryptedItem } from "./encryption";

function randomCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function buildActivationUrl(code: string, nationalId?: string): string {
  const url = new URL("https://activationphone.progtalamid.com/");

  url.searchParams.set("v", code);

  if (nationalId && String(nationalId).trim() !== "") {
    url.searchParams.set("id", String(nationalId).trim());
  }

  return url.toString();
}

async function ensureInstitutionId(): Promise<string> {
  await dbManager.initialize();

  const settings = await dbManager.getInstitutionSettings();
  let institutionId = settings?.supabaseInstitutionId || "";

  if (institutionId) {
    return institutionId;
  }

  const localLicense = await getEncryptedItem("license_data");
  const licenseKey = localLicense?.key ? String(localLicense.key).trim().toUpperCase() : "";

  if (!licenseKey) {
    throw new Error("لم يتم العثور على license_data محليًا. أعد تفعيل البرنامج أولًا.");
  }

  const { data: license, error: licenseError } = await supabase
    .from("subscription_licenses")
    .select("institution_id, license_key")
    .eq("license_key", licenseKey)
    .maybeSingle();

  if (licenseError) {
    throw new Error("تعذر جلب بيانات الترخيص من Supabase.");
  }

  institutionId = String(license?.institution_id || "").trim();

  if (!institutionId) {
    throw new Error("الترخيص الحالي لا يحتوي على institution_id في Supabase.");
  }

  await dbManager.saveInstitutionSettings({
    ...(settings || {}),
    institution: settings?.institution || "",
    academy: settings?.academy || "",
    directorate: settings?.directorate || "",
    municipality: settings?.municipality || "",
    academicYear: settings?.academicYear || "2025/2026",
    institutionCode: settings?.institutionCode || settings?.code || "",
    supabaseInstitutionId: institutionId,
    institutionActivationCode: settings?.institutionActivationCode || "",
    updatedAt: new Date().toISOString()
  });

  return institutionId;
}

export const generateActivationCodes = async () => {
  await dbManager.initialize();

  const institutionId = await ensureInstitutionId();

  const db: any = dbManager.getDatabaseInstance();

  if (!db) {
    throw new Error("قاعدة البيانات غير مهيأة");
  }

  const stmt = db.prepare(`
    SELECT id, nationalId, firstName, lastName
    FROM students
    WHERE nationalId IS NOT NULL
      AND TRIM(nationalId) <> ''
      AND status = 'متمدرس'
  `);

  const results: any[] = [];

  try {
    while (stmt.step()) {
      const student = stmt.getAsObject() as any;

      const studentId = String(student.id || "").trim();
      const nationalId = String(student.nationalId || "").trim();

      if (!studentId || !nationalId) {
        continue;
      }

      let code = "";

      const existingStmt = db.prepare(`
        SELECT code
        FROM activation_codes
        WHERE student_id = ?
        LIMIT 1
      `);

      existingStmt.bind([studentId]);

      if (existingStmt.step()) {
        const existing = existingStmt.getAsObject() as any;
        code = String(existing.code || "").trim();
      }

      existingStmt.free();

      if (!code) {
        code = randomCode(8);

        db.run(
          `
          INSERT OR REPLACE INTO activation_codes (student_id, national_id, code, used)
          VALUES (?, ?, ?, 0)
          `,
          [studentId, nationalId, code]
        );
      } else {
        db.run(
          `
          UPDATE activation_codes
          SET national_id = ?
          WHERE student_id = ?
          `,
          [nationalId, studentId]
        );
      }

      const { error: supabaseError } = await supabase
        .from("activation_codes")
        .upsert(
          {
            activation_code: code,
            massar_code: nationalId,
            institution_id: institutionId,
            used: false
          },
          {
            onConflict: "activation_code"
          }
        );

localStorage.removeItem('device_fp');
localStorage.removeItem('institution_settings_backup');
localStorage.removeItem('institutionSettings');


      if (supabaseError) {
        console.error("خطأ أثناء رفع الكود إلى Supabase:", supabaseError);
        continue;
      }

      const activationUrl = buildActivationUrl(code, nationalId);
      const qr = await QRCode.toDataURL(activationUrl);

      results.push({
        studentId,
        nationalId,
        studentName: `${student.lastName || ""} ${student.firstName || ""}`.trim(),
        code,
        url: activationUrl,
        qr
      });

      console.log("Student ID:", studentId);
      console.log("National ID:", nationalId);
      console.log("Voucher:", code);
      console.log("URL:", activationUrl);
      console.log("Institution ID:", institutionId);
      console.log("Supabase sync: OK");
    }
  } finally {
    stmt.free();
  }

  return results;
};