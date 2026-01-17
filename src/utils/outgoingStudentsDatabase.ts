import * as XLSX from 'xlsx';
import { dbManager } from './database';

// قاعدة بيانات مستقلة تماماً للتلاميذ المغادرين
// منفصلة بشكل كامل عن قاعدة بيانات التلاميذ الأصليين

export interface OutgoingStudent {
  id: string;
  studentId: string;           // رقم التلميذ (رقم مسار)
  lastName: string;            // النسب
  firstName: string;           // الاسم الشخصي

  // معلومات التحويل
  transferDate: string;        // تاريخ التحويل/المغادرة
  transferType: string;        // نوع التحويل

  // المؤسسة الأصلية (من أين غادر)
  originalInstitution: string; // المؤسسة الأصلية
  originalDirectorate: string; // المديرية الأصلية
  originalAcademy: string;     // الأكاديمية الأصلية

  // مؤسسة الاستقبال (إلى أين ذهب)
  destinationInstitution: string; // المؤسسة المستقبلة
  destinationDirectorate: string; // المديرية المستقبلة
  destinationAcademy: string;     // الأكاديمية المستقبلة

  // البيانات الوصفية المستخرجة من الملف
  academy: string;             // الأكاديمية (C5)
  directorate: string;         // المديرية (C6)
  level: string;              // المستوى (C7)
  municipality: string;        // الجماعة (G5)
  institution: string;         // المؤسسة (G6)
  academicYear: string;        // السنة الدراسية (G7)

  // حالة إرسال الملف (4 حالات)
  fileStatus: 'لم يُرسل' | 'تم الإرسال' | 'مؤجل' | 'ملغى';

  // المرجع الإداري (رقم المغادرة)
  administrativeReference: string; // رقم المغادرة (يُضاف يدوياً)

  // تتبع عمليات الإرسال
  sendCount: number;           // عدد مرات الإرسال
  sendDates: string[];         // تواريخ جميع الإرسالات
  lastSendDate?: string;       // آخر تاريخ إرسال

  // سجل المراسلات
  correspondenceHistory: CorrespondenceRecord[];

  // الجنس (يُستكمل من قاعدة البيانات الرئيسية)
  gender?: 'ذكر' | 'أنثى';
  linkedGender?: 'ذكر' | 'أنثى' | 'غير محدد';
  isLinked: boolean;           // هل تم العثور على التلميذ في القاعدة الرئيسية

  // ملاحظات
  notes: string;               // ملاحظات إضافية

  createdAt: string;
  updatedAt: string;
}

// سجل مراسلة واحدة
export interface CorrespondenceRecord {
  id: string;
  date: string;                    // تاريخ المراسلة
  sendingNumber: string;           // رقم الإرسال
  reference: string;               // المرجع
  administrativeReference: string; // رقم المغادرة
  status: string;                  // حالة الإرسال
  notes: string;                   // ملاحظات
  type: 'فردي' | 'جماعي';         // نوع الطلب
}

// سجل إرسال ملف
interface FileSend {
  id: string;
  studentId: string;
  studentName: string;
  sendingNumber: string;
  reference: string;
  administrativeReference: string;
  sendDate: string;
  destinationInstitution: string;
  destinationDirectorate: string;
  destinationAcademy: string;
  requestType: 'فردي' | 'جماعي';
  regionalScope: 'داخل الإقليم' | 'خارج الإقليم';
  pdfGenerated: boolean;
  notes: string;
}

// نتيجة الاستيراد
export interface ImportResult {
  success: number;
  errors: string[];
  warnings: string[];
  duplicates: number;
  linked: number;              // عدد التلاميذ المرتبطين بالقاعدة الرئيسية
  unlinked: number;            // عدد التلاميذ غير المرتبطين
}

class OutgoingStudentsDatabase {
  private readonly STORAGE_KEY = 'outgoingStudentsData';
  private readonly SENDS_KEY = 'outgoingStudentSends';

  // تحميل جميع التلاميذ المغادرين مع محاولة الربط
  async getAllStudents(): Promise<OutgoingStudent[]> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const students: OutgoingStudent[] = data ? JSON.parse(data) : [];

      // محاولة الربط مع القاعدة الرئيسية لاستكمال الجنس
      return await this.linkWithMainDatabase(students);
    } catch (error) {
      console.error('خطأ في تحميل بيانات التلاميذ المغادرين:', error);
      return [];
    }
  }

  // ربط اختياري مع قاعدة البيانات الرئيسية لاستكمال الجنس فقط
  private async linkWithMainDatabase(outgoingStudents: OutgoingStudent[]): Promise<OutgoingStudent[]> {
    try {
      // جلب جميع التلاميذ من القاعدة الرئيسية
      const allStudents = await dbManager.getStudents();

      return outgoingStudents.map(outgoingStudent => {
        // البحث بالرقم الوطني أو رقم التلميذ
        const matchedStudent = allStudents.find(s =>
          s.nationalId === outgoingStudent.studentId ||
          s.studentId === outgoingStudent.studentId
        );

        if (matchedStudent) {
          return {
            ...outgoingStudent,
            gender: matchedStudent.gender,
            linkedGender: matchedStudent.gender,
            isLinked: true
          };
        } else {
          return {
            ...outgoingStudent,
            linkedGender: 'غير محدد',
            isLinked: false
          };
        }
      });
    } catch (error) {
      console.warn('خطأ في ربط البيانات مع القاعدة الرئيسية:', error);
      // إرجاع البيانات بدون ربط في حالة الخطأ
      return outgoingStudents.map(student => ({
        ...student,
        linkedGender: 'غير محدد',
        isLinked: false
      }));
    }
  }

  // حفظ جميع التلاميذ المغادرين
  private async saveAllStudents(students: OutgoingStudent[]): Promise<void> {
    try {
      // حفظ البيانات الأساسية فقط (بدون البيانات المرتبطة)
      const studentsToSave = students.map(student => {
        const { linkedGender, isLinked, ...basicData } = student;
        return basicData;
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(studentsToSave));
    } catch (error) {
      console.error('خطأ في حفظ بيانات التلاميذ المغادرين:', error);
      throw error;
    }
  }

  // إضافة تلميذ مغادر جديد
  async addStudent(studentData: Omit<OutgoingStudent, 'id' | 'createdAt' | 'updatedAt' | 'linkedGender' | 'isLinked'>): Promise<string> {
    try {
      const students = await this.getAllStudents();

      // التحقق من عدم وجود تكرار
      const existingStudent = students.find(s => s.studentId === studentData.studentId);
      if (existingStudent) {
        throw new Error(`التلميذ برقم ${studentData.studentId} موجود مسبقاً في قائمة المغادرين`);
      }

      const newStudent: OutgoingStudent = {
        ...studentData,
        id: crypto.randomUUID(),
        isLinked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      students.push(newStudent);
      await this.saveAllStudents(students);

      return newStudent.id;
    } catch (error) {
      console.error('خطأ في إضافة التلميذ المغادر:', error);
      throw error;
    }
  }

  // تحديث بيانات تلميذ مغادر
  async updateStudent(studentId: string, updates: Partial<OutgoingStudent>): Promise<void> {
    try {
      const students = await this.getAllStudents();
      const studentIndex = students.findIndex(s => s.id === studentId);

      if (studentIndex === -1) {
        throw new Error('التلميذ غير موجود');
      }

      students[studentIndex] = {
        ...students[studentIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await this.saveAllStudents(students);
    } catch (error) {
      console.error('خطأ في تحديث التلميذ المغادر:', error);
      throw error;
    }
  }

  // حذف تلميذ مغادر
  async deleteStudent(studentId: string): Promise<void> {
    try {
      const students = await this.getAllStudents();
      const filteredStudents = students.filter(s => s.id !== studentId);
      await this.saveAllStudents(filteredStudents);
    } catch (error) {
      console.error('خطأ في حذف التلميذ المغادر:', error);
      throw error;
    }
  }

  // حذف تلاميذ متعددين
  async deleteMultipleStudents(studentIds: string[]): Promise<void> {
    try {
      const students = await this.getAllStudents();
      const filteredStudents = students.filter(s => !studentIds.includes(s.id));
      await this.saveAllStudents(filteredStudents);
    } catch (error) {
      console.error('خطأ في حذف التلاميذ المتعددين:', error);
      throw error;
    }
  }

  // تحديث حالة الملف
  async updateStudentStatus(
    studentId: string,
    status: OutgoingStudent['fileStatus'],
    notes?: string
  ): Promise<void> {
    try {
      const updates: Partial<OutgoingStudent> = { fileStatus: status };
      if (notes !== undefined) {
        updates.notes = notes;
      }
      await this.updateStudent(studentId, updates);
    } catch (error) {
      console.error('خطأ في تحديث حالة الملف:', error);
      throw error;
    }
  }

  // تحديث المرجع الإداري
  async updateAdministrativeReference(studentId: string, reference: string): Promise<void> {
    try {
      await this.updateStudent(studentId, { administrativeReference: reference });
    } catch (error) {
      console.error('خطأ في تحديث المرجع الإداري:', error);
      throw error;
    }
  }

  // إضافة سجل مراسلة جديد
  async addCorrespondence(
    studentId: string,
    sendingNumber: string,
    reference: string,
    administrativeReference: string,
    type: 'فردي' | 'جماعي',
    notes: string = ''
  ): Promise<void> {
    try {
      const students = await this.getAllStudents();
      const student = students.find(s => s.id === studentId);

      if (!student) {
        throw new Error('التلميذ غير موجود');
      }

      const correspondence: CorrespondenceRecord = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        sendingNumber,
        reference,
        administrativeReference,
        status: 'تم الإرسال',
        notes,
        type
      };

      // تحديث بيانات التلميذ
      const updatedCorrespondenceHistory = [...student.correspondenceHistory, correspondence];
      const updatedSendDates = [...student.sendDates, correspondence.date];

      await this.updateStudent(studentId, {
        correspondenceHistory: updatedCorrespondenceHistory,
        sendCount: student.sendCount + 1,
        sendDates: updatedSendDates,
        lastSendDate: correspondence.date,
        fileStatus: 'تم الإرسال',
        administrativeReference: administrativeReference || student.administrativeReference
      });

      // حفظ سجل الإرسال
      await this.saveFileSend({
        id: crypto.randomUUID(),
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        sendingNumber,
        reference,
        administrativeReference,
        sendDate: correspondence.date,
        destinationInstitution: student.destinationInstitution,
        destinationDirectorate: student.destinationDirectorate,
        destinationAcademy: student.destinationAcademy,
        requestType: type,
        regionalScope: 'داخل الإقليم',
        pdfGenerated: true,
        notes
      });
    } catch (error) {
      console.error('خطأ في إضافة سجل المراسلة:', error);
      throw error;
    }
  }

  // حفظ سجل إرسال الملف
  private async saveFileSend(fileSend: FileSend): Promise<void> {
    try {
      const sends = await this.getAllFileSends();
      sends.push(fileSend);
      localStorage.setItem(this.SENDS_KEY, JSON.stringify(sends));
    } catch (error) {
      console.error('خطأ في حفظ سجل الإرسال:', error);
      throw error;
    }
  }

  // تحميل جميع سجلات الإرسال
  async getAllFileSends(): Promise<FileSend[]> {
    try {
      const data = localStorage.getItem(this.SENDS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('خطأ في تحميل سجلات الإرسال:', error);
      return [];
    }
  }

  // الحصول على سجلات إرسال تلميذ معين
  async getStudentFileSends(studentId: string): Promise<FileSend[]> {
    try {
      const sends = await this.getAllFileSends();
      return sends.filter(s => s.studentId === studentId);
    } catch (error) {
      console.error('خطأ في تحميل سجلات التلميذ:', error);
      return [];
    }
  }

  // استيراد تلاميذ مغادرين من ملف Excel
  async importStudentsFromExcel(file: File): Promise<ImportResult> {
    try {
      const workbook = await this.readExcelFile(file);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      // استخراج البيانات الوصفية من الخلايا المحددة
      const metadata = this.extractMetadataFromSheet(worksheet);

      const students = await this.getAllStudents();
      const existingStudentIds = new Set(students.map(s => s.studentId));

      let successCount = 0;
      let duplicateCount = 0;
      let linkedCount = 0;
      let unlinkedCount = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      // قراءة البيانات من الصف 11 فما فوق
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');

      for (let rowIndex = 10; rowIndex <= range.e.r; rowIndex++) {
        try {
          // قراءة البيانات حسب الهيكل المطلوب
          const studentId = this.getCellValue(worksheet, `A${rowIndex + 1}`);        // رقم التلميذ
          const lastName = this.getCellValue(worksheet, `B${rowIndex + 1}`);         // النسب
          const firstName = this.getCellValue(worksheet, `C${rowIndex + 1}`);        // الاسم
          const transferDate = this.getCellValue(worksheet, `D${rowIndex + 1}`);     // تاريخ التحويل
          const transferType = this.getCellValue(worksheet, `E${rowIndex + 1}`);     // نوع التحويل
          const originalInstitution = this.getCellValue(worksheet, `F${rowIndex + 1}`); // المؤسسة الأصلية
          const destinationInstitution = this.getCellValue(worksheet, `G${rowIndex + 1}`); // مؤسسة الاستقبال
          const destinationDirectorate = this.getCellValue(worksheet, `H${rowIndex + 1}`); // المديرية المستقبلة
          const destinationAcademy = this.getCellValue(worksheet, `I${rowIndex + 1}`);     // الأكاديمية المستقبلة

          // التحقق من البيانات الأساسية
          if (!studentId || !firstName || !lastName) {
            if (studentId || firstName || lastName) { // إذا كان هناك بيانات جزئية
              errors.push(`صف ${rowIndex + 1}: بيانات ناقصة (رقم التلميذ أو الاسم مفقود)`);
            }
            continue;
          }

          // التحقق من التكرار
          if (existingStudentIds.has(studentId)) {
            duplicateCount++;
            warnings.push(`صف ${rowIndex + 1}: التلميذ ${firstName} ${lastName} (${studentId}) موجود مسبقاً`);
            continue;
          }

          // إنشاء بيانات التلميذ المغادر
          const outgoingStudentData: Omit<OutgoingStudent, 'id' | 'createdAt' | 'updatedAt' | 'linkedGender' | 'isLinked'> = {
            studentId,
            lastName,
            firstName,
            transferDate: this.formatDate(transferDate),
            transferType: transferType || 'تحويل عادي',
            originalInstitution: originalInstitution || metadata.institution,
            originalDirectorate: originalInstitution ? '' : metadata.directorate,
            originalAcademy: originalInstitution ? '' : metadata.academy,
            destinationInstitution: destinationInstitution || '',
            destinationDirectorate: destinationDirectorate || '',
            destinationAcademy: destinationAcademy || '',

            // البيانات الوصفية من الخلايا العلوية
            academy: metadata.academy,
            directorate: metadata.directorate,
            level: metadata.level,
            municipality: metadata.municipality,
            institution: metadata.institution,
            academicYear: metadata.academicYear,

            // حالة الملف الافتراضية
            fileStatus: 'لم يُرسل',
            administrativeReference: '',
            sendCount: 0,
            sendDates: [],
            correspondenceHistory: [],
            notes: `مستورد من ${file.name} - صف ${rowIndex + 1}`
          };

          await this.addStudent(outgoingStudentData);
          existingStudentIds.add(studentId);
          successCount++;

          // فحص الربط مع القاعدة الرئيسية
          try {
            const allStudents = await dbManager.getStudents();
            const isLinked = allStudents.some(s =>
              s.nationalId === studentId || s.studentId === studentId
            );

            if (isLinked) {
              linkedCount++;
            } else {
              unlinkedCount++;
              warnings.push(`صف ${rowIndex + 1}: التلميذ ${firstName} ${lastName} غير موجود في قاعدة البيانات الرئيسية`);
            }
          } catch (linkError) {
            unlinkedCount++;
            console.warn('خطأ في فحص الربط:', linkError);
          }

        } catch (error) {
          errors.push(`صف ${rowIndex + 1}: خطأ في معالجة البيانات - ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }

      return {
        success: successCount,
        errors,
        warnings,
        duplicates: duplicateCount,
        linked: linkedCount,
        unlinked: unlinkedCount
      };
    } catch (error) {
      console.error('خطأ في استيراد التلاميذ المغادرين:', error);
      throw error;
    }
  }

  // استخراج البيانات الوصفية من ورقة العمل
  private extractMetadataFromSheet(worksheet: XLSX.WorkSheet) {
    return {
      academy: this.getCellValue(worksheet, 'C5').trim(),        // الأكاديمية
      directorate: this.getCellValue(worksheet, 'C6').trim(),    // المديرية
      level: this.getCellValue(worksheet, 'C7').trim(),          // المستوى
      municipality: this.getCellValue(worksheet, 'G5').trim(),   // الجماعة
      institution: this.getCellValue(worksheet, 'G6').trim(),    // المؤسسة
      academicYear: this.getCellValue(worksheet, 'G7').trim()    // السنة الدراسية
    };
  }

  // الحصول على قيمة الخلية
  private getCellValue(worksheet: XLSX.WorkSheet, cellAddress: string): string {
    const cell = worksheet[cellAddress];
    if (!cell || cell.v === undefined || cell.v === null) {
      return '';
    }
    return String(cell.v).trim();
  }

  // قراءة ملف Excel
  private readExcelFile(file: File): Promise<XLSX.WorkBook> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          resolve(workbook);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // تنسيق التاريخ
  private formatDate(dateValue: any): string {
    if (!dateValue) return '';

    try {
      if (typeof dateValue === 'number') {
        const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
        return excelDate.toISOString().split('T')[0];
      }

      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }

      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }

      return '';
    } catch (error) {
      console.warn('خطأ في تنسيق التاريخ:', dateValue, error);
      return '';
    }
  }

  // مسح جميع البيانات
  async clearAllData(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.SENDS_KEY);
    } catch (error) {
      console.error('خطأ في مسح البيانات:', error);
      throw error;
    }
  }

  // تصدير البيانات
  async exportData(): Promise<string> {
    try {
      const students = await this.getAllStudents();
      const sends = await this.getAllFileSends();

      const exportData = {
        students,
        sends,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('خطأ في تصدير البيانات:', error);
      throw error;
    }
  }

  // استيراد البيانات
  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);

      if (data.students && Array.isArray(data.students)) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data.students));
      }

      if (data.sends && Array.isArray(data.sends)) {
        localStorage.setItem(this.SENDS_KEY, JSON.stringify(data.sends));
      }
    } catch (error) {
      console.error('خطأ في استيراد البيانات:', error);
      throw error;
    }
  }
}

// إنشاء مثيل واحد للاستخدام في جميع أنحاء التطبيق
export const outgoingStudentsDB = new OutgoingStudentsDatabase();
