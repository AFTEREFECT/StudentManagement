import React, { useState, useEffect } from 'react';
import { Upload, Download, Image, Save, Trash2, Eye, AlertCircle, CheckCircle, FileImage, Settings, Camera } from 'lucide-react';
import { logoManager } from '../utils/logoManager';

const LogoManagement: React.FC = () => {
  const [logoSettings, setLogoSettings] = useState(logoManager.getSettings());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    setLogoSettings(logoManager.getSettings());
  }, []);

  // عرض رسالة للمستخدم
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  // رفع ملف الشعار
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await logoManager.uploadLogo(file);
      if (result.success) {
        setLogoSettings(logoManager.getSettings());
        showMessage(result.message, 'success');
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      console.error('خطأ في رفع الشعار:', error);
      showMessage('خطأ في رفع الشعار', 'error');
    } finally {
      setLoading(false);
    }
  };

  // حذف الشعار
  const handleDeleteLogo = () => {
    if (confirm('هل أنت متأكد من حذف الشعار؟')) {
      try {
        const success = logoManager.deleteLogo();
        if (success) {
          setLogoSettings(logoManager.getSettings());
          showMessage('تم حذف الشعار بنجاح!', 'success');
        } else {
          showMessage('خطأ في حذف الشعار', 'error');
        }
      } catch (error) {
        console.error('خطأ في حذف الشعار:', error);
        showMessage('خطأ في حذف الشعار', 'error');
      }
    }
  };

  // تحديث النص البديل
  const handleTextUpdate = (text: string) => {
    try {
      const success = logoManager.updateSettings({
        textContent: text,
        logoType: 'text'
      });
      if (success) {
        setLogoSettings(logoManager.getSettings());
        showMessage('تم تحديث النص بنجاح!', 'success');
      } else {
        showMessage('خطأ في تحديث النص', 'error');
      }
    } catch (error) {
      console.error('خطأ في تحديث النص:', error);
      showMessage('خطأ في تحديث النص', 'error');
    }
  };

  // تحديث أبعاد الشعار
  const handleDimensionsUpdate = (width: number, height: number) => {
    try {
      const success = logoManager.updateSettings({ width, height });
      if (success) {
        setLogoSettings(logoManager.getSettings());
        showMessage('تم تحديث الأبعاد بنجاح!', 'success');
      } else {
        showMessage('خطأ في تحديث الأبعاد', 'error');
      }
    } catch (error) {
      console.error('خطأ في تحديث الأبعاد:', error);
      showMessage('خطأ في تحديث الأبعاد', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
          <Image className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">إدارة شعار الوزارة</h2>
          <p className="text-gray-600">تخصيص شعار الوزارة في جميع المطبوعات والتقارير</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* قسم رفع الشعار */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-red-600" />
            رفع شعار جديد
          </h3>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-red-300 rounded-lg p-6 text-center hover:border-red-400 transition-colors">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
                disabled={loading}
              />
              <label htmlFor="logo-upload" className="cursor-pointer">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {loading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  ) : (
                    <Camera className="w-8 h-8 text-red-600" />
                  )}
                </div>
                <p className="text-lg font-medium text-gray-700 mb-2">
                  {loading ? 'جاري رفع الشعار...' : 'انقر لرفع شعار الوزارة'}
                </p>
                <p className="text-sm text-gray-500">
                  PNG, JPG, SVG (أقل من 2MB)
                </p>
              </label>
            </div>

            {/* إعدادات أبعاد الشعار */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  العرض (px)
                </label>
                <input
                  type="number"
                  min="50"
                  max="300"
                  value={logoSettings.width}
                  onChange={(e) => handleDimensionsUpdate(parseInt(e.target.value) || 120, logoSettings.height)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الارتفاع (px)
                </label>
                <input
                  type="number"
                  min="30"
                  max="200"
                  value={logoSettings.height}
                  onChange={(e) => handleDimensionsUpdate(logoSettings.width, parseInt(e.target.value) || 80)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* تحرير النص البديل */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                النص البديل (عند عدم وجود شعار)
              </label>
              <textarea
                value={logoSettings.textContent}
                onChange={(e) => handleTextUpdate(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="نص الوزارة..."
              />
            </div>
          </div>
        </div>

        {/* معاينة الشعار */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              معاينة الشعار
            </h3>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Eye className="w-4 h-4" />
              {previewMode ? 'إخفاء المعاينة' : 'معاينة'}
            </button>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 min-h-32 flex items-center justify-center">
            {logoSettings.logoUrl ? (
              <div className="text-center">
                <img
                  src={logoSettings.logoUrl}
                  alt="شعار الوزارة"
                  style={{
                    width: `${logoSettings.width}px`,
                    height: `${logoSettings.height}px`,
                    objectFit: 'contain'
                  }}
                  className="mx-auto mb-3 border border-gray-300 rounded"
                />
                <p className="text-sm text-gray-600">
                  الأبعاد: {logoSettings.width} × {logoSettings.height} بكسل
                </p>
                <p className="text-xs text-green-600 mt-1">
                  ✅ سيظهر هذا الشعار في جميع التقارير
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div 
                  className="mx-auto mb-3 border border-gray-300 rounded bg-white flex items-center justify-center text-center"
                  style={{
                    width: `${logoSettings.width}px`,
                    height: `${logoSettings.height}px`,
                    fontSize: '10px',
                    lineHeight: '1.2',
                    padding: '4px',
                    color: '#dc2626',
                    fontWeight: 'bold'
                  }}
                >
                  {logoSettings.textContent.split('\n').map((line, index) => (
                    <div key={index}>{line}</div>
                  ))}
                </div>
                <p className="text-sm text-gray-600">النص البديل</p>
                <p className="text-xs text-blue-600 mt-1">
                  💡 ارفع شعار لاستبدال النص
                </p>
              </div>
            )}
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex gap-2 mt-4">
            {logoSettings.logoUrl && (
              <button
                onClick={handleDeleteLogo}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                <Trash2 className="w-4 h-4" />
                حذف الشعار
              </button>
            )}
            
            <button
              onClick={() => logoManager.reloadSettings()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              <Settings className="w-4 h-4" />
              إعادة تحميل
            </button>
          </div>
        </div>
      </div>

      {/* معلومات إضافية */}
      <div className="mt-8 bg-red-50 p-6 rounded-xl border border-red-200">
        <h3 className="text-lg font-semibold text-red-900 mb-4">معلومات مهمة</h3>
        <div className="space-y-2 text-red-800">
          <p>• <strong>الأنواع المدعومة:</strong> PNG, JPG, JPEG, SVG</p>
          <p>• <strong>الحد الأقصى للحجم:</strong> 2 ميجابايت</p>
          <p>• <strong>الأبعاد المناسبة:</strong> 120×80 بكسل للطباعة الواضحة</p>
          <p>• <strong>التطبيق التلقائي:</strong> سيظهر الشعار في جميع اللوائح والتقارير</p>
          <p>• <strong>التخزين الآمن:</strong> يتم حفظ الشعار في Local Storage</p>
          <p>• <strong>التحديث الفوري:</strong> يظهر الشعار فوراً في جميع التقارير</p>
          <p>• <strong>النسخ الاحتياطي:</strong> احفظ الشعار خارجياً كنسخة احتياطية</p>
        </div>
      </div>

      {/* تعليمات الاستخدام */}
      <div className="mt-6 bg-blue-50 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">كيفية الاستخدام</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <p className="text-blue-800">ارفع شعار الوزارة بصيغة PNG أو JPG أو SVG</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <p className="text-blue-800">اضبط الأبعاد المناسبة للطباعة (120×80 موصى به)</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <p className="text-blue-800">سيظهر الشعار تلقائياً في جميع لوائح التلاميذ والتقارير</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
            <p className="text-green-800">يمكن تحديث الشعار في أي وقت دون إعادة تشغيل النظام</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoManagement;