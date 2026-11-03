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

function normalizePhone(phone: any): string {
  if (!phone) return "";

  let clean = String(phone).trim();
  clean = clean.replace(/[^\d+]/g, "");

  if (clean.startsWith("+")) clean = clean.slice(1);
  if (clean.startsWith("00212")) clean = clean.slice(2);

  if (clean.startsWith("212") && clean.length === 12) {
    return clean;
  }

  if (clean.startsWith("0") && clean.length === 10) {
    return "212" + clean.substring(1);
  }

  if (/^[5-7]\d{8}$/.test(clean)) {
    return "212" + clean;
  }

  return "";
}

function chooseContactPhone(father: string, mother: string): { phone: string; source: string } {
  if (father) return { phone: father, source: "father" };
  if (mother) return { phone: mother, source: "mother" };
  return { phone: "", source: "" };
}

function getLastRowNumber(sheet: XLSX.WorkSheet): number {
  if (!sheet["!ref"]) return 0;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  return range.e.r + 1;
}

export async function importParentsFromExcel(file: File): Promise<PhoneImportResult> {
  await dbManager.initialize();
  await dbManager.ensurePhoneImportColumns();

  const db: any = dbManager.getDatabaseInstance();
  if (!db) throw new Error("قاعدة البيانات غير جاهزة");

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  const sheet = workbook.Sheets["Tuteur"];
  if (!sheet) throw new Error("ورقة Tuteur غير موجودة داخل ملف Excel");

  const startRow = 10;
  const massarColumn = "C";
  const fatherPhoneColumn = "U";  // الأب
  const motherPhoneColumn = "AC"; // الأم

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

    const fatherPhoneNormalized = normalizePhone(fatherPhoneRaw);
    const motherPhoneNormalized = normalizePhone(motherPhoneRaw);
    const preferred = chooseContactPhone(fatherPhoneNormalized, motherPhoneNormalized);

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

    const studentStmt = db.prepare(`
      SELECT id, phone
      FROM students
      WHERE nationalId = ?
      LIMIT 1
    `);
    studentStmt.bind([massarCode]);

    let student: any = null;
    if (studentStmt.step()) {
      student = studentStmt.getAsObject();
    }
    studentStmt.free();

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

    const studentId = String(student.id || "").trim();
    const currentPhone = String(student.phone || "").trim();

    db.run(`DELETE FROM parents WHERE student_id = ?`, [studentId]);

    if (fatherPhoneRaw || fatherPhoneNormalized) {
      db.run(
        `
        INSERT INTO parents (id, student_id, relation, parent_name, phone_1, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          crypto.randomUUID(),
          studentId,
          "أب",
          "الأب",
          fatherPhoneNormalized,
          new Date().toISOString()
        ]
      );
    }

    if (motherPhoneRaw || motherPhoneNormalized) {
      db.run(
        `
        INSERT INTO parents (id, student_id, relation, parent_name, phone_1, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          crypto.randomUUID(),
          studentId,
          "أم",
          "الأم",
          motherPhoneNormalized,
          new Date().toISOString()
        ]
      );
    }

    if (!preferred.phone) {
      noPhone++;
      details.push({
        rowNumber,
        massarCode,
        fatherPhoneRaw,
        motherPhoneRaw,
        fatherPhoneNormalized,
        motherPhoneNormalized,
        selectedPhone: currentPhone,
        selectedSource: "",
        status: "no_phone",
        note: "لا يوجد رقم صالح للأب أو الأم"
      });
      continue;
    }

    let finalPhone = currentPhone;
    let finalSource = "";

    if (!currentPhone) {
      finalPhone = preferred.phone;
      finalSource = preferred.source;
    } else {
      preserved++;
      finalSource = "preserved";
    }

    db.run(
      `
      UPDATE students
      SET phone = ?, updatedAt = ?
      WHERE id = ?
      `,
      [finalPhone, new Date().toISOString(), studentId]
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
      selectedSource: finalSource,
      status: "updated",
      note: currentPhone
        ? "تم حفظ بيانات الأبوين مع الإبقاء على الهاتف الحالي"
        : "تم اعتماد الهاتف تلقائيًا"
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
export interface MultiFileImportResult {
  success: boolean;
  filesCount: number;
  updated: number;
  skipped: number;
  notFound: number;
  noPhone: number;
  preserved: number;
  results: {
    fileName: string;
    result: PhoneImportResult;
  }[];
}

export async function importParentsFromMultipleExcels(files: File[]): Promise<MultiFileImportResult> {
  const results: { fileName: string; result: PhoneImportResult }[] = [];

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let noPhone = 0;
  let preserved = 0;

  for (const file of files) {
    const result = await importParentsFromExcel(file);

    results.push({
      fileName: file.name,
      result
    });

    updated += result.updated;
    skipped += result.skipped;
    notFound += result.notFound;
    noPhone += result.noPhone;
    preserved += result.preserved;
  }

  return {
    success: true,
    filesCount: files.length,
    updated,
    skipped,
    notFound,
    noPhone,
    preserved,
    results
  };
}