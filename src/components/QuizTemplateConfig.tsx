import React, { useState } from 'react';
import { FileText, Download, Settings, Eye, CheckCircle, AlertCircle, Target, Layers } from 'lucide-react';

interface TemplateConfig {
  questionsCount: 10 | 20 | 30 | 40;
  questionsPerRow: 3;
  paperSize: 'A4';
  orientation: 'portrait';
  includeBarcode: boolean;
  templateVersion: string;
}

interface QuizTemplateConfigProps {
  onConfigChange: (config: TemplateConfig) => void;
  currentConfig: TemplateConfig;
}

/**
 * مكون إعدادات قوالب الروائز الثابتة
 * يدير القوالب المختلفة (10، 20، 30، 40 سؤال) بتصميم ثابت
 */
const QuizTemplateConfig: React.FC<QuizTemplateConfigProps> = ({ onConfigChange, currentConfig }) => {
  const [config, setConfig] = useState<TemplateConfig>(currentConfig);

  // القوالب المتاحة
  const availableTemplates = [
    {
      questions: 10,
      name: 'نموذج 10 أسئلة',
      description: 'مناسب للاختبارات القصيرة والتقييمات السريعة',
      layout: '3 أعمدة × 4 صفوف',
      status: 'قريباً',
      color: 'blue'
    },
    {
      questions: 20,
      name: 'نموذج 20 سؤال',
      description: 'النموذج الحالي المحسن - متاح الآن',
      layout: '3 أعمدة × 7 صفوف',
      status: 'متاح',
      color: 'green'
    },
    {
      questions: 30,
      name: 'نموذج 30 سؤال',
      description: 'مناسب للامتحانات المتوسطة',
      layout: '3 أعمدة × 10 صفوف',
      status: 'قريباً',
      color: 'purple'
    },
    {
      questions: 40,
      name: 'نموذج 40 سؤال',
      description: 'مناسب للامتحانات الشاملة والنهائية',
      layout: '3 أعمدة × 14 صف',
      status: 'قريباً',
      color: 'orange'
    }
  ];

  const updateConfig = (updates: Partial<TemplateConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Settings className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">إعدادات القوالب الثابتة</h2>
          <p className="text-gray-600">إدارة قوالب الروائز المختلفة بتصميم ثابت ودقيق</p>
        </div>
      </div>

      {/* القوالب المتاحة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {availableTemplates.map((template) => (
          <div
            key={template.questions}
            className={`border-2 rounded-xl p-6 transition-all duration-200 cursor-pointer ${
              config.questionsCount === template.questions
                ? `border-${template.color}-500 bg-${template.color}-50 shadow-lg`
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => template.status === 'متاح' && updateConfig({ questionsCount: template.questions as 10 | 20 | 30 | 40 })}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  template.status === 'متاح' ? `bg-${template.color}-600` : 'bg-gray-400'
                }`}>
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-600">{template.layout}</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className={`text-3xl font-bold ${
                  template.status === 'متاح' ? `text-${template.color}-600` : 'text-gray-400'
                }`}>
                  {template.questions}
                </div>
                <div className="text-xs text-gray-500">سؤال</div>
              </div>
            </div>

            <p className="text-gray-700 text-sm mb-4">{template.description}</p>

            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                template.status === 'متاح' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {template.status}
              </span>
              
              {config.questionsCount === template.questions && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">محدد</span>
                </div>
              )}
            </div>

            {template.status !== 'متاح' && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">سيتم إضافة هذا النموذج قريباً</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* إعدادات النموذج المحدد */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">إعدادات النموذج المحدد</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                عدد الأسئلة
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                <span className="font-semibold text-gray-900">{config.questionsCount} سؤال</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تخطيط الأسئلة
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                <span className="font-semibold text-gray-900">{config.questionsPerRow} أعمدة</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                حجم الورقة
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                <span className="font-semibold text-gray-900">{config.paperSize}</span>
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.includeBarcode}
                  onChange={(e) => updateConfig({ includeBarcode: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="mr-2 text-sm font-medium text-gray-700">تضمين الباركود</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* مميزات النموذج الثابت */}
      <div className="mt-8 bg-green-50 p-6 rounded-xl border border-green-200">
        <h3 className="text-lg font-semibold text-green-900 mb-4">مميزات النموذج الثابت</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">دقة قراءة عالية جداً</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">مواقع ثابتة للدوائر</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">تصميم محسن للمسح الضوئي</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">باركود QR مدمج</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">نقاط مرجعية للمسح</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">تطابق مع النموذج المرفق</span>
            </div>
          </div>
        </div>
      </div>

      {/* معلومات تقنية */}
      <div className="mt-6 bg-blue-50 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">المعلومات التقنية</h3>
        <div className="space-y-2 text-blue-800 text-sm">
          <p>• <strong>التخطيط:</strong> 3 أعمدة × 7 صفوف للنموذج 20 سؤال</p>
          <p>• <strong>حجم الدوائر:</strong> 14mm قطر مع حدود 3px</p>
          <p>• <strong>المسافات:</strong> 3mm بين الدوائر، 4mm بين الأسئلة</p>
          <p>• <strong>نقاط المرجع:</strong> 4 مربعات سوداء 8×8mm في الزوايا</p>
          <p>• <strong>منطقة الباركود:</strong> محددة بإطار أزرق في الأعلى</p>
          <p>• <strong>خوارزمية القراءة:</strong> تحليل نسبة التظليل داخل كل دائرة</p>
        </div>
      </div>
    </div>
  );
};

export default QuizTemplateConfig;