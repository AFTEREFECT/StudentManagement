import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, CheckCircle, Download, Eye, Filter, Search, Calendar, Users, BarChart3, Archive, RefreshCw, X } from 'lucide-react';

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

interface Quiz {
  id: string;
  title: string;
  subject: string;
  level: string;
  section: string;
  totalQuestions: number;
  maxScore: number;
}

interface DeletedResult {
  result: QuizResult;
  deletedAt: string;
  reason: string;
}

interface QuizResultsManagerProps {
  quizzes: Quiz[];
  quizResults: QuizResult[];
  onResultUpdate: (results: QuizResult[]) => void;
}

const QuizResultsManager: React.FC<QuizResultsManagerProps> = ({ 
  quizzes, 
  quizResults, 
  onResultUpdate 
}) => {
  const [selectedQuiz, setSelectedQuiz] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResults, setFilteredResults] = useState<QuizResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'single' | 'multiple' | 'all'>('single');
  const [deleteReason, setDeleteReason] = useState('');
  const [deletedResults, setDeletedResults] = useState<DeletedResult[]>([]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'date'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    filterResults();
    loadDeletedResults();
  }, [quizResults, selectedQuiz, searchTerm, sortBy, sortOrder]);

  // تحميل النتائج المحذوفة من التخزين المحلي
  const loadDeletedResults = () => {
    try {
      const saved = localStorage.getItem('deletedQuizResults');
      if (saved) {
        setDeletedResults(JSON.parse(saved));
      }
    } catch (error) {
      console.error('خطأ في تحميل النتائج المحذوفة:', error);
    }
  };

  // حفظ النتائج المحذوفة
  const saveDeletedResults = (deleted: DeletedResult[]) => {
    try {
      localStorage.setItem('deletedQuizResults', JSON.stringify(deleted));
    } catch (error) {
      console.error('خطأ في حفظ النتائج المحذوفة:', error);
    }
  };

  // تصفية النتائج
  const filterResults = () => {
    let filtered = [...quizResults];

    if (selectedQuiz) {
      filtered = filtered.filter(result => result.quizId === selectedQuiz);
    }

    if (searchTerm) {
      filtered = filtered.filter(result =>
        result.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.nationalId.toLowerCase().includes(searchTerm.toLowerCase())
      );
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

  // حذف نتيجة واحدة
  const deleteSingleResult = (resultId: string, reason: string = '') => {
    const resultToDelete = quizResults.find(r => r.id === resultId);
    if (!resultToDelete) return;

    // إضافة إلى سلة المحذوفات
    const deletedResult: DeletedResult = {
      result: resultToDelete,
      deletedAt: new Date().toISOString(),
      reason: reason || 'حذف فردي'
    };

    const updatedDeleted = [...deletedResults, deletedResult];
    setDeletedResults(updatedDeleted);
    saveDeletedResults(updatedDeleted);

    // حذف من النتائج الحالية
    const updatedResults = quizResults.filter(r => r.id !== resultId);
    onResultUpdate(updatedResults);
  };

  // حذف نتائج متعددة
  const deleteMultipleResults = (resultIds: string[], reason: string = '') => {
    const resultsToDelete = quizResults.filter(r => resultIds.includes(r.id));
    
    // إضافة إلى سلة المحذوفات
    const deletedBatch: DeletedResult[] = resultsToDelete.map(result => ({
      result,
      deletedAt: new Date().toISOString(),
      reason: reason || 'حذف متعدد'
    }));

    const updatedDeleted = [...deletedResults, ...deletedBatch];
    setDeletedResults(updatedDeleted);
    saveDeletedResults(updatedDeleted);

    // حذف من النتائج الحالية
    const updatedResults = quizResults.filter(r => !resultIds.includes(r.id));
    onResultUpdate(updatedResults);
    setSelectedResults(new Set());
  };

  // حذف جميع النتائج
  const deleteAllResults = (reason: string = '') => {
    // إضافة جميع النتائج إلى سلة المحذوفات
    const deletedBatch: DeletedResult[] = quizResults.map(result => ({
      result,
      deletedAt: new Date().toISOString(),
      reason: reason || 'حذف شامل'
    }));

    const updatedDeleted = [...deletedResults, ...deletedBatch];
    setDeletedResults(updatedDeleted);
    saveDeletedResults(updatedDeleted);

    // مسح جميع النتائج
    onResultUpdate([]);
  };

  // استرداد نتيجة محذوفة
  const restoreResult = (deletedIndex: number) => {
    const deletedResult = deletedResults[deletedIndex];
    if (!deletedResult) return;

    // إضافة النتيجة مرة أخرى
    const updatedResults = [...quizResults, deletedResult.result];
    onResultUpdate(updatedResults);

    // إزالة من سلة المحذوفات
    const updatedDeleted = deletedResults.filter((_, index) => index !== deletedIndex);
    setDeletedResults(updatedDeleted);
    saveDeletedResults(updatedDeleted);
  };

  // مسح سلة المحذوفات نهائياً
  const emptyRecycleBin = () => {
    if (confirm('هل أنت متأكد من حذف جميع النتائج المحذوفة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) {
      setDeletedResults([]);
      localStorage.removeItem('deletedQuizResults');
    }
  };

  // فتح مودال الحذف
  const openDeleteModal = (type: 'single' | 'multiple' | 'all', resultId?: string) => {
    setDeleteType(type);
    setDeleteReason('');
    setShowDeleteModal(true);
    
    if (type === 'single' && resultId) {
      setSelectedResults(new Set([resultId]));
    }
  };

  // تنفيذ الحذف
  const executeDelete = () => {
    switch (deleteType) {
      case 'single':
        const singleId = Array.from(selectedResults)[0];
        if (singleId) {
          deleteSingleResult(singleId, deleteReason);
        }
        break;
      case 'multiple':
        deleteMultipleResults(Array.from(selectedResults), deleteReason);
        break;
      case 'all':
        deleteAllResults(deleteReason);
        break;
    }
    setShowDeleteModal(false);
    setSelectedResults(new Set());
  };

  // تحديد/إلغاء تحديد نتيجة
  const toggleResultSelection = (resultId: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
    }
    setSelectedResults(newSelected);
  };

  // تحديد/إلغاء تحديد الكل
  const toggleSelectAll = () => {
    if (selectedResults.size === filteredResults.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(filteredResults.map(r => r.id)));
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">إدارة النتائج المتقدمة</h2>
            <p className="text-gray-600">إدارة شاملة لنتائج الروائز مع نظام الاسترداد</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowRecycleBin(!showRecycleBin)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            <Archive className="w-4 h-4" />
            سلة المحذوفات ({deletedResults.length})
          </button>
        </div>
      </div>

      {/* أدوات التحكم */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* اختيار الرائز */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الرائز</label>
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* الترتيب */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الترتيب</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'score' | 'date')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="score">النقطة</option>
              <option value="name">الاسم</option>
              <option value="date">التاريخ</option>
            </select>
          </div>

          {/* اتجاه الترتيب */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الاتجاه</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="desc">تنازلي</option>
              <option value="asc">تصاعدي</option>
            </select>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex flex-col gap-2">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
            >
              {selectedResults.size === filteredResults.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </button>
            
            {selectedResults.size > 0 && (
              <button
                onClick={() => openDeleteModal(selectedResults.size === 1 ? 'single' : 'multiple')}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm"
              >
                حذف المحدد ({selectedResults.size})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{filteredResults.length}</div>
          <div className="text-sm text-blue-800">النتائج المعروضة</div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-600">{selectedResults.size}</div>
          <div className="text-sm text-green-800">النتائج المحددة</div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{deletedResults.length}</div>
          <div className="text-sm text-purple-800">في سلة المحذوفات</div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">
            {filteredResults.length > 0 ? Math.round(filteredResults.reduce((sum, r) => sum + r.percentage, 0) / filteredResults.length) : 0}%
          </div>
          <div className="text-sm text-orange-800">المعدل العام</div>
        </div>
      </div>

      {/* أزرار الإجراءات الرئيسية */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => openDeleteModal('all')}
          disabled={quizResults.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Trash2 className="w-5 h-5" />
          حذف جميع النتائج
        </button>
        
        <button
          onClick={() => openDeleteModal('multiple')}
          disabled={selectedResults.size === 0}
          className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Trash2 className="w-5 h-5" />
          حذف المحدد ({selectedResults.size})
        </button>
      </div>

      {/* جدول النتائج */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">لا توجد نتائج</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right">
                    <input
                      type="checkbox"
                      checked={selectedResults.size === filteredResults.length && filteredResults.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600"
                    />
                  </th>
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
                  <tr 
                    key={result.id} 
                    className={`hover:bg-gray-50 ${selectedResults.has(result.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedResults.has(result.id)}
                        onChange={() => toggleResultSelection(result.id)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                    </td>
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
                      <button
                        onClick={() => openDeleteModal('single', result.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        title="حذف النتيجة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* سلة المحذوفات */}
      {showRecycleBin && (
        <div className="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Archive className="w-5 h-5" />
              سلة المحذوفات ({deletedResults.length})
            </h3>
            
            <button
              onClick={emptyRecycleBin}
              disabled={deletedResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <Trash2 className="w-4 h-4" />
              إفراغ السلة نهائياً
            </button>
          </div>

          {deletedResults.length === 0 ? (
            <div className="text-center py-8">
              <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">سلة المحذوفات فارغة</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {deletedResults.map((deleted, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{deleted.result.studentName}</div>
                    <div className="text-sm text-gray-600">
                      {deleted.result.nationalId} | النقطة: {deleted.result.score} ({deleted.result.percentage}%)
                    </div>
                    <div className="text-xs text-gray-500">
                      حُذف في: {new Date(deleted.deletedAt).toLocaleString('ar-EG')} | السبب: {deleted.reason}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => restoreResult(index)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                  >
                    <RotateCcw className="w-4 h-4" />
                    استرداد
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* مودال تأكيد الحذف */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">تأكيد الحذف</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900">
                    {deleteType === 'all' ? 'حذف جميع النتائج' :
                     deleteType === 'multiple' ? `حذف ${selectedResults.size} نتيجة` :
                     'حذف نتيجة واحدة'}
                  </h3>
                  <p className="text-red-700 text-sm">
                    {deleteType === 'all' ? 'سيتم حذف جميع النتائج' :
                     deleteType === 'multiple' ? 'سيتم حذف النتائج المحددة' :
                     'سيتم حذف النتيجة المحددة'}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  سبب الحذف (اختياري)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="مثال: نتائج خاطئة، إعادة مسح، تصحيح أخطاء..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">إمكانية الاسترداد</span>
                </div>
                <p className="text-blue-800 text-sm">
                  يمكنك استرداد النتائج المحذوفة من "سلة المحذوفات" في أي وقت.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={executeDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                  تأكيد الحذف
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizResultsManager;