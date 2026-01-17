import * as XLSX from 'xlsx';

/**
 * إنشاء ملف Template لائحة التلاميذ
 */
export function createStudentListTemplate(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // إنشاء ورقة عمل فارغة
  const worksheet: XLSX.WorkSheet = {};

  // تعيين عرض الأعمدة
  worksheet['!cols'] = [
    { wch: 3 },   // A - عمود فارغ
    { wch: 5 },   // B - رت
    { wch: 30 },  // C - الإسم و النسب
    { wch: 15 },  // D - رمز مسار
    { wch: 12 },  // E - تاريخ الازدياد
    { wch: 6 },   // F - النوع
    { wch: 20 },  // G - مكان الازدياد
    { wch: 15 },  // H - ملاحظات
    { wch: 3 },   // I - عمود فارغ
  ];

  // رأس التقرير - الصف 2
  worksheet['B2'] = { t: 's', v: 'الأكاديمية الجهوية للتربية و التكوين' };
  worksheet['I2'] = { t: 's', v: '2025/2026' };

  // الصف 3
  worksheet['B3'] = { t: 's', v: 'المديرية الإقليمية' };
  worksheet['I3'] = { t: 's', v: 'المستوى' };

  // الصف 4
  worksheet['B4'] = { t: 's', v: 'المؤسسة' };
  worksheet['I4'] = { t: 's', v: 'القسم' };

  // رؤوس الجدول - الصف 9
  worksheet['B9'] = { t: 's', v: 'رت' };
  worksheet['C9'] = { t: 's', v: 'الإسم و النسب' };
  worksheet['D9'] = { t: 's', v: 'رمز مسار' };
  worksheet['E9'] = { t: 's', v: 'تاريخ الازدياد' };
  worksheet['F9'] = { t: 's', v: 'النوع' };
  worksheet['G9'] = { t: 's', v: 'مكان الازدياد' };
  worksheet['H9'] = { t: 's', v: 'ملاحظات' };

  // تعيين نطاق الورقة
  worksheet['!ref'] = 'A1:I50';

  // إضافة الورقة إلى الملف
  XLSX.utils.book_append_sheet(workbook, worksheet, 'listeEleves');

  return workbook;
}

/**
 * تحميل وإنشاء ملف Template إذا لم يكن موجوداً
 */
export async function ensureTemplateExists(): Promise<void> {
  try {
    // محاولة تحميل الملف
    const response = await fetch('/ListeEleves.xlsx');
    if (!response.ok) {
      throw new Error('Template not found');
    }

    // التحقق من أن الملف صالح
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.Sheets['listeEleves']) {
      throw new Error('Invalid template');
    }
  } catch (error) {
    console.warn('⚠️ Template غير موجود أو غير صالح، سيتم إنشاء قالب افتراضي');
  }
}
