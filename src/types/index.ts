// أنواع البيانات الأساسية لنظام إدارة التلاميذ

export interface Student {
  id: string;
  student_id?: string;        // للتوافق مع المخطط الجديد
  national_id?: string;       // العمود الأساسي في قاعدة البيانات
  firstName: string;          // الاسم الشخصي
  lastName: string;           // النسب
  nationalId: string;         // الرمز
  gender: 'ذكر' | 'أنثى';     // النوع
  birthPlace: string;         // مكان الازدياد
  dateOfBirth: string;        // تاريخ الازدياد
  email: string;             // البريد الإلكتروني
  phone: string;             // رقم الهاتف
  studentId: string;         // رقم التلميذ
  grade: string;             // الصف/المستوى
  section: string;           // القسم
  level: string;             // المستوى
  enrollmentDate: string;    // تاريخ التسجيل
  address: string;           // العنوان
  // مراجع المستوى والقسم (Foreign Keys)
  levelId?: string;          // معرف المستوى (مرجع لجدول levels)
  sectionId?: string;        // معرف القسم (مرجع لجدول sections)
  emergencyContact: string;  // جهة الاتصال في حالات الطوارئ
  emergencyPhone: string;    // هاتف الطوارئ
  guardianName: string;      // اسم ولي الأمر
  guardianPhone: string;     // هاتف ولي الأمر
  guardianRelation: string;  // صلة القرابة
  socialSupport: boolean;    // الدعم الاجتماعي
  transportService: boolean; // خدمة النقل
  medicalInfo: string;       // المعلومات الطبية
  notes: string;             // ملاحظات
  status: 'نشط' | 'غير نشط' | 'متخرج' | 'منقول' | 'منسحب' | 'متمدرس' | 'منقطع' | 'مفصول' | 'غير ملتحق'; // حالة التلميذ
  // إضافات جديدة للإحصائيات المتقدمة
  ageGroup: string;          // الفئة العمرية
  schoolType: string;        // نوع المدرسة
  academicYear: string;      // السنة الدراسية
  region: string;            // المنطقة/الجهة
  province: string;          // الإقليم/العمالة
  municipality: string;     // الجماعة
  institution: string;       // المؤسسة
  createdAt: string;         // تاريخ الإنشاء
  updatedAt: string;         // تاريخ آخر تحديث
}

export interface AttendanceRecord {
  id: string;
  studentId: string;         // معرف التلميذ
  date: string;             // التاريخ
  status: 'حاضر' | 'غائب' | 'متأخر' | 'معذور' | 'غياب مبرر'; // حالة الحضور
  period: string;           // الحصة
  subject: string;          // المادة
  notes?: string;           // ملاحظات
  createdAt: string;        // تاريخ الإنشاء
}

export interface GradeRecord {
  id: string;
  grade_id?: string;        // للتوافق مع المخطط الجديد
  studentId: string;        // معرف التلميذ
  student_id?: string;      // للتوافق مع المخطط الجديد
  subject: string;          // المادة
  grade: number;            // النقطة
  maxGrade: number;         // النقطة العظمى
  assignmentType: 'امتحان نهائي' | 'امتحان نصفي' | 'اختبار قصير' | 'واجب منزلي' | 'مشروع' | 'مشاركة صفية' | 'امتحان شفهي' | 'مراقبة مستمرة'; // نوع التقييم
  semester: 'الفصل الأول' | 'الفصل الثاني' | 'الفصل الثالث'; // الفصل الدراسي
  academicYear: string;     // السنة الدراسية
  date: string;             // التاريخ
  notes?: string;           // ملاحظات
  createdAt: string;        // تاريخ الإنشاء
}

// الجداول الجديدة حسب المخطط المحدد
export interface Level {
  level_id: string;
  level_name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Class {
  class_id: string;
  class_name: string;
  level_id: string;
  level_name?: string;      // للعرض فقط
}

export interface Exam {
  exam_id: string;
  student_id: string;
  subject: string;
  exam_type: 'محلي' | 'جهوي' | 'وطني';
  grade_value: number;
  max_grade: number;
  exam_date: string;
}

export interface Average {
  average_id: string;
  student_id: string;
  term: '1' | '2' | 'سنوي';
  average_value: number;
  academic_year: string;
}

export interface CouncilDecision {
  decision_id: string;
  student_id: string;
  decision_type: 'ينتقل' | 'يكرر' | 'يفصل' | 'إعادة إدماج';
  decision_date: string;
  note: string;
  value: number;
}

export interface Dropout {
  dropout_id: string;
  student_id: string;
  dropout_date: string;
  reason: string;
}

export interface Reintegration {
  reintegration_id: string;
  student_id: string;
  reintegration_date: string;
  previous_status: string;
}

export interface Transfer {
  transfer_id: string;
  student_id: string;
  transfer_type: 'وافد' | 'مغادر';
  from_school: string;
  to_school: string;
  transfer_date: string;
}

export interface Absentee {
  absentee_id: string;
  student_id: string;
  status_date: string;
  note: string;
}

export interface Parent {
  parent_id: string;
  student_id: string;
  relation: 'أب' | 'أم' | 'مكلف' | 'ولي';
  parent_name: string;
  phone_1: string;
  phone_2: string;
  address: string;
}

export interface Credential {
  student_id: string;
  secret_code: string;
  issue_date: string;
}

/**
 * إحصائيات شاملة لقاعدة البيانات
 * تستخدم في: Dashboard, AdvancedReports
 */
export interface DatabaseStats {
  totalStudents: number;          // إجمالي التلاميذ
  activeStudents: number;         // التلاميذ النشطون
  maleStudents: number;           // عدد التلاميذ الذكور
  femaleStudents: number;         // عدد التلميذات الإناث
  
  // إحصائيات مبسطة (تم إزالة الحضور والنقط)
  totalAttendanceRecords: number; // 0 - تم إزالة وحدة الحضور
  totalGradeRecords: number;      // 0 - تم إزالة وحدة النقط
  averageGrade: number;           // 0 - تم إزالة وحدة النقط
  attendanceRate: number;         // 0 - تم إزالة وحدة الحضور
  
  // إحصائيات الخدمات
  socialSupportCount: number;     // المستفيدون من الدعم الاجتماعي
  transportServiceCount: number;  // المستفيدون من خدمة النقل
}

// أنواع الإحصائيات المتخصصة
export interface LevelStats {
  level: string;
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  averageGrade: number;
  attendanceRate: number;
}

export interface GradeStats {
  grade: string;
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  averageGrade: number;
  attendanceRate: number;
}

export interface SectionStats {
  section: string;
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  averageGrade: number;
  attendanceRate: number;
}

export interface AgeGroupStats {
  ageGroup: string;
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  percentage: number;
}

export interface RegionStats {
  region: string;
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  averageGrade: number;
  attendanceRate: number;
}

export interface ProvinceStats {
  province: string;
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  averageGrade: number;
  attendanceRate: number;
}

export interface MunicipalityStats {
  municipality: string;
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  averageGrade: number;
  attendanceRate: number;
}

export interface ComparisonStats {
  subjectComparison: SubjectComparison[];
  sectionComparison: SectionComparison[];
  branchComparison: BranchComparison[];
}

// إضافة واجهة إحصائيات التوجيه
export interface GuidanceStatistic {
  id?: string;
  student_id: string;
  assigned_stream: string;
  gender: 'ذكر' | 'أنثى';
  decision: string;
  academic_year: string;
  level?: string;
  section?: string;
  age?: number;
  ageGroup?: string;  // الفئة العمرية المحسوبة
  createdAt?: string;
}

export interface SubjectComparison {
  subject: string;
  averageGrade: number;
  totalStudents: number;
  passRate: number;
}

export interface SectionComparison {
  section: string;
  averageGrade: number;
  totalStudents: number;
  attendanceRate: number;
}

export interface BranchComparison {
  branch: string;
  averageGrade: number;
  totalStudents: number;
  attendanceRate: number;
}

// أنواع إضافية للتصفية والبحث
export interface StudentFilter {
  searchTerm: string;
  gender: string;
  grade: string;
  section: string;
  level: string;
  status: string;
  region: string;
  province: string;
  municipality: string;
  ageGroup: string;
  socialSupport: boolean | null;
  transportService: boolean | null;
}

export interface AttendanceFilter {
  studentId: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  subject: string;
  period: string;
}

export interface GradeFilter {
  studentId: string;
  subject: string;
  assignmentType: string;
  semester: string;
  academicYear: string;
  dateFrom: string;
  dateTo: string;
  minGrade: number;
  maxGrade: number;
}

// أنواع التقارير المتقدمة
export interface StatisticsReport {
  id: string;
  title: string;
  type: 'students' | 'attendance' | 'grades' | 'comparison';
  data: any;
  generatedAt: string;
  filters: any;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
  }[];
}

// أنواع إضافية للجداول الجديدة
export interface StudentManagementData {
  students: Student[];
  levels: Level[];
  classes: Class[];
  exams: Exam[];
  averages: Average[];
  councilDecisions: CouncilDecision[];
  dropouts: Dropout[];
  reintegrations: Reintegration[];
  transfers: Transfer[];
  absentees: Absentee[];
  parents: Parent[];
  credentials: Credential[];
}

// إعدادات المؤسسة
export interface InstitutionSettings {
  id?: string;
  academy: string;        // الأكاديمية الجهوية (C5)
  directorate: string;    // المديرية (C6)
  municipality: string;  // الجماعة (G5)
  institution: string;   // المؤسسة (G6)
  academicYear: string;  // السنة الدراسية (G7)
  createdAt?: string;
  updatedAt: string;
}