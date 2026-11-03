import * as XLSX from "xlsx";
import { dbManager } from "./database";

export interface PhoneImportResultRow {
  rowNumber: number;
  massarCode: string;
  fatherPhoneRaw: string;
  motherPhoneRaw: string;
  fatherPhoneNormalized: string;
  motherPhoneNormalized: string;
  selectedPhone: string;
  selectedSource: string;
  status: "updated" | "skipped" | "not_found" | "no_phone";
  note: string;
}

export interface PhoneImportResult {
  success: boolean;
  totalRows: number;
  updated: number;
  skipped: number;
  notFound: number;
  noPhone: number;
  preserved: number;
  details: PhoneImportResultRow[];
}

function getCellValue(sheet: XLSX.WorkSheet, column: string, rowNumber: number): string {
  const ref = `${String(column).trim().toUpperCase()}${rowNumber}`;
  const cell = sheet[ref];
  if (!cell) return "";
  return String(cell.w ?? cell.v ?? "").trim();
}

export function normalizeMoroccanPhone(phone: string): string {
  if (!phone) return "";

  let clean = String(phone).trim();

  clean = clean.replace(/[^\d+]/g, "");

  if (clean.startsWith("+")) {
    clean = clean.slice(1);
  }

  if (clean.startsWith("00212")) {
    clean = clean.slice(2);
  }

  if (clean.startsWith("212") && clean.length === 12) {
    return clean;
  }

  if (clean.startsWith("0") && clean.length === 10) {
    return "212" + clean.slice(1);
  }

  if (/^[5-7]\d{8}$/.test(clean)) {
    return "212" + clean;
  }

  return "";
}

function choosePreferredPhone(fatherPhone: string, motherPhone: string): { phone: string; source: string } {
  if (fatherPhone) {
    return { phone: fatherPhone, source: "father" };
  }

  if (motherPhone) {
    return { phone: motherPhone, source: "mother" };
  }

  return { phone: "", source: "" };
}

function getLastRowNumber(sheet: XLSX.WorkSheet): number {
  if (!sheet["!ref"]) return 0;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  return range.e.r + 1;
}

/**
 * الاستيراد النهائي حسب ملف Tuteur
 * رقم مسار في العمود C
 * هاتف الأب في العمود U (اللون الأصفر)
 * هاتف الأم في العمود AC (اللون الأزرق)
 * يبدأ من السطر 10
 */
export async function importPhonesFromTuteurExcel(file: File): Promise<PhoneImportResult> {
  await dbManager.initialize();
  await dbManager.ensurePhoneImportColumns();

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const sheetName = "Tuteur";
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("تعذر العثور على الورقة Tuteur داخل ملف Excel");
  }

  const db: any = dbManager.getDatabaseInstance();
  if (!db) {
    throw new Error("قاعدة البيانات غير مهيأة");
  }

  const startRow = 10;
  const massarColumn = "C";
  const fatherPhoneColumn = "U";  // الأصفر = الأب
  const motherPhoneColumn = "AC"; // الأزرق = الأم

  const lastRow = getLastRowNumber(sheet);

  const details: PhoneImportResultRow[] = [];

  let totalRows = 0;
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let noPhone = 0;
  let preserved = 0;

  for (let rowNumber = startRow; rowNumber <= lastRow; rowNumber++) {
    const massarCode = getCellValue(sheet, massarColumn, rowNumber);
    const fatherPhoneRaw = getCellValue(sheet, fatherPhoneColumn, rowNumber);
    const motherPhoneRaw = getCellValue(sheet, motherPhoneColumn, rowNumber);

    if (!massarCode && !fatherPhoneRaw && !motherPhoneRaw) {
      continue;
    }

    totalRows++;

    const fatherPhoneNormalized = normalizeMoroccanPhone(fatherPhoneRaw);
    const motherPhoneNormalized = normalizeMoroccanPhone(motherPhoneRaw);

    const preferred = choosePreferredPhone(fatherPhoneNormalized, motherPhoneNormalized);

    if (!massarCode) {
      skipped++;
      details.push({
        rowNumber,
        massarCode: "",
        fatherPhoneRaw,
        motherPhoneRaw,
        fatherPhoneNormalized,
        motherPhoneNormalized,
        selectedPhone: "",
        selectedSource: "",
        status: "skipped",
        note: "رقم مسار فارغ"
      });
      continue;
    }

    const stmt = db.prepare(`
      SELECT id, phone, fatherPhone, motherPhone, phoneSource
      FROM students
      WHERE nationalId = ?
      LIMIT 1
    `);
    stmt.bind([massarCode]);

    let student: any = null;
    if (stmt.step()) {
      student = stmt.getAsObject();
    }
    stmt.free();

    if (!student) {
      notFound++;
      details.push({
        rowNumber,
        massarCode,
        fatherPhoneRaw,
        motherPhoneRaw,
        fatherPhoneNormalized,
        motherPhoneNormalized,
        selectedPhone: "",
        selectedSource: "",
        status: "not_found",
        note: "التلميذ غير موجود في قاعدة البيانات"
      });
      continue;
    }

    const currentPhone = String(student.phone || "").trim();
    const currentFatherPhone = String(student.fatherPhone || "").trim();
    const currentMotherPhone = String(student.motherPhone || "").trim();
    const currentPhoneSource = String(student.phoneSource || "").trim();

    const finalFatherPhone = fatherPhoneNormalized || currentFatherPhone;
    const finalMotherPhone = motherPhoneNormalized || currentMotherPhone;

    let finalPhone = currentPhone;
    let finalPhoneSource = currentPhoneSource;

    if (!preferred.phone) {
      noPhone++;

      db.run(
        `
        UPDATE students
        SET fatherPhone = ?, motherPhone = ?, updatedAt = ?
        WHERE nationalId = ?
        `,
        [
          finalFatherPhone,
          finalMotherPhone,
          new Date().toISOString(),
          massarCode
        ]
      );

      details.push({
        rowNumber,
        massarCode,
        fatherPhoneRaw,
        motherPhoneRaw,
        fatherPhoneNormalized,
        motherPhoneNormalized,
        selectedPhone: currentPhone,
        selectedSource: currentPhoneSource,
        status: "no_phone",
        note: "لا يوجد رقم صالح للأب أو الأم"
      });

      continue;
    }

    if (!currentPhone) {
      finalPhone = preferred.phone;
      finalPhoneSource = preferred.source;
    } else {
      preserved++;
    }

    db.run(
      `
      UPDATE students
      SET
        phone = ?,
        fatherPhone = ?,
        motherPhone = ?,
        phoneSource = ?,
        guardianPhone = CASE
          WHEN guardianPhone IS NULL OR TRIM(guardianPhone) = '' THEN ?
          ELSE guardianPhone
        END,
        updatedAt = ?
      WHERE nationalId = ?
      `,
      [
        finalPhone,
        finalFatherPhone,
        finalMotherPhone,
        finalPhoneSource,
        finalPhone,
        new Date().toISOString(),
        massarCode
      ]
    );

    updated++;

    details.push({
      rowNumber,
      massarCode,
      fatherPhoneRaw,
      motherPhoneRaw,
      fatherPhoneNormalized,
      motherPhoneNormalized,
      selectedPhone: finalPhone,
      selectedSource: finalPhoneSource,
      status: "updated",
      note: currentPhone
        ? "تم حفظ بيانات الأب/الأم مع الإبقاء على الهاتف الحالي"
        : "تم اعتماد الرقم تلقائيًا"
    });
  }

  if (typeof (dbManager as any).saveDatabase === "function") {
    await (dbManager as any).saveDatabase();
  }

  return {
    success: true,
    totalRows,
    updated,
    skipped,
    notFound,
    noPhone,
    preserved,
    details
  };
}