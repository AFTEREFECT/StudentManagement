import React, { useState, useEffect } from 'react';
import { Users, BookOpen, Calculator, Save, RefreshCw, Download, Plus, Minus, Eye, ChevronDown, ChevronUp, Building, Calendar, BarChart3, TrendingUp } from 'lucide-react';
import { dbManager } from '../utils/database';

interface SectionData {
  sectionId: string;
  sectionName: string;
  levelName: string;
  currentMale: number;
  currentFemale: number;
  currentTotal: number;
  expectedNew: number;
  expectedTotal: number;
}

interface LevelSummary {
  levelName: string;
  sections: SectionData[];
  totalCurrent: number;
  totalExpectedNew: number;
  totalExpected: number;
  currentMale: number;
  currentFemale: number;
}

const SchoolEntryOverview: React.FC = () => {
  const [levelSummaries, setLevelSummaries] = useState<LevelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2025/2026');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('الكل');
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [institutionInfo, setInstitutionInfo] = useState({
    academy: 'الأكاديمية الجهوية للتربية والتكوين',
    directorate: 'المديرية الإقليمية',
    municipality: 'الجماعة',
    institution: 'المؤسسة التعليمية',
    academicYear: '2025/2026'
  });

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

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedAcademicYear) {
      loadEnrollmentData();
    }
  }, [selectedAcademicYear]);

  // تحميل البيانات الأولية
  const loadInitialData = async () => {
    try {
      const years = await dbManager.getAcademicYears();
      setAcademicYears(years);
      
      const currentYear = await dbManager.getCurrentAcademicYear();
      setSelectedAcademicYear(currentYear);

      // تحميل إعدادات المؤسسة
      try {
        const settings = await dbManager.getInstitutionSettings();
        if (settings) {
          setInstitutionInfo({
            academy: settings.academy || 'الأكاديمية الجهوية للتربية والتكوين',
            directorate: settings.directorate || 'المديرية الإقليمية',
            municipality: settings.municipality || 'الجماعة',
            institution: settings.institution || 'المؤسسة التعليمية',
            academicYear: settings.academicYear || currentYear
          });
        }
      } catch (error) {
        console.warn('خطأ في تحميل إعدادات المؤسسة:', error);
      }
    } catch (error) {
      console.error('خطأ في تحميل البيانات الأولية:', error);
    }
  };

  // تحميل بيانات التسجيل
  const loadEnrollmentData = async () => {
    setLoading(true);
    try {
      console.log('🔄 بدء تحميل بيانات التسجيل للسنة:', selectedAcademicYear);
      
      // جلب جميع التلاميذ المتمدرسين
      const allStudents = await dbManager.getStudents();
      const activeStudents = allStudents.filter(s => 
        s.status === 'متمدرس' && 
        (s.academicYear === selectedAcademicYear || !s.academicYear)
      );
      console.log('👥 التلاميذ المتمدرسين:', activeStudents.length);
      
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
      
      // تحويل إلى قائمة أقسام
      const allSectionsData: SectionData[] = [];
      
      uniqueCombinations.forEach((data, key) => {
        const maleCount = data.students.filter(s => s.gender === 'ذكر').length;
        const femaleCount = data.students.filter(s => s.gender === 'أنثى').length;
        const totalCount = data.students.length;
        
        console.log(`📊 ${data.levelName} - ${data.sectionName}: ${totalCount} تلميذ (${maleCount} ذكور، ${femaleCount} إناث)`);
        
        const sectionData: SectionData = {
          sectionId: key, // استخدام المفتاح المركب كمعرف
          sectionName: data.sectionName,
          levelName: data.levelName,
          currentMale: maleCount,
          currentFemale: femaleCount,
          currentTotal: totalCount,
          expectedNew: 0, // سيتم تحديثه من التخزين المحلي
          expectedTotal: totalCount
        };
        
        allSectionsData.push(sectionData);
      });
      
      // تجميع البيانات حسب المستوى
      const levelMap = new Map<string, LevelSummary>();
      
      allSectionsData.forEach(sectionData => {
        if (!levelMap.has(sectionData.levelName)) {
          levelMap.set(sectionData.levelName, {
            levelName: sectionData.levelName,
            sections: [],
            totalCurrent: 0,
            totalExpectedNew: 0,
            totalExpected: 0,
            currentMale: 0,
            currentFemale: 0
          });
        }
        
        const level = levelMap.get(sectionData.levelName)!;
        level.sections.push(sectionData);
        level.totalCurrent += sectionData.currentTotal;
        level.currentMale += sectionData.currentMale;
        level.currentFemale += sectionData.currentFemale;
      });

      // تحميل البيانات المحفوظة للأعداد المتوقعة
      const savedData = loadSavedExpectedNumbers();
      allSectionsData.forEach(section => {
        const savedValue = savedData[`${section.sectionId}_${selectedAcademicYear}`] || 0;
        section.expectedNew = savedValue;
        section.expectedTotal = section.currentTotal + savedValue;
      });
      
      // إعادة حساب إجماليات المستويات بعد تحديث الأعداد المتوقعة
      levelMap.forEach(level => {
        level.sections.forEach(section => {
          const savedValue = savedData[`${section.sectionId}_${selectedAcademicYear}`] || 0;
          section.expectedNew = savedValue;
          section.expectedTotal = section.currentTotal + savedValue;
        });
        level.totalExpectedNew = level.sections.reduce((sum, section) => sum + section.expectedNew, 0);
        level.totalExpected = level.sections.reduce((sum, section) => sum + section.expectedTotal, 0);
      });

      const sortedLevels = Array.from(levelMap.values())
        .filter(level => level.sections.length > 0)
        .sort((a, b) => getLevelOrder(a.levelName) - getLevelOrder(b.levelName))
        .map(level => ({
          ...level,
          sections: [...level.sections].sort((a, b) => getSectionNumber(a.sectionName) - getSectionNumber(b.sectionName))
        }));

      setLevelSummaries(sortedLevels);
      console.log('✅ تم تحميل البيانات بنجاح:', sortedLevels.length, 'مستوى مع', allSectionsData.length, 'قسم');
      console.log('📊 إجمالي التلاميذ المتمدرسين:', activeStudents.length);
    } catch (error) {
      console.error('خطأ في تحميل بيانات التسجيل:', error);
    } finally {
      setLoading(false);
    }
  };

  // تحميل الأعداد المحفوظة من التخزين المحلي
  const loadSavedExpectedNumbers = (): Record<string, number> => {
    try {
      const saved = localStorage.getItem('expectedEnrollmentNumbers');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.warn('خطأ في تحميل الأعداد المحفوظة:', error);
      return {};
    }
  };

  // حفظ الأعداد في التخزين المحلي
  const saveExpectedNumbers = () => {
    try {
      const dataToSave: Record<string, number> = {};
      levelSummaries.forEach(level => {
        level.sections.forEach(section => {
          dataToSave[`${section.sectionId}_${selectedAcademicYear}`] = section.expectedNew;
        });
      });
      localStorage.setItem('expectedEnrollmentNumbers', JSON.stringify(dataToSave));
      return true;
    } catch (error) {
      console.error('خطأ في حفظ الأعداد:', error);
      return false;
    }
  };

  // تحديث العدد المتوقع لقسم معين
  const updateExpectedNew = (sectionId: string, value: number) => {
    setLevelSummaries(prev => prev.map(level => ({
      ...level,
      sections: level.sections.map(section => {
        if (section.sectionId === sectionId) {
          const newExpectedNew = Math.max(0, value);
          return {
            ...section,
            expectedNew: newExpectedNew,
            expectedTotal: section.currentTotal + newExpectedNew
          };
        }
        return section;
      }),
      totalExpectedNew: level.sections.reduce((sum, section) => 
        sum + (section.sectionId === sectionId ? Math.max(0, value) : section.expectedNew), 0
      ),
      totalExpected: level.sections.reduce((sum, section) => 
        sum + (section.sectionId === sectionId ? 
          section.currentTotal + Math.max(0, value) : 
          section.expectedTotal), 0
      )
    })));
  };

  // حفظ جميع التغييرات
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const success = saveExpectedNumbers();
      if (success) {
        alert('تم حفظ جميع التوقعات بنجاح!');
      } else {
        alert('حدث خطأ في حفظ البيانات');
      }
    } catch (error) {
      console.error('خطأ في الحفظ:', error);
      alert('حدث خطأ في حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  // تصدير البيانات
  const exportData = () => {
    const exportData = {
      تاريخ_التقرير: new Date().toLocaleDateString('fr-MA'),
      السنة_الدراسية: selectedAcademicYear,
      معلومات_المؤسسة: institutionInfo,
      إحصائيات_التسجيل: levelSummaries.map(level => ({
        المستوى: level.levelName,
        الأقسام: level.sections.map(section => ({
          القسم: section.sectionName,
          الذكور_الحاليين: section.currentMale,
          الإناث_الحاليات: section.currentFemale,
          المجموع_الحالي: section.currentTotal,
          المتوقع_الجديد: section.expectedNew,
          المجموع_المتوقع: section.expectedTotal
        })),
        إجمالي_المستوى: {
          الحالي: level.totalCurrent,
          المتوقع_الجديد: level.totalExpectedNew,
          المجموع_المتوقع: level.totalExpected
        }
      }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تتبع_الدخول_المدرسي_${selectedAcademicYear}_${new Date().toLocaleDateString('fr-MA').replace(/\//g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // تبديل توسيع المستوى
  const toggleLevelExpansion = (levelName: string) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(levelName)) {
      newExpanded.delete(levelName);
    } else {
      newExpanded.add(levelName);
    }
    setExpandedLevels(newExpanded);
  };

  // الحصول على البيانات المفلترة
  const getFilteredData = () => {
    if (levelFilter === 'الكل') {
      return levelSummaries;
    }
    return levelSummaries.filter(level => level.levelName === levelFilter);
  };

  // حساب الإجماليات
  const calculateTotals = () => {
    const filteredData = getFilteredData();
    return {
      totalCurrentStudents: filteredData.reduce((sum, level) => sum + level.totalCurrent, 0),
      totalExpectedNew: filteredData.reduce((sum, level) => sum + level.totalExpectedNew, 0),
      totalExpected: filteredData.reduce((sum, level) => sum + level.totalExpected, 0),
      totalCurrentMale: filteredData.reduce((sum, level) => sum + level.currentMale, 0),
      totalCurrentFemale: filteredData.reduce((sum, level) => sum + level.currentFemale, 0),
      totalSections: filteredData.reduce((sum, level) => sum + level.sections.length, 0)
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">جاري تحميل بيانات تتبع الدخول المدرسي...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();
  const filteredData = getFilteredData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            تتبع الدخول المدرسي
          </h1>
          <p className="text-gray-600 text-lg">إحصائيات التلاميذ الحاليين مع توقعات استقبال الوافدين الجدد</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* أدوات التحكم */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">تتبع التسجيل</h2>
                <p className="text-sm text-gray-600">آخر تحديث: {new Date().toLocaleDateString('fr-MA')}</p>
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
              
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="الكل">جميع المستويات</option>
                {levelSummaries.map(level => (
                  <option key={level.levelName} value={level.levelName}>
                    {level.levelName}
                  </option>
                ))}
              </select>
              
              <button
                onClick={loadEnrollmentData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث
              </button>
              
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ التوقعات
              </button>
              
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
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
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg mb-4">
              <h2 className="text-xl font-bold mb-2">تتبع الدخول المدرسي</h2>
              <p className="text-blue-100">وضعية: {new Date().toLocaleDateString('fr-MA')} | السنة الدراسية: {selectedAcademicYear}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="text-right">
                <p><strong>الأكاديمية:</strong> {institutionInfo.academy}</p>
                <p><strong>المديرية:</strong> {institutionInfo.directorate}</p>
              </div>
              <div className="text-right">
                <p><strong>الجماعة:</strong> {institutionInfo.municipality}</p>
                <p><strong>المؤسسة:</strong> {institutionInfo.institution}</p>
              </div>
            </div>
          </div>
        </div>

        {/* الإحصائيات الإجمالية */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{totals.totalCurrentStudents}</div>
            <div className="text-sm font-medium text-blue-800">التلاميذ الحاليين</div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
            <div className="text-2xl font-bold text-green-600">{totals.totalExpectedNew}</div>
            <div className="text-sm font-medium text-green-800">المتوقع الجديد</div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{totals.totalExpected}</div>
            <div className="text-sm font-medium text-purple-800">المجموع المتوقع</div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg text-center border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">{totals.totalSections}</div>
            <div className="text-sm font-medium text-orange-800">عدد الأقسام</div>
          </div>
        </div>

        {/* جدول تتبع التسجيل */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* رأس الجدول */}
          <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-4 text-center">
            <h3 className="text-xl font-bold">تتبع الدخول المدرسي</h3>
            <p className="text-green-100">السنة الدراسية: {selectedAcademicYear} | المستوى: {levelFilter}</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-400 px-4 py-3 text-right font-bold text-gray-700">المستوى</th>
                  <th className="border border-gray-400 px-4 py-3 text-center font-bold text-gray-700">القسم</th>
                  <th className="border border-gray-400 px-4 py-3 text-center font-bold text-blue-700">ذكور</th>
                  <th className="border border-gray-400 px-4 py-3 text-center font-bold text-pink-700">إناث</th>
                  <th className="border border-gray-400 px-4 py-3 text-center font-bold text-gray-700 bg-blue-50">المجموع</th>
                  <th className="border border-gray-400 px-4 py-3 text-center font-bold text-green-700">العدد المضاف أثناء عملية التسجيل</th>
                  <th className="border border-gray-400 px-4 py-3 text-center font-bold text-purple-700 bg-green-50">العدد المتوقع بالقسم بعد استقبال الوافدين</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((level, levelIndex) => (
                  <React.Fragment key={levelIndex}>
                    {level.sections.map((section, sectionIndex) => (
                      <tr key={section.sectionId} className={sectionIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}>
                        {sectionIndex === 0 && (
                          <td 
                            className="border border-gray-400 px-4 py-3 font-bold text-gray-900 bg-blue-50"
                            rowSpan={level.sections.length}
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-blue-600" />
                              {level.levelName}
                            </div>
                          </td>
                        )}
                        <td className="border border-gray-400 px-4 py-3 text-center text-gray-700">
                          {section.sectionName}
                        </td>
                        <td className="border border-gray-400 px-4 py-3 text-center">
                          <div className="text-xl font-bold text-blue-600">{section.currentMale}</div>
                        </td>
                        <td className="border border-gray-400 px-4 py-3 text-center">
                          <div className="text-xl font-bold text-pink-600">{section.currentFemale}</div>
                        </td>
                        <td className="border border-gray-400 px-4 py-3 text-center bg-blue-50">
                          <div className="text-xl font-bold text-gray-900">{section.currentTotal}</div>
                        </td>
                        <td className="border border-gray-400 px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => updateExpectedNew(section.sectionId, section.expectedNew - 1)}
                              className="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition-colors duration-200"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={section.expectedNew}
                              onChange={(e) => updateExpectedNew(section.sectionId, parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent font-bold text-green-600"
                            />
                            <button
                              onClick={() => updateExpectedNew(section.sectionId, section.expectedNew + 1)}
                              className="w-8 h-8 bg-green-100 hover:bg-green-200 text-green-600 rounded-full flex items-center justify-center transition-colors duration-200"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="border border-gray-400 px-4 py-3 text-center bg-green-50">
                          <div className="text-xl font-bold text-purple-600">{section.expectedTotal}</div>
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
                  <td className="border-2 border-gray-500 px-4 py-4 text-center text-gray-700">
                    {levelFilter === 'الكل' ? 'جميع المستويات' : levelFilter}
                  </td>
                  <td className="border-2 border-gray-500 px-4 py-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{totals.totalCurrentMale}</div>
                  </td>
                  <td className="border-2 border-gray-500 px-4 py-4 text-center">
                    <div className="text-2xl font-bold text-pink-700">{totals.totalCurrentFemale}</div>
                  </td>
                  <td className="border-2 border-gray-500 px-4 py-4 text-center bg-blue-100">
                    <div className="text-2xl font-bold text-gray-900">{totals.totalCurrentStudents}</div>
                  </td>
                  <td className="border-2 border-gray-500 px-4 py-4 text-center bg-green-100">
                    <div className="text-2xl font-bold text-green-600">{totals.totalExpectedNew}</div>
                  </td>
                  <td className="border-2 border-gray-500 px-4 py-4 text-center bg-purple-100">
                    <div className="text-2xl font-bold text-purple-600">{totals.totalExpected}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ملخص البنية التربوية */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">ملخص البنية التربوية</h3>
          
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 p-6 rounded-lg text-center border border-blue-200">
              <div className="text-4xl font-bold text-blue-600">{totals.totalExpected}</div>
              <div className="text-lg font-medium text-blue-800">إجمالي التلاميذ</div>
              <div className="text-sm text-blue-600">بعد استقبال الوافدين</div>
            </div>
            
            <div className="bg-red-50 p-6 rounded-lg text-center border border-red-200">
              <div className="text-4xl font-bold text-red-600">{totals.totalCurrentFemale}</div>
              <div className="text-lg font-medium text-red-800">إجمالي الإناث</div>
              <div className="text-sm text-red-600">حالياً</div>
            </div>
            
            <div className="bg-green-50 p-6 rounded-lg text-center border border-green-200">
              <div className="text-4xl font-bold text-green-600">{totals.totalCurrentMale}</div>
              <div className="text-lg font-medium text-green-800">إجمالي الذكور</div>
              <div className="text-sm text-green-600">حالياً</div>
            </div>
          </div>

          {/* مبيان بسيط للتوزيع */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-center font-bold text-gray-800 mb-4">التوزيع المتوقع حسب المستويات</h4>
            <div className="flex justify-center items-end gap-2 h-32">
              {filteredData.slice(0, 6).map((level, index) => {
                const maxHeight = Math.max(...filteredData.map(l => l.totalExpected));
                const currentHeight = (level.totalCurrent / maxHeight) * 100;
                const expectedHeight = (level.totalExpected / maxHeight) * 100;
                
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="flex gap-1 items-end">
                      <div 
                        className="bg-blue-500 rounded-t"
                        style={{ height: `${currentHeight}px`, width: '20px' }}
                        title={`الحالي: ${level.totalCurrent}`}
                      ></div>
                      <div 
                        className="bg-green-500 rounded-t"
                        style={{ height: `${expectedHeight}px`, width: '20px' }}
                        title={`المتوقع: ${level.totalExpected}`}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600 mt-2 text-center max-w-16 truncate">
                      {level.levelName.split(' ')[0]}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* مفتاح الألوان */}
            <div className="flex justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>الحالي</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>المتوقع</span>
              </div>
            </div>
          </div>
        </div>

        {/* معلومات إضافية */}
        <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">كيفية استخدام النظام</h3>
          <div className="space-y-2 text-blue-800">
            <p>• <strong>البيانات الحالية:</strong> تُجلب تلقائياً من قاعدة البيانات للتلاميذ المتمدرسين</p>
            <p>• <strong>إدخال التوقعات:</strong> استخدم الأزرار + و - أو اكتب الرقم مباشرة في الحقل</p>
            <p>• <strong>الحساب التلقائي:</strong> المجموع المتوقع = التلاميذ الحاليين + العدد المضاف</p>
            <p>• <strong>الحفظ:</strong> اضغط "حفظ التوقعات" لحفظ جميع التغييرات</p>
            <p>• <strong>الفلترة:</strong> يمكن عرض مستوى محدد أو جميع المستويات</p>
            <p>• <strong>التصدير:</strong> تصدير البيانات كملف JSON للمراجعة أو الأرشفة</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolEntryOverview;