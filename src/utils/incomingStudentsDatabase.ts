import * as XLSX from 'xlsx';
import { dbManager } from './database';
import { normalizeExcelDate } from './excelDate';
import { canonicalAcademy, canonicalDirectorate, isDirectorateInAcademy, isKnownAcademy } from './academyDirectory';

// قاعدة بيانات مستقلة للتلاميذ الوافدين
// منفصلة تماماً عن قاعدة بيانات التلاميذ الأصليين

export interface IncomingStudent {
  id: string;
  studentId: string;           // رقم التلميذ
  lastName: string;            // النسب
  firstName: string;           // الاسم
  transferDate: string;        // تاريخ التحويل
  transferType: string;        // نوع التحويل
  originalInstitution: string; // المؤسسة الأصلية
  originalDirectorate: string; // المديرية الأصلية
  originalAcademy: string;     // الأكاديمية الأصلية
  
  // البيانات الوصفية المستخرجة من الملف
  academy: string;             // الأكاديمية (C5)
  directorate: string;         // المديرية (C6)
  level: string;              // المستوى (C7)
  municipality: string;        // الجماعة (G5)
  institution: string;         // المؤسسة (G6)
  academicYear: string;        // السنة الدراسية (G7)
  
  // حالة الملف وتتبع الطلبات
  fileStatus: 'لم يتم الإرسال' | 'طلب مرسل' | 'ملف تم التوصل به' | 'مكرر' | 'غير معروف';
  requestCount: number;
  requestDates: string[];
  lastRequestDate?: string;
  notes: string;
  
  // البيانات المرتبطة (من قاعدة البيانات الرئيسية - للعرض فقط)
  linkedGender?: 'ذكر' | 'أنثى' | 'غير محدد';
  linkedSection?: string;
  linkedNationalId?: string;
  isLinked: boolean;           // هل تم العثور على التلميذ في القاعدة الرئيسية
  
  createdAt: string;
  updatedAt: string;
}

export interface FileRequest {
  id: string;
  studentId: string;
  requestNumber: string;
  requestDate: string;
  institutionName: string;
  sendingNumber: string;
  reference: string;
  senderAcademy: string;
  senderDirectorate: string;
  senderInstitution: string;
  recipientDirectorate: string;
  recipientAcademy: string;
  requestType: 'فردي' | 'جماعي';
  regionalScope: 'داخل الإقليم' | 'خارج الإقليم';
  pdfGenerated: boolean;
  notes: string;
}

export type IncomingStudentInput = Omit<
  IncomingStudent,
  'id' | 'createdAt' | 'updatedAt' | 'linkedGender' | 'linkedSection' | 'linkedNationalId' | 'isLinked'
>;

export interface IncomingFileRequestDetails {
  requestDate: string;
  sendingNumber: string;
  requestNumber: string;
  reference: string;
  senderAcademy: string;
  senderDirectorate: string;
  senderInstitution: string;
  recipientDirectorate: string;
  recipientAcademy: string;
  requestType: 'فردي' | 'جماعي';
  regionalScope: 'داخل الإقليم' | 'خارج الإقليم';
  notes: string;
}

const normalizeIncomingStudent = (value: Partial<IncomingStudent> & Record<string, unknown>): IncomingStudent => {
  const now = new Date().toISOString();
  return {
    id: String(value.id || crypto.randomUUID()),
    studentId: String(value.studentId || value.linkedNationalId || value.nationalId || ''),
    lastName: String(value.lastName || ''),
    firstName: String(value.firstName || ''),
    transferDate: normalizeExcelDate(value.transferDate || value.enrollmentDate),
    transferType: String(value.transferType || 'تحويل عادي'),
    originalInstitution: String(value.originalInstitution || value.previousInstitution || ''),
    originalDirectorate: String(value.originalDirectorate || ''),
    originalAcademy: String(value.originalAcademy || ''),
    academy: String(value.academy || ''),
    directorate: String(value.directorate || ''),
    level: String(value.level || ''),
    municipality: String(value.municipality || ''),
    institution: String(value.institution || ''),
    academicYear: String(value.academicYear || ''),
    fileStatus: (value.fileStatus as IncomingStudent['fileStatus']) || 'لم يتم الإرسال',
    requestCount: Number(value.requestCount || 0),
    requestDates: Array.isArray(value.requestDates) ? value.requestDates.map(String) : [],
    lastRequestDate: value.lastRequestDate ? String(value.lastRequestDate) : undefined,
    notes: String(value.notes || ''),
    linkedGender: value.linkedGender as IncomingStudent['linkedGender'],
    linkedSection: value.linkedSection ? String(value.linkedSection) : undefined,
    linkedNationalId: value.linkedNationalId ? String(value.linkedNationalId) : undefined,
    isLinked: Boolean(value.isLinked),
    createdAt: String(value.createdAt || now),
    updatedAt: String(value.updatedAt || now)
  };
};

const normalizeFileRequest = (value: Partial<FileRequest> & Record<string, unknown>): FileRequest => ({
  id: String(value.id || crypto.randomUUID()),
  studentId: String(value.studentId || ''),
  requestNumber: String(value.requestNumber || ''),
  requestDate: normalizeExcelDate(value.requestDate) || String(value.requestDate || ''),
  institutionName: String(value.institutionName || ''),
  sendingNumber: String(value.sendingNumber || ''),
  reference: String(value.reference || ''),
  senderAcademy: String(value.senderAcademy || ''),
  senderDirectorate: String(value.senderDirectorate || ''),
  senderInstitution: String(value.senderInstitution || ''),
  recipientDirectorate: String(value.recipientDirectorate || ''),
  recipientAcademy: String(value.recipientAcademy || ''),
  requestType: value.requestType === 'جماعي' ? 'جماعي' : 'فردي',
  regionalScope: value.regionalScope === 'خارج الإقليم' ? 'خارج الإقليم' : 'داخل الإقليم',
  pdfGenerated: Boolean(value.pdfGenerated),
  notes: String(value.notes || '')
});

interface ImportResult {
  success: number;
  errors: string[];
  warnings: string[];
  duplicates: number;
  linked: number;              // عدد التلاميذ المرتبطين بالقاعدة الرئيسية
  unlinked: number;            // عدد التلاميذ غير المرتبطين
}

class IncomingStudentsDatabase {
  private readonly LEGACY_STORAGE_KEY = 'incomingStudentsData';
  private readonly LEGACY_REQUESTS_KEY = 'incomingStudentRequests';
  private legacyDataMigrated = false;

  private async migrateLegacyData(): Promise<void> {
    if (this.legacyDataMigrated) return;
    await dbManager.initialize();

    const legacyStudentsValue = localStorage.getItem(this.LEGACY_STORAGE_KEY);
    const legacyRequestsValue = localStorage.getItem(this.LEGACY_REQUESTS_KEY);
    const legacyStudents = legacyStudentsValue
      ? (JSON.parse(legacyStudentsValue) as Array<Partial<IncomingStudent> & Record<string, unknown>>)
          .map(normalizeIncomingStudent)
      : [];
    const legacyRequests = legacyRequestsValue
      ? (JSON.parse(legacyRequestsValue) as Array<Partial<FileRequest> & Record<string, unknown>>)
          .map(normalizeFileRequest)
      : [];

    const storedStudents = await dbManager.getLocalMobilityRecords<IncomingStudent>('incoming-student');
    const storedRequests = await dbManager.getLocalMobilityRecords<FileRequest>('incoming-request');
    const students = new Map(legacyStudents.map(student => [student.id, student]));
    const requests = new Map(legacyRequests.map(request => [request.id, request]));
    storedStudents.forEach(student => students.set(student.id, student));
    storedRequests.forEach(request => requests.set(request.id, request));

    if (legacyStudentsValue) {
      await dbManager.replaceLocalMobilityRecords(
        'incoming-student',
        Array.from(students.values()).map(student => ({ ...student, studentId: student.studentId }))
      );
      localStorage.removeItem(this.LEGACY_STORAGE_KEY);
    }
    if (legacyRequestsValue) {
      await dbManager.replaceLocalMobilityRecords(
        'incoming-request',
        Array.from(requests.values()).map(request => ({ ...request, studentId: request.studentId }))
      );
      localStorage.removeItem(this.LEGACY_REQUESTS_KEY);
    }
    this.legacyDataMigrated = true;
  }

  // تحميل جميع التلاميذ الوافدين مع الربط
  async getAllStudents(): Promise<IncomingStudent[]> {
    try {
      await this.migrateLegacyData();
      const students = await dbManager.getLocalMobilityRecords<IncomingStudent>('incoming-student');
      
      // ربط البيانات مع القاعدة الرئيسية
      return await this.linkWithMainDatabase(students);
    } catch (error) {
      console.error('خطأ في تحميل بيانات التلاميذ الوافدين:', error);
      throw error;
    }
  }

  // ربط البيانات مع قاعدة البيانات الرئيسية (للعرض فقط)
  private async linkWithMainDatabase(incomingStudents: IncomingStudent[]): Promise<IncomingStudent[]> {
    try {
      // جلب جميع التلاميذ من القاعدة الرئيسية
      const allStudents = await dbManager.getStudents();
      
      return incomingStudents.map(incomingStudent => {
        // البحث بالرقم الوطني أو رقم التلميذ
        const matchedStudent = allStudents.find(s => 
          s.nationalId === incomingStudent.studentId || 
          s.studentId === incomingStudent.studentId
        );
        
        if (matchedStudent) {
          return {
            ...incomingStudent,
            linkedGender: matchedStudent.gender,
            linkedSection: matchedStudent.section,
            linkedNationalId: matchedStudent.nationalId,
            isLinked: true
          };
        } else {
          return {
            ...incomingStudent,
            linkedGender: 'غير محدد',
            linkedSection: 'غير معروف',
            linkedNationalId: '',
            isLinked: false
          };
        }
      });
    } catch (error) {
      console.warn('خطأ في ربط البيانات مع القاعدة الرئيسية:', error);
      // إرجاع البيانات بدون ربط في حالة الخطأ
      return incomingStudents.map(student => ({
        ...student,
        linkedGender: 'غير محدد',
        linkedSection: 'غير معروف',
        linkedNationalId: '',
        isLinked: false
      }));
    }
  }

  // حفظ جميع التلاميذ الوافدين
  private async saveAllStudents(students: IncomingStudent[]): Promise<void> {
    try {
      // حفظ البيانات الأساسية فقط (بدون البيانات المرتبطة)
      const studentsToSave = students.map(student => {
        const { linkedGender, linkedSection, linkedNationalId, isLinked, ...basicData } = student;
        return basicData;
      });
      await dbManager.replaceLocalMobilityRecords(
        'incoming-student',
        studentsToSave.map(student => ({ ...student, studentId: student.studentId }))
      );
    } catch (error) {
      console.error('خطأ في حفظ بيانات التلاميذ الوافدين:', error);
      throw error;
    }
  }

  // إضافة تلميذ وافد جديد
  async addStudent(studentData: IncomingStudentInput): Promise<string> {
    try {
      const students = await this.getAllStudents();
      
      // التحقق من عدم وجود تكرار
      const existingStudent = students.find(s => s.studentId === studentData.studentId);
      if (existingStudent) {
        throw new Error(`التلميذ برقم ${studentData.studentId} موجود مسبقاً في قائمة الوافدين`);
      }

      const newStudent: IncomingStudent = {
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
      console.error('خطأ في إضافة التلميذ الوافد:', error);
      throw error;
    }
  }

  // تحديث بيانات تلميذ وافد
  async updateStudent(studentId: string, updates: Partial<IncomingStudent>): Promise<void> {
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
      console.error('خطأ في تحديث التلميذ الوافد:', error);
      throw error;
    }
  }

  // حذف تلميذ وافد
  async deleteStudent(studentId: string): Promise<void> {
    try {
      const students = await this.getAllStudents();
      const filteredStudents = students.filter(s => s.id !== studentId);
      await this.saveAllStudents(filteredStudents);
    } catch (error) {
      console.error('خطأ في حذف التلميذ الوافد:', error);
      throw error;
    }
  }

  // الحصول على تلميذ برقم التلميذ
  async getStudentByStudentId(studentId: string): Promise<IncomingStudent | null> {
    try {
      const students = await this.getAllStudents();
      return students.find(s => s.studentId === studentId) || null;
    } catch (error) {
      console.error('خطأ في البحث عن التلميذ:', error);
      return null;
    }
  }

  // تحديث حالة الملف
  async updateStudentStatus(studentId: string, status: IncomingStudent['fileStatus'], notes?: string): Promise<void> {
    try {
      const updates: Partial<IncomingStudent> = { fileStatus: status };
      if (notes !== undefined) {
        updates.notes = notes;
      }
      await this.updateStudent(studentId, updates);
    } catch (error) {
      console.error('خطأ في تحديث حالة الملف:', error);
      throw error;
    }
  }

  // إضافة طلب ملف جديد
  async addFileRequest(studentId: string, details: IncomingFileRequestDetails): Promise<string> {
    try {
      const students = await this.getAllStudents();
      const student = students.find(s => s.id === studentId);
      
      if (!student) {
        throw new Error('التلميذ غير موجود');
      }

      // توليد رقم الطلب
      const requestNumber = details.requestNumber || this.generateRequestNumber(student.requestCount + 1);
      const requestDate = details.requestDate;

      // تحديث بيانات التلميذ
      const updatedRequestDates = [...student.requestDates, requestDate];
      
      await this.updateStudent(studentId, {
        requestCount: student.requestCount + 1,
        requestDates: updatedRequestDates,
        lastRequestDate: requestDate,
        fileStatus: 'طلب مرسل'
      });

      // حفظ طلب الملف
      const fileRequest: FileRequest = {
        id: crypto.randomUUID(),
        studentId,
        requestNumber,
        requestDate,
        institutionName: student.originalInstitution,
        sendingNumber: details.sendingNumber,
        reference: details.reference,
        senderAcademy: details.senderAcademy,
        senderDirectorate: details.senderDirectorate,
        senderInstitution: details.senderInstitution,
        recipientDirectorate: details.recipientDirectorate || student.originalDirectorate,
        recipientAcademy: details.recipientAcademy || student.originalAcademy,
        requestType: details.requestType,
        regionalScope: details.regionalScope,
        pdfGenerated: true,
        notes: details.notes
      };

      await this.saveFileRequest(fileRequest);
      
      return requestNumber;
    } catch (error) {
      console.error('خطأ في إضافة طلب الملف:', error);
      throw error;
    }
  }

  // توليد رقم الطلب
  private generateRequestNumber(requestCount: number): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const sequence = String(requestCount).padStart(2, '0');
    
    return `RQ-${year}${month}${day}-${sequence}`;
  }

  // حفظ طلب الملف
  private async saveFileRequest(request: FileRequest): Promise<void> {
    try {
      const requests = await this.getAllFileRequests();
      requests.push(request);
      await dbManager.replaceLocalMobilityRecords(
        'incoming-request',
        requests.map(item => ({ ...item, studentId: item.studentId }))
      );
    } catch (error) {
      console.error('خطأ في حفظ طلب الملف:', error);
      throw error;
    }
  }

  // تحميل جميع طلبات الملفات
  async getAllFileRequests(): Promise<FileRequest[]> {
    try {
      await this.migrateLegacyData();
      return await dbManager.getLocalMobilityRecords<FileRequest>('incoming-request');
    } catch (error) {
      console.error('خطأ في تحميل طلبات الملفات:', error);
      throw error;
    }
  }

  // الحصول على طلبات ملف لتلميذ معين
  async getStudentFileRequests(studentId: string): Promise<FileRequest[]> {
    try {
      const requests = await this.getAllFileRequests();
      return requests.filter(r => r.studentId === studentId);
    } catch (error) {
      console.error('خطأ في تحميل طلبات التلميذ:', error);
      return [];
    }
  }

  // استيراد تلاميذ وافدين من ملف Excel
  async importStudentsFromExcel(file: File): Promise<ImportResult> {
    try {
      const workbook = await this.readExcelFile(file);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // استخراج البيانات الوصفية من الخلايا المحددة
      const rawMetadata = this.extractMetadataFromSheet(worksheet);
      const normalizedAcademy = canonicalAcademy(rawMetadata.academy);
      const metadata = {
        ...rawMetadata,
        academy: normalizedAcademy,
        directorate: canonicalDirectorate(rawMetadata.directorate, normalizedAcademy)
      };
      if (!metadata.academy || !metadata.directorate || !metadata.institution) {
        throw new Error('تعذر قراءة المؤسسة أو المديرية أو الأكاديمية من ترويسة لائحة الوافدين.');
      }
      
      const students = await this.getAllStudents();
      const existingStudentIds = new Set(students.map(s => s.studentId));
      
      let successCount = 0;
      let duplicateCount = 0;
      let linkedCount = 0;
      let unlinkedCount = 0;
      const errors: string[] = [];
      const warnings: string[] = [];
      if (
        isKnownAcademy(metadata.academy) &&
        metadata.directorate &&
        !isDirectorateInAcademy(metadata.directorate, metadata.academy)
      ) {
        warnings.push('بيانات ترويسة المؤسسة لا تطابق علاقة الأكاديمية والمديرية في اللائحة المرجعية.');
      }

      // قراءة البيانات من الصف 11 فما فوق
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z1000');
      
      for (let rowIndex = 10; rowIndex <= range.e.r; rowIndex++) {
        try {
          // قراءة البيانات حسب الهيكل المطلوب
          const studentId = this.getCellValue(worksheet, `A${rowIndex + 1}`);        // رقم التلميذ
          const lastName = this.getCellValue(worksheet, `B${rowIndex + 1}`);         // النسب
          const firstName = this.getCellValue(worksheet, `C${rowIndex + 1}`);        // الاسم
          const transferDate = this.getRawCellValue(worksheet, `D${rowIndex + 1}`);  // تاريخ التحويل
          const transferType = this.getCellValue(worksheet, `E${rowIndex + 1}`);     // نوع التحويل
          const receivingInstitution = this.getCellValue(worksheet, `F${rowIndex + 1}`);
          const originalInstitution = this.getCellValue(worksheet, `G${rowIndex + 1}`); // المؤسسة الأصلية
          const rawOriginalDirectorate = this.getCellValue(worksheet, `H${rowIndex + 1}`);
          const rawOriginalAcademy = this.getCellValue(worksheet, `I${rowIndex + 1}`);
          const originalAcademy = canonicalAcademy(rawOriginalAcademy);
          const originalDirectorate = canonicalDirectorate(rawOriginalDirectorate, originalAcademy);

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

          // إنشاء بيانات التلميذ الوافد
          const normalizedTransferDate = this.formatDate(transferDate);
          if (transferDate && !normalizedTransferDate) {
            errors.push(`صف ${rowIndex + 1}: تاريخ التحويل غير صالح (${transferDate})`);
            continue;
          }

          const incomingStudentData: IncomingStudentInput = {
            studentId,
            lastName,
            firstName,
            transferDate: normalizedTransferDate,
            transferType: transferType || 'تحويل عادي',
            originalInstitution: originalInstitution || '',
            originalDirectorate: originalDirectorate || '',
            originalAcademy: originalAcademy || '',
            
            // البيانات الوصفية من الخلايا العلوية
            academy: metadata.academy,
            directorate: metadata.directorate,
            level: metadata.level,
            municipality: metadata.municipality,
            institution: receivingInstitution || metadata.institution,
            academicYear: metadata.academicYear,
            
            // حالة الملف الافتراضية
            fileStatus: 'لم يتم الإرسال',
            requestCount: 0,
            requestDates: [],
            notes: `مستورد من ${file.name} - صف ${rowIndex + 1}`
          };
          if (originalAcademy !== rawOriginalAcademy.trim() || originalDirectorate !== rawOriginalDirectorate.trim()) {
            warnings.push(`صف ${rowIndex + 1}: تم توحيد اسم الأكاديمية أو المديرية وفق اللائحة المرجعية.`);
          }
          if (
            isKnownAcademy(originalAcademy) &&
            originalDirectorate &&
            !isDirectorateInAcademy(originalDirectorate, originalAcademy)
          ) {
            warnings.push(`صف ${rowIndex + 1}: المديرية الأصلية غير موجودة ضمن الأكاديمية المحددة في اللائحة المرجعية.`);
          }

          await this.addStudent(incomingStudentData);
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
      console.error('خطأ في استيراد التلاميذ الوافدين:', error);
      throw error;
    }
  }

  // استخراج البيانات الوصفية من ورقة العمل
  private extractMetadataFromSheet(worksheet: XLSX.WorkSheet) {
    const cleanMetadata = (value: string) => value.replace(/^[^:：]+[:：]\s*/, '').trim();
    return {
      academy: cleanMetadata(this.getCellValue(worksheet, 'C5')),
      directorate: cleanMetadata(this.getCellValue(worksheet, 'C6')),
      level: cleanMetadata(this.getCellValue(worksheet, 'C7')),
      municipality: cleanMetadata(this.getCellValue(worksheet, 'G5')),
      institution: cleanMetadata(this.getCellValue(worksheet, 'G6')),
      academicYear: cleanMetadata(this.getCellValue(worksheet, 'G7'))
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

  private getRawCellValue(worksheet: XLSX.WorkSheet, cellAddress: string): unknown {
    return worksheet[cellAddress]?.v ?? '';
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
    return normalizeExcelDate(dateValue);
  }

  // مسح جميع البيانات
  async clearAllData(): Promise<void> {
    try {
      await this.migrateLegacyData();
      await dbManager.clearLocalMobilityRecords('incoming-student');
      await dbManager.clearLocalMobilityRecords('incoming-request');
    } catch (error) {
      console.error('خطأ في مسح البيانات:', error);
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

  // تصدير البيانات
  async exportData(): Promise<string> {
    try {
      const students = await this.getAllStudents();
      const requests = await this.getAllFileRequests();
      
      const exportData = {
        students,
        requests,
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
      await this.migrateLegacyData();
      const data = JSON.parse(jsonData);
      
      if (data.students && Array.isArray(data.students)) {
        await dbManager.replaceLocalMobilityRecords(
          'incoming-student',
          data.students.map((student: Partial<IncomingStudent> & Record<string, unknown>) => {
            const normalized = normalizeIncomingStudent(student);
            return { ...normalized, studentId: normalized.studentId };
          })
        );
      }
      
      if (data.requests && Array.isArray(data.requests)) {
        await dbManager.replaceLocalMobilityRecords(
          'incoming-request',
          data.requests.map((request: Partial<FileRequest> & Record<string, unknown>) => {
            const normalized = normalizeFileRequest(request);
            return { ...normalized, studentId: normalized.studentId };
          })
        );
      }
    } catch (error) {
      console.error('خطأ في استيراد البيانات:', error);
      throw error;
    }
  }
}

// إنشاء مثيل واحد للاستخدام في جميع أنحاء التطبيق
export const incomingStudentsDB = new IncomingStudentsDatabase(); 