import React, { useState, useEffect } from 'react';
import { BarChart3, Users, TrendingUp, AlertCircle, CheckCircle, FileText, Download, RefreshCw, Target, Award, UserCheck } from 'lucide-react';
import { dbManager } from '../utils/database';
import { GuidanceStatistic } from '../types';

interface AnalysisReport {
  totalRecords: number;
  dataIntegrity: {
    validRecords: number;
    invalidRecords: number;
    duplicates: number;
    missingPreferences: number;
  };
  passingStudents: {
    totalPassing: number;
    malesPassing: number;
    femalesPassing: number;
    preferencesByGender: {
      [key: string]: { males: number; females: number; total: number };
    };
  };
  specializations: {
    [key: string]: {
      totalStudents: number;
      males: number;
      females: number;
      percentage: number;
    };
  };
  specialCases: {
    repeatingStudents: { males: number; females: number; total: number };
    dismissedStudents: { males: number; females: number; total: number };
    noPreferences: { males: number; females: number; total: number };
    corrections: Array<{
      studentId: string;
      issue: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  };
  ageAnalysis: {
    [key: string]: { males: number; females: number; total: number };
  };
  decisionAnalysis: {
    [key: string]: { males: number; females: number; total: number; percentage: number };
  };
}

const GuidanceDataAnalysis: React.FC = () => {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    generateAnalysisReport();
  }, []);

  const generateAnalysisReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 بدء تحليل البيانات المستوردة...');
      
      // تهيئة جدول guidance_statistics قبل التحليل (حذف وإعادة إنشاء)
      dbManager.initGuidanceDatabase();
      
      // جلب جميع بيانات التوجيه
      const guidanceData = await dbManager.getGuidanceStatistics();
      const records = guidanceData.records || [];
      
      console.log('📊 عدد السجلات المجلبة:', records.length);
      
      if (records.length === 0) {
        setError('لا توجد بيانات مستوردة للتحليل. يرجى استيراد محاضر الأقسام أولاً.');
        return;
      }

      // تحليل سلامة البيانات
      const validRecords = records.filter(r => r.student_id && r.student_id.trim() !== '');
      const invalidRecords = records.length - validRecords.length;
      const duplicates = findDuplicates(records);
      const missingPreferences = records.filter(r => !r.assigned_stream || r.assigned_stream.trim() === '').length;

      // تحليل الطلاب الناجحين
      const passingStudents = records.filter(r => r.decision === 'ينتقل');
      const malesPassing = passingStudents.filter(r => r.gender === 'ذكر').length;
      const femalesPassing = passingStudents.filter(r => r.gender === 'أنثى').length;

      // تحليل التخصصات للناجحين
      const preferencesByGender: { [key: string]: { males: number; females: number; total: number } } = {};
      passingStudents.forEach(student => {
        if (student.assigned_stream && student.assigned_stream.trim() !== '') {
          const stream = student.assigned_stream.trim();
          if (!preferencesByGender[stream]) {
            preferencesByGender[stream] = { males: 0, females: 0, total: 0 };
          }
          if (student.gender === 'ذكر') {
            preferencesByGender[stream].males++;
          } else {
            preferencesByGender[stream].females++;
          }
          preferencesByGender[stream].total++;
        }
      });

      // تحليل جميع التخصصات
      const specializations: { [key: string]: { totalStudents: number; males: number; females: number; percentage: number } } = {};
      records.forEach(student => {
        if (student.assigned_stream && student.assigned_stream.trim() !== '') {
          const stream = student.assigned_stream.trim();
          if (!specializations[stream]) {
            specializations[stream] = { totalStudents: 0, males: 0, females: 0, percentage: 0 };
          }
          specializations[stream].totalStudents++;
          if (student.gender === 'ذكر') {
            specializations[stream].males++;
          } else {
            specializations[stream].females++;
          }
        }
      });

      // حساب النسب المئوية للتخصصات
      Object.keys(specializations).forEach(stream => {
        specializations[stream].percentage = Math.round((specializations[stream].totalStudents / records.length) * 100);
      });

      // تحليل الحالات الخاصة
      const repeatingStudents = records.filter(r => r.decision === 'يكرر');
      const dismissedStudents = records.filter(r => r.decision === 'يفصل');
      const noPreferences = records.filter(r => !r.assigned_stream || r.assigned_stream.trim() === '');

      // تحليل الأعمار
      const ageAnalysis: { [key: string]: { males: number; females: number; total: number } } = {};
      records.forEach(student => {
        const ageGroup = student.ageGroup || 'غير محدد';
        if (!ageAnalysis[ageGroup]) {
          ageAnalysis[ageGroup] = { males: 0, females: 0, total: 0 };
        }
        if (student.gender === 'ذكر') {
          ageAnalysis[ageGroup].males++;
        } else {
          ageAnalysis[ageGroup].females++;
        }
        ageAnalysis[ageGroup].total++;
      });

      // تحليل القرارات
      const decisionAnalysis: { [key: string]: { males: number; females: number; total: number; percentage: number } } = {};
      ['ينتقل', 'يكرر', 'يفصل'].forEach(decision => {
        const studentsWithDecision = records.filter(r => r.decision === decision);
        decisionAnalysis[decision] = {
          males: studentsWithDecision.filter(r => r.gender === 'ذكر').length,
          females: studentsWithDecision.filter(r => r.gender === 'أنثى').length,
          total: studentsWithDecision.length,
          percentage: Math.round((studentsWithDecision.length / records.length) * 100)
        };
      });

      // اقتراحات التصحيح
      const corrections = generateCorrections(records);

      const analysisReport: AnalysisReport = {
        totalRecords: records.length,
        dataIntegrity: {
          validRecords: validRecords.length,
          invalidRecords,
          duplicates: duplicates.length,
          missingPreferences
        },
        passingStudents: {
          totalPassing: passingStudents.length,
          malesPassing,
          femalesPassing,
          preferencesByGender
        },
        specializations,
        specialCases: {
          repeatingStudents: {
            males: repeatingStudents.filter(r => r.gender === 'ذكر').length,
            females: repeatingStudents.filter(r => r.gender === 'أنثى').length,
            total: repeatingStudents.length
          },
          dismissedStudents: {
            males: dismissedStudents.filter(r => r.gender === 'ذكر').length,
            females: dismissedStudents.filter(r => r.gender === 'أنثى').length,
            total: dismissedStudents.length
          },
          noPreferences: {
            males: noPreferences.filter(r => r.gender === 'ذكر').length,
            females: noPreferences.filter(r => r.gender === 'أنثى').length,
            total: noPreferences.length
          },
          corrections
        },
        ageAnalysis,
        decisionAnalysis
      };

      setReport(analysisReport);
      console.log('✅ تم إنجاز التحليل بنجاح');
      
    } catch (error) {
      console.error('❌ خطأ في تحليل البيانات:', error);
      setError('حدث خطأ أثناء تحليل البيانات: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
    } finally {
      setLoading(false);
    }
  };

  const findDuplicates = (records: GuidanceStatistic[]): GuidanceStatistic[] => {
    const seen = new Set<string>();
    const duplicates: GuidanceStatistic[] = [];
    
    records.forEach(record => {
      if (seen.has(record.student_id)) {
        duplicates.push(record);
      } else {
        seen.add(record.student_id);
      }
    });
    
    return duplicates;
  };

  const generateCorrections = (records: GuidanceStatistic[]) => {
    const corrections: Array<{
      studentId: string;
      issue: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    records.forEach(record => {
      // طلاب بدون رغبات
      if (!record.assigned_stream || record.assigned_stream.trim() === '') {
        corrections.push({
          studentId: record.student_id,
          issue: 'لا توجد رغبة في التوجيه',
          suggestion: 'يجب تحديد رغبة التوجيه قبل اتخاذ القرار النهائي',
          priority: 'high'
        });
      }

      // طلاب بدون قرار
      if (!record.decision || record.decision.trim() === '') {
        corrections.push({
          studentId: record.student_id,
          issue: 'لا يوجد قرار محدد',
          suggestion: 'يجب اتخاذ قرار (ينتقل/يكرر/يفصل)',
          priority: 'high'
        });
      }

      // طلاب بدون عمر محدد
      if (!record.age || record.age <= 0) {
        corrections.push({
          studentId: record.student_id,
          issue: 'العمر غير محدد أو غير صحيح',
          suggestion: 'يجب تحديد العمر الصحيح للطالب',
          priority: 'medium'
        });
      }

      // طلاب مفصولين بدون سبب واضح
      if (record.decision === 'يفصل' && (!record.age || record.age < 18)) {
        corrections.push({
          studentId: record.student_id,
          issue: 'قرار فصل لطالب أقل من 18 سنة',
          suggestion: 'مراجعة قرار الفصل أو تأكيد العمر',
          priority: 'high'
        });
      }
    });

    return corrections;
  };

  const exportReport = () => {
    if (!report) return;

    const reportData = {
      تاريخ_التقرير: new Date().toISOString(),
      ملخص_البيانات: {
        إجمالي_السجلات: report.totalRecords,
        السجلات_الصحيحة: report.dataIntegrity.validRecords,
        السجلات_غير_الصحيحة: report.dataIntegrity.invalidRecords,
        التكرارات: report.dataIntegrity.duplicates,
        بدون_رغبات: report.dataIntegrity.missingPreferences
      },
      الطلاب_الناجحون: {
        الإجمالي: report.passingStudents.totalPassing,
        الذكور: report.passingStudents.malesPassing,
        الإناث: report.passingStudents.femalesPassing,
        التخصصات_حسب_النوع: report.passingStudents.preferencesByGender
      },
      التخصصات: report.specializations,
      الحالات_الخاصة: report.specialCases,
      تحليل_الأعمار: report.ageAnalysis,
      تحليل_القرارات: report.decisionAnalysis
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_تحليل_محاضر_الأقسام_${new Date().toISOString().split('T')[0]}.json`;
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
              <p className="text-gray-600 text-lg">جاري تحليل البيانات المستوردة...</p>
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
            <h3 className="text-xl font-semibold text-red-900 mb-2">خطأ في التحليل</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={generateAnalysisReport}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">لا توجد بيانات للتحليل</p>
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
            تحليل شامل لبيانات محاضر الأقسام
          </h1>
          <p className="text-gray-600 text-lg">تقرير تفصيلي للبيانات المستوردة مع الإحصائيات والتوصيات</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* أزرار التحكم */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">تحليل البيانات</h2>
                <p className="text-sm text-gray-600">آخر تحديث: {new Date().toLocaleString('ar-EG')}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={generateAnalysisReport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة التحليل
              </button>
              
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Download className="w-4 h-4" />
                تصدير التقرير
              </button>
            </div>
          </div>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">إجمالي السجلات</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{report.totalRecords}</p>
            <p className="text-xs text-gray-500 mt-1">سجل مستورد</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">الطلاب الناجحون</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{report.passingStudents.totalPassing}</p>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round((report.passingStudents.totalPassing / report.totalRecords) * 100)}% من الإجمالي
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">التخصصات</span>
            </div>
            <p className="text-3xl font-bold text-purple-600">{Object.keys(report.specializations).length}</p>
            <p className="text-xs text-gray-500 mt-1">تخصص متاح</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-700">يحتاج تصحيح</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{report.specialCases.corrections.length}</p>
            <p className="text-xs text-gray-500 mt-1">حالة تحتاج مراجعة</p>
          </div>
        </div>

        {/* قائمة الأقسام */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { id: 'overview', label: 'نظرة عامة', icon: BarChart3, color: 'blue' },
            { id: 'passing', label: 'الطلاب الناجحون', icon: CheckCircle, color: 'green' },
            { id: 'specializations', label: 'التخصصات', icon: Target, color: 'purple' },
            { id: 'corrections', label: 'التصحيحات', icon: AlertCircle, color: 'red' }
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
              <h2 className="text-xl font-bold text-gray-900 mb-6">نظرة عامة على البيانات المستوردة</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* سلامة البيانات */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">سلامة البيانات</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">السجلات الصحيحة</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-green-600">{report.dataIntegrity.validRecords}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${(report.dataIntegrity.validRecords / report.totalRecords) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">السجلات غير الصحيحة</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-600">{report.dataIntegrity.invalidRecords}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-red-600 h-2 rounded-full" 
                            style={{ width: `${(report.dataIntegrity.invalidRecords / report.totalRecords) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">التكرارات</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-yellow-600">{report.dataIntegrity.duplicates}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-yellow-600 h-2 rounded-full" 
                            style={{ width: `${(report.dataIntegrity.duplicates / report.totalRecords) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">بدون رغبات</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-orange-600">{report.dataIntegrity.missingPreferences}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-orange-600 h-2 rounded-full" 
                            style={{ width: `${(report.dataIntegrity.missingPreferences / report.totalRecords) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* تحليل القرارات */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">توزيع القرارات</h3>
                  <div className="space-y-3">
                    {Object.entries(report.decisionAnalysis).map(([decision, data]) => (
                      <div key={decision} className="bg-white p-3 rounded border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900">{decision}</span>
                          <span className="text-lg font-bold text-blue-600">{data.percentage}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-gray-900">{data.total}</div>
                            <div className="text-gray-500">الإجمالي</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-blue-600">{data.males}</div>
                            <div className="text-gray-500">ذكور</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-pink-600">{data.females}</div>
                            <div className="text-gray-500">إناث</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* تحليل الأعمار */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">توزيع الفئات العمرية</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(report.ageAnalysis).map(([ageGroup, data]) => (
                    <div key={ageGroup} className="bg-white p-3 rounded border">
                      <div className="text-center mb-2">
                        <div className="font-medium text-gray-900">{ageGroup}</div>
                        <div className="text-2xl font-bold text-purple-600">{data.total}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-blue-600">{data.males}</div>
                          <div className="text-gray-500">ذكور</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-pink-600">{data.females}</div>
                          <div className="text-gray-500">إناث</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* الطلاب الناجحون */}
          {activeTab === 'passing' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">تحليل الطلاب الناجحين</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-green-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">{report.passingStudents.totalPassing}</div>
                  <div className="text-green-800 font-medium">إجمالي الناجحين</div>
                  <div className="text-sm text-green-600 mt-1">
                    {Math.round((report.passingStudents.totalPassing / report.totalRecords) * 100)}% من الإجمالي
                  </div>
                </div>
                
                <div className="bg-blue-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{report.passingStudents.malesPassing}</div>
                  <div className="text-blue-800 font-medium">الذكور الناجحون</div>
                  <div className="text-sm text-blue-600 mt-1">
                    {Math.round((report.passingStudents.malesPassing / report.passingStudents.totalPassing) * 100)}% من الناجحين
                  </div>
                </div>
                
                <div className="bg-pink-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-pink-600 mb-2">{report.passingStudents.femalesPassing}</div>
                  <div className="text-pink-800 font-medium">الإناث الناجحات</div>
                  <div className="text-sm text-pink-600 mt-1">
                    {Math.round((report.passingStudents.femalesPassing / report.passingStudents.totalPassing) * 100)}% من الناجحين
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">توزيع رغبات الطلاب الناجحين حسب التخصص</h3>
                <div className="space-y-4">
                  {Object.entries(report.passingStudents.preferencesByGender)
                    .sort(([,a], [,b]) => b.total - a.total)
                    .map(([stream, data]) => (
                    <div key={stream} className="bg-white p-4 rounded border">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900">{stream}</h4>
                        <span className="text-lg font-bold text-green-600">{data.total}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{data.males}</div>
                          <div className="text-sm text-gray-600">ذكور</div>
                          <div className="text-xs text-blue-500">
                            {data.total > 0 ? Math.round((data.males / data.total) * 100) : 0}%
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-pink-600">{data.females}</div>
                          <div className="text-sm text-gray-600">إناث</div>
                          <div className="text-xs text-pink-500">
                            {data.total > 0 ? Math.round((data.females / data.total) * 100) : 0}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${(data.total / report.passingStudents.totalPassing) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-center">
                        {Math.round((data.total / report.passingStudents.totalPassing) * 100)}% من الناجحين
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* التخصصات */}
          {activeTab === 'specializations' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">تحليل التخصصات (جميع الطلاب)</h2>
              
              <div className="space-y-4">
                {Object.entries(report.specializations)
                  .sort(([,a], [,b]) => b.totalStudents - a.totalStudents)
                  .map(([stream, data]) => (
                  <div key={stream} className="bg-gray-50 p-6 rounded-lg border">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{stream}</h3>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600">{data.totalStudents}</div>
                        <div className="text-sm text-gray-600">{data.percentage}% من الإجمالي</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-2">{data.males}</div>
                        <div className="text-blue-800 font-medium">طلاب ذكور</div>
                        <div className="text-sm text-blue-600 mt-1">
                          {data.totalStudents > 0 ? Math.round((data.males / data.totalStudents) * 100) : 0}%
                        </div>
                      </div>
                      
                      <div className="bg-pink-50 p-4 rounded-lg text-center">
                        <div className="text-3xl font-bold text-pink-600 mb-2">{data.females}</div>
                        <div className="text-pink-800 font-medium">طالبات إناث</div>
                        <div className="text-sm text-pink-600 mt-1">
                          {data.totalStudents > 0 ? Math.round((data.females / data.totalStudents) * 100) : 0}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-purple-600 h-3 rounded-full" 
                        style={{ width: `${(data.totalStudents / report.totalRecords) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* التصحيحات */}
          {activeTab === 'corrections' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">الحالات التي تحتاج تصحيح</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-yellow-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-yellow-600 mb-2">{report.specialCases.repeatingStudents.total}</div>
                  <div className="text-yellow-800 font-medium">طلاب مكررون</div>
                  <div className="text-sm text-yellow-600 mt-1">
                    ذكور: {report.specialCases.repeatingStudents.males} | إناث: {report.specialCases.repeatingStudents.females}
                  </div>
                </div>
                
                <div className="bg-red-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-red-600 mb-2">{report.specialCases.dismissedStudents.total}</div>
                  <div className="text-red-800 font-medium">طلاب مفصولون</div>
                  <div className="text-sm text-red-600 mt-1">
                    ذكور: {report.specialCases.dismissedStudents.males} | إناث: {report.specialCases.dismissedStudents.females}
                  </div>
                </div>
                
                <div className="bg-orange-50 p-6 rounded-lg text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">{report.specialCases.noPreferences.total}</div>
                  <div className="text-orange-800 font-medium">بدون رغبات</div>
                  <div className="text-sm text-orange-600 mt-1">
                    ذكور: {report.specialCases.noPreferences.males} | إناث: {report.specialCases.noPreferences.females}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  اقتراحات التصحيح ({report.specialCases.corrections.length} حالة)
                </h3>
                
                {report.specialCases.corrections.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <p className="text-green-800 font-medium">لا توجد حالات تحتاج تصحيح</p>
                    <p className="text-green-600 text-sm">جميع البيانات سليمة ومكتملة</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {report.specialCases.corrections.map((correction, index) => (
                      <div key={index} className={`p-4 rounded border-l-4 ${
                        correction.priority === 'high' ? 'bg-red-50 border-red-500' :
                        correction.priority === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                        'bg-blue-50 border-blue-500'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-gray-900">
                            الطالب: {correction.studentId}
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            correction.priority === 'high' ? 'bg-red-100 text-red-800' :
                            correction.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {correction.priority === 'high' ? 'عالي' :
                             correction.priority === 'medium' ? 'متوسط' : 'منخفض'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 mb-1">
                          <strong>المشكلة:</strong> {correction.issue}
                        </div>
                        <div className="text-sm text-gray-700">
                          <strong>الاقتراح:</strong> {correction.suggestion}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ملخص التوصيات */}
        <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">ملخص التوصيات</h3>
          <div className="space-y-2 text-blue-800">
            <p>• <strong>سلامة البيانات:</strong> {Math.round((report.dataIntegrity.validRecords / report.totalRecords) * 100)}% من البيانات سليمة</p>
            <p>• <strong>معدل النجاح:</strong> {Math.round((report.passingStudents.totalPassing / report.totalRecords) * 100)}% من الطلاب ناجحون</p>
            <p>• <strong>التخصصات الأكثر طلباً:</strong> {Object.entries(report.specializations).sort(([,a], [,b]) => b.totalStudents - a.totalStudents).slice(0, 3).map(([name]) => name).join('، ')}</p>
            <p>• <strong>الحالات التي تحتاج مراجعة:</strong> {report.specialCases.corrections.length} حالة</p>
            <p>• <strong>الطلاب بدون رغبات:</strong> {report.dataIntegrity.missingPreferences} طالب يحتاج تحديد رغبة التوجيه</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidanceDataAnalysis;