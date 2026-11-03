export type DisciplineSeverity = 1 | 2 | 3;
export type DisciplineRecordKind = 'positive' | 'negative' | 'encouragement';
export type DisciplineRecordStatus = 'pending' | 'approved' | 'rejected';

export interface DisciplineCategory {
  id: string;
  name: string;
  kind: DisciplineRecordKind;
  severity: DisciplineSeverity | null;
  createdAt: string;
}

export interface DisciplineAction {
  id: string;
  name: string;
  createdAt: string;
}

export type IncidentReporterType = 'student' | 'teacher' | 'visitor';

export interface StudentIncident {
  id: string;
  studentId: string;
  studentName: string;
  section: string;
  kind: DisciplineRecordKind;
  status: DisciplineRecordStatus;
  incidentDate: string;
  incidentTime: string;
  location: string;
  details: string;
  categoryId: string;
  categoryName: string;
  severity: DisciplineSeverity | null;
  points: number;
  reporterType: IncidentReporterType;
  reporterName: string;
  actions: string[];
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
}

export type NewStudentIncident = Omit<StudentIncident, 'id' | 'createdAt'>;

const defaultCreatedAt = '2026-01-01T00:00:00.000Z';

export const DEFAULT_DISCIPLINE_CATEGORIES: DisciplineCategory[] = [
  { id: 'uniform', name: 'عدم ارتداء الوزرة', kind: 'negative', severity: 1, createdAt: defaultCreatedAt },
  { id: 'school-supplies', name: 'عدم إحضار الأدوات المدرسية', kind: 'negative', severity: 1, createdAt: defaultCreatedAt },
  { id: 'homework', name: 'عدم إنجاز التمارين المنزلية', kind: 'negative', severity: 1, createdAt: defaultCreatedAt },
  { id: 'sports-uniform', name: 'عدم إحضار البدلة الرياضية', kind: 'negative', severity: 1, createdAt: defaultCreatedAt },
  { id: 'repeated-absence', name: 'كثرة الغيابات غير المبررة', kind: 'negative', severity: 1, createdAt: defaultCreatedAt },
  { id: 'insulting', name: 'السب والشتم', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'vulgar-language-class', name: 'التلفظ بكلام قبيح داخل القسم', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'vulgar-language-school', name: 'التلفظ بكلام قبيح خارج القسم داخل المؤسسة', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'fight-class', name: 'العراك داخل القسم', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'fight-school', name: 'العراك في فضاءات المؤسسة', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'mobile-phone', name: 'استعمال الهاتف النقال داخل المؤسسة رغم المنع', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'inappropriate-clothing', name: 'لباس غير لائق أو غير تربوي', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'inappropriate-haircut', name: 'حلاقة غير لائقة أو غير تربوية', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'writing-walls', name: 'الكتابة على جدران المؤسسة', kind: 'negative', severity: 2, createdAt: defaultCreatedAt },
  { id: 'insult-administration', name: 'التطاول على إدارة المؤسسة', kind: 'negative', severity: 3, createdAt: defaultCreatedAt },
  { id: 'theft', name: 'السرقة', kind: 'negative', severity: 3, createdAt: defaultCreatedAt },
  { id: 'assault-inside', name: 'التعدي على الغير داخل المؤسسة', kind: 'negative', severity: 3, createdAt: defaultCreatedAt },
  { id: 'assault-outside', name: 'التعدي على الغير خارج المؤسسة', kind: 'negative', severity: 3, createdAt: defaultCreatedAt },
  { id: 'throwing-stones-inside', name: 'الرشق بالحجارة من داخل المؤسسة', kind: 'negative', severity: 3, createdAt: defaultCreatedAt },
  { id: 'throwing-stones-outside', name: 'الرشق بالحجارة من خارج المؤسسة', kind: 'negative', severity: 3, createdAt: defaultCreatedAt },
  { id: 'property-damage', name: 'إتلاف ممتلكات المؤسسة', kind: 'negative', severity: 3, createdAt: defaultCreatedAt },
  { id: 'document-damage', name: 'إتلاف مستندات المؤسسة أو تمزيق أوراق الغياب', kind: 'negative', severity: 3, createdAt: defaultCreatedAt },
  { id: 'positive-participation', name: 'المشاركة الإيجابية في القسم', kind: 'positive', severity: null, createdAt: defaultCreatedAt },
  { id: 'positive-cooperation', name: 'التعاون ومساعدة الزملاء', kind: 'positive', severity: null, createdAt: defaultCreatedAt },
  { id: 'positive-initiative', name: 'المبادرة في الأنشطة التربوية', kind: 'positive', severity: null, createdAt: defaultCreatedAt },
  { id: 'positive-care', name: 'المحافظة على ممتلكات المؤسسة', kind: 'positive', severity: null, createdAt: defaultCreatedAt },
  { id: 'encouragement', name: 'تقدير تشجيعي', kind: 'encouragement', severity: null, createdAt: defaultCreatedAt },
];

export const DEFAULT_DISCIPLINE_ACTIONS: DisciplineAction[] = [
  { id: 'student-warning', name: 'تنبيه التلميذ', createdAt: defaultCreatedAt },
  { id: 'student-reprimand', name: 'إنذار التلميذ', createdAt: defaultCreatedAt },
  { id: 'student-rebuke', name: 'توبيخ التلميذ', createdAt: defaultCreatedAt },
  { id: 'listening-cell', name: 'الإحالة على خلية الإنصات', createdAt: defaultCreatedAt },
  { id: 'social-specialist', name: 'الإحالة على المختص الاجتماعي أو التربوي', createdAt: defaultCreatedAt },
  { id: 'disciplinary-council', name: 'الإحالة على المجلس التأديبي', createdAt: defaultCreatedAt },
  { id: 'student-commitment', name: 'توقيع التزام خاص بالتلميذ', createdAt: defaultCreatedAt },
  { id: 'guardian-commitment', name: 'التزام خاص بولي أمر التلميذ', createdAt: defaultCreatedAt },
  { id: 'notify-guardian', name: 'إخبار ولي أمره', createdAt: defaultCreatedAt },
  { id: 'call-guardian', name: 'الاتصال بولي أمره', createdAt: defaultCreatedAt },
  { id: 'conduct-deduction', name: 'الخصم من نقطة السلوك والمواظبة', createdAt: defaultCreatedAt },
];
