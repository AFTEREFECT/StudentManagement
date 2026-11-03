export interface TeacherAssignmentImportRow {
  teacher_arabic: string;
  teacher_french: string;
  teacher_id: string;
  ppr: string;
  class: string;
  subject_code: string;
  subject_arabic: string;
}

const normalizeHeader = (value: string) => value
  .replace(/^\uFEFF/, '')
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase()
  .replace(/[\s_\-./()]+/g, '');

const fieldAliases = {
  teacher_arabic: ['اسم الأستاذ بالعربية', 'الأستاذ بالعربية', 'اسم الأستاذ', 'الأستاذ', 'teacherArabic', 'teacher_arabic', 'teacherArabicName', 'arabicName'],
  teacher_french: ['اسم الأستاذ بالفرنسية', 'الأستاذ بالفرنسية', 'teacherFrench', 'teacher_french', 'teacherFrenchName', 'frenchName'],
  teacher_id: ['معرف الأستاذ', 'معرف الاستاذ', 'رقم البطاقة', 'رقم بطاقة الأستاذ', 'رقم مسار', 'مسار', 'teacherId', 'teacher_id', 'teacherCode', 'code'],
  ppr: ['رقم التأجير', 'رقم التاجير', 'رقم الموظف', 'ppr', 'employeeNumber'],
  class: ['القسم', 'القسم الدراسي', 'المستوى والقسم', 'class', 'className', 'section'],
  subject_code: ['رمز المادة', 'رمز النشاط', 'subjectCode', 'subject_code', 'subject'],
  subject_arabic: ['المادة بالعربية', 'اسم المادة', 'المادة', 'subjectArabic', 'subject_arabic', 'subjectName'],
} satisfies Record<keyof TeacherAssignmentImportRow, string[]>;

const normalizedAliases = Object.fromEntries(
  Object.entries(fieldAliases).map(([field, aliases]) => [
    field,
    new Set(aliases.map(normalizeHeader)),
  ]),
) as Record<keyof TeacherAssignmentImportRow, Set<string>>;

function rowValue(row: Record<string, unknown>, aliases: Set<string>): string {
  const entry = Object.entries(row).find(([header]) => aliases.has(normalizeHeader(header)));
  const value = entry?.[1];
  return value === null || value === undefined ? '' : String(value).trim();
}

export function mapTeacherAssignmentRows(rows: Array<Record<string, unknown>>): {
  assignments: TeacherAssignmentImportRow[];
  skippedRows: number;
} {
  const mapped = rows.map((row) => ({
    teacher_arabic: rowValue(row, normalizedAliases.teacher_arabic),
    teacher_french: rowValue(row, normalizedAliases.teacher_french),
    teacher_id: rowValue(row, normalizedAliases.teacher_id),
    ppr: rowValue(row, normalizedAliases.ppr),
    class: rowValue(row, normalizedAliases.class),
    subject_code: rowValue(row, normalizedAliases.subject_code),
    subject_arabic: rowValue(row, normalizedAliases.subject_arabic),
  }));
  const assignments = mapped.filter((row) => row.class && row.teacher_id);
  if (!assignments.length) {
    const headers = rows[0] ? Object.keys(rows[0]).join('، ') : 'لا توجد عناوين أعمدة';
    throw new Error(`لم يُعثر على توزيعات صالحة. يجب أن يحتوي الملف على عمودي "معرف الأستاذ" و"القسم" على الأقل. العناوين الموجودة: ${headers}`);
  }
  return { assignments, skippedRows: rows.length - assignments.length };
}

export const teacherAssignmentTemplateHeaders = [
  'اسم الأستاذ بالعربية',
  'اسم الأستاذ بالفرنسية',
  'معرف الأستاذ',
  'رقم التأجير',
  'القسم',
  'رمز المادة',
  'المادة بالعربية',
];

export const teacherAssignmentTemplateInstructions = [
  ['التعليمات', 'التفاصيل'],
  ['الأعمدة الإلزامية', 'معرف الأستاذ، القسم'],
  ['الأعمدة الاختيارية', 'اسم الأستاذ بالعربية، اسم الأستاذ بالفرنسية، رقم التأجير، رمز المادة، المادة بالعربية'],
  ['طريقة الإدخال', 'استخدم صفاً مستقلاً لكل أستاذ وقسم ومادة.'],
  ['معرف الأستاذ', 'استخدم المعرّف نفسه المعتمد في المؤسسة وملفات الجداول.'],
  ['الأرقام والمعرّفات', 'تُقرأ كنصوص للحفاظ على الأصفار في بداية الرمز.'],
];
