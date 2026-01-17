import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Award, Users, Target, Download, RefreshCw, Calendar, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface Quiz {
  id: string;
  title: string;
  subject: string;
  level: string;
  section: string;
  totalQuestions: number;
  maxScore: number;
  date: string;
}

interface QuizResult {
  id: string;
  quizId: string;
  studentId: string;
  nationalId: string;
  studentName: string;
  score: number;
  percentage: number;
  answers: string[];
  correctAnswers: number;
  wrongAnswers: number;
  scannedAt: string;
  verified: boolean;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  level: string;
  section: string;
  gender: 'ذكر' | 'أنثى';
}

interface QuizStatisticsProps {
  quizzes: Quiz[];
  quizResults: QuizResult[];
  students: Student[];
}

const QuizStatistics: React.FC<QuizStatisticsProps> = ({ quizzes, quizResults, students }) => {
  const [selectedQuiz, setSelectedQuiz] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('الكل');
  const [selectedSubject, setSelectedSubject] = useState<string>('الكل');
  const [activeChart, setActiveChart] = useState('performance');

  // حساب الإحصائيات العامة
  const calculateGeneralStats = () => {
    const totalQuizzes = quizzes.length;
    const totalResults = quizResults.length;
    const averageScore = totalResults > 0 
      ? Math.round(quizResults.reduce((sum, r) => sum + r.percentage, 0) / totalResults)
      : 0;
    
    const passedResults = quizResults.filter(r => r.percentage >= 60);
    const passRate = totalResults > 0 ? Math.round((passedResults.length / totalResults) * 100) : 0;

    return {
      totalQuizzes,
      totalResults,
      averageScore,
      passRate,
      totalStudents: new Set(quizResults.map(r => r.studentId)).size
    };
  };

  // حساب إحصائيات الأداء حسب المستوى
  const calculatePerformanceByLevel = () => {
    const levelStats = new Map<string, { total: number; passed: number; averageScore: number; scores: number[] }>();

    quizResults.forEach(result => {
      const student = students.find(s => s.id === result.studentId);
      const level = student?.level || 'غير محدد';
      
      if (!levelStats.has(level)) {
        levelStats.set(level, { total: 0, passed: 0, averageScore: 0, scores: [] });
      }
      
      const stats = levelStats.get(level)!;
      stats.total++;
      stats.scores.push(result.percentage);
      if (result.percentage >= 60) {
        stats.passed++;
      }
    });

    // حساب المعدلات
    levelStats.forEach(stats => {
      stats.averageScore = Math.round(stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length);
    });

    return Array.from(levelStats.entries()).map(([level, stats]) => ({
      level,
      total: stats.total,
      passed: stats.passed,
      failed: stats.total - stats.passed,
      averageScore: stats.averageScore,
      passRate: Math.round((stats.passed / stats.total) * 100)
    }));
  };

  // حساب إحصائيات الأداء حسب المادة
  const calculatePerformanceBySubject = () => {
    const subjectStats = new Map<string, { total: number; passed: number; scores: number[] }>();

    quizResults.forEach(result => {
      const quiz = quizzes.find(q => q.id === result.quizId);
      const subject = quiz?.subject || 'غير محدد';
      
      if (!subjectStats.has(subject)) {
        subjectStats.set(subject, { total: 0, passed: 0, scores: [] });
      }
      
      const stats = subjectStats.get(subject)!;
      stats.total++;
      stats.scores.push(result.percentage);
      if (result.percentage >= 60) {
        stats.passed++;
      }
    });

    return Array.from(subjectStats.entries()).map(([subject, stats]) => ({
      subject,
      total: stats.total,
      passed: stats.passed,
      failed: stats.total - stats.passed,
      averageScore: Math.round(stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length),
      passRate: Math.round((stats.passed / stats.total) * 100)
    }));
  };

  // حساب توزيع الدرجات
  const calculateGradeDistribution = () => {
    const distribution = {
      'ممتاز (90-100%)': 0,
      'جيد جداً (80-89%)': 0,
      'جيد (70-79%)': 0,
      'مقبول (60-69%)': 0,
      'ضعيف (50-59%)': 0,
      'راسب (أقل من 50%)': 0
    };

    quizResults.forEach(result => {
      if (result.percentage >= 90) distribution['ممتاز (90-100%)']++;
      else if (result.percentage >= 80) distribution['جيد جداً (80-89%)']++;
      else if (result.percentage >= 70) distribution['جيد (70-79%)']++;
      else if (result.percentage >= 60) distribution['مقبول (60-69%)']++;
      else if (result.percentage >= 50) distribution['ضعيف (50-59%)']++;
      else distribution['راسب (أقل من 50%)']++;
    });

    return Object.entries(distribution).map(([grade, count]) => ({
      grade,
      count,
      percentage: quizResults.length > 0 ? Math.round((count / quizResults.length) * 100) : 0
    }));
  };

  // حساب الأداء عبر الزمن
  const calculatePerformanceOverTime = () => {
    const timeStats = new Map<string, { total: number; averageScore: number; scores: number[] }>();

    quizResults.forEach(result => {
      const date = new Date(result.scannedAt).toISOString().split('T')[0];
      
      if (!timeStats.has(date)) {
        timeStats.set(date, { total: 0, averageScore: 0, scores: [] });
      }
      
      const stats = timeStats.get(date)!;
      stats.total++;
      stats.scores.push(result.percentage);
    });

    // حساب المعدلات
    timeStats.forEach(stats => {
      stats.averageScore = Math.round(stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length);
    });

    return Array.from(timeStats.entries())
      .map(([date, stats]) => ({
        date,
        averageScore: stats.averageScore,
        total: stats.total
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // تصدير الإحصائيات
  const exportStatistics = () => {
    const generalStats = calculateGeneralStats();
    const levelStats = calculatePerformanceByLevel();
    const subjectStats = calculatePerformanceBySubject();
    const gradeDistribution = calculateGradeDistribution();
    const timeStats = calculatePerformanceOverTime();

    const reportData = {
      تاريخ_التقرير: new Date().toISOString(),
      الإحصائيات_العامة: generalStats,
      الأداء_حسب_المستوى: levelStats,
      الأداء_حسب_المادة: subjectStats,
      توزيع_الدرجات: gradeDistribution,
      الأداء_عبر_الزمن: timeStats
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `إحصائيات_الروائز_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generalStats = calculateGeneralStats();
  const levelStats = calculatePerformanceByLevel();
  const subjectStats = calculatePerformanceBySubject();
  const gradeDistribution = calculateGradeDistribution();
  const timeStats = calculatePerformanceOverTime();

  const COLORS = ['#059669', '#0284c7', '#7c3aed', '#dc2626', '#ea580c', '#0891b2'];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">إحصائيات الروائز</h2>
            <p className="text-gray-600">تحليل شامل لأداء التلاميذ في الروائز</p>
          </div>
        </div>
        
        <button
          onClick={exportStatistics}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200"
        >
          <Download className="w-4 h-4" />
          تصدير الإحصائيات
        </button>
      </div>

      {/* الإحصائيات العامة */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-green-50 p-6 rounded-lg text-center border border-green-200">
          <div className="text-3xl font-bold text-green-600">{generalStats.totalQuizzes}</div>
          <div className="text-sm text-green-800">إجمالي الروائز</div>
        </div>
        
        <div className="bg-blue-50 p-6 rounded-lg text-center border border-blue-200">
          <div className="text-3xl font-bold text-blue-600">{generalStats.totalResults}</div>
          <div className="text-sm text-blue-800">النتائج المسجلة</div>
        </div>
        
        <div className="bg-purple-50 p-6 rounded-lg text-center border border-purple-200">
          <div className="text-3xl font-bold text-purple-600">{generalStats.totalStudents}</div>
          <div className="text-sm text-purple-800">التلاميذ المشاركين</div>
        </div>
        
        <div className="bg-orange-50 p-6 rounded-lg text-center border border-orange-200">
          <div className="text-3xl font-bold text-orange-600">{generalStats.averageScore}%</div>
          <div className="text-sm text-orange-800">المعدل العام</div>
        </div>
        
        <div className="bg-emerald-50 p-6 rounded-lg text-center border border-emerald-200">
          <div className="text-3xl font-bold text-emerald-600">{generalStats.passRate}%</div>
          <div className="text-sm text-emerald-800">نسبة النجاح</div>
        </div>
      </div>

      {/* قائمة أنواع المبيانات */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { id: 'performance', label: 'الأداء حسب المستوى', icon: TrendingUp, color: 'green' },
          { id: 'subjects', label: 'الأداء حسب المادة', icon: BookOpen, color: 'blue' },
          { id: 'distribution', label: 'توزيع الدرجات', icon: Award, color: 'purple' },
          { id: 'timeline', label: 'الأداء عبر الزمن', icon: Calendar, color: 'orange' }
        ].map((chart) => {
          const IconComponent = chart.icon;
          return (
            <button
              key={chart.id}
              onClick={() => setActiveChart(chart.id)}
              className={`p-4 rounded-xl text-center transition-all duration-200 ${
                activeChart === chart.id
                  ? `bg-${chart.color}-600 text-white shadow-lg transform scale-105`
                  : `bg-white text-gray-700 hover:bg-${chart.color}-50 shadow-sm hover:shadow-md border border-gray-100`
              }`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${
                activeChart === chart.id 
                  ? 'bg-white bg-opacity-20' 
                  : `bg-${chart.color}-100`
              }`}>
                <IconComponent className={`w-6 h-6 ${
                  activeChart === chart.id 
                    ? 'text-white' 
                    : `text-${chart.color}-600`
                }`} />
              </div>
              <h3 className="font-semibold text-sm">{chart.label}</h3>
            </button>
          );
        })}
      </div>

      {/* المبيانات */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        {/* الأداء حسب المستوى */}
        {activeChart === 'performance' && (
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">الأداء حسب المستوى</h3>
            {levelStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={levelStats}>
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
                    formatter={(value, name) => [
                      value, 
                      name === 'passed' ? 'ناجح' : 
                      name === 'failed' ? 'راسب' : 
                      name === 'averageScore' ? 'المعدل' : name
                    ]}
                    labelFormatter={(label) => `المستوى: ${label}`}
                  />
                  <Legend 
                    formatter={(value) => 
                      value === 'passed' ? 'الناجحون' : 
                      value === 'failed' ? 'الراسبون' : 
                      value === 'averageScore' ? 'المعدل %' : value
                    }
                  />
                  <Bar dataKey="passed" fill="#059669" name="passed" />
                  <Bar dataKey="failed" fill="#dc2626" name="failed" />
                  <Bar dataKey="averageScore" fill="#0284c7" name="averageScore" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">لا توجد بيانات للعرض</p>
              </div>
            )}
          </div>
        )}

        {/* الأداء حسب المادة */}
        {activeChart === 'subjects' && (
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">الأداء حسب المادة</h3>
            {subjectStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={subjectStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="subject" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value, name) => [
                      value, 
                      name === 'averageScore' ? 'المعدل %' : 
                      name === 'passRate' ? 'نسبة النجاح %' : name
                    ]}
                    labelFormatter={(label) => `المادة: ${label}`}
                  />
                  <Legend 
                    formatter={(value) => 
                      value === 'averageScore' ? 'المعدل %' : 
                      value === 'passRate' ? 'نسبة النجاح %' : value
                    }
                  />
                  <Bar dataKey="averageScore" fill="#0284c7" name="averageScore" />
                  <Bar dataKey="passRate" fill="#059669" name="passRate" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">لا توجد بيانات للعرض</p>
              </div>
            )}
          </div>
        )}

        {/* توزيع الدرجات */}
        {activeChart === 'distribution' && (
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">توزيع الدرجات</h3>
            {gradeDistribution.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={gradeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ grade, percentage }) => `${grade}: ${percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {gradeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-3">
                  {gradeDistribution.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="text-sm font-medium text-gray-900">{item.grade}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{item.count}</div>
                        <div className="text-sm text-gray-600">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">لا توجد بيانات للعرض</p>
              </div>
            )}
          </div>
        )}

        {/* الأداء عبر الزمن */}
        {activeChart === 'timeline' && (
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">تطور الأداء عبر الزمن</h3>
            {timeStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timeStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('ar-EG')}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value, name) => [
                      value, 
                      name === 'averageScore' ? 'المعدل %' : 
                      name === 'total' ? 'عدد النتائج' : name
                    ]}
                    labelFormatter={(label) => `التاريخ: ${new Date(label).toLocaleDateString('ar-EG')}`}
                  />
                  <Legend 
                    formatter={(value) => 
                      value === 'averageScore' ? 'المعدل %' : 
                      value === 'total' ? 'عدد النتائج' : value
                    }
                  />
                  <Line 
                    type="monotone" 
                    dataKey="averageScore" 
                    stroke="#0284c7" 
                    strokeWidth={3}
                    name="averageScore"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#059669" 
                    strokeWidth={2}
                    name="total"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">لا توجد بيانات للعرض</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* جداول الإحصائيات التفصيلية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* إحصائيات المستويات */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-green-50 p-4 border-b">
            <h3 className="text-lg font-semibold text-green-900">الأداء حسب المستوى</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right font-bold">المستوى</th>
                  <th className="px-4 py-2 text-center font-bold">المجموع</th>
                  <th className="px-4 py-2 text-center font-bold text-green-700">ناجح</th>
                  <th className="px-4 py-2 text-center font-bold text-red-700">راسب</th>
                  <th className="px-4 py-2 text-center font-bold text-blue-700">المعدل</th>
                </tr>
              </thead>
              <tbody>
                {levelStats.map((stat, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-25' : 'bg-white'}>
                    <td className="px-4 py-2 font-medium">{stat.level}</td>
                    <td className="px-4 py-2 text-center">{stat.total}</td>
                    <td className="px-4 py-2 text-center text-green-600 font-bold">{stat.passed}</td>
                    <td className="px-4 py-2 text-center text-red-600 font-bold">{stat.failed}</td>
                    <td className="px-4 py-2 text-center text-blue-600 font-bold">{stat.averageScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* إحصائيات المواد */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-blue-50 p-4 border-b">
            <h3 className="text-lg font-semibold text-blue-900">الأداء حسب المادة</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right font-bold">المادة</th>
                  <th className="px-4 py-2 text-center font-bold">المجموع</th>
                  <th className="px-4 py-2 text-center font-bold text-green-700">ناجح</th>
                  <th className="px-4 py-2 text-center font-bold text-red-700">راسب</th>
                  <th className="px-4 py-2 text-center font-bold text-blue-700">المعدل</th>
                </tr>
              </thead>
              <tbody>
                {subjectStats.map((stat, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-25' : 'bg-white'}>
                    <td className="px-4 py-2 font-medium">{stat.subject}</td>
                    <td className="px-4 py-2 text-center">{stat.total}</td>
                    <td className="px-4 py-2 text-center text-green-600 font-bold">{stat.passed}</td>
                    <td className="px-4 py-2 text-center text-red-600 font-bold">{stat.failed}</td>
                    <td className="px-4 py-2 text-center text-blue-600 font-bold">{stat.averageScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* معلومات إضافية */}
      <div className="mt-8 bg-orange-50 p-6 rounded-xl border border-orange-200">
        <h3 className="text-lg font-semibold text-orange-900 mb-4">تفسير الإحصائيات</h3>
        <div className="space-y-2 text-orange-800">
          <p>• <strong>المعدل العام:</strong> متوسط جميع النقط في جميع الروائز</p>
          <p>• <strong>نسبة النجاح:</strong> نسبة التلاميذ الحاصلين على 60% أو أكثر</p>
          <p>• <strong>الأداء حسب المستوى:</strong> مقارنة أداء المستويات المختلفة</p>
          <p>• <strong>الأداء حسب المادة:</strong> مقارنة صعوبة المواد المختلفة</p>
          <p>• <strong>توزيع الدرجات:</strong> توزيع التلاميذ على فئات الدرجات</p>
          <p>• <strong>الأداء عبر الزمن:</strong> تتبع تطور الأداء خلال الفترة الزمنية</p>
        </div>
      </div>
    </div>
  );
};

export default QuizStatistics;