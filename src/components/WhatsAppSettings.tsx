import React, { useState, useEffect } from 'react';
import { MessageSquare, Save, CheckCircle, AlertCircle, Server, Key, Link } from 'lucide-react';
import { dbManager } from '../utils/database';
import { evolutionWhatsAppService } from '../utils/evolutionWhatsAppService';

interface WhatsAppConfig {
  evolution_api_url: string;
  evolution_instance_name: string;
  evolution_api_key: string;
  is_active: boolean;
}

export const WhatsAppSettings: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppConfig>({
    evolution_api_url: '',
    evolution_instance_name: '',
    evolution_api_key: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      console.log('🔍 تحميل إعدادات Evolution API...');

      await dbManager.initialize();
      const data = await dbManager.getWhatsAppSettings();

      if (data) {
        console.log('✅ تم تحميل الإعدادات:', data);
        setConfig({
          evolution_api_url: data.evolutionApiUrl || '',
          evolution_instance_name: data.evolutionInstanceName || '',
          evolution_api_key: data.evolutionApiKey || '',
          is_active: data.isActive ?? true
        });
      } else {
        console.log('⚠️ لا توجد إعدادات محفوظة');
      }
    } catch (error) {
      console.error('❌ خطأ في تحميل الإعدادات:', error);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!config.evolution_api_url.trim() || !config.evolution_instance_name.trim() || !config.evolution_api_key.trim()) {
        showMessage('الرجاء إدخال جميع البيانات المطلوبة', 'error');
        setLoading(false);
        return;
      }

      const settingsData = {
        evolution_api_url: config.evolution_api_url.trim(),
        evolution_instance_name: config.evolution_instance_name.trim(),
        evolution_api_key: config.evolution_api_key.trim(),
        is_active: config.is_active
      };

      console.log('💾 حفظ إعدادات Evolution API...');
      console.log('📊 البيانات:', { ...settingsData, evolution_api_key: '***' });

      await dbManager.initialize();
      await dbManager.saveWhatsAppSettings(settingsData);

      console.log('✅ تم الحفظ بنجاح');
      showMessage('تم حفظ الإعدادات بنجاح', 'success');

      await loadSettings();
    } catch (error) {
      console.error('❌ خطأ في الحفظ:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل حفظ الإعدادات';

      if (errorMessage.includes('ترحيل') || errorMessage.includes('إعادة تحميل')) {
        showMessage(errorMessage + ' يرجى إعادة تحميل الصفحة (F5)', 'error');
      } else {
        showMessage(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.evolution_api_url || !config.evolution_instance_name || !config.evolution_api_key) {
      showMessage('الرجاء حفظ الإعدادات أولاً', 'error');
      return;
    }

    setTestingConnection(true);
    setMessage(null);

    try {
      const result = await evolutionWhatsAppService.testConnection();
      showMessage(result.message, result.success ? 'success' : 'error');
    } catch (error) {
      console.error('❌ خطأ في اختبار الاتصال:', error);
      showMessage('فشل اختبار الاتصال', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) {
      showMessage('الرجاء إدخال رقم الهاتف', 'error');
      return;
    }

    if (!config.evolution_api_url || !config.evolution_instance_name || !config.evolution_api_key) {
      showMessage('الرجاء حفظ الإعدادات أولاً', 'error');
      return;
    }

    setTestLoading(true);
    setMessage(null);

    try {
      const testMessage = 'مرحباً! هذه رسالة تجريبية من نظام إدارة التلاميذ PROGTALAMID 📚';

      console.log('🚀 إرسال رسالة تجريبية...');
      console.log('📞 الرقم:', testPhone);

      const result = await evolutionWhatsAppService.sendMessage(testPhone, testMessage);

      if (result.success) {
        showMessage(`✅ ${result.message}`, 'success');
      } else {
        showMessage(`❌ ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('❌ خطأ في الاختبار:', error);
      showMessage(`فشل إرسال الرسالة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`, 'error');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">إعدادات واتساب - Evolution API</h1>
                <p className="text-green-100 mt-1">قم بإعداد خادمك الخاص لإرسال رسائل WhatsApp</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {message && (
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-2">معلومات مهمة:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>يجب أن تحصل على بيانات الاتصال من مدير النظام</li>
                    <li>عنوان الخادم مثل: http://api.progtalamid.com</li>
                    <li>اسم المثيل مثل: school_alamal</li>
                    <li>المفتاح السري يجب الحفاظ عليه بشكل آمن</li>
                  </ul>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Link className="w-4 h-4 text-gray-600" />
                  عنوان خادم الـ API
                </label>
                <input
                  type="url"
                  value={config.evolution_api_url}
                  onChange={(e) => setConfig({ ...config, evolution_api_url: e.target.value })}
                  placeholder="http://api.progtalamid.com"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                  required
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">عنوان الخادم الخاص بـ Evolution API</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4 text-gray-600" />
                  اسم المثيل (Instance Name)
                </label>
                <input
                  type="text"
                  value={config.evolution_instance_name}
                  onChange={(e) => setConfig({ ...config, evolution_instance_name: e.target.value })}
                  placeholder="school_alamal"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                  required
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">المعرف الفريد للمؤسسة</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-600" />
                  مفتاح الـ API الخاص بالمثيل
                </label>
                <input
                  type="password"
                  value={config.evolution_api_key}
                  onChange={(e) => setConfig({ ...config, evolution_api_key: e.target.value })}
                  placeholder="••••••••••••••••••••"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                  required
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">المفتاح السري للمصادقة</p>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={config.is_active}
                  onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                  className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                  تفعيل إرسال الإشعارات تلقائياً
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-6 rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="bg-blue-600 text-white py-3 px-6 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  <Server className="w-5 h-5" />
                  {testingConnection ? 'جاري الاختبار...' : 'اختبار الاتصال'}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-green-600" />
                اختبار إرسال رسالة
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="أدخل رقم الهاتف (مثال: 0662707072)"
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  dir="ltr"
                />
                <button
                  onClick={handleTest}
                  disabled={testLoading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  <MessageSquare className="w-5 h-5" />
                  {testLoading ? 'جاري الإرسال...' : 'إرسال تجريبي'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                💡 أدخل الرقم المغربي بدون رمز البلد (مثال: 0662707072). سيتم تنسيقه تلقائياً إلى 212662707072
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
