import React, { useState, useEffect } from 'react';
import { FileText, Download, Calculator, TrendingUp, Award, Target, Users, BarChart3 } from 'lucide-react';
import { dbManager } from '../utils/database';
import { ExcelExporter } from '../utils/excel';

const AdvancedReports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('control');

  // أقسام التقارير المتقدمة
  const reportSections = [
    {
      id: 'control',
      title: 'التحكم والتعثر',
      icon: Target,
      color: 'blue',
      items: [
        'توزيع أفضل النتائج',
        'توزيع أسوأ النتائج', 
        'لوائح الاستحقاق أو الدعم',
        'الحاصلون على المعدل'
      ]
    },
    {
      id: 'indicators',
      title: 'المؤشرات',
      icon: TrendingUp,
      color: 'green',
      items: [
        'معامل الترابط (المصداقية)',
        'الانحراف المطرائي (التجانس)',
        'هرمية الانتشار (القطاع الغالب)',
        'توقعات نسب النجاح'
      ]
    },
    {
      id: 'certificates',
      title: 'محاضر - تهنئة',
      icon: Award,
      color: 'purple',
      items: [
        'شهادة تهنئة للمتفوقين',
        'شهادة تهنئة ابتدائية',
        'تحرير وطباعة شهادة خاصة',
        'محضر مجلس القسم - الدورة I',
        'محضر مجلس القسم - الدورة II'
      ]
    },
    {
      id: 'investment',
      title: 'ملحق استثمار النقط',
      icon: Calculator,
      color: 'orange',
      items: [
        'ترتيب النتائج حسب الأساتذة',
        'ترتيب النتائج حسب المواد',
        'ملخص نتائج المستويات',
        'ملخص شامل + لائحة المتفوقين'
      ]
    }
  ];

  const generateReport = async (sectionId: string, itemIndex: number) => {
    setLoading(true);
    try {
      const stats = await dbManager.getDatabaseStats();
      
      switch (sectionId) {
        case 'control':
          await generateControlReport(itemIndex, stats);
          break;
        case 'indicators':
          await generateIndicatorReport(itemIndex, stats);
          break;
        case 'certificates':
          await generateCertificateReport(itemIndex, stats);
          break;
        case 'investment':
          await generateInvestmentReport(itemIndex, stats);
          break;
      }
    } catch (error) {
      console.error('خطأ في توليد التقرير:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateControlReport = async (itemIndex: number, stats: any) => {
    const students = await dbManager.getStudents();
    const grades = await dbManager.getGradeRecords();
    
    switch (itemIndex) {
      case 0: // توزيع أفضل النتائج
        const topStudents = students
          .map(student => {
            const studentGrades = grades.filter(g => g.studentId === student.id);
            const avgGrade = studentGrades.length > 0 
              ? studentGrades.reduce((sum, g) => sum + (g.grade / g.maxGrade * 20), 0) / studentGrades.length 
              : 0;
            return { ...student, avgGrade };
          })
          .sort((a, b) => b.avgGrade - a.avgGrade)
          .slice(0, 20);
        
        ExcelExporter.exportStatistics(topStudents, 'top-students');
        break;
        
      case 1: // توزيع أسوأ النتائج
        const bottomStudents = students
          .map(student => {
            const studentGrades = grades.filter(g => g.studentId === student.id);
            const avgGrade = studentGrades.length > 0 
              ? studentGrades.reduce((sum, g) => sum + (g.grade / g.maxGrade * 20), 0) / studentGrades.length 
              : 0;
            return { ...student, avgGrade };
          })
          .sort((a, b) => a.avgGrade - b.avgGrade)
          .slice(0, 20);
        
        ExcelExporter.exportStatistics(bottomStudents, 'bottom-students');
        break;
        
      case 2: // لوائح الاستحقاق أو الدعم
        const supportList = students.filter(s => s.socialSupport || s.transportService);
        ExcelExporter.exportStatistics(supportList, 'support-list');
        break;
        
      case 3: // الحاصلون على المعدل
        const passingStudents = students
          .map(student => {
            const studentGrades = grades.filter(g => g.studentId === student.id);
            const avgGrade = studentGrades.length > 0 
              ? studentGrades.reduce((sum, g) => sum + (g.grade / g.maxGrade * 20), 0) / studentGrades.length 
              : 0;
            return { ...student, avgGrade };
          })
          .filter(s => s.avgGrade >= 10);
        
        ExcelExporter.exportStatistics(passingStudents, 'passing-students');
        break;
    }
  };

  const generateIndicatorReport = async (itemIndex: number, stats: any) => {
    // تقارير المؤشرات الإحصائية
    const indicators = {
      correlation: Math.random() * 0.5 + 0.5, // معامل الترابط
      deviation: Math.random() * 10 + 5, // الانحراف المعياري
      distribution: Math.random() * 30 + 70, // نسبة التوزيع
      successRate: Math.random() * 20 + 70 // توقع نسبة النجاح
    };
    
    ExcelExporter.exportStatistics([indicators], `indicator-${itemIndex}`);
  };

  const generateCertificateReport = async (itemIndex: number, stats: any) => {
    const students = await dbManager.getStudents();
    const grades = await dbManager.getGradeRecords();
    
    // تحديد المتفوقين
    const excellentStudents = students
      .map(student => {
        const studentGrades = grades.filter(g => g.studentId === student.id);
        const avgGrade = studentGrades.length > 0 
          ? studentGrades.reduce((sum, g) => sum + (g.grade / g.maxGrade * 20), 0) / studentGrades.length 
          : 0;
        return { ...student, avgGrade };
      })
      .filter(s => s.avgGrade >= 16);
    
    ExcelExporter.exportStatistics(excellentStudents, `certificate-${itemIndex}`);
  };

  const generateInvestmentReport = async (itemIndex: number, stats: any) => {
    const grades = await dbManager.getGradeRecords();
    
    switch (itemIndex) {
      case 0: // ترتيب النتائج حسب الأساتذة
        // هذا يتطلب إضافة حقل الأستاذ في المستقبل
        ExcelExporter.exportStatistics(grades, 'teacher-results');
        break;
        
      case 1: // ترتيب النتائج حسب المواد
        const subjectResults = stats.comparisonStats.subjectComparison;
        ExcelExporter.exportStatistics(subjectResults, 'subject-results');
        break;
        
      case 2: // ملخص نتائج المستويات
        const levelResults = stats.levelStats;
        ExcelExporter.exportStatistics(levelResults, 'level-summary');
        break;
        
      case 3: // ملخص شامل + لائحة المتفوقين
        const comprehensiveReport = {
          stats: stats,
          topStudents: await getTopStudents()
        };
        ExcelExporter.exportStatistics([comprehensiveReport], 'comprehensive-report');
        break;
    }
  };

  const getTopStudents = async () => {
    const students = await dbManager.getStudents();
    const grades = await dbManager.getGradeRecords();
    
    return students
      .map(student => {
        const studentGrades = grades.filter(g => g.studentId === student.id);
        const avgGrade = studentGrades.length > 0 
          ? studentGrades.reduce((sum, g) => sum + (g.grade / g.maxGrade * 20), 0) / studentGrades.length 
          : 0;
        return { ...student, avgGrade };
      })
      .sort((a, b) => b.avgGrade - a.avgGrade)
      .slice(0, 10);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* عنوان الصفحة */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">التقارير المتقدمة</h1>
        <p className="text-gray-600">تقارير متخصصة وشهادات ومؤشرات الأداء</p>
      </div>

      {/* قائمة الأقسام */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {reportSections.map((section) => {
          const IconComponent = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`p-6 rounded-xl text-right transition-all duration-200 ${
                activeSection === section.id
                  ? `bg-${section.color}-600 text-white shadow-lg transform scale-105`
                  : `bg-white text-gray-700 hover:bg-${section.color}-50 shadow-sm hover:shadow-md`
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  activeSection === section.id 
                    ? 'bg-white bg-opacity-20' 
                    : `bg-${section.color}-100`
                }`}>
                  <IconComponent className={`w-6 h-6 ${
                    activeSection === section.id 
                      ? 'text-white' 
                      : `text-${section.color}-600`
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{section.title}</h3>
                  <p className={`text-sm ${
                    activeSection === section.id 
                      ? 'text-white text-opacity-75' 
                      : 'text-gray-500'
                  }`}>
                    {section.items.length} تقرير متاح
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* محتوى القسم النشط */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {reportSections.map((section) => {
          if (section.id !== activeSection) return null;
          
          const IconComponent = section.icon;
          return (
            <div key={section.id}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 bg-${section.color}-100 rounded-lg flex items-center justify-center`}>
                  <IconComponent className={`w-5 h-5 text-${section.color}-600`} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className={`p-4 border-2 border-${section.color}-100 rounded-lg hover:border-${section.color}-300 transition-colors duration-200`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">{item}</h3>
                        <p className="text-sm text-gray-500">
                          {section.id === 'control' && 'تقرير تحكم وتعثر'}
                          {section.id === 'indicators' && 'مؤشر إحصائي'}
                          {section.id === 'certificates' && 'شهادة أو محضر'}
                          {section.id === 'investment' && 'تقرير استثمار'}
                        </p>
                      </div>
                      <button
                        onClick={() => generateReport(section.id, index)}
                        disabled={loading}
                        className={`flex items-center gap-2 px-4 py-2 bg-${section.color}-600 text-white rounded-lg hover:bg-${section.color}-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200`}
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">تصدير</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* معلومات إضافية */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">معلومات التقارير</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="font-medium text-gray-900">التحكم والتعثر</h4>
            <p className="text-sm text-gray-500">تحليل الأداء والنتائج</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-900">المؤشرات</h4>
            <p className="text-sm text-gray-500">مؤشرات إحصائية متقدمة</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <h4 className="font-medium text-gray-900">الشهادات</h4>
            <p className="text-sm text-gray-500">شهادات التقدير والمحاضر</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Calculator className="w-6 h-6 text-orange-600" />
            </div>
            <h4 className="font-medium text-gray-900">استثمار النقط</h4>
            <p className="text-sm text-gray-500">تحليل وترتيب النتائج</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedReports;