import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Heart,
  MapPin,
  Plus,
  Printer,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  ThumbsUp,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { dbManager } from '../utils/database';
import {
  DisciplineAction,
  DisciplineCategory,
  DisciplineRecordKind,
  DisciplineRecordStatus,
  DisciplineSeverity,
  IncidentReporterType,
  StudentIncident,
} from '../utils/discipline';

type ViewMode = 'dashboard' | 'card' | 'entry';
type ProgressPeriod = '2w' | '3w' | '4w' | '1m' | '2m' | '3m' | '6m' | '1y' | '2y' | '3y' | '4y' | '5y';

interface MetricTitles {
  positive: string;
  negative: string;
  encouragements: string;
  pending: string;
  students: string;
}

const DEFAULT_METRIC_TITLES: MetricTitles = {
  positive: 'النقط الإيجابية',
  negative: 'السلوكات السلبية المؤكدة',
  encouragements: 'التقديرات التشجيعية',
  pending: 'بانتظار المراجعة',
  students: 'التلاميذ في النطاق',
};

interface Student {
  id: string;
  name: string;
  code: string;
  level: string;
  section: string;
  status: string;
}

interface AttendanceRow {
  studentId: string;
  status: string;
}

const kindLabels: Record<DisciplineRecordKind, string> = {
  positive: 'سلوك إيجابي',
  negative: 'سلوك يحتاج إلى مراجعة',
  encouragement: 'تقدير تشجيعي',
};

const reporterLabels: Record<IncidentReporterType, string> = {
  student: 'تلميذ',
  teacher: 'أستاذ',
  visitor: 'مرتفق',
};

const localDate = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeStudentSearch = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
  .toLocaleLowerCase('ar')
  .trim();

const categoryDisplayName = (category: DisciplineCategory): string => category.id === 'mobile-phone'
  ? 'استعمال الهاتف النقال داخل المؤسسة رغم المنع'
  : category.name;

interface ProgressBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

interface EducationalRecommendation {
  level: string;
  duration: string;
  responsible: string;
  summary: string;
  steps: string[];
  suggestedActions: string[];
}

const getPhoneRecommendation = (previousRecords: StudentIncident[]): EducationalRecommendation => {
  const interventions = previousRecords.flatMap(record => [...record.actions, record.details]);
  const hasPriorWarning = interventions.some(text => /تنبيه|إنذار|توبيخ|إشعار|إخبار ولي|إخبار الأسرة|التزام/.test(text));
  const hasPriorEscalatedIntervention = interventions.some(text => /إخبار ولي|إخبار الأسرة|اتصال بولي|التزام|إحالة|خلية الإنصات|مجلس تأديبي/.test(text));

  if (previousRecords.length === 0) {
    return {
      level: 'تنبيه وتوعية فردية',
      duration: 'أسبوع',
      responsible: 'الأستاذ بتنسيق مع الإدارة التربوية',
      summary: 'إجراء حوار تربوي فردي مع التلميذ حول استعمال الهاتف النقال داخل المؤسسة، وتذكيره بالنظام الداخلي والتنبيه إلى عدم تكرار ذلك.',
      steps: [
        'التحاور مع التلميذ بهدوء حول سبب استعمال الهاتف.',
        'تذكيره بمنع استعمال الهاتف داخل المؤسسة وبالتوجيهات التربوية.',
        'تسجيل التنبيه ومتابعة السلوك خلال الأسبوع الموالي.',
      ],
      suggestedActions: ['تنبيه التلميذ'],
    };
  }

  if (hasPriorEscalatedIntervention) {
    return {
      level: 'إحالة للإدارة وخطة متابعة',
      duration: 'أسبوعان',
      responsible: 'الإدارة التربوية بتنسيق مع الأستاذ وولي الأمر',
      summary: 'إحالة الحالة إلى الإدارة التربوية لدراسة أسباب استمرار استعمال الهاتف رغم التدخلات السابقة، وإشراك الأسرة في خطة متابعة تربوية لمدة أسبوعين وفق النظام الداخلي.',
      steps: [
        'إجراء حوار تربوي فردي لفهم أسباب استمرار السلوك.',
        'إشعار ولي الأمر وإشراكه في خطة المعالجة.',
        'تطبيق ما ينص عليه النظام الداخلي عند الاقتضاء، دون التشهير بالتلميذ أو تفتيش محتويات هاتفه.',
        'تتبع السلوك أسبوعين؛ وعند التحقق من الالتزام، تسجيل تحسن وتعزيزه إيجابيًا.',
      ],
      suggestedActions: ['إخبار ولي أمره', 'الاتصال بولي أمره', 'الإحالة على المختص الاجتماعي أو التربوي'],
    };
  }

  if (hasPriorWarning) {
    return {
      level: 'تعزيز التدخل بعد التنبيه السابق',
      duration: 'أسبوعان',
      responsible: 'الإدارة التربوية بتنسيق مع الأستاذ',
      summary: 'إجراء حوار تربوي فردي بشأن استعمال الهاتف رغم المنع والتنبيه السابق، مع إشعار ولي الأمر وتذكير التلميذ بالنظام الداخلي وتوقيع التزام تربوي، ثم تتبع مدى التزامه خلال أسبوعين.',
      steps: [
        'استدعاء التلميذ لحوار تربوي فردي حول أسباب تكرار المخالفة وعدم الاستجابة للتنبيه.',
        'تذكيره بمقتضيات النظام الداخلي وبأن المنع يسري داخل المؤسسة.',
        'إشعار ولي الأمر وإشراكه في معالجة السلوك.',
        'تحرير التزام تربوي باحترام منع استعمال الهاتف.',
        'تطبيق الإجراء المنصوص عليه في النظام الداخلي عند الاقتضاء، دون التشهير بالتلميذ أو تفتيش محتويات هاتفه.',
        'تتبع السلوك خلال أسبوعين، وتعزيز أي تحسن ملحوظ بعد التحقق منه.',
      ],
      suggestedActions: ['تنبيه التلميذ', 'إخبار ولي أمره', 'توقيع التزام خاص بالتلميذ'],
    };
  }

  return {
    level: 'تكرار مسجل — يلزم توثيق التنبيه',
    duration: 'أسبوعان',
    responsible: 'الإدارة التربوية بتنسيق مع الأستاذ',
    summary: 'تكررت واقعة استعمال الهاتف بحسب السجلات، لكن لا يظهر فيها تنبيه سابق موثق؛ يُوصى بتوثيق الحوار والتنبيه وإشعار ولي الأمر وبدء متابعة تربوية لمدة أسبوعين.',
    steps: [
      'التحقق من الوقائع السابقة وعدم احتساب الملاحظات المرفوضة.',
      'إجراء حوار تربوي وتوثيق التنبيه الحالي بوضوح.',
      'إشعار ولي الأمر وتذكير التلميذ بالنظام الداخلي.',
      'متابعة السلوك أسبوعين؛ وتعزيز التحسن إذا تم التحقق من الالتزام.',
    ],
    suggestedActions: ['تنبيه التلميذ', 'إخبار ولي أمره'],
  };
};

const createProgressBuckets = (period: ProgressPeriod, current: Date): ProgressBucket[] => {
  const isWeeks = period.endsWith('w');
  const periodCount = Number.parseInt(period, 10);
  const bucketCount = isWeeks ? periodCount : periodCount * (period.endsWith('y') ? 12 : 1);
  if (isWeeks) {
    return Array.from({ length: bucketCount }, (_, index) => {
      const end = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1 - (bucketCount - index - 1) * 7);
      const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
      return {
        key: `week-${start.getTime()}`,
        label: `${start.toLocaleDateString('ar-MA', { day: 'numeric', month: 'short' })} - ${new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1).toLocaleDateString('ar-MA', { day: 'numeric', month: 'short' })}`,
        start,
        end,
      };
    });
  }
  return Array.from({ length: bucketCount }, (_, index) => {
    const monthDate = new Date(current.getFullYear(), current.getMonth() - (bucketCount - index - 1), 1);
    return {
      key: `month-${monthDate.getFullYear()}-${monthDate.getMonth()}`,
      label: monthDate.toLocaleDateString('ar-MA', { month: 'short', year: bucketCount > 12 ? '2-digit' : undefined }),
      start: monthDate,
      end: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
    };
  });
};

const studentFromRow = (row: Record<string, unknown>): Student => ({
  id: String(row.id ?? ''),
  name: `${String(row.firstName ?? '')} ${String(row.lastName ?? '')}`.trim() || 'اسم غير متوفر',
  code: String(row.studentId || row.nationalId || ''),
  level: String(row.level || row.grade || 'المستوى غير محدد'),
  section: String(row.section || 'غير محدد'),
  status: String(row.status || ''),
});

const studentTotals = (studentId: string, records: StudentIncident[]) => {
  const own = records.filter(record => record.studentId === studentId && record.status === 'approved');
  const positive = own
    .filter(record => record.kind === 'positive')
    .reduce((sum, record) => sum + record.points, 0);
  const negative = own
    .filter(record => record.kind === 'negative')
    .reduce((sum, record) => sum + record.points, 0);
  return {
    positive,
    negative,
    negativeCount: own.filter(record => record.kind === 'negative').length,
    encouragements: own.filter(record => record.kind === 'encouragement').length,
    net: positive - negative,
  };
};

const attendanceRate = (studentId: string, attendance: AttendanceRow[]): number | null => {
  const relevant = attendance.filter(row =>
    row.studentId === studentId &&
    ['حاضر', 'غائب', 'متأخر', 'معذور', 'غياب مبرر'].includes(row.status)
  );
  if (relevant.length === 0) return null;
  const present = relevant.filter(row => row.status === 'حاضر' || row.status === 'متأخر').length;
  return Math.round((present / relevant.length) * 100);
};

const formatDate = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('ar-MA');
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'flat';
}> = ({ title, value, caption, icon, color, trend, trendDirection = 'flat' }) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    violet: 'bg-violet-50 text-violet-800',
    blue: 'bg-blue-50 text-blue-800',
    slate: 'bg-slate-100 text-slate-800',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${colors[color]}`}>{icon}</div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
      {trend && (
        <p className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
          trendDirection === 'up'
            ? 'bg-emerald-50 text-emerald-700'
            : trendDirection === 'down'
              ? 'bg-red-50 text-red-700'
              : 'bg-slate-100 text-slate-600'
        }`}>
          {trendDirection === 'up' ? '↑ ' : trendDirection === 'down' ? '↓ ' : '• '}{trend}
        </p>
      )}
    </div>
  );
};

export const DisciplineManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<StudentIncident[]>([]);
  const [categories, setCategories] = useState<DisciplineCategory[]>([]);
  const [actions, setActions] = useState<DisciplineAction[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState<ViewMode>('dashboard');
  const [selectedSection, setSelectedSection] = useState('الكل');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [progressPeriod, setProgressPeriod] = useState<ProgressPeriod>('6m');
  const [metricTitles, setMetricTitles] = useState<MetricTitles>(DEFAULT_METRIC_TITLES);
  const [metricTitleDraft, setMetricTitleDraft] = useState<MetricTitles>(DEFAULT_METRIC_TITLES);
  const [selectedMetricTitle, setSelectedMetricTitle] = useState<keyof MetricTitles>('positive');
  const [metricTitlesSaved, setMetricTitlesSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [recordFilter, setRecordFilter] = useState<'all' | DisciplineRecordKind>('all');
  const [dashboardRecordFilter, setDashboardRecordFilter] = useState<'all' | DisciplineRecordKind>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [kind, setKind] = useState<DisciplineRecordKind>('negative');
  const [categoryId, setCategoryId] = useState('');
  const [incidentDate, setIncidentDate] = useState(localDate());
  const [incidentTime, setIncidentTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [points, setPoints] = useState(3);
  const [reporterType, setReporterType] = useState<IncidentReporterType>('teacher');
  const [reporterName, setReporterName] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [savedMessage, setSavedMessage] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKind, setNewCategoryKind] = useState<DisciplineRecordKind>('negative');
  const [newCategorySeverity, setNewCategorySeverity] = useState<DisciplineSeverity>(1);
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingActionId, setEditingActionId] = useState('');
  const [actionName, setActionName] = useState('');

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await dbManager.initialize();
      const [studentRows, incidentRows, categoryRows, actionRows, attendanceRows] = await Promise.all([
        dbManager.getStudents(),
        dbManager.getStudentIncidents(),
        dbManager.getDisciplineCategories(),
        dbManager.getDisciplineActions(),
        dbManager.getAttendanceRecords(),
      ]);
      const importedStudents = studentRows.map((row: Record<string, unknown>) => studentFromRow(row))
        .filter((student: Student) => student.id);
      setStudents(importedStudents);
      setRecords(incidentRows);
      setCategories(categoryRows);
      setActions(actionRows);
      setAttendance(attendanceRows.map((row: Record<string, unknown>) => ({
        studentId: String(row.studentId ?? ''),
        status: String(row.status ?? ''),
      })));
      setSelectedStudentId(current =>
        importedStudents.some((student: Student) => student.id === current)
          ? current
          : importedStudents[0]?.id || ''
      );
    } catch (loadError) {
      console.error('تعذر تحميل بيانات البطاقة السلوكية:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل بيانات التلاميذ والسلوك.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!categories.some(category => category.id === categoryId && category.kind === kind)) {
      setCategoryId(categories.find(category => category.kind === kind)?.id || '');
    }
  }, [categories, categoryId, kind]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('disciplineMetricTitles');
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<MetricTitles>;
      const titles = Object.fromEntries(
        Object.entries(DEFAULT_METRIC_TITLES).map(([key, defaultTitle]) => {
          const value = parsed[key as keyof MetricTitles];
          return [key, typeof value === 'string' && value.trim() ? value : defaultTitle];
        })
      ) as MetricTitles;
      setMetricTitles(titles);
      setMetricTitleDraft(titles);
    } catch (loadError) {
      console.error('تعذر تحميل عناوين مؤشرات السلوك:', loadError);
      setError('تعذر تحميل عناوين المؤشرات المحفوظة.');
    }
  }, []);

  const sections = useMemo(
    () => Array.from(new Set(students.map(student => student.section).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')),
    [students]
  );
  const sectionStudents = useMemo(
    () => students.filter(student => selectedSection === 'الكل' || student.section === selectedSection),
    [students, selectedSection]
  );
  const visibleStudents = useMemo(() => {
    const query = normalizeStudentSearch(search);
    return sectionStudents.filter(student =>
      !query || normalizeStudentSearch(`${student.name} ${student.code} ${student.level} ${student.section}`).includes(query)
    );
  }, [sectionStudents, search]);
  const selectedStudent = students.find(student => student.id === selectedStudentId) ?? null;
  const studentRecords = records.filter(record => record.studentId === selectedStudentId);
  const sectionStudentIds = new Set(sectionStudents.map(student => student.id));
  const sectionRecords = records.filter(record => sectionStudentIds.has(record.studentId));
  const confirmedRecords = sectionRecords.filter(record => record.status === 'approved');
  const positiveTotal = confirmedRecords
    .filter(record => record.kind === 'positive')
    .reduce((sum, record) => sum + record.points, 0);
  const negativeTotal = confirmedRecords
    .filter(record => record.kind === 'negative')
    .reduce((sum, record) => sum + record.points, 0);
  const encouragementTotal = confirmedRecords.filter(record => record.kind === 'encouragement').length;
  const pendingCount = sectionRecords.filter(record => record.kind === 'negative' && record.status === 'pending').length;
  const filteredRecords = studentRecords.filter(record => recordFilter === 'all' || record.kind === recordFilter);
  const selectedCategory = categories.find(category => category.id === categoryId && category.kind === kind);
  const kindCategories = categories.filter(category => category.kind === kind);
  const isMobilePhoneCategory = kind === 'negative' && Boolean(selectedCategory) &&
    (selectedCategory?.id === 'mobile-phone' || /هاتف/.test(selectedCategory?.name || ''));
  const previousPhoneIncidents = isMobilePhoneCategory && selectedStudent
    ? records.filter(record => {
      const isSamePhoneCategory = record.categoryId === selectedCategory?.id || /هاتف/.test(record.categoryName);
      const occurredBefore = record.incidentDate < incidentDate ||
        (record.incidentDate === incidentDate && record.incidentTime < incidentTime);
      return record.studentId === selectedStudent.id &&
        record.kind === 'negative' &&
        record.status === 'approved' &&
        isSamePhoneCategory &&
        occurredBefore;
    })
    : [];
  const phoneRecommendation = isMobilePhoneCategory ? getPhoneRecommendation(previousPhoneIncidents) : null;
  const dashboardRecords = sectionRecords
    .filter(record => dashboardRecordFilter === 'all' || record.kind === dashboardRecordFilter)
    .slice(0, 6);

  const rankings = visibleStudents.map(student => ({
    student,
    totals: studentTotals(student.id, records),
    attendance: attendanceRate(student.id, attendance),
  })).sort((a, b) =>
    b.totals.negativeCount - a.totals.negativeCount ||
    b.totals.positive - a.totals.positive ||
    a.student.name.localeCompare(b.student.name, 'ar')
  );
  const rankingWithRecords = rankings.filter(item =>
    item.totals.negativeCount > 0 || item.totals.positive > 0 || item.totals.encouragements > 0
  ).slice(0, 10);

  const monthlyProgress = useMemo(() => {
    if (!selectedStudentId) return [];
    return createProgressBuckets(progressPeriod, new Date()).map(bucket => {
      const bucketRecords = studentRecords.filter(record => {
        const date = new Date(`${record.incidentDate}T00:00:00`);
        return date >= bucket.start && date < bucket.end && record.status === 'approved';
      });
      return {
        key: bucket.key,
        label: bucket.label,
        positive: bucketRecords.filter(record => record.kind === 'positive').reduce((sum, record) => sum + record.points, 0),
        negative: bucketRecords.filter(record => record.kind === 'negative').reduce((sum, record) => sum + record.points, 0),
      };
    });
  }, [progressPeriod, selectedStudentId, studentRecords]);
  const progressMax = Math.max(1, ...monthlyProgress.flatMap(item => [item.positive, item.negative]));
  const dashboardProgress = useMemo(() => createProgressBuckets(progressPeriod, new Date()).map(bucket => {
    const bucketRecords = confirmedRecords.filter(record => {
      const date = new Date(`${record.incidentDate}T00:00:00`);
      return date >= bucket.start && date < bucket.end;
    });
    return {
      ...bucket,
      positive: bucketRecords.filter(record => record.kind === 'positive').reduce((sum, record) => sum + record.points, 0),
      negative: bucketRecords.filter(record => record.kind === 'negative').reduce((sum, record) => sum + record.points, 0),
    };
  }), [confirmedRecords, progressPeriod]);
  const dashboardProgressMax = Math.max(1, ...dashboardProgress.flatMap(item => [item.positive, item.negative]));
  const behaviorIndex = positiveTotal - negativeTotal;
  const latestIncidentDate = sectionRecords[0]?.createdAt
    ? new Date(sectionRecords[0].createdAt).toLocaleString('ar-MA', { dateStyle: 'short', timeStyle: 'short' })
    : 'لا توجد سجلات بعد';
  const positiveStudentHighlight = rankings
    .filter(item => item.totals.positive > 0)
    .sort((a, b) => b.totals.positive - a.totals.positive)[0];

  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();
    confirmedRecords
      .filter(record => record.kind === 'negative')
      .forEach(record => counts.set(record.categoryName, (counts.get(record.categoryName) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [confirmedRecords]);
  const mostCommonIncident = categoryStats[0];
  const pendingStudentIncident = sectionRecords.find(record => record.kind === 'negative' && record.status === 'pending');
  const repeatedBehavior = useMemo(() => {
    const grouped = new Map<string, { studentId: string; categoryId: string; categoryName: string; count: number }>();
    confirmedRecords.filter(record => record.kind === 'negative').forEach(record => {
      const key = `${record.studentId}:${record.categoryId}`;
      const current = grouped.get(key);
      grouped.set(key, {
        studentId: record.studentId,
        categoryId: record.categoryId,
        categoryName: record.categoryName,
        count: (current?.count || 0) + 1,
      });
    });
    return Array.from(grouped.values()).filter(item => item.count > 1).sort((a, b) => b.count - a.count)[0];
  }, [confirmedRecords]);
  const repeatedBehaviorStudent = repeatedBehavior
    ? students.find(student => student.id === repeatedBehavior.studentId)
    : undefined;
  const repeatedBehaviorRecords = repeatedBehavior
    ? confirmedRecords.filter(record =>
      record.studentId === repeatedBehavior.studentId &&
      record.categoryId === repeatedBehavior.categoryId &&
      record.kind === 'negative'
    )
    : [];
  const repeatedBehaviorRecommendation = repeatedBehavior
    ? repeatedBehavior.categoryId === 'mobile-phone' || /هاتف/.test(repeatedBehavior.categoryName)
      ? getPhoneRecommendation(repeatedBehaviorRecords).summary
      : 'يوصى بحوار تربوي فردي لفهم أسباب تكرار السلوك، وتوثيق التدخل المناسب بالتنسيق مع الأسرة عند الحاجة، ثم متابعة الاستجابة خلال أسبوعين. تُراجع كل حالة على حدة ولا يُعتمد مجموع النقاط وحده.'
    : '';

  const weeklyChange = (kind: DisciplineRecordKind): { text: string; direction: 'up' | 'down' | 'flat'; current: number; previous: number } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - 6);
    const previousWeekStart = new Date(thisWeekStart);
    previousWeekStart.setDate(thisWeekStart.getDate() - 7);
    const totalInRange = (start: Date, end: Date) => confirmedRecords
      .filter(record => {
        const date = new Date(`${record.incidentDate}T00:00:00`);
        return record.kind === kind && date >= start && date < end;
      })
      .reduce((sum, record) => sum + (kind === 'encouragement' ? 1 : record.points), 0);
    const current = totalInRange(thisWeekStart, new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
    const previous = totalInRange(previousWeekStart, thisWeekStart);
    if (current === previous) return { text: 'لا تغيير عن الأسبوع السابق', direction: 'flat', current, previous };
    const difference = Math.abs(current - previous);
    const improving = kind === 'negative' ? current < previous : current > previous;
    return {
      text: `${improving ? 'تحسن' : kind === 'negative' ? 'ارتفاع' : 'انخفاض'} ${difference} عن الأسبوع السابق`,
      direction: improving ? 'up' : 'down',
      current,
      previous,
    };
  };
  const weeklyPositiveChange = weeklyChange('positive');
  const weeklyNegativeChange = weeklyChange('negative');
  const currentWeeklyIndex = weeklyPositiveChange.current - weeklyNegativeChange.current;
  const previousWeeklyIndex = weeklyPositiveChange.previous - weeklyNegativeChange.previous;
  const weeklyIndexDelta = currentWeeklyIndex - previousWeeklyIndex;
  const weeklyIndexTrend = {
    text: weeklyIndexDelta === 0
      ? 'لا تغيير عن الأسبوع السابق'
      : `${weeklyIndexDelta > 0 ? 'تحسن' : 'تراجع'} ${Math.abs(weeklyIndexDelta)} عن الأسبوع السابق`,
    direction: weeklyIndexDelta > 0 ? 'up' as const : weeklyIndexDelta < 0 ? 'down' as const : 'flat' as const,
  };

  const openEntryForCategory = (preferredKind: DisciplineRecordKind, preferredCategoryId?: string) => {
    changeKind(preferredKind);
    if (preferredCategoryId && categories.some(category => category.id === preferredCategoryId && category.kind === preferredKind)) {
      setCategoryId(preferredCategoryId);
      const category = categories.find(item => item.id === preferredCategoryId);
      setPoints(preferredKind === 'negative' ? (category?.severity || 1) * 3 : preferredKind === 'positive' ? 3 : 0);
    }
    setActiveView('entry');
  };

  const improvementLabel = useMemo(() => {
    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setDate(now.getDate() - 30);
    const previousStart = new Date(now);
    previousStart.setDate(now.getDate() - 60);
    const balanceSince = (start: Date, end: Date) => studentRecords
      .filter(record => {
        const date = new Date(`${record.incidentDate}T00:00:00`);
        return record.status === 'approved' && date >= start && date < end;
      })
      .reduce((sum, record) => sum + (record.kind === 'positive' ? record.points : record.kind === 'negative' ? -record.points : 0), 0);
    const recent = balanceSince(recentStart, now);
    const previous = balanceSince(previousStart, recentStart);
    if (recent > previous) return 'تحسن مقارنة بالثلاثين يوماً السابقة';
    if (recent < previous) return 'تحتاج الحالة إلى مواكبة مقارنة بالفترة السابقة';
    return 'لا تغير واضح في السجلات خلال الفترتين';
  }, [studentRecords]);

  const changeKind = (nextKind: DisciplineRecordKind) => {
    setKind(nextKind);
    const first = categories.find(category => category.kind === nextKind);
    setCategoryId(first?.id || '');
    setPoints(nextKind === 'negative' ? (first?.severity || 1) * 3 : nextKind === 'positive' ? 3 : 0);
    setSelectedActions([]);
    setSavedMessage('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStudent) {
      setError('اختر تلميذاً من قائمة التلاميذ المستوردة أولاً.');
      return;
    }
    if (!selectedCategory || !location.trim() || !details.trim()) {
      setError('يرجى تحديد نوع السلوك والمكان وكتابة وصف موضوعي للواقعة.');
      return;
    }
    if (!Number.isFinite(points) || points < 0 || points > 20) {
      setError('يجب أن تكون النقط بين 0 و20.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const status: DisciplineRecordStatus = kind === 'negative' ? 'pending' : 'approved';
      await dbManager.addStudentIncident({
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        section: selectedStudent.section,
        kind,
        status,
        incidentDate,
        incidentTime,
        location: location.trim(),
        details: details.trim(),
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.id === 'mobile-phone'
          ? 'استعمال الهاتف النقال داخل المؤسسة رغم المنع'
          : selectedCategory.name,
        severity: kind === 'negative' ? selectedCategory.severity : null,
        points,
        reporterType,
        reporterName: reporterName.trim(),
        actions: kind === 'negative' ? selectedActions : [],
        reviewedAt: kind === 'negative' ? null : new Date().toISOString(),
        reviewedBy: null,
      });
      await refreshData();
      setLocation('');
      setDetails('');
      setReporterName('');
      setSelectedActions([]);
      setSavedMessage(kind === 'negative'
        ? 'حُفظت الملاحظة بنجاح، وهي بانتظار المراجعة قبل احتسابها.'
        : 'حُفظ التسجيل في البطاقة السلوكية للتلميذ.');
    } catch (saveError) {
      console.error('تعذر حفظ الملاحظة السلوكية:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'تعذر حفظ الملاحظة السلوكية.');
    } finally {
      setSaving(false);
    }
  };

  const reviewIncident = async (incident: StudentIncident, status: 'approved' | 'rejected') => {
    const confirmed = window.confirm(status === 'approved'
      ? 'تأكيد صحة الواقعة واحتسابها في المؤشرات؟'
      : 'رفض هذه الملاحظة؟ لن تدخل في مؤشرات السلوك.');
    if (!confirmed) return;
    try {
      await dbManager.reviewStudentIncident(incident.id, status);
      await refreshData();
    } catch (reviewError) {
      console.error('تعذرت مراجعة الملاحظة:', reviewError);
      setError(reviewError instanceof Error ? reviewError.message : 'تعذرت مراجعة الملاحظة.');
    }
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    const current = categories.find(category => category.id === editingCategoryId);
    try {
      await dbManager.saveDisciplineCategory({
        id: current?.id || crypto.randomUUID(),
        name,
        kind: newCategoryKind,
        severity: newCategoryKind === 'negative' ? newCategorySeverity : null,
      });
      setNewCategoryName('');
      setEditingCategoryId('');
      await refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'تعذر حفظ التصنيف.');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm('حذف هذا التصنيف من قائمة الاختيار؟ السجلات السابقة ستبقى محفوظة.')) return;
    try {
      await dbManager.deleteDisciplineCategory(id);
      await refreshData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'تعذر حذف التصنيف.');
    }
  };

  const saveAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = actionName.trim();
    if (!name) return;
    try {
      await dbManager.saveDisciplineAction({ id: editingActionId || crypto.randomUUID(), name });
      setActionName('');
      setEditingActionId('');
      await refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'تعذر حفظ الإجراء.');
    }
  };

  const deleteAction = async (id: string) => {
    if (!window.confirm('حذف هذا الإجراء من قائمة الاختيار؟ السجلات السابقة ستبقى محفوظة.')) return;
    try {
      await dbManager.deleteDisciplineAction(id);
      await refreshData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'تعذر حذف الإجراء.');
    }
  };

  const saveMetricTitles = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const titles = Object.fromEntries(
      Object.entries(metricTitleDraft).map(([key, title]) => [key, title.trim()])
    ) as MetricTitles;
    if (Object.values(titles).some(title => !title)) {
      setError('يرجى إدخال عنوان لكل بطاقة إحصائية.');
      return;
    }
    try {
      localStorage.setItem('disciplineMetricTitles', JSON.stringify(titles));
      setMetricTitles(titles);
      setMetricTitleDraft(titles);
      setMetricTitlesSaved(true);
      setError('');
    } catch (saveError) {
      console.error('تعذر حفظ عناوين مؤشرات السلوك:', saveError);
      setError('تعذر حفظ عناوين المؤشرات على هذا الجهاز.');
    }
  };

  const resetMetricTitles = () => {
    try {
      localStorage.removeItem('disciplineMetricTitles');
      setMetricTitles(DEFAULT_METRIC_TITLES);
      setMetricTitleDraft(DEFAULT_METRIC_TITLES);
      setMetricTitlesSaved(false);
      setError('');
    } catch (resetError) {
      console.error('تعذر استعادة عناوين مؤشرات السلوك الافتراضية:', resetError);
      setError('تعذر استعادة العناوين الافتراضية.');
    }
  };

  const navButton = (view: ViewMode, label: string, icon: React.ReactNode) => (
    <button
      key={view}
      type="button"
      onClick={() => {
        setActiveView(view);
        setSavedMessage('');
        setError('');
        if (view === 'card' && search.trim() && !visibleStudents.some(student => student.id === selectedStudentId)) {
          setSelectedStudentId(visibleStudents[0]?.id || '');
        }
      }}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
        activeView === view ? 'bg-indigo-700 text-white shadow' : 'bg-white text-slate-700 hover:bg-indigo-50'
      }`}
    >
      {icon}{label}
    </button>
  );

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-2xl bg-gradient-to-l from-slate-900 via-indigo-900 to-indigo-700 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/15 p-3"><Shield className="h-8 w-8" /></div>
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">البطاقة السلوكية الرقمية</h1>
                <p className="mt-1 text-indigo-100">متابعة مرتبطة بتلاميذ المؤسسة وأقسامهم المستوردة</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm">
              <UsersRound className="ml-1 inline h-4 w-4" />
              {students.length} تلميذاً · {sections.length} قسماً
            </div>
          </div>
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-white/20 bg-white/10 p-3 text-sm leading-6 text-indigo-50">
            <Heart className="mt-1 h-4 w-4 shrink-0 text-rose-200" />
            تُقيّم الملاحظات السلوك والموقف لا شخصية التلميذ. ولا تدخل الملاحظات السلبية في الإحصائيات إلا بعد مراجعتها.
          </p>
        </header>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="إغلاق التنبيه" className="mr-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600">جارٍ تحميل التلاميذ والسجلات المحفوظة…</div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h2 className="font-bold">لا توجد بيانات تلاميذ مستوردة لعرضها</h2>
            <p className="mt-2 text-sm leading-6">استورد لائحة التلاميذ والأقسام أولاً، ثم عُد إلى هذه الشاشة لربط السلوكات بالتلميذ الصحيح.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="min-w-52 space-y-1 text-sm font-bold text-slate-700">
                القسم
                <select value={selectedSection} onChange={event => {
                  const nextSection = event.target.value;
                  setSelectedSection(nextSection);
                  const query = normalizeStudentSearch(search);
                  const matchingStudents = students.filter(student =>
                    (nextSection === 'الكل' || student.section === nextSection) &&
                    (!query || normalizeStudentSearch(`${student.name} ${student.code} ${student.level} ${student.section}`).includes(query))
                  );
                  setSelectedStudentId(matchingStudents[0]?.id || '');
                }} className={inputClass}>
                  <option value="الكل">كل الأقسام</option>
                  {sections.map(section => <option key={section} value={section}>{section}</option>)}
                </select>
              </label>
              <label className="min-w-52 flex-1 space-y-1 text-sm font-bold text-slate-700">
                بحث عن تلميذ
                <span className="relative block">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={event => {
                      const value = event.target.value;
                      setSearch(value);
                      const query = normalizeStudentSearch(value);
                      if (query && (activeView === 'card' || activeView === 'entry')) {
                        setSelectedStudentId(sectionStudents.find(student =>
                          normalizeStudentSearch(`${student.name} ${student.code} ${student.level} ${student.section}`).includes(query)
                        )?.id || '');
                        setRecordFilter('all');
                      }
                    }}
                    className={`${inputClass} pr-9`}
                    placeholder="الاسم أو الرقم أو المستوى"
                  />
                </span>
              </label>
              <span className="pb-2 text-sm text-slate-500">{visibleStudents.length} من {sectionStudents.length} تلميذاً في العرض</span>
            </div>

            <nav className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              {navButton('dashboard', 'لوحة القيادة', <BarChart3 className="h-4 w-4" />)}
              {navButton('card', 'البطاقة الفردية', <UserRound className="h-4 w-4" />)}
              {navButton('entry', 'تسجيل ملاحظة', <Plus className="h-4 w-4" />)}
              <button type="button" onClick={() => setShowSettings(value => !value)} className="mr-auto inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">
                <Settings2 className="h-4 w-4" />إعداد التصنيفات والإجراءات
              </button>
            </nav>

            {showSettings && (
              <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
                <div>
                  <h2 className="mb-3 font-bold text-slate-900">تصنيفات السلوك</h2>
                  <form onSubmit={saveCategory} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                    <input value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} className={inputClass} placeholder="اسم التصنيف" required />
                    <select value={newCategoryKind} onChange={event => setNewCategoryKind(event.target.value as DisciplineRecordKind)} className={inputClass}>
                      <option value="negative">سلوك سلبي</option><option value="positive">سلوك إيجابي</option><option value="encouragement">تقدير تشجيعي</option>
                    </select>
                    {newCategoryKind === 'negative' && (
                      <select value={newCategorySeverity} onChange={event => setNewCategorySeverity(Number(event.target.value) as DisciplineSeverity)} className={inputClass}>
                        <option value={1}>الدرجة الأولى</option><option value={2}>الدرجة الثانية</option><option value={3}>الدرجة الثالثة</option>
                      </select>
                    )}
                    <button className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white">{editingCategoryId ? 'حفظ التعديل' : 'إضافة تصنيف'}</button>
                  </form>
                  <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                    {categories.map(category => (
                      <div key={category.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                        <span className="min-w-0 flex-1">{categoryDisplayName(category)} <span className="text-xs text-slate-500">· {kindLabels[category.kind]}{category.severity ? ` · الدرجة ${category.severity}` : ''}</span></span>
                        <button type="button" onClick={() => {
                          setEditingCategoryId(category.id);
                          setNewCategoryName(category.name);
                          setNewCategoryKind(category.kind);
                          setNewCategorySeverity(category.severity || 1);
                        }} className="rounded p-1 text-indigo-700 hover:bg-indigo-50">تعديل</button>
                        <button type="button" onClick={() => void deleteCategory(category.id)} aria-label={`حذف ${category.name}`} className="rounded p-1 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 className="mb-3 font-bold text-slate-900">الإجراءات المتاحة</h2>
                  <form onSubmit={saveAction} className="flex gap-2 rounded-lg bg-slate-50 p-3">
                    <input value={actionName} onChange={event => setActionName(event.target.value)} className={inputClass} placeholder="اسم الإجراء" required />
                    <button className="shrink-0 rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white">{editingActionId ? 'حفظ' : 'إضافة'}</button>
                  </form>
                  <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                    {actions.map(action => (
                      <div key={action.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                        <span className="min-w-0 flex-1">{action.name}</span>
                        <button type="button" onClick={() => { setEditingActionId(action.id); setActionName(action.name); }} className="rounded p-1 text-indigo-700 hover:bg-indigo-50">تعديل</button>
                        <button type="button" onClick={() => void deleteAction(action.id)} aria-label={`حذف ${action.name}`} className="rounded p-1 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <h2 className="mb-3 font-bold text-slate-900">عناوين بطاقات الإحصائيات</h2>
                  <form onSubmit={saveMetricTitles} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      اختر العنوان
                      <select value={selectedMetricTitle} onChange={event => {
                        setSelectedMetricTitle(event.target.value as keyof MetricTitles);
                        setMetricTitlesSaved(false);
                      }} className={inputClass}>
                        {(Object.keys(DEFAULT_METRIC_TITLES) as Array<keyof MetricTitles>).map(key => (
                          <option key={key} value={key}>{metricTitles[key]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      الاسم الجديد
                      <input
                        value={metricTitleDraft[selectedMetricTitle]}
                        onChange={event => {
                          setMetricTitleDraft(current => ({ ...current, [selectedMetricTitle]: event.target.value }));
                          setMetricTitlesSaved(false);
                        }}
                        className={inputClass}
                        maxLength={60}
                        required
                      />
                    </label>
                    <div className="flex flex-wrap items-end gap-2">
                      <button className="rounded-lg bg-indigo-700 px-4 py-2 font-bold text-white">حفظ العناوين</button>
                      <button type="button" onClick={resetMetricTitles} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">استعادة الافتراضية</button>
                      {metricTitlesSaved && <span role="status" className="text-sm font-semibold text-emerald-700">تم حفظ العناوين</span>}
                    </div>
                  </form>
                </div>
              </section>
            )}

            {activeView === 'dashboard' && (
              <div className="space-y-5">
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard title={metricTitles.positive} value={`+${positiveTotal}`} caption="إجمالي السلوكات الإيجابية المقبولة" icon={<ThumbsUp className="h-5 w-5" />} color="emerald" trend={weeklyPositiveChange.text} trendDirection={weeklyPositiveChange.direction} />
                  <MetricCard title={metricTitles.negative} value={`−${negativeTotal}`} caption="السلوكات المقبولة بعد المراجعة" icon={<AlertCircle className="h-5 w-5" />} color="amber" trend={weeklyNegativeChange.text} trendDirection={weeklyNegativeChange.direction} />
                  <MetricCard title={metricTitles.encouragements} value={String(encouragementTotal)} caption="تقديرات محفوظة" icon={<Award className="h-5 w-5" />} color="violet" trend={weeklyChange('encouragement').text} trendDirection={weeklyChange('encouragement').direction} />
                  <MetricCard title="مؤشر السلوك العام" value={`${behaviorIndex > 0 ? '+' : ''}${behaviorIndex}`} caption={behaviorIndex > 0 ? 'المؤشر الإيجابي أعلى من السلبي' : behaviorIndex < 0 ? 'يحتاج إلى مواكبة تربوية' : 'توازن في السجلات المقبولة'} icon={<BarChart3 className="h-5 w-5" />} color="blue" trend={weeklyIndexTrend.text} trendDirection={weeklyIndexTrend.direction} />
                </section>

                <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex items-center gap-3 border-slate-100 sm:border-l sm:pl-3"><FileText className="h-9 w-9 rounded-full bg-blue-50 p-2 text-blue-600" /><span><span className="block text-xs text-slate-500">إجمالي السجلات</span><strong>{sectionRecords.length}</strong></span></div>
                  <div className="flex items-center gap-3 border-slate-100 sm:border-l sm:pl-3"><Clock3 className="h-9 w-9 rounded-full bg-amber-50 p-2 text-amber-600" /><span><span className="block text-xs text-slate-500">{metricTitles.pending}</span><strong>{pendingCount}</strong></span></div>
                  <div className="flex items-center gap-3 border-slate-100 sm:border-l sm:pl-3"><UsersRound className="h-9 w-9 rounded-full bg-indigo-50 p-2 text-indigo-600" /><span><span className="block text-xs text-slate-500">{metricTitles.students}</span><strong>{sectionStudents.length}</strong></span></div>
                  <div className="flex items-center gap-3"><CalendarDays className="h-9 w-9 rounded-full bg-emerald-50 p-2 text-emerald-600" /><span><span className="block text-xs text-slate-500">آخر تحديث</span><strong className="text-xs">{latestIncidentDate}</strong></span></div>
                </section>

                <section className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" />طباعة تقرير</button>
                  <button type="button" onClick={() => openEntryForCategory('negative', categories.find(category => category.kind === 'negative' && (category.id === 'mobile-phone' || /هاتف/.test(category.name)))?.id)} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100"><Settings2 className="h-4 w-4" />إجراء تربوي</button>
                  <button type="button" onClick={() => openEntryForCategory('negative', categories.find(category => category.kind === 'negative' && /عراك|شجار|نزاع/.test(category.name))?.id)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"><UsersRound className="h-4 w-4" />تسجيل نزاع</button>
                  <button type="button" onClick={() => openEntryForCategory('positive')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" />إضافة سلوك</button>
                  <button type="button" onClick={() => openEntryForCategory('negative')} className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-700 hover:bg-orange-100"><AlertCircle className="h-4 w-4" />تسجيل مخالفة</button>
                  <button type="button" onClick={() => { setSelectedStudentId(pendingStudentIncident?.studentId || selectedStudentId); setActiveView('card'); setRecordFilter('all'); }} disabled={!pendingStudentIncident} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"><Settings2 className="h-4 w-4" />مراجعة السلوكات ({pendingCount})</button>
                </section>

                <section className="grid gap-5 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div><h2 className="text-lg font-bold text-slate-900">تطور السلوك خلال</h2><p className="text-sm text-slate-500">محتسب من الوقائع المحفوظة والمقبولة فقط · {selectedSection === 'الكل' ? 'كل الأقسام' : `القسم ${selectedSection}`}</p></div>
                      <select aria-label="مدة مخطط لوحة القيادة" value={progressPeriod} onChange={event => setProgressPeriod(event.target.value as ProgressPeriod)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="2w">آخر أسبوعين</option><option value="3w">آخر 3 أسابيع</option><option value="4w">آخر 4 أسابيع</option>
                        <option value="1m">آخر شهر</option><option value="2m">آخر شهرين</option><option value="3m">آخر 3 أشهر</option><option value="6m">آخر 6 أشهر</option>
                        <option value="1y">آخر سنة</option><option value="2y">آخر سنتين</option><option value="3y">آخر 3 سنوات</option><option value="4y">آخر 4 سنوات</option><option value="5y">آخر 5 سنوات</option>
                      </select>
                    </div>
                    <div className="mb-2 flex justify-end gap-4 text-xs"><span className="text-emerald-700">● السلوك الإيجابي</span><span className="text-orange-700">● السلوك السلبي المؤكد</span></div>
                    {dashboardProgress.length > 0 ? (
                      <div className="overflow-x-auto">
                        <div className="flex min-w-max items-end gap-2 border-b border-slate-200 px-2 pb-2 pt-3">
                          {dashboardProgress.map(item => (
                            <div key={item.key} className="flex w-20 flex-col items-center gap-2">
                              <div className="flex h-36 w-full items-end justify-center gap-1 border-b border-slate-100 bg-[repeating-linear-gradient(to_top,transparent_0,transparent_35px,#e2e8f0_36px)] px-2">
                                <div title={`إيجابي: ${item.positive}`} className="w-4 rounded-t bg-emerald-500" style={{ height: `${Math.max(item.positive ? 5 : 0, (item.positive / dashboardProgressMax) * 100)}%` }} />
                                <div title={`سلبي مؤكد: ${item.negative}`} className="w-4 rounded-t bg-orange-500" style={{ height: `${Math.max(item.negative ? 5 : 0, (item.negative / dashboardProgressMax) * 100)}%` }} />
                              </div>
                              <span className="max-w-20 text-center text-[10px] leading-4 text-slate-500">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">لا توجد بيانات ضمن الفترة المحددة.</p>}
                    <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">لا تدخل السلوكات السلبية قيد المراجعة في هذا المخطط حتى يتم التحقق منها.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div><h2 className="text-lg font-bold text-slate-900">سجل السلوك</h2><p className="text-sm text-slate-500">{sectionRecords.length} تسجيلاً محفوظاً</p></div>
                      <select aria-label="تصفية سجل لوحة القيادة" value={dashboardRecordFilter} onChange={event => setDashboardRecordFilter(event.target.value as typeof dashboardRecordFilter)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                        <option value="all">كل التسجيلات</option><option value="positive">إيجابية</option><option value="negative">سلبية</option><option value="encouragement">تقديرات</option>
                      </select>
                    </div>
                    {dashboardRecords.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">لا توجد تسجيلات مطابقة في هذا القسم.</p>
                    ) : (
                      <div className="max-h-[28rem] space-y-3 overflow-y-auto">
                        {dashboardRecords.map(record => (
                          <article key={record.id} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <button type="button" onClick={() => { setSelectedStudentId(record.studentId); setActiveView('card'); setRecordFilter('all'); }} className="text-right font-bold text-slate-900 hover:text-indigo-700">{record.categoryName}</button>
                                <p className="mt-1 text-xs text-slate-600">{record.studentName} · {record.section}</p>
                                <p className="mt-1 text-xs text-slate-500">{formatDate(record.incidentDate)} · {record.incidentTime}{record.location ? ` · ${record.location}` : ''}</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${record.status === 'pending' ? 'bg-amber-100 text-amber-800' : record.status === 'rejected' ? 'bg-slate-100 text-slate-600' : record.kind === 'negative' ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {record.status === 'pending' ? 'بانتظار المراجعة' : record.status === 'rejected' ? 'مرفوض' : kindLabels[record.kind]}
                              </span>
                            </div>
                            {record.status === 'pending' && (
                              <div className="mt-3 flex justify-end">
                                <button type="button" onClick={() => void reviewIncident(record, 'approved')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800">مراجعة وتأكيد</button>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /><h2 className="text-lg font-bold text-slate-900">رؤى سريعة للمواكبة</h2></div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-red-100 bg-red-50/50 p-4"><p className="text-xs font-semibold text-red-800">أكثر مخالفة تسجيلاً</p>{mostCommonIncident ? <><p className="mt-2 font-bold text-slate-900">{mostCommonIncident[0]}</p><p className="mt-1 text-sm text-red-700">{mostCommonIncident[1]} سجلات مؤكدة</p></> : <p className="mt-2 text-sm text-slate-500">لا توجد مخالفات مؤكدة بعد</p>}</div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"><p className="text-xs font-semibold text-emerald-800">أفضل سلوك إيجابي مسجل</p>{positiveStudentHighlight ? <button type="button" onClick={() => { setSelectedStudentId(positiveStudentHighlight.student.id); setActiveView('card'); }} className="mt-2 block text-right font-bold text-slate-900 hover:text-emerald-700">{positiveStudentHighlight.student.name}<span className="mt-1 block text-sm text-emerald-700">+{positiveStudentHighlight.totals.positive} نقطة</span></button> : <p className="mt-2 text-sm text-slate-500">لا توجد بيانات إيجابية بعد</p>}</div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-xs font-semibold text-amber-800">التوصية التربوية</p>{repeatedBehavior ? <><p className="mt-2 font-bold text-slate-900">{repeatedBehaviorStudent?.name || 'تلميذ مسجل'} · {repeatedBehavior.categoryName}</p><p className="mt-1 text-xs leading-5 text-slate-600">{repeatedBehaviorRecommendation}</p><p className="mt-2 text-xs font-semibold text-amber-800">{repeatedBehavior.count} وقائع مؤكدة · متابعة مقترحة</p><button type="button" onClick={() => { setSelectedStudentId(repeatedBehavior.studentId); openEntryForCategory('negative', repeatedBehavior.categoryId); }} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100">تسجيل متابعة تربوية</button></> : <p className="mt-2 text-sm leading-5 text-slate-600">لا توجد مخالفة متكررة مؤكدة تستدعي توصية خاصة. لا تعني قلة السجلات تحسنًا تلقائيًا.</p>}</div>
                    </div>
                    <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">هذه المؤشرات وصفية لدعم المواكبة التربوية، ولا تكفي وحدها لاتخاذ إجراء بحق أي تلميذ.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-bold text-slate-900">أنواع السلوكات السلبية المؤكدة</h2>
                    {categoryStats.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">ستظهر الإحصائيات بعد تسجيل الوقائع ومراجعتها.</p>
                    ) : (
                      <div className="max-h-64 space-y-3 overflow-y-auto">
                        {categoryStats.map(([name, count]) => (
                          <div key={name}>
                            <div className="mb-1 flex justify-between gap-2 text-sm"><span>{name}</span><strong>{count}</strong></div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(8, (count / categoryStats[0][1]) * 100)}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeView === 'card' && (
              selectedStudent ? (
                <div className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="block max-w-xl space-y-2 text-sm font-bold text-slate-700">
                      اختر تلميذاً من القائمة المستوردة
                      <select value={selectedStudentId} onChange={event => { setSelectedStudentId(event.target.value); setRecordFilter('all'); }} className={inputClass}>
                        {visibleStudents.map(student => <option key={student.id} value={student.id}>{student.name} — {student.level}، {student.section}</option>)}
                      </select>
                    </label>
                  </section>
                  <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
                    <div className="bg-gradient-to-l from-indigo-50 via-white to-emerald-50 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="rounded-2xl bg-indigo-100 p-4 text-indigo-800"><UserRound className="h-9 w-9" /></div>
                          <div>
                            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-900">بيانات من قاعدة المؤسسة</span>
                            <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                            <p className="mt-1 text-slate-600">{selectedStudent.level} · القسم {selectedStudent.section} · {selectedStudent.code ? `الرقم ${selectedStudent.code}` : 'لا يوجد رقم مسجل'}</p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-emerald-100 bg-white/80 p-4">
                          <p className="text-sm text-slate-500">مؤشر المواظبة من سجلات الحضور</p>
                          <p className="mt-1 text-2xl font-bold text-emerald-700">{attendanceRate(selectedStudent.id, attendance) === null ? 'لا معطيات' : `${attendanceRate(selectedStudent.id, attendance)}%`}</p>
                          <p className="text-xs text-slate-500">لا يُعرض رقم تقديري عند غياب السجلات</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="bg-white p-4"><p className="text-sm text-slate-500">{metricTitles.positive}</p><strong className="mt-1 block text-xl text-emerald-700">+{studentTotals(selectedStudent.id, records).positive}</strong></div>
                      <div className="bg-white p-4"><p className="text-sm text-slate-500">{metricTitles.negative}</p><strong className="mt-1 block text-xl text-amber-700">−{studentTotals(selectedStudent.id, records).negative}</strong></div>
                      <div className="bg-white p-4"><p className="text-sm text-slate-500">{metricTitles.encouragements}</p><strong className="mt-1 block text-xl text-violet-700">{studentTotals(selectedStudent.id, records).encouragements}</strong></div>
                      <div className="bg-white p-4"><p className="text-sm text-slate-500">مؤشر وصفي</p><strong className="mt-1 block text-sm text-indigo-700">{improvementLabel}</strong></div>
                    </div>
                  </section>

                  <section className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-900">تطور السلوك خلال</h3>
                        <select
                          aria-label="مدة عرض تطور السلوك"
                          value={progressPeriod}
                          onChange={event => setProgressPeriod(event.target.value as ProgressPeriod)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          <option value="2w">آخر أسبوعين</option>
                          <option value="3w">آخر 3 أسابيع</option>
                          <option value="4w">آخر 4 أسابيع</option>
                          <option value="1m">آخر شهر</option>
                          <option value="2m">آخر شهرين</option>
                          <option value="3m">آخر 3 أشهر</option>
                          <option value="6m">آخر 6 أشهر</option>
                          <option value="1y">آخر سنة</option>
                          <option value="2y">آخر سنتين</option>
                          <option value="3y">آخر 3 سنوات</option>
                          <option value="4y">آخر 4 سنوات</option>
                          <option value="5y">آخر 5 سنوات</option>
                        </select>
                      </div>
                      <p className="mb-5 text-sm text-slate-500">محتسب من الوقائع المحفوظة والمقبولة فقط.</p>
                      <div className="max-h-[36rem] space-y-4 overflow-y-auto pr-1">
                        {monthlyProgress.map(item => (
                          <div key={item.key}>
                            <div className="mb-1 flex justify-between text-xs text-slate-600"><span>{item.label}</span><span>+{item.positive} إيجابي · −{item.negative} سلبي</span></div>
                            <div className="space-y-1">
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(item.positive / progressMax) * 100}%` }} /></div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(item.negative / progressMax) * 100}%` }} /></div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-4 text-xs text-slate-600"><span className="text-emerald-700">● السلوك الإيجابي</span><span className="text-amber-700">● السلوك السلبي المؤكد</span></div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="text-lg font-bold text-slate-900">سجل السلوك</h3><p className="text-sm text-slate-500">{studentRecords.length} تسجيلاً محفوظاً</p></div>
                        <select value={recordFilter} onChange={event => setRecordFilter(event.target.value as typeof recordFilter)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                          <option value="all">كل التسجيلات</option><option value="positive">إيجابية</option><option value="negative">سلبية</option><option value="encouragement">تقديرات</option>
                        </select>
                      </div>
                      {filteredRecords.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">لا توجد تسجيلات في هذا التصنيف.</p>
                      ) : (
                        <div className="max-h-[34rem] space-y-3 overflow-auto">
                          {filteredRecords.map(record => (
                            <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-slate-900">{record.categoryName}</h4>
                                  <p className="mt-1 text-xs text-slate-500">{formatDate(record.incidentDate)} · {record.incidentTime} · {record.location}</p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-xs font-bold ${record.status === 'pending' ? 'bg-blue-100 text-blue-800' : record.status === 'rejected' ? 'bg-slate-100 text-slate-600' : record.kind === 'negative' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {record.status === 'pending' ? 'بانتظار المراجعة' : record.status === 'rejected' ? 'مرفوضة' : kindLabels[record.kind]}
                                </span>
                              </div>
                              {record.severity && <p className="mt-2 text-xs font-semibold text-amber-800">الدرجة {record.severity} · {record.points} نقط</p>}
                              {record.kind !== 'negative' && record.points > 0 && <p className="mt-2 text-xs font-semibold text-emerald-800">{record.points} نقط إيجابية</p>}
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{record.details}</p>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                                <span><MapPin className="ml-1 inline h-3.5 w-3.5" />{record.location}</span>
                                <span>{reporterLabels[record.reporterType]}{record.reporterName ? `: ${record.reporterName}` : ''}</span>
                              </div>
                              {record.actions.length > 0 && <p className="mt-2 text-xs text-slate-600">الإجراءات: {record.actions.join('، ')}</p>}
                              {record.kind === 'negative' && record.status === 'pending' && (
                                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                                  <button type="button" onClick={() => void reviewIncident(record, 'approved')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">تأكيد بعد المراجعة</button>
                                  <button type="button" onClick={() => void reviewIncident(record, 'rejected')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">رفض الملاحظة</button>
                                </div>
                              )}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <p className="rounded-xl bg-white p-6 text-slate-600">لا يوجد تلميذ مطابق للبحث في القسم المحدد.</p>
              )
            )}

            {activeView === 'entry' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900">تسجيل ملاحظة في بطاقة التلميذ</h2>
                  <p className="mt-1 text-sm text-slate-500">سيُحفظ التسجيل في قاعدة البيانات ويرتبط بمعرّف التلميذ المستورد.</p>
                </div>
                {savedMessage && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="ml-1 inline h-4 w-4" />{savedMessage}</p>}
                <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    التلميذ
                    <select value={selectedStudentId} onChange={event => setSelectedStudentId(event.target.value)} required className={inputClass}>
                      {visibleStudents.map(student => <option key={student.id} value={student.id}>{student.name} — {student.level}، {student.section}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    نوع التسجيل
                    <select value={kind} onChange={event => changeKind(event.target.value as DisciplineRecordKind)} className={inputClass}>
                      <option value="negative">سلوك سلبي يحتاج إلى مراجعة</option>
                      <option value="positive">سلوك إيجابي</option>
                      <option value="encouragement">تقدير تشجيعي</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                    السلوك أو المبادرة
                    <select value={categoryId} onChange={event => {
                      setCategoryId(event.target.value);
                      const category = kindCategories.find(item => item.id === event.target.value);
                      setPoints(kind === 'negative' ? (category?.severity || 1) * 3 : kind === 'positive' ? 3 : 0);
                    }} required className={inputClass}>
                      {kindCategories.map(category => <option key={category.id} value={category.id}>{categoryDisplayName(category)}{category.severity ? ` — الدرجة ${category.severity}` : ''}</option>)}
                    </select>
                    {kindCategories.length === 0 && <span className="text-xs text-red-700">أضف تصنيفاً من إعدادات التصنيفات أولاً.</span>}
                  </label>
                  {phoneRecommendation && (
                    <aside className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 md:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-700" />
                            <h3 className="font-bold text-indigo-950">بطاقة التوصية التربوية · {phoneRecommendation.level}</h3>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-indigo-950">{phoneRecommendation.summary}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedActions(current => Array.from(new Set([
                            ...current,
                            ...actions.filter(action => phoneRecommendation.suggestedActions.includes(action.name)).map(action => action.name),
                          ])))}
                          className="shrink-0 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
                        >
                          اختيار الإجراءات المقترحة
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 border-t border-indigo-200 pt-3 text-sm sm:grid-cols-3">
                        <p><span className="font-bold text-indigo-900">التصنيف:</span> احترام النظام الداخلي للمؤسسة</p>
                        <p><span className="font-bold text-indigo-900">طبيعة المخالفة:</span> استعمال ممنوع ومتكرر بعد تنبيه سابق عند ثبوته في السجل</p>
                        <p><span className="font-bold text-indigo-900">مدة التتبع:</span> {phoneRecommendation.duration}</p>
                        <p className="sm:col-span-3"><span className="font-bold text-indigo-900">المسؤول عن التتبع:</span> {phoneRecommendation.responsible}</p>
                      </div>
                      <ol className="mt-3 list-inside list-decimal space-y-1 text-sm leading-6 text-slate-700">
                        {phoneRecommendation.steps.map(step => <li key={step}>{step}</li>)}
                      </ol>
                      <p className="mt-3 rounded-lg bg-white/80 p-3 text-xs leading-5 text-slate-600">
                        بُني الاقتراح على {previousPhoneIncidents.length} واقعة سابقة مؤكدة لهذا التلميذ في التصنيف نفسه، لا على مجموع النقط. الوقائع المعلقة أو المرفوضة مستبعدة؛ والتوصية إرشادية ولا تنفذ إجراءً تلقائيًا.
                      </p>
                    </aside>
                  )}
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    التاريخ
                    <input type="date" value={incidentDate} onChange={event => setIncidentDate(event.target.value)} required className={inputClass} />
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    الوقت
                    <input type="time" value={incidentTime} onChange={event => setIncidentTime(event.target.value)} required className={inputClass} />
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    المكان
                    <input value={location} onChange={event => setLocation(event.target.value)} required className={inputClass} placeholder="القسم أو فضاء المؤسسة" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      مصدر الملاحظة
                      <select value={reporterType} onChange={event => setReporterType(event.target.value as IncidentReporterType)} className={inputClass}>
                        <option value="student">تلميذ</option><option value="teacher">أستاذ</option><option value="visitor">مرتفق</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      اسم المبلّغ (اختياري)
                      <input value={reporterName} onChange={event => setReporterName(event.target.value)} className={inputClass} />
                    </label>
                  </div>
                  {kind !== 'encouragement' && (
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      النقط
                      <input type="number" min="0" max="20" value={points} onChange={event => setPoints(Number(event.target.value))} className={inputClass} />
                    </label>
                  )}
                  {kind === 'negative' && selectedCategory?.severity && (
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      درجة السلوك
                      <select value={selectedCategory.severity} onChange={event => {
                        const severity = Number(event.target.value) as DisciplineSeverity;
                        const matching = categories.find(category => category.kind === 'negative' && category.severity === severity);
                        if (matching) setCategoryId(matching.id);
                        setPoints(severity * 3);
                      }} className={inputClass}>
                        <option value={1}>الدرجة الأولى</option><option value={2}>الدرجة الثانية</option><option value={3}>الدرجة الثالثة</option>
                      </select>
                    </label>
                  )}
                  <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                    وصف موضوعي للملاحظة
                    <textarea value={details} onChange={event => setDetails(event.target.value)} required rows={4} className={inputClass} placeholder="سجّل ما حدث أو المبادرة دون إصدار حكم على التلميذ..." />
                  </label>
                  {kind === 'negative' && (
                    <>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 md:col-span-2">
                        هذا تسجيل أولي؛ لن يدخل في مؤشر السلوك السلبي حتى تتم مراجعته والتحقق منه.
                      </div>
                      <fieldset className="rounded-lg border border-slate-200 p-3 md:col-span-2">
                        <legend className="px-1 text-sm font-semibold text-slate-700">الإجراءات المتخذة أو المقترحة</legend>
                        {actions.length === 0 ? <p className="text-sm text-slate-500">أضف إجراءات من الإعدادات إذا لزم الأمر.</p> : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {actions.map(action => (
                              <label key={action.id} className="flex items-start gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={selectedActions.includes(action.name)} onChange={event => setSelectedActions(current =>
                                  event.target.checked ? [...current, action.name] : current.filter(item => item !== action.name)
                                )} className="mt-1 rounded border-slate-300 text-indigo-600" />
                                {action.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </fieldset>
                    </>
                  )}
                  <button disabled={saving || kindCategories.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-5 py-2.5 font-bold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2">
                    <Plus className="h-4 w-4" />{saving ? 'جارٍ الحفظ…' : 'حفظ في البطاقة السلوكية'}
                  </button>
                </form>
              </section>
            )}
          </>
        )}

        <footer className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">
          <CalendarDays className="ml-1 inline h-3.5 w-3.5" />
          السجلات محفوظة محلياً ضمن قاعدة بيانات البرنامج ومرتبطة بمعرّف التلميذ؛ تبقى محفوظة بعد إغلاق الشاشة. راجع الملاحظات قبل اعتمادها في المؤشرات.
        </footer>
      </div>
    </div>
  );
};

export default DisciplineManagement;
