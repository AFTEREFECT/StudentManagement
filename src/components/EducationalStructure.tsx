import React, { useState, useEffect } from 'react';
import { BarChart3, Users, TrendingUp, Calendar, Building, RefreshCw, Download, AlertCircle, CheckCircle, Info, Eye, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { dbManager } from '../utils/database';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface EducationalStats {
  totalStudents: number;
  totalMale: number;
  totalFemale: number;
  levelStats: Array<{
    level: string;
    male: number;
    female: number;
    total: number;
    sections: Array<{
      name: string;
      male: number;
      female: number;
      total: number;
    }>;
  }>;
  mobilityStats: {
    incoming: { male: number; female: number; total: number };
    outgoing: { male: number; female: number; total: number };
    dropouts: { male: number; female: number; total: number };
    dismissed: { male: number; female: number; total: number };
    reintegrated: { male: number; female: number; total: number };
    unenrolled: { male: number; female: number; total: number };
  };
  institutionInfo: {
    academy: string;
    directorate: string;
    municipality: string;
    institution: string;
    academicYear: string;
  };
}

const EducationalStructure: React.FC = () => {
  const [stats, setStats] = useState<EducationalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2025/2026');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [showCharts, setShowCharts] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  // ألوان المبيانات
  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];

  // دالة للحصول على الرقم الترتيبي للمستوى
  const getLevelOrder = (levelName: string): number => {
    const levelMap: { [key: string]: number } = {
      'الأولى إعدادي': 1,
      'الأولى': 1,
      'الثانية إعدادي': 2,
      'الثانية': 2,
      'الثالثة إعدادي': 3,
      'الثالثة': 3
    };
    return levelMap[levelName] || 999;
  };

  // دالة لاستخراج رقم القسم من الرمز
  const getSectionNumber = (sectionName: string): number => {
    const match = sectionName.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // دالة لترتيب المستويات والأقسام
  const sortLevelStats = (levelStats: Array<{
    level: string;
    male: number;
    female: number;
    total: number;
    sections: Array<{
      name: string;
      male: number;
      female: number;
      total: number;
    }>;
  }>) => {
    return levelStats
      .sort((a, b) => getLevelOrder(a.level) - getLevelOrder(b.level))
      .map(level => ({
        ...level,
        sections: [...level.sections].sort((a, b) => getSectionNumber(a.name) - getSectionNumber(b.name))
      }));
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedAcademicYear) {
      loadStatistics();
    }
  }, [selectedAcademicYear]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // تحميل البيانات الأولية
  const loadInitialData = async () => {
    try {
      const years = await dbManager.getAcademicYears();
      setAcademicYears(years);
      
      const currentYear = await dbManager.getCurrentAcademicYear();
      setSelectedAcademicYear(currentYear);
    } catch (error) {
      console.error('خطأ في تحميل البيانات الأولية:', error);
      setError('خطأ في تحميل البيانات الأولية');
    }
  };

  // تحميل الإحصائيات
  const loadStatistics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 بدء تحميل إحصائيات البنية التربوية للسنة:', selectedAcademicYear);
      
      // جلب جميع التلاميذ وفلترة حسب السنة
      const allStudents = await dbManager.getStudents();
      const students = allStudents.filter(s => 
        s.academicYear === selectedAcademicYear || 
        (!s.academicYear && selectedAcademicYear === '2025/2026')
      );
      console.log('👥 عدد التلاميذ المجلبين:', students.length);
      
      // تصفية التلاميذ النشطين (المتمدرسين)
      const activeStudents = students.filter(s => s.status === 'متمدرس');
      console.log('✅ التلاميذ النشطين:', activeStudents.length);
      
      // استخدام حقلي SECTION و LEVEL النصيين مباشرة من جدول التلاميذ
      // جمع جميع المستويات والأقسام الفريدة من التلاميذ المتمدرسين
      const uniqueCombinations = new Map<string, {
        levelName: string;
        sectionName: string;
        students: typeof activeStudents;
      }>();
      
      activeStudents.forEach(student => {
        if (student.level && student.section) {
          const key = `${student.level}_${student.section}`;
          if (!uniqueCombinations.has(key)) {
            uniqueCombinations.set(key, {
              levelName: student.level,
              sectionName: student.section,
              students: []
            });
          }
          uniqueCombinations.get(key)!.students.push(student);
        }
      });
      
      console.log('📊 المجموعات المكتشفة:', uniqueCombinations.size);
      
      // تجميع الإحصائيات حسب المستوى من البيانات الفعلية
      const levelStatsMap = new Map<string, {
        level: string;
        male: number;
        female: number;
        total: number;
        sections: Array<{
          name: string;
          male: number;
          female: number;
          total: number;
        }>;
      }>();

      // تجميع البيانات حسب المستوى من المجموعات المكتشفة
      uniqueCombinations.forEach((data, key) => {
        const levelName = data.levelName;
        
        // إنشاء المستوى إذا لم يكن موجوداً
        if (!levelStatsMap.has(levelName)) {
          levelStatsMap.set(levelName, {
            level: levelName,
            male: 0,
            female: 0,
            total: 0,
            sections: []
          });
        }
        
        const levelStats = levelStatsMap.get(levelName)!;
        
        // حساب إحصائيات القسم
        const maleCount = data.students.filter(s => s.gender === 'ذكر').length;
        const femaleCount = data.students.filter(s => s.gender === 'أنثى').length;
        const totalCount = data.students.length;
        
        console.log(`📊 ${levelName} - ${data.sectionName}: ${totalCount} تلميذ (${maleCount} ذكور، ${femaleCount} إناث)`);
        
        // إضافة القسم إلى المستوى
        levelStats.sections.push({
          name: data.sectionName,
          male: maleCount,
          female: femaleCount,
          total: totalCount
        });
        
        // تحديث إجماليات المستوى
        levelStats.male += maleCount;
        levelStats.female += femaleCount;
        levelStats.total += totalCount;
      });

      // إحصائيات الحركية مع معالجة آمنة للأخطاء
      let mobilityStats = {
        incoming: { male: 0, female: 0, total: 0 },
        outgoing: { male: 0, female: 0, total: 0 },
        dropouts: { male: 0, female: 0, total: 0 },
        dismissed: { male: 0, female: 0, total: 0 },
        reintegrated: { male: 0, female: 0, total: 0 },
        unenrolled: { male: 0, female: 0, total: 0 }
      };

      try {
        // جلب بيانات النقل والتحويلات
        const transfers = await dbManager.getTransfers();
        const currentYearTransfers = transfers.filter(t => {
          try {
            const metadata = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
            return metadata && metadata.academicYear === selectedAcademicYear;
          } catch (e) {
            console.warn('خطأ في تحليل metadata للنقل:', t.transfer_id);
            return false;
          }
        });

        currentYearTransfers.forEach(transfer => {
          try {
            const metadata = typeof transfer.metadata === 'string' ? JSON.parse(transfer.metadata) : transfer.metadata;
            const gender = metadata?.gender || 'ذكر';
            
            if (transfer.transfer_type === 'وافد') {
              mobilityStats.incoming.total++;
              if (gender === 'ذكر') mobilityStats.incoming.male++;
              else mobilityStats.incoming.female++;
            } else if (transfer.transfer_type === 'مغادر') {
              mobilityStats.outgoing.total++;
              if (gender === 'ذكر') mobilityStats.outgoing.male++;
              else mobilityStats.outgoing.female++;
            }
          } catch (e) {
            console.warn('خطأ في معالجة بيانات النقل:', transfer.transfer_id);
          }
        });
      } catch (error) {
        console.warn('خطأ في جلب بيانات النقل:', error);
      }

      try {
        // جلب بيانات المنقطعين
        const dropouts = await dbManager.getDropouts();
        const currentYearDropouts = dropouts.filter(d => {
          try {
            const metadata = typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata;
            return metadata && metadata.academicYear === selectedAcademicYear;
          } catch (e) {
            console.warn('خطأ في تحليل metadata للمنقطعين:', d.dropout_id);
            return false;
          }
        });

        currentYearDropouts.forEach(dropout => {
          try {
            const metadata = typeof dropout.metadata === 'string' ? JSON.parse(dropout.metadata) : dropout.metadata;
            const gender = metadata?.gender || 'ذكر';
            
            mobilityStats.dropouts.total++;
            if (gender === 'ذكر') mobilityStats.dropouts.male++;
            else mobilityStats.dropouts.female++;
          } catch (e) {
            console.warn('خطأ في معالجة بيانات المنقطعين:', dropout.dropout_id);
          }
        });
      } catch (error) {
        console.warn('خطأ في جلب بيانات المنقطعين:', error);
      }

      try {
        // جلب بيانات المفصولين
        const dismissed = await dbManager.getDismissedStudents();
        const currentYearDismissed = dismissed.filter(d => {
          try {
            const metadata = typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata;
            return metadata && metadata.academicYear === selectedAcademicYear;
          } catch (e) {
            console.warn('خطأ في تحليل metadata للمفصولين:', d.dismissal_id);
            return false;
          }
        });

        currentYearDismissed.forEach(dismissedStudent => {
          try {
            const metadata = typeof dismissedStudent.metadata === 'string' ? JSON.parse(dismissedStudent.metadata) : dismissedStudent.metadata;
            const gender = metadata?.gender || 'ذكر';
            
            mobilityStats.dismissed.total++;
            if (gender === 'ذكر') mobilityStats.dismissed.male++;
            else mobilityStats.dismissed.female++;
          } catch (e) {
            console.warn('خطأ في معالجة بيانات المفصولين:', dismissedStudent.dismissal_id);
          }
        });
      } catch (error) {
        console.warn('خطأ في جلب بيانات المفصولين:', error);
      }

      try {
        // جلب بيانات المدمجين
        const reintegrations = await dbManager.getReintegrations();
        const currentYearReintegrations = reintegrations.filter(r => {
          try {
            const metadata = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
            return metadata && metadata.academicYear === selectedAcademicYear;
          } catch (e) {
            console.warn('خطأ في تحليل metadata للمدمجين:', r.reintegration_id);
            return false;
          }
        });

        currentYearReintegrations.forEach(reintegration => {
          try {
            const metadata = typeof reintegration.metadata === 'string' ? JSON.parse(reintegration.metadata) : reintegration.metadata;
            const gender = metadata?.gender || 'ذكر';
            
            mobilityStats.reintegrated.total++;
            if (gender === 'ذكر') mobilityStats.reintegrated.male++;
            else mobilityStats.reintegrated.female++;
          } catch (e) {
            console.warn('خطأ في معالجة بيانات المدمجين:', reintegration.reintegration_id);
          }
        });
      } catch (error) {
        console.warn('خطأ في جلب بيانات المدمجين:', error);
      }

      try {
        // جلب بيانات غير الملتحقين
        const unenrolled = await dbManager.getUnenrolledStudents();
        const currentYearUnenrolled = unenrolled.filter(u => {
          try {
            const metadata = typeof u.metadata === 'string' ? JSON.parse(u.metadata) : u.metadata;
            return metadata && metadata.academicYear === selectedAcademicYear;
          } catch (e) {
            console.warn('خطأ في تحليل metadata لغير الملتحقين:', u.unenrolled_id);
            return false;
          }
        });

        currentYearUnenrolled.forEach(unenrolledStudent => {
          try {
            const metadata = typeof unenrolledStudent.metadata === 'string' ? JSON.parse(unenrolledStudent.metadata) : unenrolledStudent.metadata;
            const gender = metadata?.gender || 'ذكر';
            
            mobilityStats.unenrolled.total++;
            if (gender === 'ذكر') mobilityStats.unenrolled.male++;
            else mobilityStats.unenrolled.female++;
          } catch (e) {
            console.warn('خطأ في معالجة بيانات غير الملتحقين:', unenrolledStudent.unenrolled_id);
          }
        });
      } catch (error) {
        console.warn('خطأ في جلب بيانات غير الملتحقين:', error);
      }

      // جلب إعدادات المؤسسة مع معالجة آمنة للأخطاء
      let institutionInfo = {
        academy: 'الأكاديمية الجهوية للتربية والتكوين',
        directorate: 'المديرية الإقليمية',
        municipality: 'الجماعة',
        institution: 'المؤسسة التعليمية',
        academicYear: selectedAcademicYear
      };

      try {
        console.log('🔄 جلب إعدادات المؤسسة من قاعدة البيانات...');
        const institutionSettings = await dbManager.getInstitutionSettings();
        console.log('📋 إعدادات المؤسسة المستلمة:', institutionSettings);

        if (institutionSettings) {
          institutionInfo = {
            academy: institutionSettings.academy || institutionInfo.academy,
            directorate: institutionSettings.directorate || institutionInfo.directorate,
            municipality: institutionSettings.municipality || institutionInfo.municipality,
            institution: institutionSettings.institution || institutionInfo.institution,
            academicYear: institutionSettings.academicYear || selectedAcademicYear
          };
          console.log('✅ معلومات المؤسسة بعد التحديث:', institutionInfo);
        } else {
          console.warn('⚠️ لا توجد إعدادات مؤسسة في قاعدة البيانات');
        }
      } catch (error) {
        console.error('❌ خطأ في جلب إعدادات المؤسسة:', error);
      }

      const educationalStats: EducationalStats = {
        totalStudents: activeStudents.length,
        totalMale: activeStudents.filter(s => s.gender === 'ذكر').length,
        totalFemale: activeStudents.filter(s => s.gender === 'أنثى').length,
        levelStats: sortLevelStats(Array.from(levelStatsMap.values()).filter(l => l.total > 0)),
        mobilityStats,
        institutionInfo
      };

      setStats(educationalStats);
      console.log('✅ تم تحميل الإحصائيات بنجاح:', educationalStats);
      
    } catch (error) {
      console.error('❌ خطأ في تحميل الإحصائيات:', error);
      
      // معالجة آمنة للخطأ
      let errorMessage = 'خطأ غير معروف في تحميل الإحصائيات';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // تصدير التقرير
  const exportReport = () => {
    if (!stats) return;

    const reportData = {
      تاريخ_التقرير: new Date().toISOString(),
      السنة_الدراسية: selectedAcademicYear,
      معلومات_المؤسسة: stats.institutionInfo,
      الإحصائيات_العامة: {
        إجمالي_التلاميذ: stats.totalStudents,
        الذكور: stats.totalMale,
        الإناث: stats.totalFemale
      },
      إحصائيات_المستويات: stats.levelStats,
      إحصائيات_الحركية: stats.mobilityStats
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_البنية_التربوية_${selectedAcademicYear}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">جاري تحميل البنية التربوية...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-red-900 mb-2">خطأ في تحميل البيانات</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadStatistics}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">لا توجد بيانات للبنية التربوية</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            البنية التربوية للمؤسسة
          </h1>
          <p className="text-gray-600 text-lg">إحصائيات شاملة للمستويات والأقسام وحركية التلاميذ</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* أدوات التحكم */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">البنية التربوية</h2>
                <p className="text-sm text-gray-600">آخر تحديث: {new Date().toLocaleString('fr-EG')}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {academicYears.map(year => (
                  <option key={year.id} value={year.year}>
                    {year.year} {year.isActive ? '(نشطة)' : ''}
                  </option>
                ))}
                <option value="2024/2025">2024/2025</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2023/2024">2023/2024</option>
              </select>
              
              <button
                onClick={() => setShowCharts(!showCharts)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
              >
                <BarChart3 className="w-4 h-4" />
                {showCharts ? 'إخفاء المبيانات' : 'إظهار المبيانات'}
              </button>
              
              <button
                onClick={loadStatistics}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث
              </button>
              
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                تصدير
              </button>
            </div>
          </div>
        </div>

        {/* معلومات المؤسسة */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="text-center">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-6">
              <h2 className="text-2xl font-bold mb-2">البنية التربوية</h2>
              <p className="text-lg">السنة الدراسية: {stats.institutionInfo.academicYear}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="text-right">
                <p><strong>الأكاديمية:</strong> {stats.institutionInfo.academy}</p>
                <p><strong>المديرية:</strong> {stats.institutionInfo.directorate}</p>
              </div>
              <div className="text-right">
                <p><strong>الجماعة:</strong> {stats.institutionInfo.municipality}</p>
                <p><strong>المؤسسة:</strong> {stats.institutionInfo.institution}</p>
              </div>
            </div>
          </div>
        </div>

        {/* الإحصائيات الإجمالية */}
        <div className="mb-8">
          <div 
            className="flex items-center justify-between cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4"
            onClick={() => toggleSection('overview')}
          >
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              الإحصائيات الإجمالية
            </h2>
            {expandedSections.has('overview') ? 
              <ChevronUp className="w-5 h-5 text-gray-500" /> : 
              <ChevronDown className="w-5 h-5 text-gray-500" />
            }
          </div>
          
          {expandedSections.has('overview') && (
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-green-50 p-6 rounded-lg text-center border-2 border-green-200">
                <div className="text-4xl font-bold text-green-600">{stats.totalStudents}</div>
                <div className="text-lg font-medium text-green-800">المجموع</div>
              </div>
              <div className="bg-red-50 p-6 rounded-lg text-center border-2 border-red-200">
                <div className="text-4xl font-bold text-red-600">{stats.totalFemale}</div>
                <div className="text-lg font-medium text-red-800">الإناث</div>
              </div>
              <div className="bg-blue-50 p-6 rounded-lg text-center border-2 border-blue-200">
                <div className="text-4xl font-bold text-blue-600">{stats.totalMale}</div>
                <div className="text-lg font-medium text-blue-800">الذكور</div>
              </div>
            </div>
          )}
        </div>

        {/* إحصائيات الحركية */}
        <div className="mb-8">
          <div 
            className="flex items-center justify-between cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4"
            onClick={() => toggleSection('mobility')}
          >
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              إحصائيات الحركية
            </h2>
            {expandedSections.has('mobility') ? 
              <ChevronUp className="w-5 h-5 text-gray-500" /> : 
              <ChevronDown className="w-5 h-5 text-gray-500" />
            }
          </div>
          
          {expandedSections.has('mobility') && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
                <div className="text-2xl font-bold text-green-600">{stats.mobilityStats.incoming.total}</div>
                <div className="text-sm font-medium text-green-800">الوافدون</div>
                <div className="text-xs text-green-600 mt-1">
                  ذ: {stats.mobilityStats.incoming.male} | أ: {stats.mobilityStats.incoming.female}
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{stats.mobilityStats.outgoing.total}</div>
                <div className="text-sm font-medium text-blue-800">المغادرون</div>
                <div className="text-xs text-blue-600 mt-1">
                  ذ: {stats.mobilityStats.outgoing.male} | أ: {stats.mobilityStats.outgoing.female}
                </div>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg text-center border border-orange-200">
                <div className="text-2xl font-bold text-orange-600">{stats.mobilityStats.dropouts.total}</div>
                <div className="text-sm font-medium text-orange-800">المنقطعون</div>
                <div className="text-xs text-orange-600 mt-1">
                  ذ: {stats.mobilityStats.dropouts.male} | أ: {stats.mobilityStats.dropouts.female}
                </div>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg text-center border border-red-200">
                <div className="text-2xl font-bold text-red-600">{stats.mobilityStats.dismissed.total}</div>
                <div className="text-sm font-medium text-red-800">المفصولون</div>
                <div className="text-xs text-red-600 mt-1">
                  ذ: {stats.mobilityStats.dismissed.male} | أ: {stats.mobilityStats.dismissed.female}
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">{stats.mobilityStats.reintegrated.total}</div>
                <div className="text-sm font-medium text-purple-800">المدمجون</div>
                <div className="text-xs text-purple-600 mt-1">
                  ذ: {stats.mobilityStats.reintegrated.male} | أ: {stats.mobilityStats.reintegrated.female}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-200">
                <div className="text-2xl font-bold text-gray-600">{stats.mobilityStats.unenrolled.total}</div>
                <div className="text-sm font-medium text-gray-800">غير ملتحقين</div>
                <div className="text-xs text-gray-600 mt-1">
                  ذ: {stats.mobilityStats.unenrolled.male} | أ: {stats.mobilityStats.unenrolled.female}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* جدول المستويات والأقسام */}
        <div className="mb-8">
          <div 
            className="flex items-center justify-between cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4"
            onClick={() => toggleSection('levels')}
          >
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-green-600" />
              إحصائيات المستويات الدراسية
            </h2>
            {expandedSections.has('levels') ? 
              <ChevronUp className="w-5 h-5 text-gray-500" /> : 
              <ChevronDown className="w-5 h-5 text-gray-500" />
            }
          </div>
          
          {expandedSections.has('levels') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* رأس الجدول مع خلفية متدرجة */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 text-center">
                <h3 className="text-xl font-bold">إحصائيات المستويات الدراسية</h3>
                <p className="text-blue-100">السنة الدراسية: {selectedAcademicYear} | المستوى: الكل</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-400 px-4 py-3 text-right font-bold">المستوى</th>
                      <th className="border border-gray-400 px-4 py-3 text-center font-bold text-blue-700">ذكور</th>
                      <th className="border border-gray-400 px-4 py-3 text-center font-bold text-pink-700">إناث</th>
                      <th className="border border-gray-400 px-4 py-3 text-center font-bold text-gray-700 bg-blue-50">المجموع</th>
                      <th className="border border-gray-400 px-4 py-3 text-center font-bold text-purple-700">النسبة %</th>
                      <th className="border border-gray-400 px-4 py-3 text-center font-bold text-green-700 bg-green-50">عدد الأقسام</th>
                      <th className="border border-gray-400 px-4 py-3 text-center font-bold text-orange-700">معدل التلاميذ/القسم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.levelStats.map((level, index) => (
                      <React.Fragment key={index}>
                        {/* صف المستوى */}
                        <tr className="bg-blue-50">
                          <td className="border border-gray-400 px-4 py-3 font-bold text-gray-900">
                            {level.level}
                          </td>
                          <td className="border border-gray-400 px-6 py-4 text-center">
                            <div className="text-2xl font-bold text-blue-600">{level.male}</div>
                          </td>
                          <td className="border border-gray-400 px-6 py-4 text-center">
                            <div className="text-2xl font-bold text-pink-600">{level.female}</div>
                          </td>
                          <td className="border border-gray-400 px-6 py-4 text-center bg-blue-50">
                            <div className="text-2xl font-bold text-gray-900">{level.total}</div>
                          </td>
                          <td className="border border-gray-400 px-6 py-4 text-center">
                            <div className="text-lg font-bold text-purple-600">
                              {stats.totalStudents > 0 ? Math.round((level.total / stats.totalStudents) * 100) : 0}%
                            </div>
                          </td>
                          <td className="border border-gray-400 px-6 py-4 text-center bg-green-50">
                            <div className="text-lg font-bold text-green-600">{level.sections.length}</div>
                          </td>
                          <td className="border border-gray-400 px-6 py-4 text-center">
                            <div className="text-lg font-bold text-orange-600">
                              {level.sections.length > 0 ? Math.round(level.total / level.sections.length) : 0}
                            </div>
                          </td>
                        </tr>
                        
                        {/* صفوف الأقسام */}
                        {level.sections.map((section, sectionIndex) => (
                          <tr key={sectionIndex} className="hover:bg-gray-25">
                            <td className="border border-gray-400 px-8 py-2 text-gray-700">
                              └ {section.name}
                            </td>
                            <td className="border border-gray-400 px-4 py-2 text-center text-blue-600">
                              {section.male}
                            </td>
                            <td className="border border-gray-400 px-4 py-2 text-center text-red-600">
                              {section.female}
                            </td>
                            <td className="border border-gray-400 px-4 py-2 text-center text-gray-700">
                              {section.total}
                            </td>
                            <td className="border border-gray-400 px-4 py-2 text-center text-purple-600">
                              {level.total > 0 ? Math.round((section.total / level.total) * 100) : 0}%
                            </td>
                            <td className="border border-gray-400 px-4 py-2 text-center text-gray-700">
                              -
                            </td>
                            <td className="border border-gray-400 px-4 py-2 text-center text-gray-700">
                              -
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    
                    {/* صف المجموع */}
                    <tr className="bg-gradient-to-r from-orange-100 to-green-100 font-bold">
                      <td className="border-2 border-gray-500 px-4 py-4 text-gray-900">
                        المجموع الكلي
                      </td>
                      <td className="border-2 border-gray-500 px-4 py-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">
                          {stats.totalMale}
                        </div>
                      </td>
                      <td className="border-2 border-gray-500 px-4 py-4 text-center">
                        <div className="text-2xl font-bold text-pink-700">
                          {stats.totalFemale}
                        </div>
                      </td>
                      <td className="border-2 border-gray-500 px-4 py-4 text-center bg-blue-100">
                        <div className="text-2xl font-bold text-gray-900">
                          {stats.totalStudents}
                        </div>
                      </td>
                      <td className="border-2 border-gray-500 px-4 py-4 text-center">
                        <div className="text-lg font-bold text-purple-700">
                          100%
                        </div>
                      </td>
                      <td className="border-2 border-gray-500 px-4 py-4 text-center bg-green-100">
                        <div className="text-lg font-bold text-green-600">
                          {stats.levelStats.reduce((sum, level) => sum + level.sections.length, 0)}
                        </div>
                      </td>
                      <td className="border-2 border-gray-500 px-4 py-4 text-center">
                        <div className="text-lg font-bold text-orange-600">
                          {stats.levelStats.reduce((sum, level) => sum + level.sections.length, 0) > 0 ? 
                            Math.round(stats.totalStudents / stats.levelStats.reduce((sum, level) => sum + level.sections.length, 0)) : 
                            0
                          }
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* إحصائيات الأقسام الدراسية */}
        <div className="mb-8">
          <div 
            className="flex items-center justify-between cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4"
            onClick={() => toggleSection('sections')}
          >
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-green-600" />
              إحصائيات الأقسام الدراسية
            </h2>
            {expandedSections.has('sections') ? 
              <ChevronUp className="w-5 h-5 text-gray-500" /> : 
              <ChevronDown className="w-5 h-5 text-gray-500" />
            }
          </div>
          
          {expandedSections.has('sections') && (
            <SectionsStatisticsTable 
              stats={stats} 
              selectedAcademicYear={selectedAcademicYear}
            />
          )}
        </div>

        {/* المبيانات */}
        {showCharts && (
          <div className="space-y-8">
            {/* مبيان الأعمدة للمستويات */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">توزيع التلاميذ حسب المستويات</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={stats.levelStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="level" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'male' ? 'ذكور' : name === 'female' ? 'إناث' : 'المجموع']}
                    labelFormatter={(label) => `المستوى: ${label}`}
                  />
                  <Legend 
                    formatter={(value) => value === 'male' ? 'الذكور' : value === 'female' ? 'الإناث' : 'المجموع'}
                  />
                  <Bar dataKey="male" fill="#3B82F6" name="male" />
                  <Bar dataKey="female" fill="#EF4444" name="female" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* مبيان دائري للتوزيع العام */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">التوزيع العام حسب الجنس</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'الذكور', value: stats.totalMale, fill: '#3B82F6' },
                      { name: 'الإناث', value: stats.totalFemale, fill: '#EF4444' }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'الذكور', value: stats.totalMale, fill: '#3B82F6' },
                      { name: 'الإناث', value: stats.totalFemale, fill: '#EF4444' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* مبيان الحركية */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">إحصائيات حركية التلاميذ</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { name: 'الوافدون', male: stats.mobilityStats.incoming.male, female: stats.mobilityStats.incoming.female },
                  { name: 'المغادرون', male: stats.mobilityStats.outgoing.male, female: stats.mobilityStats.outgoing.female },
                  { name: 'المنقطعون', male: stats.mobilityStats.dropouts.male, female: stats.mobilityStats.dropouts.female },
                  { name: 'المفصولون', male: stats.mobilityStats.dismissed.male, female: stats.mobilityStats.dismissed.female },
                  { name: 'المدمجون', male: stats.mobilityStats.reintegrated.male, female: stats.mobilityStats.reintegrated.female },
                  { name: 'غير ملتحقين', male: stats.mobilityStats.unenrolled.male, female: stats.mobilityStats.unenrolled.female }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'male' ? 'ذكور' : 'إناث']}
                  />
                  <Legend 
                    formatter={(value) => value === 'male' ? 'الذكور' : 'الإناث'}
                  />
                  <Bar dataKey="male" fill="#3B82F6" name="male" />
                  <Bar dataKey="female" fill="#EF4444" name="female" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* معلومات إضافية */}
        <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">ملاحظات مهمة</h3>
          <div className="space-y-2 text-blue-800">
            <p>• <strong>التلاميذ المتمدرسين:</strong> يشمل الوافدين والمدمجين في الإحصائيات الرئيسية</p>
            <p>• <strong>الحركية منفصلة:</strong> المغادرون والمنقطعون والمفصولون وغير الملتحقين منفصلون عن المتمدرسين</p>
            <p>• <strong>تحديث تلقائي:</strong> عند تغيير السنة الدراسية، تتحدث جميع الإحصائيات فوراً</p>
            <p>• <strong>ربط البيانات:</strong> يتم ربط كل تلميذ بمستواه وقسمه تلقائياً</p>
            <p>• <strong>معالجة الأخطاء:</strong> النظام يتعامل مع البيانات المفقودة أو التالفة بأمان</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EducationalStructure;

// مكون جدول إحصائيات الأقسام
const SectionsStatisticsTable: React.FC<{
  stats: EducationalStats;
  selectedAcademicYear: string;
}> = ({ stats, selectedAcademicYear }) => {
  const [levelFilter, setLevelFilter] = useState<string>('الكل');

  // دوال المساعدة للترتيب
  const getLevelOrder = (levelName: string): number => {
    const levelMap: { [key: string]: number } = {
      'الأولى إعدادي': 1,
      'الأولى': 1,
      'الثانية إعدادي': 2,
      'الثانية': 2,
      'الثالثة إعدادي': 3,
      'الثالثة': 3
    };
    return levelMap[levelName] || 999;
  };

  const getSectionNumber = (sectionName: string): number => {
    const match = sectionName.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // جمع جميع الأقسام من جميع المستويات
  const allSections = stats.levelStats.flatMap(level =>
    level.sections.map(section => ({
      ...section,
      levelName: level.level,
      percentage: stats.totalStudents > 0 ? Math.round((section.total / stats.totalStudents) * 100) : 0
    }))
  );

  // تصفية الأقسام حسب المستوى المحدد
  const filteredSections = levelFilter === 'الكل'
    ? allSections
    : allSections.filter(section => section.levelName === levelFilter);

  // ترتيب الأقسام: أولاً حسب المستوى ثم حسب رقم القسم
  const sortedSections = filteredSections.sort((a, b) => {
    const levelDiff = getLevelOrder(a.levelName) - getLevelOrder(b.levelName);
    if (levelDiff !== 0) return levelDiff;
    return getSectionNumber(a.name) - getSectionNumber(b.name);
  });
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* رأس الجدول مع خلفية متدرجة */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <h3 className="text-xl font-bold">إحصائيات الأقسام الدراسية</h3>
            <p className="text-green-100">السنة الدراسية: {selectedAcademicYear} | المستوى: {levelFilter}</p>
          </div>
        </div>
        
        {/* فلتر المستوى */}
        <div className="mt-4 flex justify-center">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-4 py-2 bg-white text-gray-900 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="الكل">جميع المستويات</option>
            {stats.levelStats.map(level => (
              <option key={level.level} value={level.level}>
                {level.level}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-400 px-4 py-3 text-right font-bold text-gray-700">القسم</th>
              <th className="border border-gray-400 px-4 py-3 text-center font-bold text-gray-700">المستوى</th>
              <th className="border border-gray-400 px-4 py-3 text-center font-bold text-blue-700">ذكور</th>
              <th className="border border-gray-400 px-4 py-3 text-center font-bold text-pink-700">إناث</th>
              <th className="border border-gray-400 px-4 py-3 text-center font-bold text-gray-700 bg-blue-50">المجموع</th>
              <th className="border border-gray-400 px-4 py-3 text-center font-bold text-green-700">النسبة</th>
            </tr>
          </thead>
          <tbody>
            {sortedSections.map((section, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}>
                <td className="border border-gray-400 px-4 py-3 font-bold text-gray-900">
                  {section.name}
                </td>
                <td className="border border-gray-400 px-4 py-3 text-center text-gray-700">
                  {section.levelName}
                </td>
                <td className="border border-gray-400 px-4 py-3 text-center">
                  <div className="text-xl font-bold text-blue-600">{section.male}</div>
                </td>
                <td className="border border-gray-400 px-4 py-3 text-center">
                  <div className="text-xl font-bold text-pink-600">{section.female}</div>
                </td>
                <td className="border border-gray-400 px-4 py-3 text-center bg-blue-50">
                  <div className="text-xl font-bold text-gray-900">{section.total}</div>
                </td>
                <td className="border border-gray-400 px-4 py-3 text-center">
                  <div className="text-lg font-bold text-green-600">{section.percentage}%</div>
                </td>
              </tr>
            ))}
            
            {/* صف المجموع للأقسام المفلترة */}
            <tr className="bg-gradient-to-r from-green-100 to-blue-100 font-bold">
              <td className="border-2 border-gray-500 px-4 py-4 text-gray-900">
                المجموع الكلي
              </td>
              <td className="border-2 border-gray-500 px-4 py-4 text-center text-gray-700">
                {levelFilter === 'الكل' ? 'جميع المستويات' : levelFilter}
              </td>
              <td className="border-2 border-gray-500 px-4 py-4 text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {filteredSections.reduce((sum, section) => sum + section.male, 0)}
                </div>
              </td>
              <td className="border-2 border-gray-500 px-4 py-4 text-center">
                <div className="text-2xl font-bold text-pink-700">
                  {filteredSections.reduce((sum, section) => sum + section.female, 0)}
                </div>
              </td>
              <td className="border-2 border-gray-500 px-4 py-4 text-center bg-blue-100">
                <div className="text-2xl font-bold text-gray-900">
                  {filteredSections.reduce((sum, section) => sum + section.total, 0)}
                </div>
              </td>
              <td className="border-2 border-gray-500 px-4 py-4 text-center">
                <div className="text-lg font-bold text-green-700">
                  {levelFilter === 'الكل' ? '100%' : 
                    `${Math.round((filteredSections.reduce((sum, section) => sum + section.total, 0) / stats.totalStudents) * 100)}%`
                  }
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};