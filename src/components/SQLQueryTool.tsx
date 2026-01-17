import React, { useState } from 'react';
import { Database, Play, Download, Copy, AlertCircle, CheckCircle } from 'lucide-react';
import { dbManager } from '../utils/database';
 

const SQLQueryTool: React.FC = () => {
  const [query, setQuery] = useState('SELECT name FROM sqlite_master WHERE type=\'table\';');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // تشغيل الاستعلام
  const executeQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResults([]);
    setColumns([]);

    try {
      // الوصول إلى قاعدة البيانات مباشرة
      const db = (dbManager as any).db;
      if (!db) {
        throw new Error('قاعدة البيانات غير متاحة');
      }

      const stmt = db.prepare(query);
      try {
        const queryResults: any[] = [];
        const queryColumns: string[] = [];

        // تنفيذ الاستعلام
        while (stmt.step()) {
          const row = stmt.getAsObject();
          queryResults.push(row);
          
          // الحصول على أسماء الأعمدة من أول صف
          if (queryColumns.length === 0) {
            queryColumns.push(...Object.keys(row));
          }
        }

        setResults(queryResults);
        setColumns(queryColumns);
        setSuccess(`تم تنفيذ الاستعلام بنجاح. النتائج: ${queryResults.length} صف`);
      } finally {
        stmt.free();
      }

    } catch (err) {
      console.error('خطأ في تنفيذ الاستعلام:', err);
      setError(err instanceof Error ? err.message : 'خطأ غير معروف');
    } finally {
      setLoading(false);
    }
  };

  // نسخ النتائج
  const copyResults = () => {
    const csvContent = [
      columns.join(','),
      ...results.map(row => columns.map(col => row[col] || '').join(','))
    ].join('\n');
    
    navigator.clipboard.writeText(csvContent);
    setSuccess('تم نسخ النتائج إلى الحافظة');
  };

  // تصدير النتائج
  const exportResults = () => {
    const csvContent = [
      columns.join(','),
      ...results.map(row => columns.map(col => row[col] || '').join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // استعلامات جاهزة
  const predefinedQueries = [
    {
      name: 'عرض جميع الجداول',
      query: "SELECT name FROM sqlite_master WHERE type='table';"
    },
    {
      name: 'عرض التلاميذ',
      query: "SELECT * FROM students LIMIT 10;"
    },
    {
      name: 'عرض المستويات',
      query: "SELECT * FROM levels;"
    },
    {
      name: 'عرض الأقسام',
      query: "SELECT * FROM sections;"
    },
    {
      name: 'عرض الأكواد السرية',
      query: "SELECT * FROM credentials LIMIT 10;"
    },
    {
      name: 'عرض الامتحانات',
      query: "SELECT * FROM exams LIMIT 10;"
    },
    {
      name: 'عرض المعدلات',
      query: "SELECT * FROM averages LIMIT 10;"
    },
    {
      name: 'عرض قرارات المجالس',
      query: "SELECT * FROM council_decisions LIMIT 10;"
    },
    {
      name: 'عرض المنقطعين',
      query: "SELECT * FROM dropouts LIMIT 10;"
    },
    {
      name: 'عرض المدمجين',
      query: "SELECT * FROM reintegrations LIMIT 10;"
    },
    {
      name: 'عرض النقل والتحويلات',
      query: "SELECT * FROM transfers LIMIT 10;"
    },
    {
      name: 'عرض الغائبين',
      query: "SELECT * FROM absentees LIMIT 10;"
    },
    {
      name: 'عرض أولياء الأمور',
      query: "SELECT * FROM parents LIMIT 10;"
    },
    {
      name: 'عرض إعدادات المؤسسة',
      query: "SELECT * FROM institution_settings;"
    },
    {
      name: 'عرض غير الملتحقين',
      query: "SELECT * FROM unenrolled_students LIMIT 10;"
    },
    {
      name: 'عرض المفصولين',
      query: "SELECT * FROM dismissed_students LIMIT 10;"
    },
    {
      name: 'عرض إحصائيات التوجيه',
      query: "SELECT * FROM guidance_statistics LIMIT 10;"
    },
    {
      name: 'ربط التلاميذ بالأقسام والمستويات',
      query: `SELECT 
  s.firstName, s.lastName, 
  l.name AS level_name, 
  sec.name AS section_name
FROM students s
JOIN sections sec ON s.section = sec.id
JOIN levels l ON sec.levelId = l.id
LIMIT 20;`
    },
    {
      name: 'ربط التلاميذ بالامتحانات والنقط',
      query: `SELECT 
  s.firstName, s.lastName, s.nationalId,
  e.subject, e.exam_type, e.grade_value, e.max_grade,
  a.term, a.average_value
FROM students s
LEFT JOIN exams e ON s.nationalId = e.student_id
LEFT JOIN averages a ON s.nationalId = a.student_id
WHERE e.exam_id IS NOT NULL OR a.average_id IS NOT NULL
LIMIT 20;`
    },
    {
      name: 'ربط التلاميذ بأولياء الأمور',
      query: `SELECT 
  s.firstName, s.lastName, s.nationalId,
  p.relation, p.parent_name, p.phone_1, p.address
FROM students s
JOIN parents p ON s.nationalId = p.student_id
LIMIT 20;`
    },
    {
      name: 'ربط التلاميذ بقرارات المجالس',
      query: `SELECT 
  s.firstName, s.lastName, s.nationalId,
  cd.decision_type, cd.decision_date, cd.note, cd.value
FROM students s
JOIN council_decisions cd ON s.nationalId = cd.student_id
ORDER BY cd.decision_date DESC
LIMIT 20;`
    },
    {
      name: 'ربط التلاميذ بالأكواد السرية',
      query: `SELECT 
  s.firstName, s.lastName, s.nationalId,
  c.secret_code, c.issue_date
FROM students s
JOIN credentials c ON s.nationalId = c.student_id
LIMIT 20;`
    },
    {
      name: 'تحليل حركية التلاميذ',
      query: `SELECT 
  'المنقطعين' as category, COUNT(*) as count
FROM dropouts
UNION ALL
SELECT 'المدمجين', COUNT(*) FROM reintegrations
UNION ALL
SELECT 'المحولين', COUNT(*) FROM transfers
UNION ALL
SELECT 'الغائبين', COUNT(*) FROM absentees
UNION ALL
SELECT 'غير الملتحقين', COUNT(*) FROM unenrolled_students
UNION ALL
SELECT 'المفصولين', COUNT(*) FROM dismissed_students;`
    },
    {
      name: 'إحصائيات الامتحانات حسب النوع',
      query: `SELECT 
  exam_type,
  COUNT(*) as total_exams,
  AVG(grade_value) as avg_grade,
  MIN(grade_value) as min_grade,
  MAX(grade_value) as max_grade
FROM exams
GROUP BY exam_type
ORDER BY total_exams DESC;`
    },
    {
      name: 'إحصائيات المعدلات حسب الفصل',
      query: `SELECT 
  term,
  COUNT(*) as total_averages,
  AVG(average_value) as overall_avg,
  MIN(average_value) as min_avg,
  MAX(average_value) as max_avg
FROM averages
GROUP BY term
ORDER BY term;`
    },
    {
      name: 'تحليل قرارات المجالس',
      query: `SELECT 
  decision_type,
  COUNT(*) as count,
  AVG(value) as avg_value
FROM council_decisions
GROUP BY decision_type
ORDER BY count DESC;`
    },
    {
      name: 'إحصائيات النقل والتحويلات',
      query: `SELECT 
  transfer_type,
  COUNT(*) as count,
  COUNT(DISTINCT from_school) as unique_from_schools,
  COUNT(DISTINCT to_school) as unique_to_schools
FROM transfers
GROUP BY transfer_type;`
    },
    {
      name: 'تحليل أولياء الأمور',
      query: `SELECT 
  relation,
  COUNT(*) as count,
  COUNT(CASE WHEN phone_1 IS NOT NULL AND phone_1 != '' THEN 1 END) as with_phone1,
  COUNT(CASE WHEN phone_2 IS NOT NULL AND phone_2 != '' THEN 1 END) as with_phone2
FROM parents
GROUP BY relation
ORDER BY count DESC;`
    },
    {
      name: 'التلاميذ مع جميع البيانات المرتبطة',
      query: `SELECT 
  s.firstName, s.lastName, s.nationalId, s.gender,
  l.name as level_name,
  sec.name as section_name,
  c.secret_code,
  p.parent_name, p.relation,
  cd.decision_type,
  CASE WHEN d.student_id IS NOT NULL THEN 'منقطع' ELSE 'متمدرس' END as dropout_status
FROM students s
LEFT JOIN levels l ON s.levelId = l.id
LEFT JOIN sections sec ON s.sectionId = sec.id
LEFT JOIN credentials c ON s.nationalId = c.student_id
LEFT JOIN parents p ON s.nationalId = p.student_id
LEFT JOIN council_decisions cd ON s.nationalId = cd.student_id
LEFT JOIN dropouts d ON s.nationalId = d.student_id
LIMIT 15;`
    },
    {
      name: 'عرض بنية جميع الجداول',
      query: "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name;"
    },
    {
      name: 'عدد التلاميذ',
      query: "SELECT COUNT(*) as total_students FROM students;"
    },
    {
      name: 'إحصائيات التوجيه',
      query: "SELECT COUNT(*) as guidance_records FROM guidance_statistics;"
    },
    {
      name: 'عدد السجلات في كل جدول',
      query: `SELECT 
        'students' as table_name, COUNT(*) as count FROM students
        UNION ALL SELECT 'credentials', COUNT(*) FROM credentials
        UNION ALL SELECT 'levels', COUNT(*) FROM levels
        UNION ALL SELECT 'sections', COUNT(*) FROM sections
        UNION ALL SELECT 'academic_years', COUNT(*) FROM academic_years
        UNION ALL SELECT 'exams', COUNT(*) FROM exams
        UNION ALL SELECT 'averages', COUNT(*) FROM averages
        UNION ALL SELECT 'council_decisions', COUNT(*) FROM council_decisions
        UNION ALL SELECT 'guidance_statistics', COUNT(*) FROM guidance_statistics
        UNION ALL SELECT 'dropouts', COUNT(*) FROM dropouts
        UNION ALL SELECT 'reintegrations', COUNT(*) FROM reintegrations
        UNION ALL SELECT 'transfers', COUNT(*) FROM transfers
        UNION ALL SELECT 'absentees', COUNT(*) FROM absentees
        UNION ALL SELECT 'parents', COUNT(*) FROM parents
        UNION ALL SELECT 'institution_settings', COUNT(*) FROM institution_settings
        UNION ALL SELECT 'unenrolled_students', COUNT(*) FROM unenrolled_students
        UNION ALL SELECT 'dismissed_students', COUNT(*) FROM dismissed_students
        ORDER BY count DESC;`
    },
    {
      name: 'التلاميذ حسب النوع',
      query: "SELECT gender, COUNT(*) as count FROM students GROUP BY gender;"
    },
    {
      name: 'التلاميذ حسب الحالة',
      query: "SELECT status, COUNT(*) as count FROM students GROUP BY status;"
    },
    {
      name: 'بنية جدول التلاميذ',
      query: "PRAGMA table_info(students);"
    },
    {
      name: 'المستويات الدراسية',
      query: "SELECT * FROM levels ORDER BY name;"
    },
    {
      name: 'السنوات الدراسية',
      query: "SELECT * FROM academic_years ORDER BY year DESC;"
    },
    {
      name: 'الأقسام مع المستويات',
      query: `SELECT s.name as section_name, l.name as level_name
              FROM sections s 
              LEFT JOIN levels l ON s.levelId = l.id 
              ORDER BY s.name;`
    },
    {
      name: 'التلاميذ مع الأقسام والمستويات (محدث)',
      query: `SELECT s.firstName, s.lastName, s.nationalId, s.academicYear,
                     l.name as level_name, sec.name as section_name
              FROM students s
              LEFT JOIN levels l ON s.levelId = l.id
              LEFT JOIN sections sec ON s.sectionId = sec.id
              ORDER BY s.lastName, s.firstName
              LIMIT 20;`
    },
    {
      name: 'فحص سلامة المراجع',
      query: `SELECT 
                'التلاميذ بدون مستوى' as issue, COUNT(*) as count 
                FROM students WHERE levelId IS NULL OR levelId = ''
              UNION ALL SELECT 
                'التلاميذ بدون قسم', COUNT(*)
                FROM students WHERE sectionId IS NULL OR sectionId = ''
              UNION ALL SELECT 
                'التلاميذ بدون سنة دراسية', COUNT(*) 
                FROM students WHERE academicYear IS NULL OR academicYear = ''
              UNION ALL SELECT
                'أقسام بدون مستوى', COUNT(*)
                FROM sections WHERE levelId IS NULL OR levelId = ''
              UNION ALL SELECT
                'امتحانات بدون تلاميذ', COUNT(*)
                FROM exams e LEFT JOIN students s ON e.student_id = s.nationalId WHERE s.nationalId IS NULL;`
    },
    {
      name: 'تحليل البيانات المفقودة',
      query: `SELECT 
                'تلاميذ بدون بريد إلكتروني' as missing_data, COUNT(*) as count
                FROM students WHERE email IS NULL OR email = ''
              UNION ALL SELECT
                'تلاميذ بدون هاتف', COUNT(*)
                FROM students WHERE phone IS NULL OR phone = ''
              UNION ALL SELECT
                'تلاميذ بدون تاريخ ميلاد', COUNT(*)
                FROM students WHERE dateOfBirth IS NULL OR dateOfBirth = ''
              UNION ALL SELECT
                'تلاميذ بدون عنوان', COUNT(*)
                FROM students WHERE address IS NULL OR address = ''
              UNION ALL SELECT
                'تلاميذ بدون ولي أمر', COUNT(*)
                FROM students s LEFT JOIN parents p ON s.nationalId = p.student_id WHERE p.student_id IS NULL;`
    },
    {
      name: 'إحصائيات شاملة للجداول',
      query: `SELECT 
                table_name,
                record_count,
                CASE 
                  WHEN record_count = 0 THEN 'فارغ'
                  WHEN record_count < 10 THEN 'قليل'
                  WHEN record_count < 100 THEN 'متوسط'
                  ELSE 'كثير'
                END as data_status
              FROM (
                SELECT 'students' as table_name, COUNT(*) as record_count FROM students
                UNION ALL SELECT 'levels', COUNT(*) FROM levels
                UNION ALL SELECT 'sections', COUNT(*) FROM sections
                UNION ALL SELECT 'credentials', COUNT(*) FROM credentials
                UNION ALL SELECT 'exams', COUNT(*) FROM exams
                UNION ALL SELECT 'averages', COUNT(*) FROM averages
                UNION ALL SELECT 'council_decisions', COUNT(*) FROM council_decisions
                UNION ALL SELECT 'dropouts', COUNT(*) FROM dropouts
                UNION ALL SELECT 'reintegrations', COUNT(*) FROM reintegrations
                UNION ALL SELECT 'transfers', COUNT(*) FROM transfers
                UNION ALL SELECT 'absentees', COUNT(*) FROM absentees
                UNION ALL SELECT 'parents', COUNT(*) FROM parents
                UNION ALL SELECT 'guidance_statistics', COUNT(*) FROM guidance_statistics
                UNION ALL SELECT 'institution_settings', COUNT(*) FROM institution_settings
                UNION ALL SELECT 'unenrolled_students', COUNT(*) FROM unenrolled_students
                UNION ALL SELECT 'dismissed_students', COUNT(*) FROM dismissed_students
                UNION ALL SELECT 'academic_years', COUNT(*) FROM academic_years
              ) ORDER BY record_count DESC;`
    },
    {
      name: 'تحليل العلاقات بين الجداول',
      query: `SELECT 
                'students → levels' as relationship,
                COUNT(CASE WHEN s.levelId IS NOT NULL AND l.id IS NOT NULL THEN 1 END) as linked,
                COUNT(CASE WHEN s.levelId IS NOT NULL AND l.id IS NULL THEN 1 END) as broken
              FROM students s LEFT JOIN levels l ON s.levelId = l.id
              UNION ALL
              SELECT 'students → sections',
                COUNT(CASE WHEN s.sectionId IS NOT NULL AND sec.id IS NOT NULL THEN 1 END),
                COUNT(CASE WHEN s.sectionId IS NOT NULL AND sec.id IS NULL THEN 1 END)
              FROM students s LEFT JOIN sections sec ON s.sectionId = sec.id
              UNION ALL
              SELECT 'students → credentials',
                COUNT(CASE WHEN c.student_id IS NOT NULL THEN 1 END),
                COUNT(CASE WHEN s.nationalId IS NOT NULL AND c.student_id IS NULL THEN 1 END)
              FROM students s LEFT JOIN credentials c ON s.nationalId = c.student_id
              UNION ALL
              SELECT 'students → parents',
                COUNT(CASE WHEN p.student_id IS NOT NULL THEN 1 END),
                COUNT(CASE WHEN s.nationalId IS NOT NULL AND p.student_id IS NULL THEN 1 END)
              FROM students s LEFT JOIN parents p ON s.nationalId = p.student_id;`
    },
    {
      name: 'أفضل 10 تلاميذ في الامتحانات',
      query: `SELECT 
  s.firstName, s.lastName, s.nationalId,
  AVG(e.grade_value / e.max_grade * 100) as avg_percentage,
  COUNT(e.exam_id) as total_exams
FROM students s
JOIN exams e ON s.nationalId = e.student_id
GROUP BY s.nationalId, s.firstName, s.lastName
HAVING total_exams >= 3
ORDER BY avg_percentage DESC
LIMIT 10;`
    },
    {
      name: 'التلاميذ المعرضون للخطر',
      query: `SELECT 
  s.firstName, s.lastName, s.nationalId,
  CASE 
    WHEN d.student_id IS NOT NULL THEN 'منقطع'
    WHEN ds.student_id IS NOT NULL THEN 'مفصول'
    WHEN a.student_id IS NOT NULL THEN 'غائب'
    WHEN cd.decision_type = 'يفصل' THEN 'مهدد بالفصل'
    WHEN cd.decision_type = 'يكرر' THEN 'مكرر'
    ELSE 'غير محدد'
  END as risk_status,
  COALESCE(d.dropout_date, ds.dismissal_date, a.status_date, cd.decision_date) as status_date
FROM students s
LEFT JOIN dropouts d ON s.nationalId = d.student_id
LEFT JOIN dismissed_students ds ON s.nationalId = ds.student_id
LEFT JOIN absentees a ON s.nationalId = a.student_id
LEFT JOIN council_decisions cd ON s.nationalId = cd.student_id
WHERE d.student_id IS NOT NULL 
   OR ds.student_id IS NOT NULL 
   OR a.student_id IS NOT NULL 
   OR cd.decision_type IN ('يفصل', 'يكرر')
ORDER BY status_date DESC
LIMIT 20;`
    },
    {
      name: 'إحصائيات التوجيه المفصلة',
      query: `SELECT 
  assigned_stream,
  gender,
  decision,
  COUNT(*) as count,
  AVG(age) as avg_age
FROM guidance_statistics
WHERE assigned_stream IS NOT NULL AND assigned_stream != ''
GROUP BY assigned_stream, gender, decision
ORDER BY assigned_stream, gender;`
    },
    {
      name: 'آخر 10 تلاميذ مضافين',
      query: "SELECT firstName, lastName, nationalId, createdAt FROM students ORDER BY createdAt DESC LIMIT 10;"
    },
    {
      name: 'إحصائيات الحضور',
      query: "SELECT status, COUNT(*) as count FROM attendance_records GROUP BY status;"
    },
    {
      name: 'متوسط النقط',
      query: "SELECT AVG(grade) as average_grade, COUNT(*) as total_grades FROM grade_records;"
    },
    {
      name: 'قرارات مجالس الأقسام',
      query: `SELECT cd.decision, COUNT(*) as count 
              FROM council_decisions cd 
              GROUP BY cd.decision 
              ORDER BY count DESC;`
    },
    {
      name: 'إحصائيات الانقطاع',
      query: `SELECT COUNT(*) as total_dropouts, 
              COUNT(DISTINCT student_id) as unique_students 
              FROM dropouts;`
    },
    {
      name: 'التلاميذ مع المراجع المفقودة',
      query: `SELECT s.firstName, s.lastName, s.nationalId, s.level, s.section, s.academicYear,
              CASE WHEN s.levelId IS NULL THEN 'مستوى مفقود' ELSE 'موجود' END as level_status,
              CASE WHEN s.academicYear IS NULL OR s.academicYear = '' THEN 'سنة مفقودة' ELSE 'موجود' END as year_status,
              CASE WHEN s.sectionId IS NULL THEN 'قسم مفقود' ELSE 'موجود' END as class_status
              FROM students s 
              WHERE s.levelId IS NULL OR s.academicYear IS NULL OR s.academicYear = '' OR s.sectionId IS NULL
              LIMIT 20;`
    },
    {
      name: 'سجلات الحضور بدون مراجع',
      query: `SELECT ar.*, s.firstName, s.lastName 
              FROM attendance_records ar 
              LEFT JOIN students s ON ar.studentId = s.id 
              WHERE s.id IS NULL 
              LIMIT 10;`
    },
    {
      name: 'سجلات النقط بدون مراجع',
      query: `SELECT gr.*, s.firstName, s.lastName 
              FROM grade_records gr 
              LEFT JOIN students s ON gr.studentId = s.id 
              WHERE s.id IS NULL 
              LIMIT 10;`
    },
    {
      name: 'فحص تكامل قاعدة البيانات',
      query: `SELECT 
                'مستويات بدون أقسام' as integrity_check,
                COUNT(*) as count
              FROM levels l 
              LEFT JOIN sections s ON l.id = s.levelId 
              WHERE s.levelId IS NULL
              UNION ALL
              SELECT 'أقسام بدون تلاميذ',
                COUNT(*)
              FROM sections sec
              LEFT JOIN students s ON sec.id = s.sectionId
              WHERE s.sectionId IS NULL
              UNION ALL
              SELECT 'تلاميذ بدون أكواد سرية',
                COUNT(*)
              FROM students s
              LEFT JOIN credentials c ON s.nationalId = c.student_id
              WHERE c.student_id IS NULL
              UNION ALL
              SELECT 'امتحانات لتلاميذ غير موجودين',
                COUNT(*)
              FROM exams e
              LEFT JOIN students s ON e.student_id = s.nationalId
              WHERE s.nationalId IS NULL;`
    },
    {
      name: 'تقرير شامل للمؤسسة',
      query: `SELECT 
                i.academy, i.directorate, i.municipality, i.institution, i.academicYear,
                COUNT(s.id) as total_students,
                COUNT(CASE WHEN s.gender = 'ذكر' THEN 1 END) as male_students,
                COUNT(CASE WHEN s.gender = 'أنثى' THEN 1 END) as female_students,
                COUNT(DISTINCT s.levelId) as total_levels,
                COUNT(DISTINCT s.sectionId) as total_sections,
                COUNT(c.student_id) as students_with_credentials,
                COUNT(p.student_id) as students_with_parents
              FROM institution_settings i
              LEFT JOIN students s ON s.academicYear = i.academicYear
              LEFT JOIN credentials c ON s.nationalId = c.student_id
              LEFT JOIN parents p ON s.nationalId = p.student_id
              GROUP BY i.academy, i.directorate, i.municipality, i.institution, i.academicYear;`
    },
    {
      name: 'آخر النشاطات في النظام',
      query: `SELECT 
                'إضافة تلميذ' as activity_type,
                s.firstName || ' ' || s.lastName as details,
                s.createdAt as activity_date
              FROM students s
              ORDER BY s.createdAt DESC
              LIMIT 5
              UNION ALL
              SELECT 'قرار مجلس',
                cd.decision_type,
                cd.decision_date
              FROM council_decisions cd
              ORDER BY cd.decision_date DESC
              LIMIT 5
              UNION ALL
              SELECT 'نقل/تحويل',
                t.transfer_type || ' إلى ' || t.to_school,
                t.transfer_date
              FROM transfers t
              ORDER BY t.transfer_date DESC
              LIMIT 5;`
    },
    {
      name: 'إحصائيات متقدمة للأداء',
      query: `SELECT 
                'معدل النجاح في الامتحانات' as metric,
                ROUND(AVG(CASE WHEN e.grade_value >= (e.max_grade * 0.5) THEN 100.0 ELSE 0.0 END), 2) || '%' as value
              FROM exams e
              UNION ALL
              SELECT 'معدل الحضور العام',
                ROUND(AVG(CASE WHEN ar.status = 'حاضر' THEN 100.0 ELSE 0.0 END), 2) || '%'
              FROM attendance_records ar
              UNION ALL
              SELECT 'نسبة التلاميذ مع أولياء أمور',
                ROUND(COUNT(DISTINCT p.student_id) * 100.0 / COUNT(DISTINCT s.nationalId), 2) || '%'
              FROM students s LEFT JOIN parents p ON s.nationalId = p.student_id
              UNION ALL
              SELECT 'نسبة التلاميذ مع أكواد سرية',
                ROUND(COUNT(DISTINCT c.student_id) * 100.0 / COUNT(DISTINCT s.nationalId), 2) || '%'
              FROM students s LEFT JOIN credentials c ON s.nationalId = c.student_id;`
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            أداة استعلام SQL
          </h1>
          <p className="text-gray-600 text-lg">تشغيل استعلامات SQL مباشرة على قاعدة البيانات</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* الاستعلامات الجاهزة */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            استعلامات جاهزة
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {predefinedQueries.map((item, index) => (
              <button
                key={index}
                onClick={() => setQuery(item.query)}
                className="p-3 text-right bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors duration-200 border border-indigo-200"
              >
                <div className="text-sm font-medium text-indigo-900">{item.name}</div>
                <div className="text-xs text-indigo-600 mt-1 font-mono">{item.query.substring(0, 30)}...</div>
              </button>
            ))}
          </div>
        </div>

        {/* محرر الاستعلام */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Database className="w-5 h-5" />
              محرر الاستعلام
            </h2>
            <button
              onClick={executeQuery}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Play className="w-4 h-4" />
              )}
              تشغيل الاستعلام
            </button>
          </div>

          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="أدخل استعلام SQL هنا..."
            className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
            dir="ltr"
          />

          {/* الرسائل */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800">{success}</span>
            </div>
          )}
        </div>

        {/* النتائج */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                النتائج ({results.length} صف)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={copyResults}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                >
                  <Copy className="w-4 h-4" />
                  نسخ
                </button>
                <button
                  onClick={exportResults}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <Download className="w-4 h-4" />
                  تصدير CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((column, index) => (
                      <th key={index} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {columns.map((column, colIndex) => (
                        <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row[column] !== null && row[column] !== undefined ? String(row[column]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* معلومات إضافية */}
        <div className="mt-8 bg-indigo-50 p-6 rounded-xl border border-indigo-200">
          <h3 className="text-lg font-semibold text-indigo-900 mb-4">ملاحظات مهمة</h3>
          <div className="space-y-2 text-indigo-800">
            <p>• يمكنك تشغيل أي استعلام SQL صالح على قاعدة البيانات</p>
            <p>• استخدم الاستعلامات الجاهزة للبدء السريع</p>
            <p>• يمكن نسخ وتصدير النتائج بصيغة CSV</p>
            <p>• تجنب استعلامات التعديل (UPDATE/DELETE) إلا إذا كنت متأكداً</p>
            <p>• استخدم LIMIT لتحديد عدد النتائج في الاستعلامات الكبيرة</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SQLQueryTool;