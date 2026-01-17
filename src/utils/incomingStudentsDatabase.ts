import * as XLSX from 'xlsx';
import { dbManager } from './database';

// قاعدة بيانات مستقلة للتلاميذ الوافدين
// منفصلة تماماً عن قاعدة بيانات التلاميذ الأصليين

interface IncomingStudent {
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

interface FileRequest {
  id: string;
  studentId: string;
  requestNumber: string;
  requestDate: string;
  institutionName: string;
  pdfGenerated: boolean;
  notes: string;
}

interface ImportResult {
  success: number;
  errors: string[];
  warnings: string[];
  duplicates: number;
  linked: number;              // عدد التلاميذ المرتبطين بالقاعدة الرئيسية
  unlinked: number;            // عدد التلاميذ غير المرتبطين
}

class IncomingStudentsDatabase {
  private readonly STORAGE_KEY = 'incomingStudentsData';
  private readonly REQUESTS_KEY = 'incomingStudentRequests';

  // تحميل جميع التلاميذ الوافدين مع الربط
  async getAllStudents(): Promise<IncomingStudent[]> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const students: IncomingStudent[] = data ? JSON.parse(data) : [];
      
      // ربط البيانات مع القاعدة الرئيسية
      return await this.linkWithMainDatabase(students);
    } catch (error) {
      console.error('خطأ في تحميل بيانات التلاميذ الوافدين:', error);
      return [];
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
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(studentsToSave));
    } catch (error) {
      console.error('خطأ في حفظ بيانات التلاميذ الوافدين:', error);
      throw error;
    }
  }

  // إضافة تلميذ وافد جديد
  async addStudent(studentData: Omit<IncomingStudent, 'id' | 'createdAt' | 'updatedAt' | 'linkedGender' | 'linkedSection' | 'linkedNationalId' | 'isLinked'>): Promise<string> {
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
  async addFileRequest(studentId: string): Promise<string> {
    try {
      const students = await this.getAllStudents();
      const student = students.find(s => s.id === studentId);
      
      if (!student) {
        throw new Error('التلميذ غير موجود');
      }

      // توليد رقم الطلب
      const requestNumber = this.generateRequestNumber(student.requestCount + 1);
      const requestDate = new Date().toISOString().split('T')[0];

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
        pdfGenerated: false,
        notes: ''
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
      localStorage.setItem(this.REQUESTS_KEY, JSON.stringify(requests));
    } catch (error) {
      console.error('خطأ في حفظ طلب الملف:', error);
      throw error;
    }
  }

  // تحميل جميع طلبات الملفات
  async getAllFileRequests(): Promise<FileRequest[]> {
    try {
      const data = localStorage.getItem(this.REQUESTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('خطأ في تحميل طلبات الملفات:', error);
      return [];
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
          const originalInstitution = this.getCellValue(worksheet, `G${rowIndex + 1}`); // المؤسسة الأصلية
          const originalDirectorate = this.getCellValue(worksheet, `H${rowIndex + 1}`); // المديرية الأصلية
          const originalAcademy = this.getCellValue(worksheet, `I${rowIndex + 1}`);     // الأكاديمية الأصلية

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
          const incomingStudentData: Omit<IncomingStudent, 'id' | 'createdAt' | 'updatedAt' | 'linkedGender' | 'linkedSection' | 'linkedNationalId' | 'isLinked'> = {
            studentId,
            lastName,
            firstName,
            transferDate: this.formatDate(transferDate),
            transferType: transferType || 'تحويل عادي',
            originalInstitution: originalInstitution || '',
            originalDirectorate: originalDirectorate || '',
            originalAcademy: originalAcademy || '',
            
            // البيانات الوصفية من الخلايا العلوية
            academy: metadata.academy,
            directorate: metadata.directorate,
            level: metadata.level,
            municipality: metadata.municipality,
            institution: metadata.institution,
            academicYear: metadata.academicYear,
            
            // حالة الملف الافتراضية
            fileStatus: 'لم يتم الإرسال',
            requestCount: 0,
            requestDates: [],
            notes: `مستورد من ${file.name} - صف ${rowIndex + 1}`
          };

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
      localStorage.removeItem(this.REQUESTS_KEY);
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
      const data = JSON.parse(jsonData);
      
      if (data.students && Array.isArray(data.students)) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data.students));
      }
      
      if (data.requests && Array.isArray(data.requests)) {
        localStorage.setItem(this.REQUESTS_KEY, JSON.stringify(data.requests));
      }
    } catch (error) {
      console.error('خطأ في استيراد البيانات:', error);
      throw error;
    }
  }
}

// إنشاء مثيل واحد للاستخدام في جميع أنحاء التطبيق
export const incomingStudentsDB = new IncomingStudentsDatabase(); 