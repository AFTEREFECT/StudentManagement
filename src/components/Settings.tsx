import React, { useState, useEffect } from 'react';
import { Download, Upload, Database, Trash2, AlertTriangle, CheckCircle, FileSpreadsheet, Settings as SettingsIcon, Target, RotateCcw, Image } from 'lucide-react';
import { dbManager } from '../utils/database';
import ImportSettings from './ExcelImportSettings';
import LogoManagement from './LogoManagement';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [activeSection, setActiveSection] = useState('database');
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string>('');
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  // عرض رسالة للمستخدم
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  // تحميل السنوات الدراسية
  const loadAcademicYears = async () => {
    try {
      const years = await dbManager.getAcademicYears();
      setAcademicYears(years);
      
      const currentYear = await dbManager.getCurrentAcademicYear();
      setCurrentAcademicYear(currentYear);
    } catch (error) {
      console.error('خطأ في تحميل السنوات الدراسية:', error);
    }
  };

  // تحديث السنة الدراسية الحالية
  const handleUpdateCurrentAcademicYear = async (year: string) => {
    try {
      await dbManager.setCurrentAcademicYear(year);
      setCurrentAcademicYear(year);
      showMessage('تم تحديث السنة الدراسية الحالية بنجاح!', 'success');
    } catch (error) {
      console.error('خطأ في تحديث السنة الدراسية:', error);
      showMessage('خطأ في تحديث السنة الدراسية', 'error');
    }
  };

  useEffect(() => {
    loadAcademicYears();
  }, []);

  // تصدير قاعدة البيانات
  const handleExportDatabase = async () => {
    try {
      setLoading(true);
      const data = await dbManager.exportData();
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `نسخة_احتياطية_${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('تم تصدير قاعدة البيانات بنجاح!', 'success');
    } catch (error) {
      console.error('خطأ في التصدير:', error);
      showMessage('خطأ في تصدير قاعدة البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  // استيراد قاعدة البيانات
  const handleImportDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      await dbManager.importData(data);
      showMessage('تم استيراد قاعدة البيانات بنجاح!', 'success');
      // إعادة تحميل الصفحة لتحديث البيانات
      window.location.reload();
    } catch (error) {
      console.error('خطأ في الاستيراد:', error);
      showMessage('خطأ في استيراد قاعدة البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  // مسح قاعدة البيانات
  const handleClearDatabase = async () => {
    const confirmed = confirm(
      'هل أنت متأكد من مسح جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه. يُنصح بعمل نسخة احتياطية أولاً.'
    );
    
    if (!confirmed) return;

    try {
      setLoading(true);
      try {
        await dbManager.clearDatabase();
      } catch (error) {
        // تجاهل خطأ "no such table: guidance_statistics"
        if (error instanceof Error && !error.message.includes('no such table: guidance_statistics')) {
          throw error; // إعادة رمي الأخطاء الأخرى
        }
        console.warn('تم تجاهل خطأ: جدول guidance_statistics غير موجود');
      }
      showMessage('تم مسح قاعدة البيانات بنجاح!', 'success');
      // إعادة تحميل الصفحة لتحديث البيانات
      window.location.reload();
    } catch (error) {
      console.error('خطأ في المسح:', error);
      showMessage('خطأ في مسح قاعدة البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  // تفريغ جدول التوجيه
  const handleClearGuidanceTable = async () => {
    const confirmed = confirm(
      'هل أنت متأكد من تفريغ جدول إحصائيات التوجيه؟ سيتم حذف جميع بيانات التوجيه المحفوظة.'
    );
    
    if (!confirmed) return;

    try {
      setLoading(true);
      try {
        await dbManager.clearGuidanceStatistics();
        showMessage('تم تفريغ جدول التوجيه بنجاح!', 'success');
      } catch (error) {
        // تجاهل خطأ "no such table: guidance_statistics"
        if (error instanceof Error && error.message.includes('no such table: guidance_statistics')) {
          showMessage('جدول التوجيه غير موجود أو فارغ بالفعل', 'success');
        } else {
          throw error; // إعادة رمي الأخطاء الأخرى
        }
      }
    } catch (error) {
      console.error('خطأ في تفريغ جدول التوجيه:', error);
      showMessage('خطأ في تفريغ جدول التوجيه', 'error');
    } finally {
      setLoading(false);
    }
  };

  // إعادة تهيئة جدول التوجيه
  const handleResetGuidanceTable = async () => {
    const confirmed = confirm(
      'هل أنت متأكد من إعادة تهيئة جدول التوجيه؟ سيتم حذف الجدول الحالي وإنشاء جدول جديد فارغ بالهيكل المحدث مع العمودين desired_stream و assigned_stream.'
    );
    
    if (!confirmed) return;

    try {
      setLoading(true);
      await dbManager.resetGuidanceStatistics();
      showMessage('تم إعادة تهيئة جدول التوجيه بنجاح مع الهيكل المحدث (desired_stream + assigned_stream)!', 'success');
    } catch (error) {
      console.error('خطأ في إعادة تهيئة جدول التوجيه:', error);
      showMessage('خطأ في إعادة تهيئة جدول التوجيه', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* عنوان الصفحة */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">الإعدادات</h1>
        <p className="text-gray-600">إدارة إعدادات نظام إدارة الطلاب</p>
      </div>

      {/* قائمة الأقسام */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => setActiveSection('database')}
          className={`p-4 rounded-lg text-right transition-colors duration-200 ${
            activeSection === 'database' 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">إدارة قاعدة البيانات</h3>
              <p className="text-sm opacity-75">تصدير واستيراد ومسح البيانات</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('guidance')}
          className={`p-4 rounded-lg text-right transition-colors duration-200 ${
            activeSection === 'guidance' 
              ? 'bg-purple-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-red-50 border border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">إدارة التوجيه</h3>
              <p className="text-sm opacity-75">تفريغ وإعادة تهيئة جدول التوجيه</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('academic')}
          className={`p-4 rounded-lg text-right transition-colors duration-200 ${
            activeSection === 'academic' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">السنة الدراسية</h3>
              <p className="text-sm opacity-75">إدارة السنة الدراسية الحالية</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('logo')}
          className={`p-4 rounded-lg text-right transition-colors duration-200 ${
            activeSection === 'logo' 
              ? 'bg-red-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-red-50 border border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Image className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">إدارة الشعار</h3>
              <p className="text-sm opacity-75">رفع وتخصيص شعار الوزارة</p>
            </div>
          </div>
        </button> 

        <button
          onClick={() => setActiveSection('excel')}
          className={`p-4 rounded-lg text-right transition-colors duration-200 ${
            activeSection === 'excel' 
              ? 'bg-green-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">إعدادات استيراد Excel</h3>
              <p className="text-sm opacity-75">تخصيص نقاط بداية الاستيراد</p>
            </div>
          </div>
        </button>
      </div>

      {/* عرض الرسائل */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
          messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {messageType === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {message}
        </div>
      )}

      {/* محتوى الإعدادات */}
      {activeSection === 'database' && (
        <div>
          {/* إدارة قاعدة البيانات */}
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              إدارة قاعدة البيانات
            </h2>
            
            <div className="space-y-4">
              {/* تصدير قاعدة البيانات */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">تصدير قاعدة البيانات</h3>
                <p className="text-sm text-blue-700 mb-3">
                  إنشاء نسخة احتياطية من قاعدة البيانات الكاملة تشمل جميع الطلاب وسجلات الحضور والدرجات.
                </p>
                <button
                  onClick={handleExportDatabase}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <Download className="w-4 h-4" />
                  {loading ? 'جاري التصدير...' : 'تصدير قاعدة البيانات'}
                </button>
              </div>

              {/* استيراد قاعدة البيانات */}
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2">استيراد قاعدة البيانات</h3>
                <p className="text-sm text-green-700 mb-3">
                  استعادة نسخة احتياطية من قاعدة البيانات. سيتم استبدال جميع البيانات الحالية.
                </p>
                <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors duration-200">
                  <Upload className="w-4 h-4" />
                  {loading ? 'جاري الاستيراد...' : 'استيراد قاعدة البيانات'}
                  <input
                    type="file"
                    accept=".db"
                    onChange={handleImportDatabase}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
              </div>

              {/* مسح قاعدة البيانات */}
              <div className="p-4 bg-red-50 rounded-lg">
                <h3 className="font-medium text-red-900 mb-2">مسح قاعدة البيانات</h3>
                <p className="text-sm text-red-700 mb-3">
                  حذف جميع البيانات من قاعدة البيانات. هذا الإجراء لا يمكن التراجع عنه.
                </p>
                <button
                  onClick={handleClearDatabase}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                  {loading ? 'جاري المسح...' : 'مسح قاعدة البيانات'}
                </button>
              </div>
            </div>
          </div>

          {/* معلومات النظام */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">معلومات النظام</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">إصدار التطبيق</h3>
                <p className="text-sm text-gray-600">الإصدار 1.0.0</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">محرك قاعدة البيانات</h3>
                <p className="text-sm text-gray-600">SQLite (sql.js)</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">موقع التخزين</h3>
                <p className="text-sm text-gray-600">التخزين المحلي للمتصفح</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">أمان البيانات</h3>
                <p className="text-sm text-gray-600">محلي فقط - لا توجد خوادم خارجية</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'guidance' && (
        <div>
          {/* إدارة التوجيه */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              إدارة إحصائيات التوجيه
            </h2>
            
            <div className="space-y-4">
              {/* تفريغ جدول التوجيه */}
              <div className="p-4 bg-orange-50 rounded-lg">
                <h3 className="font-medium text-orange-900 mb-2">تفريغ جدول التوجيه</h3>
                <p className="text-sm text-orange-700 mb-3">
                  حذف جميع بيانات إحصائيات التوجيه المحفوظة مع الاحتفاظ ببنية الجدول.
                </p>
                <button
                  onClick={handleClearGuidanceTable}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                  {loading ? 'جاري التفريغ...' : 'تفريغ جدول التوجيه'}
                </button>
              </div>

              {/* إعادة تهيئة جدول التوجيه */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-medium text-purple-900 mb-2">إعادة تهيئة جدول التوجيه</h3>
                <p className="text-sm text-purple-700 mb-3">
                  حذف الجدول الحالي وإنشاء جدول جديد فارغ بالهيكل المحدث مع جميع الأعمدة المطلوبة.
                </p>
                <button
                  onClick={handleResetGuidanceTable}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <RotateCcw className="w-4 h-4" />
                  {loading ? 'جاري إعادة التهيئة...' : 'إعادة تهيئة الجدول'}
                </button>
              </div>

              {/* معلومات إضافية */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">معلومات مهمة</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>• تفريغ الجدول يحذف البيانات فقط ويحتفظ ببنية الجدول</p>
                  <p>• إعادة التهيئة تحذف الجدول كاملاً وتنشئه من جديد بالهيكل المحدث</p>
                  <p>• يُنصح بعمل نسخة احتياطية قبل تنفيذ أي من هذه العمليات</p>
                  <p>• هذه العمليات لا تؤثر على بيانات التلاميذ الأساسية</p>
                  <p>• الهيكل المحدث يتضمن جميع الأعمدة المطلوبة: assigned_stream, gender, decision, إلخ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'academic' && (
        <div>
          {/* إدارة السنة الدراسية */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              إدارة السنة الدراسية الحالية
            </h2>
            
            <div className="space-y-6">
              {/* السنة الدراسية الحالية */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-3">السنة الدراسية الحالية</h3>
                <div className="flex items-center gap-4">
                  <select
                    value={currentAcademicYear}
                    onChange={(e) => handleUpdateCurrentAcademicYear(e.target.value)}
                    disabled={loading}
                    className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
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
                  
                  <div className="text-sm text-blue-700">
                    <p>السنة المحددة حالياً: <strong>{currentAcademicYear}</strong></p>
                    <p>ستُستخدم في جميع الإحصائيات والتقارير</p>
                  </div>
                </div>
                
                {/* تأثير تغيير السنة الدراسية */}
                <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">تأثير تغيير السنة الدراسية:</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• <strong>لوحة التحكم:</strong> ستعرض إحصائيات السنة المحددة فقط</p>
                    <p>• <strong>البنية التربوية:</strong> ستحسب الإحصائيات للسنة المحددة</p>
                    <p>• <strong>التقارير:</strong> ستُولد للسنة المحددة</p>
                    <p>• <strong>الاستيراد:</strong> سيتم ربط البيانات الجديدة بالسنة المحددة</p>
                    <p>• <strong>التوجيه:</strong> ستعرض بيانات التوجيه للسنة المحددة</p>
                  </div>
                </div>
              </div>

              {/* معلومات إضافية */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">معلومات مهمة</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>• <strong>الإحصائيات المتمدرسين:</strong> تشمل الوافدين والمدمجين</p>
                  <p>• <strong>الإحصائيات المنفصلة:</strong> المغادرون والمفصولون وغير الملتحقين منفصلون عن المتمدرسين</p>
                  <p>• <strong>تحديث تلقائي:</strong> عند تغيير السنة، تتحدث جميع الإحصائيات فوراً</p>
                  <p>• <strong>ربط البيانات:</strong> يتم ربط كل تلميذ بمستواه وقسمه تلقائياً</p>
                  <p>• <strong>منع التكرار:</strong> لا يتم تكرار الاستيراد لنفس السنة</p>
                </div>
              </div>

              {/* إحصائيات السنوات */}
              {academicYears.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-medium text-green-900 mb-3">السنوات الدراسية المتاحة</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {academicYears.map(year => (
                      <div key={year.id} className={`p-3 rounded-lg border ${
                        year.isActive ? 'bg-green-100 border-green-300' : 'bg-white border-gray-200'
                      }`}>
                        <div className="font-medium text-gray-900">{year.year}</div>
                        <div className="text-sm text-gray-600">
                          {year.isActive ? '✅ نشطة' : '⚪ غير نشطة'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* إرشادات الاستخدام */}
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <h3 className="font-medium text-indigo-900 mb-3">إرشادات الاستخدام</h3>
                <div className="text-sm text-indigo-800 space-y-2">
                  <p><strong>1. تحديد السنة الدراسية:</strong> اختر السنة الدراسية التي تريد العمل عليها</p>
                  <p><strong>2. استيراد البيانات:</strong> عند استيراد أي بيانات، ستُربط تلقائياً بالسنة المحددة</p>
                  <p><strong>3. عرض الإحصائيات:</strong> جميع الإحصائيات ستعرض للسنة المحددة فقط</p>
                  <p><strong>4. تجنب التكرار:</strong> النظام يمنع تكرار الاستيراد لنفس السنة</p>
                  <p><strong>5. ربط المستويات والأقسام:</strong> يتم استخراج هذه البيانات من الخلايا العلوية في ملفات Excel</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'excel' && (
        <div>
          <ImportSettings />
        </div>
      )}

      {activeSection === 'logo' && (
        <div>
          <LogoManagement />
        </div>
      )}

    </div>
  );
};

export default Settings;