import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, Edit, Trash2, Search, Filter, Users, Award, TrendingUp, CheckCircle, AlertCircle, Printer, X } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
}

interface QuizResultsProps {
  quizzes: Quiz[];
  quizResults: QuizResult[];
  students: Student[];
  onResultUpdate: (results: QuizResult[]) => void;
}

const QuizResults: React.FC<QuizResultsProps> = ({ quizzes, quizResults, students, onResultUpdate }) => {
  const [selectedQuiz, setSelectedQuiz] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('الكل');
  const [filteredResults, setFilteredResults] = useState<QuizResult[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'date'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    filterResults();
  }, [quizResults, selectedQuiz, searchTerm, gradeFilter, sortBy, sortOrder]);

  // تصفية النتائج
  const filterResults = () => {
    let filtered = [...quizResults];

    // تصفية حسب الرائز المحدد
    if (selectedQuiz) {
      filtered = filtered.filter(result => result.quizId === selectedQuiz);
    }

    // تصفية حسب البحث
    if (searchTerm) {
      filtered = filtered.filter(result =>
        result.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.nationalId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // تصفية حسب الدرجة
    if (gradeFilter !== 'الكل') {
      if (gradeFilter === 'ناجح') {
        filtered = filtered.filter(result => result.percentage >= 60);
      } else if (gradeFilter === 'راسب') {
        filtered = filtered.filter(result => result.percentage < 60);
      } else if (gradeFilter === 'ممتاز') {
        filtered = filtered.filter(result => result.percentage >= 90);
      } else if (gradeFilter === 'جيد') {
        filtered = filtered.filter(result => result.percentage >= 70 && result.percentage < 90);
      }
    }

    // ترتيب النتائج
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.studentName.localeCompare(b.studentName);
          break;
        case 'score':
          comparison = a.percentage - b.percentage;
          break;
        case 'date':
          comparison = new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredResults(filtered);
  };

  // حذف نتيجة
  const deleteResult = (resultId: string) => {
    if (confirm('هل أنت متأكد من حذف هذه النتيجة؟')) {
      const updatedResults = quizResults.filter(r => r.id !== resultId);
      onResultUpdate(updatedResults);
    }
  };

  // تصدير النتائج
  const exportResults = () => {
    const quiz = quizzes.find(q => q.id === selectedQuiz);
    if (!quiz) {
      alert('يرجى اختيار رائز أولاً');
      return;
    }

    const resultsToExport = filteredResults.map((result, index) => ({
      'الترتيب': index + 1,
      'الرقم الوطني': result.nationalId,
      'اسم التلميذ': result.studentName,
      'النقطة': result.score,
      'النسبة المئوية': `${result.percentage}%`,
      'الإجابات الصحيحة': result.correctAnswers,
      'الإجابات الخاطئة': result.wrongAnswers,
      'تاريخ المسح': new Date(result.scannedAt).toLocaleDateString('ar-EG'),
      'الحالة': result.percentage >= 60 ? 'ناجح' : 'راسب'
    }));

    // إنشاء ملف CSV
    const csvContent = [
      Object.keys(resultsToExport[0] || {}).join(','),
      ...resultsToExport.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `نتائج_${quiz.title}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // طباعة النتائج
  const printResults = async () => {
    const quiz = quizzes.find(q => q.id === selectedQuiz);
    if (!quiz || filteredResults.length === 0) {
      alert('لا توجد نتائج للطباعة');
      return;
    }

    try {
      // إنشاء محتوى HTML للطباعة
      const printContent = generatePrintableContent(quiz, filteredResults);
      
      // إنشاء عنصر مؤقت
      const printElement = document.createElement('div');
      printElement.innerHTML = printContent;
      printElement.style.position = 'absolute';
      printElement.style.left = '-9999px';
      printElement.style.top = '0';
      printElement.style.width = '210mm';
      printElement.style.background = 'white';
      printElement.style.fontFamily = 'Cairo, Arial, sans-serif';
      printElement.style.direction = 'rtl';
      document.body.appendChild(printElement);

      // تحويل إلى صورة
      const canvas = await html2canvas(printElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // إنشاء PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let yOffset = 0;
      while (yOffset < imgHeight) {
        if (yOffset > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight);
        yOffset += pdfHeight;
      }

      pdf.save(`نتائج_${quiz.title}_${new Date().toLocaleDateString('fr-MA').replace(/\//g, '-')}.pdf`);
      
      // تنظيف
      document.body.removeChild(printElement);

    } catch (error) {
      console.error('خطأ في الطباعة:', error);
      alert('حدث خطأ في إنشاء ملف PDF');
    }
  };

  // توليد محتوى HTML للطباعة
  const generatePrintableContent = (quiz: Quiz, results: QuizResult[]) => {
    const passedCount = results.filter(r => r.percentage >= 60).length;
    const failedCount = results.length - passedCount;
    const averageScore = results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
      : 0;

    return `
      <div style="padding: 20mm; font-family: 'Cairo', Arial, sans-serif; direction: rtl; line-height: 1.4;">
        <!-- رأس التقرير -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #059669; padding-bottom: 20px;">
          <h1 style="color: #059669; font-size: 24px; margin: 0 0 10px 0; font-weight: bold;">
            نتائج ${quiz.title}
          </h1>
          <div style="font-size: 14px; color: #374151; margin-bottom: 10px;">
            <strong>المادة:</strong> ${quiz.subject} | 
            <strong>المستوى:</strong> ${quiz.level} | 
            <strong>القسم:</strong> ${quiz.section}
          </div>
          <div style="font-size: 12px; color: #6b7280;">
            <strong>تاريخ الرائز:</strong> ${new Date(quiz.date).toLocaleDateString('ar-EG')} | 
            <strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('ar-EG')}
          </div>
        </div>

        <!-- الإحصائيات العامة -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #059669;">
            <div style="font-size: 24px; font-weight: bold; color: #059669;">${results.length}</div>
            <div style="font-size: 12px; color: #065f46;">إجمالي التلاميذ</div>
          </div>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #0284c7;">
            <div style="font-size: 24px; font-weight: bold; color: #0284c7;">${passedCount}</div>
            <div style="font-size: 12px; color: #0c4a6e;">الناجحون</div>
          </div>
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #dc2626;">
            <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${failedCount}</div>
            <div style="font-size: 12px; color: #991b1b;">الراسبون</div>
          </div>
          <div style="background: #fefce8; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #ca8a04;">
            <div style="font-size: 24px; font-weight: bold; color: #ca8a04;">${averageScore}%</div>
            <div style="font-size: 12px; color: #92400e;">المعدل العام</div>
          </div>
        </div>

        <!-- جدول النتائج -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
          <thead>
            <tr style="background: #059669; color: white;">
              <th style="border: 1px solid #059669; padding: 8px; text-align: center;">الترتيب</th>
              <th style="border: 1px solid #059669; padding: 8px; text-align: center;">الرقم الوطني</th>
              <th style="border: 1px solid #059669; padding: 8px; text-align: center;">اسم التلميذ</th>
              <th style="border: 1px solid #059669; padding: 8px; text-align: center;">النقطة</th>
              <th style="border: 1px solid #059669; padding: 8px; text-align: center;">النسبة</th>
              <th style="border: 1px solid #059669; padding: 8px; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${results.map((result, index) => `
              <tr style="${index % 2 === 0 ? 'background: #f9fafb;' : 'background: white;'}">
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-weight: bold;">${index + 1}</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-family: monospace;">${result.nationalId}</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-weight: 500;">${result.studentName}</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-weight: bold; color: #0284c7;">${result.score.toFixed(1)}</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center; font-weight: bold; color: ${result.percentage >= 60 ? '#059669' : '#dc2626'};">${result.percentage}%</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">
                  <span style="background: ${result.percentage >= 60 ? '#dcfce7' : '#fef2f2'}; color: ${result.percentage >= 60 ? '#166534' : '#991b1b'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                    ${result.percentage >= 60 ? 'ناجح' : 'راسب'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- تذييل التقرير -->
        <div style="text-align: center; font-size: 10px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 15px;">
          <p style="margin: 0;">تم إنشاء هذا التقرير بواسطة نظام إدارة الروائز - ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
      </div>
    `;
  };

  // حساب الإحصائيات للرائز المحدد
  const calculateQuizStats = () => {
    const quizResults = filteredResults;
    const totalStudents = quizResults.length;
    const passedStudents = quizResults.filter(r => r.percentage >= 60).length;
    const failedStudents = totalStudents - passedStudents;
    const averageScore = totalStudents > 0 
      ? Math.round(quizResults.reduce((sum, r) => sum + r.percentage, 0) / totalStudents)
      : 0;
    const highestScore = totalStudents > 0 
      ? Math.max(...quizResults.map(r => r.percentage))
      : 0;
    const lowestScore = totalStudents > 0 
      ? Math.min(...quizResults.map(r => r.percentage))
      : 0;

    return {
      totalStudents,
      passedStudents,
      failedStudents,
      averageScore,
      highestScore,
      lowestScore,
      passRate: totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0
    };
  };

  const stats = calculateQuizStats();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">نتائج الروائز</h2>
          <p className="text-gray-600">عرض وإدارة نتائج الروائز المصححة</p>
        </div>
      </div>

      {/* أدوات التحكم */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* اختيار الرائز */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الرائز</label>
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">جميع الروائز</option>
              {quizzes.map(quiz => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title} - {quiz.subject}
                </option>
              ))}
            </select>
          </div>

          {/* البحث */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">البحث</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="البحث في النتائج..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* تصفية الدرجات */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">تصفية الدرجات</label>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="الكل">جميع الدرجات</option>
              <option value="ممتاز">ممتاز (90%+)</option>
              <option value="جيد">جيد (70-89%)</option>
              <option value="ناجح">ناجح (60%+)</option>
              <option value="راسب">راسب (أقل من 60%)</option>
            </select>
          </div>

          {/* الترتيب */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الترتيب</label>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'score' | 'date')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="score">النقطة</option>
                <option value="name">الاسم</option>
                <option value="date">التاريخ</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* إحصائيات الرائز المحدد */}
      {selectedQuiz && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.totalStudents}</div>
            <div className="text-sm text-green-800">المجموع</div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{stats.passedStudents}</div>
            <div className="text-sm text-blue-800">ناجح</div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg text-center border border-red-200">
            <div className="text-2xl font-bold text-red-600">{stats.failedStudents}</div>
            <div className="text-sm text-red-800">راسب</div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{stats.averageScore}%</div>
            <div className="text-sm text-purple-800">المعدل</div>
          </div>
          
          <div className="bg-emerald-50 p-4 rounded-lg text-center border border-emerald-200">
            <div className="text-2xl font-bold text-emerald-600">{stats.highestScore}%</div>
            <div className="text-sm text-emerald-800">الأعلى</div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg text-center border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">{stats.lowestScore}%</div>
            <div className="text-sm text-orange-800">الأدنى</div>
          </div>
          
          <div className="bg-indigo-50 p-4 rounded-lg text-center border border-indigo-200">
            <div className="text-2xl font-bold text-indigo-600">{stats.passRate}%</div>
            <div className="text-sm text-indigo-800">نسبة النجاح</div>
          </div>
        </div>
      )}

      {/* أزرار الإجراءات */}
      {selectedQuiz && filteredResults.length > 0 && (
        <div className="flex gap-4 mb-6">
          <button
            onClick={exportResults}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>
          
          <button
            onClick={printResults}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Printer className="w-4 h-4" />
            طباعة PDF
          </button>
        </div>
      )}

      {/* جدول النتائج */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">لا توجد نتائج</p>
            <p className="text-gray-400 text-sm mt-2">
              {selectedQuiz ? 'لم يتم مسح أي أوراق لهذا الرائز بعد' : 'اختر رائز لعرض النتائج'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الترتيب</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الرقم الوطني</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم التلميذ</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">النقطة</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">النسبة</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">صحيح</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">خطأ</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">الحالة</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">تاريخ المسح</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredResults.map((result, index) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-bold text-gray-900">{index + 1}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {result.nationalId}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {result.studentName}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-bold text-blue-600">
                        {result.score.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-lg font-bold ${
                        result.percentage >= 90 ? 'text-emerald-600' :
                        result.percentage >= 70 ? 'text-green-600' :
                        result.percentage >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {result.percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-600 font-semibold">{result.correctAnswers}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-600 font-semibold">{result.wrongAnswers}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        result.percentage >= 60 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {result.percentage >= 60 ? 'ناجح' : 'راسب'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
                      {new Date(result.scannedAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedResult(result);
                            setShowDetailModal(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => deleteResult(result.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                          title="حذف النتيجة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* مودال تفاصيل النتيجة */}
      {showDetailModal && selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">تفاصيل النتيجة</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* معلومات التلميذ */}
              <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">معلومات التلميذ</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">الاسم:</span>
                    <span className="text-gray-900 mr-2">{selectedResult.studentName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">الرقم الوطني:</span>
                    <span className="text-gray-900 mr-2 font-mono">{selectedResult.nationalId}</span>
                  </div>
                </div>
              </div>

              {/* النتيجة */}
              <div className="bg-green-50 p-4 rounded-lg mb-6 border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-3">النتيجة</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedResult.score.toFixed(1)}</div>
                    <div className="text-sm text-gray-600">النقطة</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      selectedResult.percentage >= 60 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedResult.percentage}%
                    </div>
                    <div className="text-sm text-gray-600">النسبة</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedResult.correctAnswers}</div>
                    <div className="text-sm text-gray-600">صحيح</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{selectedResult.wrongAnswers}</div>
                    <div className="text-sm text-gray-600">خطأ</div>
                  </div>
                </div>
              </div>

              {/* الإجابات */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">الإجابات المسحوبة</h3>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                  {selectedResult.answers.map((answer, index) => (
                    <div key={index} className="text-center">
                      <div className="text-xs text-gray-600 mb-1">س{index + 1}</div>
                      <div className={`px-2 py-1 text-sm font-bold rounded ${
                        answer ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {answer || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* معلومات المسح */}
              <div className="mt-4 text-sm text-gray-600">
                <p><strong>تاريخ المسح:</strong> {new Date(selectedResult.scannedAt).toLocaleString('ar-EG')}</p>
                <p><strong>حالة التحقق:</strong> {selectedResult.verified ? 'محقق' : 'غير محقق'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizResults;