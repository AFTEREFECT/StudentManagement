import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Camera, FileImage, Scan, AlertCircle, CheckCircle, Info, Eye, EyeOff } from 'lucide-react';

interface QuizSettings {
  scanning: {
    ocrLanguage: string;
    confidenceThreshold: number;
    autoSave: boolean;
    enablePreview: boolean;
  };
  grading: {
    passingGrade: number;
    gradingScale: 'percentage' | 'points';
    roundingMethod: 'round' | 'floor' | 'ceil';
    showDetailedResults: boolean;
  };
  display: {
    resultsPerPage: number;
    defaultSortBy: 'name' | 'score' | 'date';
    defaultSortOrder: 'asc' | 'desc';
    showStudentPhotos: boolean;
  };
  export: {
    includeAnswers: boolean;
    includeStatistics: boolean;
    defaultFormat: 'csv' | 'pdf' | 'excel';
    includeCharts: boolean;
  };
}

const DEFAULT_SETTINGS: QuizSettings = {
  scanning: {
    ocrLanguage: 'ara+eng',
    confidenceThreshold: 80,
    autoSave: false,
    enablePreview: true
  },
  grading: {
    passingGrade: 60,
    gradingScale: 'percentage',
    roundingMethod: 'round',
    showDetailedResults: true
  },
  display: {
    resultsPerPage: 50,
    defaultSortBy: 'score',
    defaultSortOrder: 'desc',
    showStudentPhotos: false
  },
  export: {
    includeAnswers: true,
    includeStatistics: true,
    defaultFormat: 'pdf',
    includeCharts: false
  }
};

const QuizSettings: React.FC = () => {
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('scanning');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    loadSettings();
  }, []);

  // تحميل الإعدادات من التخزين المحلي
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('quizSettings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
      }
    } catch (error) {
      console.error('خطأ في تحميل الإعدادات:', error);
      showMessage('خطأ في تحميل الإعدادات', 'error');
    }
  };

  // حفظ الإعدادات
  const saveSettings = () => {
    try {
      localStorage.setItem('quizSettings', JSON.stringify(settings));
      showMessage('تم حفظ الإعدادات بنجاح!', 'success');
    } catch (error) {
      console.error('خطأ في حفظ الإعدادات:', error);
      showMessage('خطأ في حفظ الإعدادات', 'error');
    }
  };

  // إعادة تعيين الإعدادات
  const resetSettings = () => {
    if (confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات للقيم الافتراضية؟')) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem('quizSettings');
      showMessage('تم إعادة تعيين الإعدادات للقيم الافتراضية', 'success');
    }
  };

  // عرض رسالة للمستخدم
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  // تحديث إعدادات المسح
  const updateScanningSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      scanning: {
        ...prev.scanning,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات التقييم
  const updateGradingSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      grading: {
        ...prev.grading,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات العرض
  const updateDisplaySettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      display: {
        ...prev.display,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات التصدير
  const updateExportSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      export: {
        ...prev.export,
        [key]: value
      }
    }));
  };

  // أقسام الإعدادات
  const settingsTabs = [
    { id: 'scanning', label: 'المسح الضوئي', icon: Scan, color: 'blue' },
    { id: 'grading', label: 'التقييم', icon: CheckCircle, color: 'green' },
    { id: 'display', label: 'العرض', icon: Eye, color: 'purple' },
    { id: 'export', label: 'التصدير', icon: FileImage, color: 'orange' }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">إعدادات نظام الروائز</h2>
            <p className="text-gray-600">تخصيص إعدادات المسح والتقييم والعرض</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={saveSettings}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Save className="w-4 h-4" />
            حفظ الإعدادات
          </button>
          
          <button
            onClick={resetSettings}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            <RotateCcw className="w-4 h-4" />
            إعادة تعيين
          </button>
        </div>
      </div>

      {/* عرض الرسائل */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
          messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {messageType === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message}
        </div>
      )}

      {/* قائمة الأقسام */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {settingsTabs.map((tab) => {
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

      {/* محتوى الإعدادات */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* إعدادات المسح الضوئي */}
        {activeTab === 'scanning' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Scan className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">إعدادات المسح الضوئي</h3>
                <p className="text-gray-600">تخصيص خيارات المسح الضوئي وقراءة النصوص</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  لغة المسح الضوئي
                </label>
                <select
                  value={settings.scanning.ocrLanguage}
                  onChange={(e) => updateScanningSettings('ocrLanguage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ara">العربية فقط</option>
                  <option value="eng">الإنجليزية فقط</option>
                  <option value="ara+eng">العربية والإنجليزية</option>
                  <option value="fra">الفرنسية</option>
                  <option value="ara+fra">العربية والفرنسية</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد الثقة في المسح ({settings.scanning.confidenceThreshold}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={settings.scanning.confidenceThreshold}
                  onChange={(e) => updateScanningSettings('confidenceThreshold', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.scanning.autoSave}
                    onChange={(e) => updateScanningSettings('autoSave', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">الحفظ التلقائي للنتائج</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.scanning.enablePreview}
                    onChange={(e) => updateScanningSettings('enablePreview', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">إظهار معاينة النتائج قبل الحفظ</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* إعدادات التقييم */}
        {activeTab === 'grading' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">إعدادات التقييم</h3>
                <p className="text-gray-600">تخصيص معايير التقييم والدرجات</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  درجة النجاح ({settings.grading.passingGrade}%)
                </label>
                <input
                  type="range"
                  min="40"
                  max="80"
                  value={settings.grading.passingGrade}
                  onChange={(e) => updateGradingSettings('passingGrade', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>40%</span>
                  <span>60%</span>
                  <span>80%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نظام التقييم
                </label>
                <select
                  value={settings.grading.gradingScale}
                  onChange={(e) => updateGradingSettings('gradingScale', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="percentage">نسبة مئوية</option>
                  <option value="points">نقاط</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  طريقة التقريب
                </label>
                <select
                  value={settings.grading.roundingMethod}
                  onChange={(e) => updateGradingSettings('roundingMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="round">تقريب عادي</option>
                  <option value="floor">تقريب لأسفل</option>
                  <option value="ceil">تقريب لأعلى</option>
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.grading.showDetailedResults}
                    onChange={(e) => updateGradingSettings('showDetailedResults', e.target.checked)}
                    className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">إظهار النتائج التفصيلية</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* إعدادات العرض */}
        {activeTab === 'display' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">إعدادات العرض</h3>
                <p className="text-gray-600">تخصيص طريقة عرض النتائج والواجهة</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  عدد النتائج في الصفحة
                </label>
                <select
                  value={settings.display.resultsPerPage}
                  onChange={(e) => updateDisplaySettings('resultsPerPage', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={25}>25 نتيجة</option>
                  <option value={50}>50 نتيجة</option>
                  <option value={100}>100 نتيجة</option>
                  <option value={200}>200 نتيجة</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الترتيب الافتراضي
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={settings.display.defaultSortBy}
                    onChange={(e) => updateDisplaySettings('defaultSortBy', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="score">النقطة</option>
                    <option value="name">الاسم</option>
                    <option value="date">التاريخ</option>
                  </select>
                  
                  <select
                    value={settings.display.defaultSortOrder}
                    onChange={(e) => updateDisplaySettings('defaultSortOrder', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="desc">تنازلي</option>
                    <option value="asc">تصاعدي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.display.showStudentPhotos}
                    onChange={(e) => updateDisplaySettings('showStudentPhotos', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">إظهار صور التلاميذ (إذا كانت متاحة)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* إعدادات التصدير */}
        {activeTab === 'export' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <FileImage className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">إعدادات التصدير</h3>
                <p className="text-gray-600">تخصيص خيارات تصدير النتائج والتقارير</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تنسيق التصدير الافتراضي
                </label>
                <select
                  value={settings.export.defaultFormat}
                  onChange={(e) => updateExportSettings('defaultFormat', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.export.includeAnswers}
                    onChange={(e) => updateExportSettings('includeAnswers', e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">تضمين الإجابات التفصيلية</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.export.includeStatistics}
                    onChange={(e) => updateExportSettings('includeStatistics', e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">تضمين الإحصائيات</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.export.includeCharts}
                    onChange={(e) => updateExportSettings('includeCharts', e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">تضمين المبيانات والرسوم البيانية</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* معاينة الإعدادات */}
      <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">معاينة الإعدادات الحالية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <p><strong className="text-blue-800">لغة المسح:</strong> <span className="text-gray-700">{settings.scanning.ocrLanguage}</span></p>
            <p><strong className="text-blue-800">حد الثقة:</strong> <span className="text-gray-700">{settings.scanning.confidenceThreshold}%</span></p>
            <p><strong className="text-blue-800">درجة النجاح:</strong> <span className="text-gray-700">{settings.grading.passingGrade}%</span></p>
            <p><strong className="text-blue-800">نظام التقييم:</strong> <span className="text-gray-700">{settings.grading.gradingScale === 'percentage' ? 'نسبة مئوية' : 'نقاط'}</span></p>
          </div>
          <div className="space-y-2">
            <p><strong className="text-blue-800">النتائج في الصفحة:</strong> <span className="text-gray-700">{settings.display.resultsPerPage}</span></p>
            <p><strong className="text-blue-800">الترتيب الافتراضي:</strong> <span className="text-gray-700">{settings.display.defaultSortBy} ({settings.display.defaultSortOrder === 'desc' ? 'تنازلي' : 'تصاعدي'})</span></p>
            <p><strong className="text-blue-800">تنسيق التصدير:</strong> <span className="text-gray-700">{settings.export.defaultFormat.toUpperCase()}</span></p>
            <p><strong className="text-blue-800">الحفظ التلقائي:</strong> <span className="text-gray-700">{settings.scanning.autoSave ? 'مفعل' : 'معطل'}</span></p>
          </div>
        </div>
      </div>

      {/* معلومات إضافية */}
      <div className="mt-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ملاحظات مهمة</h3>
        <div className="space-y-2 text-gray-800">
          <p>• <strong>المسح الضوئي:</strong> يتطلب اتصال بالإنترنت لتحميل مكتبة Tesseract</p>
          <p>• <strong>جودة الصورة:</strong> للحصول على أفضل النتائج، استخدم صور عالية الجودة ومضاءة جيداً</p>
          <p>• <strong>تنسيق الأوراق:</strong> تأكد من وضوح الرقم الوطني والإجابات في الورقة</p>
          <p>• <strong>التحقق اليدوي:</strong> راجع النتائج دائماً قبل الحفظ النهائي</p>
          <p>• <strong>النسخ الاحتياطية:</strong> يتم حفظ الإعدادات محلياً في المتصفح</p>
        </div>
      </div>
    </div>
  );
};

export default QuizSettings;