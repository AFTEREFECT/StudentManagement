import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Eye, EyeOff, Zap, Target, Layers, AlertCircle, CheckCircle, Info, Camera, Scan } from 'lucide-react';

interface ScanMethod {
  id: string;
  name: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  accuracy: number;
  speed: number;
  complexity: number;
  enabled: boolean;
  weight: number;
}

interface AdvancedScanSettings {
  // طرق المسح المتاحة
  methods: {
    traditional: ScanMethod;
    hiddenLetters: ScanMethod;
    hybrid: ScanMethod;
  };
  
  // إعدادات عامة
  general: {
    confidenceThreshold: number;
    multipleAnswerHandling: 'reject' | 'best' | 'first';
    emptyAnswerHandling: 'skip' | 'wrong' | 'retry';
    debugMode: boolean;
    showProcessingDetails: boolean;
  };
  
  // إعدادات التظليل التقليدي
  traditional: {
    darknessThreshold: number;
    minimumFillPercentage: number;
    contrastBoost: number;
    noiseReduction: boolean;
  };
  
  // إعدادات الأحرف المخفية
  hiddenLetters: {
    textVisibilityThreshold: number;
    ocrConfidence: number;
    letterDetectionSensitivity: number;
    backgroundAnalysis: boolean;
  };
  
  // إعدادات الطريقة المختلطة
  hybrid: {
    traditionalWeight: number;
    hiddenLettersWeight: number;
    agreementThreshold: number;
    conflictResolution: 'traditional' | 'hidden' | 'confidence';
  };
}

const DEFAULT_SETTINGS: AdvancedScanSettings = {
  methods: {
    traditional: {
      id: 'traditional',
      name: 'الطريقة التقليدية',
      description: 'كشف التظليل في الدوائر باستخدام تحليل كثافة البكسلات',
      advantages: [
        'سريعة ومباشرة',
        'تعمل مع جميع أنواع الكاميرات',
        'لا تحتاج معالجة معقدة',
        'مناسبة للاستخدام العام'
      ],
      disadvantages: [
        'قد تتأثر بجودة الإضاءة',
        'حساسة لنوع القلم المستخدم',
        'قد تخطئ في التظليل الخفيف'
      ],
      accuracy: 85,
      speed: 95,
      complexity: 30,
      enabled: true,
      weight: 0.6
    },
    hiddenLetters: {
      id: 'hiddenLetters',
      name: 'طريقة الأحرف المخفية',
      description: 'كشف اختفاء الأحرف داخل الدوائر المظللة باستخدام OCR',
      advantages: [
        'دقة عالية جداً',
        'لا تتأثر بنوع التظليل',
        'تكشف التظليل الجزئي',
        'مقاومة للضوضاء'
      ],
      disadvantages: [
        'تحتاج معالجة أكثر تعقيداً',
        'أبطأ من الطريقة التقليدية',
        'تحتاج جودة صورة عالية'
      ],
      accuracy: 95,
      speed: 70,
      complexity: 80,
      enabled: true,
      weight: 0.4
    },
    hybrid: {
      id: 'hybrid',
      name: 'الطريقة المختلطة',
      description: 'دمج الطريقتين للحصول على أقصى دقة وموثوقية',
      advantages: [
        'أعلى دقة ممكنة',
        'تتحقق من النتائج مرتين',
        'تقلل الأخطاء إلى الحد الأدنى',
        'مرونة في التعامل مع الحالات المختلفة'
      ],
      disadvantages: [
        'أبطأ من الطرق الفردية',
        'تحتاج موارد معالجة أكثر',
        'معقدة في التطبيق'
      ],
      accuracy: 98,
      speed: 60,
      complexity: 90,
      enabled: false,
      weight: 1.0
    }
  },
  
  general: {
    confidenceThreshold: 70,
    multipleAnswerHandling: 'best',
    emptyAnswerHandling: 'wrong',
    debugMode: true,
    showProcessingDetails: true,
    scanMethod: 'traditional'
  },
  
  traditional: {
    darknessThreshold: 20,
    minimumFillPercentage: 15,
    contrastBoost: 150,
    noiseReduction: true
  },
  
  hiddenLetters: {
    textVisibilityThreshold: 40,
    ocrConfidence: 80,
    letterDetectionSensitivity: 60,
    backgroundAnalysis: true
  },
  
  hybrid: {
    traditionalWeight: 40,
    hiddenLettersWeight: 60,
    agreementThreshold: 80,
    conflictResolution: 'confidence'
  }
};

const AdvancedScanSettings: React.FC = () => {
  const [settings, setSettings] = useState<AdvancedScanSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('methods');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // تحميل الإعدادات من التخزين المحلي
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('advancedScanSettings');
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
      localStorage.setItem('advancedScanSettings', JSON.stringify(settings));
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
      localStorage.removeItem('advancedScanSettings');
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

  // تحديث طريقة مسح
  const updateMethod = (methodId: keyof AdvancedScanSettings['methods'], updates: Partial<ScanMethod>) => {
    setSettings(prev => ({
      ...prev,
      methods: {
        ...prev.methods,
        [methodId]: {
          ...prev.methods[methodId],
          ...updates
        }
      }
    }));
  };

  // تحديث الإعدادات العامة
  const updateGeneral = (key: keyof AdvancedScanSettings['general'], value: any) => {
    setSettings(prev => ({
      ...prev,
      general: {
        ...prev.general,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات التظليل التقليدي
  const updateTraditional = (key: keyof AdvancedScanSettings['traditional'], value: any) => {
    setSettings(prev => ({
      ...prev,
      traditional: {
        ...prev.traditional,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات الأحرف المخفية
  const updateHiddenLetters = (key: keyof AdvancedScanSettings['hiddenLetters'], value: any) => {
    setSettings(prev => ({
      ...prev,
      hiddenLetters: {
        ...prev.hiddenLetters,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات الطريقة المختلطة
  const updateHybrid = (key: keyof AdvancedScanSettings['hybrid'], value: any) => {
    setSettings(prev => ({
      ...prev,
      hybrid: {
        ...prev.hybrid,
        [key]: value
      }
    }));
  };

  // حساب النقاط الإجمالية لطريقة
  const calculateMethodScore = (method: ScanMethod) => {
    return Math.round((method.accuracy * 0.5 + method.speed * 0.3 + (100 - method.complexity) * 0.2));
  };

  // الحصول على لون الطريقة
  const getMethodColor = (methodId: string) => {
    switch (methodId) {
      case 'traditional': return 'blue';
      case 'hiddenLetters': return 'green';
      case 'hybrid': return 'purple';
      default: return 'gray';
    }
  };

  // أقسام الإعدادات
  const settingsTabs = [
    { id: 'methods', label: 'طرق المسح', icon: Scan, color: 'blue' },
    { id: 'traditional', label: 'التظليل التقليدي', icon: Target, color: 'blue' },
    { id: 'hiddenLetters', label: 'الأحرف المخفية', icon: Eye, color: 'green' },
    { id: 'hybrid', label: 'الطريقة المختلطة', icon: Layers, color: 'purple' },
    { id: 'general', label: 'الإعدادات العامة', icon: Settings, color: 'gray' }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">إعدادات المسح المتقدمة</h2>
            <p className="text-gray-600">تخصيص طرق كشف الإجابات وتحسين الدقة</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAdvanced ? 'إخفاء المتقدم' : 'إظهار المتقدم'}
          </button>
          
          <button
            onClick={saveSettings}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Save className="w-4 h-4" />
            حفظ الإعدادات
          </button>
          
          <button
            onClick={resetSettings}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
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
        {/* طرق المسح */}
        {activeTab === 'methods' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Scan className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">طرق كشف الإجابات</h3>
                <p className="text-gray-600">اختر الطريقة المناسبة لاحتياجاتك</p>
              </div>
            </div>

            <div className="space-y-6">
              {Object.entries(settings.methods).map(([methodId, method]) => {
                const color = getMethodColor(methodId);
                const score = calculateMethodScore(method);
                
                return (
                  <div key={methodId} className={`border-2 rounded-xl p-6 transition-all duration-200 ${
                    method.enabled 
                      ? `border-${color}-300 bg-${color}-50` 
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          method.enabled ? `bg-${color}-600` : 'bg-gray-400'
                        }`}>
                          {methodId === 'traditional' && <Target className="w-6 h-6 text-white" />}
                          {methodId === 'hiddenLetters' && <Eye className="w-6 h-6 text-white" />}
                          {methodId === 'hybrid' && <Layers className="w-6 h-6 text-white" />}
                        </div>
                        
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">{method.name}</h4>
                          <p className="text-gray-600 text-sm">{method.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${method.enabled ? `text-${color}-600` : 'text-gray-400'}`}>
                            {score}
                          </div>
                          <div className="text-xs text-gray-500">النقاط</div>
                        </div>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={method.enabled}
                            onChange={(e) => updateMethod(methodId as keyof AdvancedScanSettings['methods'], { enabled: e.target.checked })}
                            className={`rounded border-gray-300 text-${color}-600 shadow-sm focus:border-${color}-300 focus:ring focus:ring-${color}-200 focus:ring-opacity-50`}
                          />
                          <span className="mr-2 text-sm font-medium text-gray-700">تفعيل</span>
                        </label>
                      </div>
                    </div>

                    {/* مؤشرات الأداء */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>الدقة</span>
                          <span>{method.accuracy}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`bg-${color}-500 h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${method.accuracy}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>السرعة</span>
                          <span>{method.speed}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`bg-${color}-500 h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${method.speed}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>البساطة</span>
                          <span>{100 - method.complexity}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`bg-${color}-500 h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${100 - method.complexity}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* المزايا والعيوب */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold text-green-900 mb-2">المزايا:</h5>
                        <ul className="space-y-1">
                          {method.advantages.map((advantage, index) => (
                            <li key={index} className="text-sm text-green-700 flex items-center gap-2">
                              <CheckCircle className="w-3 h-3" />
                              {advantage}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h5 className="font-semibold text-red-900 mb-2">العيوب:</h5>
                        <ul className="space-y-1">
                          {method.disadvantages.map((disadvantage, index) => (
                            <li key={index} className="text-sm text-red-700 flex items-center gap-2">
                              <AlertCircle className="w-3 h-3" />
                              {disadvantage}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* وزن الطريقة (للطريقة المختلطة) */}
                    {methodId !== 'hybrid' && showAdvanced && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          الوزن في الطريقة المختلطة ({Math.round(method.weight * 100)}%)
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={method.weight}
                          onChange={(e) => updateMethod(methodId as keyof AdvancedScanSettings['methods'], { weight: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* إعدادات التظليل التقليدي */}
        {activeTab === 'traditional' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">إعدادات التظليل التقليدي</h3>
                <p className="text-gray-600">تخصيص معايير كشف التظليل في الدوائر</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد التظليل ({settings.traditional.darknessThreshold}%)
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={settings.traditional.darknessThreshold}
                  onChange={(e) => updateTraditional('darknessThreshold', parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>حساس جداً (5%)</span>
                  <span>متوسط (25%)</span>
                  <span>صارم (50%)</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  النسبة المئوية للبكسلات الداكنة المطلوبة لاعتبار الدائرة مظللة
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحد الأدنى للتعبئة ({settings.traditional.minimumFillPercentage}%)
                </label>
                <input
                  type="range"
                  min="10"
                  max="40"
                  value={settings.traditional.minimumFillPercentage}
                  onChange={(e) => updateTraditional('minimumFillPercentage', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-600 mt-2">
                  النسبة المئوية الدنيا من مساحة الدائرة التي يجب أن تكون مظللة
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تعزيز التباين ({settings.traditional.contrastBoost}%)
                </label>
                <input
                  type="range"
                  min="100"
                  max="300"
                  value={settings.traditional.contrastBoost}
                  onChange={(e) => updateTraditional('contrastBoost', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-600 mt-2">
                  مستوى تحسين التباين لتوضيح الفرق بين المناطق المظللة وغير المظللة
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.traditional.noiseReduction}
                    onChange={(e) => updateTraditional('noiseReduction', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">تقليل الضوضاء</span>
                </label>
                <p className="text-sm text-gray-600 mt-1 mr-6">
                  تطبيق فلاتر لتقليل الضوضاء وتحسين جودة الكشف
                </p>
              </div>
            </div>
          </div>
        )}

        {/* إعدادات الأحرف المخفية */}
        {activeTab === 'hiddenLetters' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">إعدادات الأحرف المخفية</h3>
                <p className="text-gray-600">تخصيص معايير كشف اختفاء الأحرف</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد وضوح النص ({settings.hiddenLetters.textVisibilityThreshold}%)
                </label>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={settings.hiddenLetters.textVisibilityThreshold}
                  onChange={(e) => updateHiddenLetters('textVisibilityThreshold', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-600 mt-2">
                  النسبة المئوية لوضوح النص المطلوبة لاعتبار الحرف مرئياً
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ثقة OCR ({settings.hiddenLetters.ocrConfidence}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={settings.hiddenLetters.ocrConfidence}
                  onChange={(e) => updateHiddenLetters('ocrConfidence', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-600 mt-2">
                  مستوى الثقة المطلوب من محرك OCR لقراءة الأحرف
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حساسية كشف الأحرف ({settings.hiddenLetters.letterDetectionSensitivity}%)
                </label>
                <input
                  type="range"
                  min="30"
                  max="90"
                  value={settings.hiddenLetters.letterDetectionSensitivity}
                  onChange={(e) => updateHiddenLetters('letterDetectionSensitivity', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-600 mt-2">
                  مستوى الحساسية لكشف وجود أو اختفاء الأحرف
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.hiddenLetters.backgroundAnalysis}
                    onChange={(e) => updateHiddenLetters('backgroundAnalysis', e.target.checked)}
                    className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">تحليل الخلفية</span>
                </label>
                <p className="text-sm text-gray-600 mt-1 mr-6">
                  تحليل خلفية الدائرة لتحسين كشف اختفاء الأحرف
                </p>
              </div>
            </div>
          </div>
        )}

        {/* إعدادات الطريقة المختلطة */}
        {activeTab === 'hybrid' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">إعدادات الطريقة المختلطة</h3>
                <p className="text-gray-600">دمج الطريقتين للحصول على أقصى دقة</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وزن الطريقة التقليدية ({settings.hybrid.traditionalWeight}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.hybrid.traditionalWeight}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    updateHybrid('traditionalWeight', value);
                    updateHybrid('hiddenLettersWeight', 100 - value);
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  وزن طريقة الأحرف المخفية ({settings.hybrid.hiddenLettersWeight}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.hybrid.hiddenLettersWeight}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    updateHybrid('hiddenLettersWeight', value);
                    updateHybrid('traditionalWeight', 100 - value);
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد الاتفاق ({settings.hybrid.agreementThreshold}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={settings.hybrid.agreementThreshold}
                  onChange={(e) => updateHybrid('agreementThreshold', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-600 mt-2">
                  النسبة المطلوبة لاتفاق الطريقتين لقبول النتيجة
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حل التعارض
                </label>
                <select
                  value={settings.hybrid.conflictResolution}
                  onChange={(e) => updateHybrid('conflictResolution', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="traditional">أعطِ الأولوية للطريقة التقليدية</option>
                  <option value="hidden">أعطِ الأولوية للأحرف المخفية</option>
                  <option value="confidence">اختر الأعلى ثقة</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* الإعدادات العامة */}
        {activeTab === 'general' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">الإعدادات العامة</h3>
                <p className="text-gray-600">إعدادات عامة لجميع طرق المسح</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  طريقة المسح
                </label>
                <select
                  value={settings.general.scanMethod}
                  onChange={(e) => updateGeneral('scanMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="traditional">الطريقة التقليدية (تحليل التظليل)</option>
                  <option value="hiddenLetters">طريقة الأحرف المخفية</option>
                  <option value="hybrid">الطريقة المختلطة (الأدق)</option>
                </select>
                <p className="text-sm text-gray-600 mt-2">
                  {settings.general.scanMethod === 'traditional' && 'تحليل نسبة التظليل داخل الدوائر'}
                  {settings.general.scanMethod === 'hiddenLetters' && 'كشف اختفاء الأحرف داخل الدوائر المظللة'}
                  {settings.general.scanMethod === 'hybrid' && 'دمج الطريقتين للحصول على أقصى دقة'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  حد الثقة العام ({settings.general.confidenceThreshold}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={settings.general.confidenceThreshold}
                  onChange={(e) => updateGeneral('confidenceThreshold', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-gray-600 mt-2">
                  الحد الأدنى للثقة المطلوب لقبول نتيجة المسح
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  التعامل مع الإجابات المتعددة
                </label>
                <select
                  value={settings.general.multipleAnswerHandling}
                  onChange={(e) => updateGeneral('multipleAnswerHandling', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="reject">رفض الإجابة (اعتبارها خطأ)</option>
                  <option value="best">اختيار الأوضح</option>
                  <option value="first">اختيار الأول</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  التعامل مع الإجابات الفارغة
                </label>
                <select
                  value={settings.general.emptyAnswerHandling}
                  onChange={(e) => updateGeneral('emptyAnswerHandling', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="wrong">اعتبارها خطأ</option>
                  <option value="skip">تخطيها</option>
                  <option value="retry">إعادة المحاولة</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.general.debugMode}
                    onChange={(e) => updateGeneral('debugMode', e.target.checked)}
                    className="rounded border-gray-300 text-gray-600 shadow-sm focus:border-gray-300 focus:ring focus:ring-gray-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">وضع التصحيح</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.general.showProcessingDetails}
                    onChange={(e) => updateGeneral('showProcessingDetails', e.target.checked)}
                    className="rounded border-gray-300 text-gray-600 shadow-sm focus:border-gray-300 focus:ring focus:ring-gray-200 focus:ring-opacity-50"
                  />
                  <span className="mr-2 text-sm font-medium text-gray-700">إظهار تفاصيل المعالجة</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* معاينة الإعدادات */}
      <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">معاينة الإعدادات النشطة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 text-sm">
            <p><strong className="text-blue-800">الطرق المفعلة:</strong></p>
            <p className="text-gray-700">طريقة المسح: {
              settings.general.scanMethod === 'traditional' ? 'التقليدية' :
              settings.general.scanMethod === 'hiddenLetters' ? 'الأحرف المخفية' :
              'المختلطة'
            }</p>
            {Object.entries(settings.methods)
              .filter(([_, method]) => method.enabled)
              .map(([id, method]) => (
                <div key={id} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700">{method.name} (وزن: {Math.round(method.weight * 100)}%)</span>
                </div>
              ))}
          </div>
          
          <div className="space-y-2 text-sm">
            <p><strong className="text-blue-800">الإعدادات الرئيسية:</strong></p>
            <p className="text-gray-700">حد الثقة: {settings.general.confidenceThreshold}%</p>
            <p className="text-gray-700">حد التظليل: {settings.traditional.darknessThreshold}%</p>
            <p className="text-gray-700">وضوح النص: {settings.hiddenLetters.textVisibilityThreshold}%</p>
            <p className="text-gray-700">وضع التصحيح: {settings.general.debugMode ? 'مفعل' : 'معطل'}</p>
          </div>
        </div>
      </div>

      {/* دليل الاستخدام */}
      <div className="mt-8 bg-green-50 p-6 rounded-xl border border-green-200">
        <h3 className="text-lg font-semibold text-green-900 mb-4">دليل الاستخدام</h3>
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <h4 className="font-bold text-green-900 mb-2">🎯 الطريقة التقليدية:</h4>
            <p className="text-green-800 text-sm mb-2">
              <strong>كيف تعمل:</strong> تحليل كثافة البكسلات داخل الدوائر لكشف التظليل
            </p>
            <p className="text-green-700 text-sm">
              <strong>الاستخدام:</strong> ظلل الدائرة بالكامل بقلم أسود أو أزرق داكن
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <h4 className="font-bold text-green-900 mb-2">👁️ طريقة الأحرف المخفية:</h4>
            <p className="text-green-800 text-sm mb-2">
              <strong>كيف تعمل:</strong> كشف اختفاء الحرف داخل الدائرة المظللة باستخدام OCR
            </p>
            <p className="text-green-700 text-sm">
              <strong>الاستخدام:</strong> ظلل الدائرة بحيث يختفي الحرف داخلها جزئياً أو كلياً
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <h4 className="font-bold text-green-900 mb-2">🔄 الطريقة المختلطة:</h4>
            <p className="text-green-800 text-sm mb-2">
              <strong>كيف تعمل:</strong> تطبيق الطريقتين معاً ومقارنة النتائج للحصول على أقصى دقة
            </p>
            <p className="text-green-700 text-sm">
              <strong>الاستخدام:</strong> أي طريقة تظليل - النظام سيتحقق بالطريقتين
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedScanSettings;