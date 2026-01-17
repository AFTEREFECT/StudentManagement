import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  FileText, 
  Users, 
  BarChart3, 
  Download, 
  Scan, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  Edit, 
  Trash2, 
  Plus,
  Calculator,
  Target,
  Award,
  TrendingUp,
  BookOpen,
  Settings,
  RefreshCw,
  X,
  Save
} from 'lucide-react';
import { dbManager } from '../utils/database';
import { Student } from '../types';
import QuizScanner from './QuizScanner';
import QuizResultsManager from './QuizResultsManager';
import AdvancedScanSettings from './AdvancedScanSettings';
import QuizSettings from './QuizSettings';
import QuizStatistics from './QuizStatistics';
import QuizTemplateGenerator from './QuizTemplateGenerator';

interface Quiz {
  id: string;
  title: string;
  subject: string;
  level: string;
  section: string;
  totalQuestions: number;
  maxScore: number;
  date: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
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

const QuizManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    subject: '',
    level: '',
    section: '',
    totalQuestions: 20,
    maxScore: 20,
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  // تحميل البيانات الأولية
  const loadInitialData = async () => {
    try {
      const [studentsData, quizzesData, resultsData] = await Promise.all([
        dbManager.getStudents(),
        loadQuizzes(),
        loadQuizResults()
      ]);
      
      setStudents(studentsData);
      setQuizzes(quizzesData);
      setQuizResults(resultsData);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  // تحميل الروائز من التخزين المحلي
  const loadQuizzes = async (): Promise<Quiz[]> => {
    try {
      const saved = localStorage.getItem('quizzes');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('خطأ في تحميل الروائز:', error);
      return [];
    }
  };

  // تحميل نتائج الروائز من التخزين المحلي
  const loadQuizResults = async (): Promise<QuizResult[]> => {
    try {
      const saved = localStorage.getItem('quizResults');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('خطأ في تحميل نتائج الروائز:', error);
      return [];
    }
  };

  // حفظ الروائز في التخزين المحلي
  const saveQuizzes = (quizzesToSave: Quiz[]) => {
    try {
      localStorage.setItem('quizzes', JSON.stringify(quizzesToSave));
    } catch (error) {
      console.error('خطأ في حفظ الروائز:', error);
    }
  };

  // حفظ نتائج الروائز في التخزين المحلي
  const saveQuizResults = (resultsToSave: QuizResult[]) => {
    try {
      localStorage.setItem('quizResults', JSON.stringify(resultsToSave));
    } catch (error) {
      console.error('خطأ في حفظ نتائج الروائز:', error);
    }
  };

  // إنشاء رائز جديد
  const handleCreateQuiz = () => {
    const quiz: Quiz = {
      id: crypto.randomUUID(),
      title: newQuiz.title,
      subject: newQuiz.subject,
      level: newQuiz.level,
      section: newQuiz.section,
      totalQuestions: newQuiz.totalQuestions,
      maxScore: newQuiz.maxScore,
      date: newQuiz.date,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questionPoints: Array(newQuiz.totalQuestions).fill(1),
      correctAnswers: Array(newQuiz.totalQuestions).fill('A')
    };

    const updatedQuizzes = [...quizzes, quiz];
    setQuizzes(updatedQuizzes);
    saveQuizzes(updatedQuizzes);
    setShowCreateQuiz(false);
    setNewQuiz({
      title: '',
      subject: '',
      level: '',
      section: '',
      totalQuestions: 20,
      maxScore: 20,
      date: new Date().toISOString().split('T')[0]
    });
  };
 
  // حذف رائز
  const handleDeleteQuiz = (quizId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الرائز؟ سيتم حذف جميع النتائج المرتبطة به.')) {
      const updatedQuizzes = quizzes.filter(q => q.id !== quizId);
      const updatedResults = quizResults.filter(r => r.quizId !== quizId);
      
      setQuizzes(updatedQuizzes);
      setQuizResults(updatedResults);
      saveQuizzes(updatedQuizzes);
      saveQuizResults(updatedResults);
    }
  };

  // تحديث حالة الرائز
  const updateQuizStatus = (quizId: string, status: Quiz['status']) => {
    const updatedQuizzes = quizzes.map(q => 
      q.id === quizId ? { ...q, status, updatedAt: new Date().toISOString() } : q
    );
    setQuizzes(updatedQuizzes);
    saveQuizzes(updatedQuizzes);
  };

  // إضافة نتيجة رائز
  const addQuizResult = (result: Omit<QuizResult, 'id' | 'scannedAt'>) => {
    const newResult: QuizResult = {
      ...result,
      id: crypto.randomUUID(),
      scannedAt: new Date().toISOString()
    };

    const updatedResults = [...quizResults, newResult];
    setQuizResults(updatedResults);
    saveQuizResults(updatedResults);
  };

  // الحصول على المستويات الفريدة
  const getUniqueLevels = () => {
    return Array.from(new Set(students.map(s => s.level).filter(Boolean)));
  };

  // الحصول على الأقسام الفريدة
  const getUniqueSections = () => {
    return Array.from(new Set(students.map(s => s.section).filter(Boolean)));
  };

  // الحصول على المواد الفريدة
  const getUniqueSubjects = () => {
    return ['الرياضيات', 'الفيزياء', 'الكيمياء', 'علوم الحياة والأرض', 'اللغة العربية', 'اللغة الفرنسية', 'اللغة الإنجليزية', 'التاريخ', 'الجغرافيا', 'التربية الإسلامية', 'الفلسفة'];
  };

  // حساب الإحصائيات
  const calculateStats = () => {
    const totalQuizzes = quizzes.length;
    const activeQuizzes = quizzes.filter(q => q.status === 'active').length;
    const completedQuizzes = quizzes.filter(q => q.status === 'completed').length;
    const totalResults = quizResults.length;
    const averageScore = quizResults.length > 0 
      ? Math.round(quizResults.reduce((sum, r) => sum + r.percentage, 0) / quizResults.length)
      : 0;

    return {
      totalQuizzes,
      activeQuizzes,
      completedQuizzes,
      totalResults,
      averageScore
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">جاري تحميل نظام الروائز...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-3">
            نظام إدارة الروائز
          </h1>
          <p className="text-gray-600 text-lg">تصحيح أوتوماتيكي للروائز بالمسح الضوئي وربطها ببيانات التلاميذ</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-green-600 to-blue-600 rounded-full mx-auto"></div>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 mb-6 lg:mb-8 px-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span className="text-xs sm:text-sm font-medium text-gray-700">إجمالي الروائز</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.totalQuizzes}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">الروائز النشطة</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.activeQuizzes}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">الروائز المكتملة</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{stats.completedQuizzes}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-gray-700">النتائج المسجلة</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.totalResults}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Award className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-700">المعدل العام</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.averageScore}%</p>
          </div>
        </div>

        {/* قائمة الأقسام */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 mb-6 lg:mb-8">
          {[
            { id: 'overview', label: 'نظرة عامة', icon: BarChart3, color: 'green' },
            { id: 'templates', label: 'نماذج PDF', icon: FileText, color: 'purple' },
            { id: 'scanner', label: 'مسح الأوراق', icon: Scan, color: 'blue' },
            { id: 'results', label: 'إدارة النتائج', icon: FileText, color: 'purple' },
            { id: 'statistics', label: 'الإحصائيات', icon: TrendingUp, color: 'orange' },
            { id: 'scan-settings', label: 'إعدادات المسح', icon: Settings, color: 'gray' },
            { id: 'settings', label: 'إعدادات عامة', icon: Settings, color: 'gray' }
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-2 sm:p-4 rounded-lg sm:rounded-xl text-center transition-all duration-200 ${
                  activeTab === tab.id
                    ? `bg-${tab.color}-600 text-white shadow-lg transform scale-105`
                    : `bg-white text-gray-700 hover:bg-${tab.color}-50 shadow-sm hover:shadow-md border border-gray-100`
                }`}
              >
                <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3 ${
                  activeTab === tab.id 
                    ? 'bg-white bg-opacity-20' 
                    : `bg-${tab.color}-100`
                }`}>
                  <IconComponent className={`w-4 h-4 sm:w-6 sm:h-6 ${
                    activeTab === tab.id 
                      ? 'text-white' 
                      : `text-${tab.color}-600`
                  }`} />
                </div>
                <h3 className="font-semibold text-xs sm:text-sm">{tab.label}</h3>
              </button>
            );
          })}
        </div>

        {/* محتوى الأقسام */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* نظرة عامة */}
          {activeTab === 'overview' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">إدارة الروائز</h2>
                <button
                  onClick={() => setShowCreateQuiz(true)}
                  className="flex items-center gap-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  إنشاء رائز جديد
                </button>
              </div>

              {/* قائمة الروائز */}
              <div className="space-y-4">
                {quizzes.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">لا توجد روائز</p>
                    <p className="text-gray-400 text-sm mt-2">ابدأ بإنشاء رائز جديد</p>
                  </div>
                ) : (
                  quizzes.map((quiz) => {
                    const quizResultsCount = quizResults.filter(r => r.quizId === quiz.id).length;
                    const averageScore = quizResults.filter(r => r.quizId === quiz.id).length > 0
                      ? Math.round(quizResults.filter(r => r.quizId === quiz.id).reduce((sum, r) => sum + r.percentage, 0) / quizResults.filter(r => r.quizId === quiz.id).length)
                      : 0;

                    return (
                      <div key={quiz.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">{quiz.title}</h3>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                quiz.status === 'active' ? 'bg-green-100 text-green-800' :
                                quiz.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {quiz.status === 'active' ? 'نشط' : 
                                 quiz.status === 'completed' ? 'مكتمل' : 'مسودة'}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">المادة:</span> {quiz.subject}
                              </div>
                              <div>
                                <span className="font-medium">المستوى:</span> {quiz.level}
                              </div>
                              <div>
                                <span className="font-medium">القسم:</span> {quiz.section}
                              </div>
                              <div>
                                <span className="font-medium">التاريخ:</span> {new Date(quiz.date).toLocaleDateString('ar-EG')}
                              </div>
                            </div>
                            
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="bg-blue-50 p-2 rounded">
                                <span className="text-blue-600 font-medium">{quiz.totalQuestions}</span>
                                <span className="text-gray-600"> سؤال</span>
                              </div>
                              <div className="bg-green-50 p-2 rounded">
                                <span className="text-green-600 font-medium">{quiz.maxScore}</span>
                                <span className="text-gray-600"> نقطة</span>
                              </div>
                              <div className="bg-purple-50 p-2 rounded">
                                <span className="text-purple-600 font-medium">{quizResultsCount}</span>
                                <span className="text-gray-600"> نتيجة</span>
                              </div>
                              <div className="bg-orange-50 p-2 rounded">
                                <span className="text-orange-600 font-medium">{averageScore}%</span>
                                <span className="text-gray-600"> معدل</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedQuiz(quiz)}
                              className="flex items-center gap-2 px-4 py-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 border border-blue-200 hover:border-blue-300 font-medium"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">عرض التفاصيل</span>
                            </button>
                            
                            <button
                              onClick={() => {
                                setSelectedQuiz(quiz);
                                setActiveTab('templates');
                              }}
                              className="flex items-center gap-2 px-4 py-3 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200 border border-purple-200 hover:border-purple-300 font-medium"
                              title="توليد نماذج PDF"
                            >
                              <FileText className="w-4 h-4" />
                              <span className="hidden sm:inline">نماذج PDF</span>
                            </button>
                            
                            <div className="relative">
                              <select
                                value={quiz.status}
                                onChange={(e) => updateQuizStatus(quiz.id, e.target.value as Quiz['status'])}
                                className="px-3 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              >
                                <option value="draft">مسودة</option>
                                <option value="active">نشط</option>
                                <option value="completed">مكتمل</option>
                              </select>
                            </div>
                            
                            <button
                              onClick={() => handleDeleteQuiz(quiz.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="حذف الرائز"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* نماذج PDF */}
          {activeTab === 'templates' && selectedQuiz && (
            <QuizTemplateGenerator 
              quiz={selectedQuiz}
              students={students.filter(s => s.level === selectedQuiz.level && s.section === selectedQuiz.section)}
            />
          )}

          {activeTab === 'templates' && !selectedQuiz && (
            <div className="p-6 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">اختر رائز من نظرة عامة لتوليد النماذج</p>
            </div>
          )}

          {/* مسح الأوراق */}
          {activeTab === 'scanner' && (
            <QuizScanner 
              quizzes={quizzes.filter(q => q.status === 'active')}
              students={students}
              onResultAdded={addQuizResult}
            />
          )}

          {/* النتائج */}
          {activeTab === 'results' && (
            <QuizResultsManager 
              quizzes={quizzes}
              quizResults={quizResults}
              onResultUpdate={(updatedResults) => {
                setQuizResults(updatedResults);
                saveQuizResults(updatedResults);
              }}
            />
          )}

          {/* إعدادات المسح المتقدمة */}
          {activeTab === 'scan-settings' && (
            <AdvancedScanSettings />
          )}

          {/* الإحصائيات */}
          {activeTab === 'statistics' && (
            <QuizStatistics 
              quizzes={quizzes}
              quizResults={quizResults}
              students={students}
            />
          )}

          {/* الإعدادات */}
          {activeTab === 'settings' && (
            <QuizSettings />
          )}

          {/* نماذج PDF */}
          {activeTab === 'templates' && (
            selectedQuiz ? (
              <QuizTemplateGenerator 
                quiz={selectedQuiz}
                students={students.filter(s => s.level === selectedQuiz.level && s.section === selectedQuiz.section)}
              />
            ) : (
              <div className="p-6 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">اختر رائز من نظرة عامة لتوليد النماذج</p>
              </div>
            )
          )}
        </div>

        {/* مودال إنشاء رائز جديد */}
        {showCreateQuiz && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">إنشاء رائز جديد</h2>
                <button
                  onClick={() => setShowCreateQuiz(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* عنوان الرائز */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عنوان الرائز *
                  </label>
                  <input
                    type="text"
                    max="20"
                    onChange={(e) => setNewQuiz(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثال: رائز الرياضيات - الدورة الأولى"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    النموذج الثابت يدعم حتى 20 سؤال
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    المادة *
                  </label>
                  <select
                    value={newQuiz.subject}
                    onChange={(e) => setNewQuiz(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">اختر المادة</option>
                    {getUniqueSubjects().map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                {/* عدد الأسئلة والنقطة العظمى */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      المستوى *
                    </label>
                    <select
                      value={newQuiz.level}
                      onChange={(e) => setNewQuiz(prev => ({ ...prev, level: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">اختر المستوى</option>
                      {getUniqueLevels().map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      القسم *
                    </label>
                    <select
                      value={newQuiz.section}
                      onChange={(e) => setNewQuiz(prev => ({ ...prev, section: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">اختر القسم</option>
                      {getUniqueSections().map(section => (
                        <option key={section} value={section}>{section}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      عدد الأسئلة *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newQuiz.totalQuestions}
                      onChange={(e) => setNewQuiz(prev => ({ ...prev, totalQuestions: parseInt(e.target.value) || 20 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      النقطة العظمى *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newQuiz.maxScore}
                      onChange={(e) => setNewQuiz(prev => ({ ...prev, maxScore: parseInt(e.target.value) || 20 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* تاريخ الرائز */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    تاريخ الرائز *
                  </label>
                  <input
                    type="date"
                    value={newQuiz.date}
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* أزرار التحكم */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleCreateQuiz}
                    disabled={!newQuiz.title || !newQuiz.subject || !newQuiz.level || !newQuiz.section}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    إنشاء الرائز
                  </button>
                  <button
                    onClick={() => setShowCreateQuiz(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* مودال تحرير الرائز */}
        {selectedQuiz && activeTab === 'overview' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">تحرير الرائز: {selectedQuiz.title}</h2>
                <button
                  onClick={() => setSelectedQuiz(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* معلومات أساسية */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">المعلومات الأساسية</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">العنوان:</span>
                      <div className="text-gray-900">{selectedQuiz.title}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">المادة:</span>
                      <div className="text-gray-900">{selectedQuiz.subject}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">عدد الأسئلة:</span>
                      <div className="text-gray-900">{selectedQuiz.totalQuestions}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">النقطة العظمى:</span>
                      <div className="text-gray-900">{selectedQuiz.maxScore}</div>
                    </div>
                  </div>
                </div>

                {/* تحرير النقط المخصصة لكل سؤال */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-green-900">النقط المخصصة لكل سؤال</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const updatedQuiz = {
                            ...selectedQuiz,
                            questionPoints: Array(selectedQuiz.totalQuestions).fill(1),
                            maxScore: selectedQuiz.totalQuestions * 1,
                            updatedAt: new Date().toISOString()
                          };
                          const updatedQuizzes = quizzes.map(q => q.id === selectedQuiz.id ? updatedQuiz : q);
                          setQuizzes(updatedQuizzes);
                          saveQuizzes(updatedQuizzes);
                          setSelectedQuiz(updatedQuiz);
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        1 نقطة للكل
                      </button>
                      <button
                        onClick={() => {
                          const updatedQuiz = {
                            ...selectedQuiz,
                            questionPoints: Array(selectedQuiz.totalQuestions).fill(0.5),
                            maxScore: selectedQuiz.totalQuestions * 0.5,
                            updatedAt: new Date().toISOString()
                          };
                          const updatedQuizzes = quizzes.map(q => q.id === selectedQuiz.id ? updatedQuiz : q);
                          setQuizzes(updatedQuizzes);
                          saveQuizzes(updatedQuizzes);
                          setSelectedQuiz(updatedQuiz);
                        }}
                        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                      >
                        0.5 نقطة للكل
                      </button>
                      <button
                        onClick={() => {
                          const updatedQuiz = {
                            ...selectedQuiz,
                            questionPoints: Array(selectedQuiz.totalQuestions).fill(2),
                            maxScore: selectedQuiz.totalQuestions * 2,
                            updatedAt: new Date().toISOString()
                          };
                          const updatedQuizzes = quizzes.map(q => q.id === selectedQuiz.id ? updatedQuiz : q);
                          setQuizzes(updatedQuizzes);
                          saveQuizzes(updatedQuizzes);
                          setSelectedQuiz(updatedQuiz);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        2 نقطة للكل
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
                    {Array.from({ length: selectedQuiz.totalQuestions }, (_, index) => (
                      <div key={index} className="text-center bg-white p-2 rounded border">
                        <div className="text-xs text-gray-600 mb-1">س{index + 1}</div>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={selectedQuiz.questionPoints?.[index] || 1}
                          onChange={(e) => {
                            const newPoints = [...(selectedQuiz.questionPoints || Array(selectedQuiz.totalQuestions).fill(1))];
                            newPoints[index] = parseFloat(e.target.value) || 0;
                            const newMaxScore = newPoints.reduce((sum, point) => sum + point, 0);
                            
                            const updatedQuiz = {
                              ...selectedQuiz,
                              questionPoints: newPoints,
                              maxScore: newMaxScore,
                              updatedAt: new Date().toISOString()
                            };
                            
                            const updatedQuizzes = quizzes.map(q => q.id === selectedQuiz.id ? updatedQuiz : q);
                            setQuizzes(updatedQuizzes);
                            saveQuizzes(updatedQuizzes);
                            setSelectedQuiz(updatedQuiz);
                          }}
                          className="w-full text-center text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 text-center">
                    <span className="text-lg font-bold text-green-800">
                      المجموع: {selectedQuiz.maxScore} نقطة
                    </span>
                  </div>
                </div>

                {/* تحرير الإجابات الصحيحة */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-blue-900">الإجابات الصحيحة</h3>
                    <div className="text-sm text-blue-700">
                      <strong>مهم:</strong> يجب تحديد الإجابات الصحيحة لكل سؤال قبل المسح
                    </div>
                    <div className="flex gap-2">
                      {['A', 'B', 'C', 'D'].map(option => (
                        <button
                          key={option}
                          onClick={() => {
                            const updatedQuiz = {
                              ...selectedQuiz,
                              correctAnswers: Array(selectedQuiz.totalQuestions).fill(option),
                              updatedAt: new Date().toISOString()
                            };
                            const updatedQuizzes = quizzes.map(q => q.id === selectedQuiz.id ? updatedQuiz : q);
                            setQuizzes(updatedQuizzes);
                            saveQuizzes(updatedQuizzes);
                            setSelectedQuiz(updatedQuiz);
                          }}
                          className={`px-3 py-1 rounded text-sm font-bold transition-colors duration-200 ${
                            option === 'A' ? 'bg-green-600 text-white hover:bg-green-700' :
                            option === 'B' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                            option === 'C' ? 'bg-purple-600 text-white hover:bg-purple-700' :
                            'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          {option} للكل
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        تأكد من تحديد الإجابة الصحيحة لكل سؤال. بدون مفتاح التصحيح، لن يتم حساب النقط بشكل صحيح.
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
                    {Array.from({ length: selectedQuiz.totalQuestions }, (_, index) => (
                      <div key={index} className="text-center bg-white p-2 rounded border">
                        <div className="text-xs text-gray-600 mb-1">س{index + 1}</div>
                        <select
                          value={selectedQuiz.correctAnswers?.[index] || 'A'}
                          onChange={(e) => {
                            const newAnswers = [...(selectedQuiz.correctAnswers || Array(selectedQuiz.totalQuestions).fill('A'))];
                            newAnswers[index] = e.target.value;
                            
                            const updatedQuiz = {
                              ...selectedQuiz,
                              correctAnswers: newAnswers,
                              updatedAt: new Date().toISOString()
                            };
                            
                            const updatedQuizzes = quizzes.map(q => q.id === selectedQuiz.id ? updatedQuiz : q);
                            setQuizzes(updatedQuizzes);
                            saveQuizzes(updatedQuizzes);
                            setSelectedQuiz(updatedQuiz);
                          }}
                          className={`w-full text-center text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-bold ${
                            (selectedQuiz.correctAnswers?.[index] || 'A') === 'A' ? 'text-green-600' :
                            (selectedQuiz.correctAnswers?.[index] || 'A') === 'B' ? 'text-blue-600' :
                            (selectedQuiz.correctAnswers?.[index] || 'A') === 'C' ? 'text-purple-600' :
                            'text-red-600'
                          }`}
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 text-center">
                    <div className="text-sm text-blue-700">
                      <strong>إجمالي الإجابات المحددة:</strong> {
                        selectedQuiz.correctAnswers ? 
                        selectedQuiz.correctAnswers.filter(a => a && a !== '').length : 0
                      } من {selectedQuiz.totalQuestions}
                    </div>
                    {(!selectedQuiz.correctAnswers || selectedQuiz.correctAnswers.filter(a => a && a !== '').length < selectedQuiz.totalQuestions) && (
                      <div className="text-red-600 text-sm mt-1">
                        ⚠️ يجب تحديد إجابة صحيحة لكل سؤال
                      </div>
                    )}
                  </div>
                </div>

                {/* أزرار الإجراءات */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => {
                      setActiveTab('templates');
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    توليد نماذج PDF
                  </button>
                  <button
                    onClick={() => setSelectedQuiz(null)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizManagement;