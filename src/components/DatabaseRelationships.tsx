import React, { useState, useEffect } from 'react';
import { Database, Link2, RefreshCw, Check, AlertCircle, Info, Download, Users, BookOpen, Layers, School } from 'lucide-react';
import { dbManager } from '../utils/database';

interface RelationshipStats {
  totalStudents: number;
  studentsWithLevelId: number;
  studentsWithSectionId: number;
  orphanedStudents: number;
  levels: LevelInfo[];
  sections: SectionInfo[];
  missingReferences: MissingReference[];
}

interface LevelInfo {
  id: string;
  name: string;
  code: string;
  studentCount: number;
}

interface SectionInfo {
  id: string;
  name: string;
  code: string;
  levelId: string;
  levelName: string;
  studentCount: number;
}

interface MissingReference {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  level: string;
  section: string;
  missingLevelId: boolean;
  missingSectionId: boolean;
}

const DatabaseRelationships: React.FC = () => {
  const [stats, setStats] = useState<RelationshipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [fixingRelationships, setFixingRelationships] = useState(false);
  const [fixResults, setFixResults] = useState<{
    fixed: number;
    errors: number;
    details: string[];
  } | null>(null);

  useEffect(() => {
    loadRelationshipStats();
  }, []);

  const loadRelationshipStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // الحصول على البيانات من قاعدة البيانات
      const [students, levels, sections] = await Promise.all([
        dbManager.getStudents(),
        dbManager.getLevels(),
        dbManager.getSections()
      ]);
      
      // حساب الإحصائيات
      const studentsWithLevelId = students.filter(s => s.levelId).length;
      const studentsWithSectionId = students.filter(s => s.sectionId).length;
      const orphanedStudents = students.filter(s => !s.levelId || !s.sectionId).length;
      
      // معلومات المستويات
      const levelsInfo: LevelInfo[] = levels.map(level => {
        const studentCount = students.filter(s => s.levelId === level.id).length;
        return {
          id: level.id,
          name: level.name,
          code: level.code || '',
          studentCount
        };
      });
      
      // معلومات الأقسام
      const sectionsInfo: SectionInfo[] = sections.map(section => {
        const studentCount = students.filter(s => s.sectionId === section.id).length;
        const level = levels.find(l => l.id === section.levelId);
        return {
          id: section.id,
          name: section.name,
          code: section.code || '',
          levelId: section.levelId,
          levelName: level ? level.name : 'غير محدد',
          studentCount
        };
      });
      
      // الطلاب بدون مراجع
      const missingReferences: MissingReference[] = students
        .filter(s => !s.levelId || !s.sectionId)
        .map(student => ({
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          nationalId: student.nationalId,
          level: student.level,
          section: student.section,
          missingLevelId: !student.levelId,
          missingSectionId: !student.sectionId
        }));
      
      setStats({
        totalStudents: students.length,
        studentsWithLevelId,
        studentsWithSectionId,
        orphanedStudents,
        levels: levelsInfo,
        sections: sectionsInfo,
        missingReferences
      });
      
    } catch (error) {
      console.error('خطأ في تحميل إحصائيات العلاقات:', error);
      setError('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // إصلاح العلاقات المفقودة
  const fixRelationships = async () => {
    if (!stats) return;
    
    try {
      setFixingRelationships(true);
      const results = {
        fixed: 0,
        errors: 0,
        details: [] as string[]
      };
      
      // إصلاح المراجع المفقودة
      for (const student of stats.missingReferences) {
        try {
          // البحث عن المستوى المناسب
          if (student.missingLevelId && student.level) {
            const matchingLevel = stats.levels.find(l => 
              l.name.trim().toLowerCase() === student.level.trim().toLowerCase()
            );
            
            if (matchingLevel) {
              await dbManager.updateStudent(student.id, { levelId: matchingLevel.id });
              results.fixed++;
              results.details.push(`✅ تم ربط التلميذ ${student.firstName} ${student.lastName} بالمستوى ${matchingLevel.name}`);
            } else {
              // إنشاء مستوى جديد إذا لم يكن موجوداً
              const newLevelId = await dbManager.addLevel({
                name: student.level,
                code: student.level.substring(0, 3).toUpperCase()
              });
              
              await dbManager.updateStudent(student.id, { levelId: newLevelId });
              results.fixed++;
              results.details.push(`✅ تم إنشاء مستوى جديد "${student.level}" وربط التلميذ ${student.firstName} ${student.lastName} به`);
            }
          }
          
          // البحث عن القسم المناسب
          if (student.missingSectionId && student.section) {
            const matchingSection = stats.sections.find(s => 
              s.name.trim().toLowerCase() === student.section.trim().toLowerCase()
            );
            
            if (matchingSection) {
              await dbManager.updateStudent(student.id, { sectionId: matchingSection.id });
              results.fixed++;
              results.details.push(`✅ تم ربط التلميذ ${student.firstName} ${student.lastName} بالقسم ${matchingSection.name}`);
            } else {
              // الحصول على معرف المستوى أولاً
              let levelId = null;
              if (student.levelId) {
                levelId = student.levelId;
              } else if (student.level) {
                const level = stats.levels.find(l => 
                  l.name.trim().toLowerCase() === student.level.trim().toLowerCase()
                );
                levelId = level?.id;
              }
              
              if (levelId) {
                // إنشاء قسم جديد
                const newSectionId = await dbManager.addSection({
                  name: student.section,
                  levelId: levelId,
                  code: student.section.substring(0, 3).toUpperCase()
                });
                
                await dbManager.updateStudent(student.id, { sectionId: newSectionId });
                results.fixed++;
                results.details.push(`✅ تم إنشاء قسم جديد "${student.section}" وربط التلميذ ${student.firstName} ${student.lastName} به`);
              } else {
                results.errors++;
                results.details.push(`❌ تعذر ربط التلميذ ${student.firstName} ${student.lastName} بقسم لأن المستوى غير محدد`);
              }
            }
          }
        } catch (error) {
          results.errors++;
          results.details.push(`❌ خطأ في إصلاح العلاقات للتلميذ ${student.firstName} ${student.lastName}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }
      
      setFixResults(results);
      
      // إعادة تحميل الإحصائيات
      await loadRelationshipStats();
      
    } catch (error) {
      console.error('خطأ في إصلاح العلاقات:', error);
      setError('خطأ في إصلاح العلاقات');
    } finally {
      setFixingRelationships(false);
    }
  };

  // تصدير تقرير العلاقات
  const exportRelationshipsReport = () => {
    if (!stats) return;
    
    const reportData = {
      إحصائيات_العلاقات: {
        إجمالي_التلاميذ: stats.totalStudents,
        التلاميذ_مع_مستوى: stats.studentsWithLevelId,
        التلاميذ_مع_قسم: stats.studentsWithSectionId,
        التلاميذ_بدون_مراجع: stats.orphanedStudents,
        نسبة_اكتمال_المراجع: `${Math.round((stats.studentsWithLevelId / stats.totalStudents) * 100)}%`
      },
      المستويات: stats.levels.map(level => ({
        المعرف: level.id,
        الاسم: level.name,
        الرمز: level.code,
        عدد_التلاميذ: level.studentCount
      })),
      الأقسام: stats.sections.map(section => ({
        المعرف: section.id,
        الاسم: section.name,
        الرمز: section.code,
        معرف_المستوى: section.levelId,
        اسم_المستوى: section.levelName,
        عدد_التلاميذ: section.studentCount
      })),
      المراجع_المفقودة: stats.missingReferences.map(ref => ({
        معرف_التلميذ: ref.id,
        الاسم: `${ref.firstName} ${ref.lastName}`,
        الرقم_الوطني: ref.nationalId,
        المستوى: ref.level,
        القسم: ref.section,
        مستوى_مفقود: ref.missingLevelId ? 'نعم' : 'لا',
        قسم_مفقود: ref.missingSectionId ? 'نعم' : 'لا'
      }))
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_العلاقات_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-red-900 mb-2">خطأ في تحميل البيانات</h3>
            <p className="text-red-700">{error || 'لا توجد بيانات متاحة'}</p>
            <button
              onClick={loadRelationshipStats}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              إعادة المحاولة
            </button>
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
            إدارة العلاقات بين الجداول
          </h1>
          <p className="text-gray-600 text-lg">تحليل وإصلاح العلاقات بين التلاميذ والمستويات والأقسام</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* أزرار التحكم */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">إدارة العلاقات</h2>
                <p className="text-sm text-gray-600">آخر تحديث: {new Date().toLocaleString('fr-EG')}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={loadRelationshipStats}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث البيانات
              </button>
              
              <button
                onClick={fixRelationships}
                disabled={fixingRelationships || stats.orphanedStudents === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {fixingRelationships ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Check className="w-4 h-4" />
                )}
                إصلاح العلاقات المفقودة
              </button>
              
              <button
                onClick={exportRelationshipsReport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Download className="w-4 h-4" />
                تصدير التقرير
              </button>
            </div>
          </div>
        </div>

        {/* نتائج الإصلاح */}
        {fixResults && (
          <div className={`mb-6 p-6 rounded-xl border ${
            fixResults.errors === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                fixResults.errors === 0 ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                {fixResults.errors === 0 ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">نتائج إصلاح العلاقات</h3>
                <p className={`text-sm ${fixResults.errors === 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                  تم إصلاح {fixResults.fixed} علاقة بنجاح
                  {fixResults.errors > 0 && ` مع ${fixResults.errors} خطأ`}
                </p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg max-h-40 overflow-y-auto">
              <h4 className="font-medium text-gray-900 mb-2">تفاصيل العملية:</h4>
              <div className="space-y-1">
                {fixResults.details.map((detail, index) => (
                  <p key={index} className="text-sm text-gray-700">
                    {detail}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">إجمالي التلاميذ</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.totalStudents}</p>
            <p className="text-xs text-gray-500 mt-1">في قاعدة البيانات</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Layers className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">المستويات</span>
            </div>
            <p className="text-3xl font-bold text-purple-600">{stats.levels.length}</p>
            <p className="text-xs text-gray-500 mt-1">مستوى دراسي</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">الأقسام</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.sections.length}</p>
            <p className="text-xs text-gray-500 mt-1">قسم دراسي</p>
          </div>
          
          <div className={`bg-white p-6 rounded-xl shadow-sm border ${
            stats.orphanedStudents > 0 ? 'border-red-200' : 'border-gray-100'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <Link2 className={`w-5 h-5 ${
                stats.orphanedStudents > 0 ? 'text-red-600' : 'text-gray-600'
              }`} />
              <span className="text-sm font-medium text-gray-700">مراجع مفقودة</span>
            </div>
            <p className={`text-3xl font-bold ${
              stats.orphanedStudents > 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {stats.orphanedStudents}
            </p>
            <p className="text-xs text-gray-500 mt-1">تلميذ بدون مستوى أو قسم</p>
          </div>
        </div>

        {/* قائمة الأقسام */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { id: 'overview', label: 'نظرة عامة', icon: Database, color: 'blue' },
            { id: 'levels', label: 'المستويات', icon: Layers, color: 'purple' },
            { id: 'sections', label: 'الأقسام', icon: BookOpen, color: 'green' }
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 rounded-xl text-center transition-all duration-200 ${
                  activeTab === tab.id
                    ? `bg-${tab.color}-600 text-white shadow-lg transform scale-105`
                    : `bg-white text-gray-700 hover:bg-${tab.color}-50 shadow-sm hover:shadow-md border border-gray-100`
                }`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${
                  activeTab === tab.id 
                    ? 'bg-white bg-opacity-20' 
                    : `bg-${tab.color}-100`
                }`}>
                  <IconComponent className={`w-6 h-6 ${
                    activeTab === tab.id 
                      ? 'text-white' 
                      : `text-${tab.color}-600`
                  }`} />
                </div>
                <h3 className="font-semibold text-sm">{tab.label}</h3>
              </button>
            );
          })}
        </div>

        {/* محتوى الأقسام */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* نظرة عامة */}
          {activeTab === 'overview' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">نظرة عامة على العلاقات</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* إحصائيات الربط */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">إحصائيات الربط</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">التلاميذ مع مستوى</span>
                        <span className="text-sm font-medium text-gray-900">
                          {stats.studentsWithLevelId} / {stats.totalStudents}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{ width: `${(stats.studentsWithLevelId / stats.totalStudents) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">التلاميذ مع قسم</span>
                        <span className="text-sm font-medium text-gray-900">
                          {stats.studentsWithSectionId} / {stats.totalStudents}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${(stats.studentsWithSectionId / stats.totalStudents) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">اكتمال المراجع</span>
                        <span className="text-sm font-medium text-gray-900">
                          {Math.round(((stats.totalStudents - stats.orphanedStudents) / stats.totalStudents) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${((stats.totalStudents - stats.orphanedStudents) / stats.totalStudents) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* هيكل العلاقات */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">هيكل العلاقات</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Users className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-900">التلاميذ (students)</p>
                        <p className="text-sm text-blue-700">levelId → المستوى، sectionId → القسم</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <Layers className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium text-purple-900">المستويات (levels)</p>
                        <p className="text-sm text-purple-700">id ← students.levelId</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <BookOpen className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">الأقسام (sections)</p>
                        <p className="text-sm text-green-700">id ← students.sectionId، levelId → levels.id</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* المراجع المفقودة */}
              {stats.missingReferences.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">التلاميذ بدون مراجع</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            التلميذ
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            الرقم الوطني
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            المستوى
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            القسم
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            المراجع المفقودة
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {stats.missingReferences.slice(0, 10).map((ref, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {ref.firstName} {ref.lastName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {ref.nationalId}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-sm text-gray-900">{ref.level || 'غير محدد'}</span>
                                {ref.missingLevelId && (
                                  <span className="mr-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                    معرف مفقود
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-sm text-gray-900">{ref.section || 'غير محدد'}</span>
                                {ref.missingSectionId && (
                                  <span className="mr-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                    معرف مفقود
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {ref.missingLevelId && ref.missingSectionId ? 'المستوى والقسم' : 
                                 ref.missingLevelId ? 'المستوى فقط' : 'القسم فقط'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {stats.missingReferences.length > 10 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      ... و {stats.missingReferences.length - 10} تلميذ آخر
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* المستويات */}
          {activeTab === 'levels' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">المستويات الدراسية</h2>
              
             {stats.levels.length === 0 ? (
               <div className="text-center py-12">
                 <Layers className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                 <p className="text-gray-500 text-lg">لا توجد مستويات</p>
                 <p className="text-gray-400 text-sm mt-2">سيتم إنشاء المستويات تلقائياً عند استيراد التلاميذ</p>
               </div>
             ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المستوى
                      </th>
                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                       المعرف
                     </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                       عدد التلاميذ المرتبطين
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                       عدد الأقسام
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                       تاريخ الإنشاء
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                       الحالة
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.levels.map((level, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex items-center gap-2">
                           <Layers className="w-4 h-4 text-purple-600" />
                           <div className="text-sm font-medium text-gray-900">{level.name}</div>
                          </div>
                        </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                         {level.id}
                       </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                         <div className="flex items-center">
                           <span className="text-sm font-medium text-blue-600">{level.studentCount}</span>
                           <div className="mr-2 w-16 bg-gray-200 rounded-full h-2">
                             <div 
                               className="bg-blue-600 h-2 rounded-full" 
                               style={{ width: `${(level.studentCount / stats.totalStudents) * 100}%` }}
                             ></div>
                           </div>
                         </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                         <span className="text-sm font-medium text-purple-600">
                           {stats.sections.filter(s => s.levelId === level.id).length}
                         </span>
                        </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                         {new Date().toLocaleDateString('fr-EG')}
                        </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                           level.studentCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                         }`}>
                           {level.studentCount > 0 ? 'نشط' : 'فارغ'}
                         </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
             )}
            </div>
          )}

          {/* الأقسام */}
          {activeTab === 'sections' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">الأقسام الدراسية</h2>
              
             {stats.sections.length === 0 ? (
               <div className="text-center py-12">
                 <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                 <p className="text-gray-500 text-lg">لا توجد أقسام</p>
                 <p className="text-gray-400 text-sm mt-2">سيتم إنشاء الأقسام تلقائياً عند استيراد التلاميذ</p>
               </div>
             ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        القسم
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                       المعرف
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        المستوى
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        عدد التلاميذ
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                       تاريخ الإنشاء
                     </th>
                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                       الحالة
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.sections.map((section, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex items-center gap-2">
                           <BookOpen className="w-4 h-4 text-green-600" />
                           <div className="text-sm font-medium text-gray-900">{section.name}</div>
                          </div>
                        </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                         {section.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                          {section.levelName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-green-600">{section.studentCount}</span>
                            <div className="mr-2 w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full" 
                                style={{ width: `${(section.studentCount / stats.totalStudents) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                         {new Date().toLocaleDateString('fr-EG')}
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                           section.studentCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                         }`}>
                           {section.studentCount > 0 ? 'نشط' : 'فارغ'}
                         </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
             )}
            </div>
          )}
        </div>

        {/* معلومات إضافية */}
        <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">أهمية العلاقات بين الجداول</h3>
          <div className="space-y-2 text-blue-800">
            <p>• <strong>ربط التلاميذ بالمستويات والأقسام:</strong> يسهل عمليات التوجيه والإحصائيات</p>
            <p>• <strong>تحديث مستمر:</strong> يجب تحديث students.levelId و students.sectionId عند كل تغيير في المستوى أو القسم</p>
            <p>• <strong>استعلامات JOIN:</strong> استخدم استعلامات JOIN بين الجداول للحصول على بيانات متكاملة</p>
            <p>• <strong>التوجيه:</strong> ربط guidance_statistics بـ students.id وتحديث students.levelId و students.sectionId حسب قرار التوجيه</p>
            <p>• <strong>الإحصائيات:</strong> تجميع البيانات من students و guidance_statistics و levels و sections لعرض الإحصائيات بشكل صحيح</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseRelationships;