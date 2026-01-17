import React, { useState, useEffect } from 'react';
import { MessageSquare, Save, CheckCircle, AlertCircle, Server, Key, Link, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { unifiedWhatsAppService, ServiceType } from '../utils/unifiedWhatsAppService';

interface WhatsAppConfig {
  service_type: ServiceType;
  is_active: boolean;

  //ahw settings
 ahw_server_url: string;
 ahw_api_key: string;
 ahw_session_name: string;

  // Evolution API settings
  evolution_api_url: string;
  evolution_instance_name: string;
  evolution_api_key: string;

  // Green API settings
  green_api_instance: string;
  green_api_token: string;

  // CallMeBot settings
  instance_id: string;
  access_token: string;
}

export const UnifiedWhatsAppSettings: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppConfig>({
    service_type: 'waaku',
    is_active: true,
   ahw_server_url: '',
   ahw_api_key: '',
   ahw_session_name: 'default',
    evolution_api_url: '',
    evolution_instance_name: '',
    evolution_api_key: '',
    green_api_instance: '',
    green_api_token: '',
    instance_id: '',
    access_token: ''
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
      console.log('🔍 تحميل إعدادات WhatsApp...');

      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('❌ خطأ في تحميل الإعدادات:', error);
        return;
      }

      if (data) {
        console.log('✅ تم تحميل الإعدادات:', data);
        setConfig({
          service_type: data.service_type || 'waaku',
          is_active: data.is_active ?? true,
         ahw_server_url: data.waha_server_url || '',
         ahw_api_key: data.waha_api_key || '',
         ahw_session_name: data.waha_session_name || 'default',
          evolution_api_url: data.evolution_api_url || '',
          evolution_instance_name: data.evolution_instance_name || '',
          evolution_api_key: data.evolution_api_key || '',
          green_api_instance: data.green_api_instance || '',
          green_api_token: data.green_api_token || '',
          instance_id: data.instance_id || '',
          access_token: data.access_token || ''
        });
      }
    } catch (error) {
      console.error('❌ خطأ في تحميل الإعدادات:', error);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const validateSettings = (): boolean => {
    switch (config.service_type) {
      case 'waaku':
        // Waaku لا يحتاج إعدادات إضافية - الكل يتم من صفحة الربط
        return true;
      case 'waha':
        if (!config.waha_server_url.trim() || !config.waha_session_name.trim()) {
          showMessage('الرجاء إدخال عنوان الخادم واسم الجلسة لـahw', 'error');
          return false;
        }
        break;
      case 'evolution':
        if (!config.evolution_api_url.trim() || !config.evolution_instance_name.trim() || !config.evolution_api_key.trim()) {
          showMessage('الرجاء إدخال جميع بيانات Evolution API', 'error');
          return false;
        }
        break;
      case 'green_api':
        if (!config.green_api_instance.trim() || !config.green_api_token.trim()) {
          showMessage('الرجاء إدخال بيانات Green API', 'error');
          return false;
        }
        break;
      case 'callmebot':
        if (!config.instance_id.trim() || !config.access_token.trim()) {
          showMessage('الرجاء إدخال بيانات CallMeBot', 'error');
          return false;
        }
        break;
    }
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!validateSettings()) {
        setLoading(false);
        return;
      }

      console.log('💾 حفظ إعدادات WhatsApp...');

      // حذف الإعدادات القديمة أولاً
      await supabase.from('whatsapp_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // إدراج الإعدادات الجديدة
      const { error } = await supabase.from('whatsapp_settings').insert({
        service_type: config.service_type,
        is_active: config.is_active,
       ahw_server_url: config.waha_server_url.trim(),
       ahw_api_key: config.waha_api_key.trim(),
       ahw_session_name: config.waha_session_name.trim(),
        evolution_api_url: config.evolution_api_url.trim(),
        evolution_instance_name: config.evolution_instance_name.trim(),
        evolution_api_key: config.evolution_api_key.trim(),
        green_api_instance: config.green_api_instance.trim(),
        green_api_token: config.green_api_token.trim(),
        instance_id: config.instance_id.trim(),
        access_token: config.access_token.trim()
      });

      if (error) throw error;

      console.log('✅ تم الحفظ بنجاح');
      showMessage('تم حفظ الإعدادات بنجاح', 'success');
      await loadSettings();
    } catch (error) {
      console.error('❌ خطأ في الحفظ:', error);
      showMessage(error instanceof Error ? error.message : 'فشل حفظ الإعدادات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!validateSettings()) {
      return;
    }

    setTestingConnection(true);
    setMessage(null);

    try {
      const result = await unifiedWhatsAppService.testConnection();
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

    if (!validateSettings()) {
      return;
    }

    setTestLoading(true);
    setMessage(null);

    try {
      const testMessage = 'مرحباً! هذه رسالة تجريبية من نظام إدارة التلاميذ PROGTALAMID 📚';

      console.log('🚀 إرسال رسالة تجريبية...');
      console.log('📞 الرقم:', testPhone);

      const result = await unifiedWhatsAppService.sendMessage(testPhone, testMessage);

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

  const renderServiceFields = () => {
    switch (config.service_type) {
      case 'waaku':
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-blue-900 mb-2">استخدام نظام Waaku</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Waaku هو خادم مخصص وآمن لإرسال رسائل WhatsApp. جميع الإعدادات تُدار تلقائياً.
                </p>
                <div className="bg-white rounded-lg p-4 border border-blue-300">
                  <p className="text-sm font-semibold text-gray-800 mb-2">لإعداد جلسة WhatsApp:</p>
                  <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                    <li>احفظ هذه الإعدادات أولاً</li>
                    <li>اذهب إلى صفحة <span className="font-bold">ربط WhatsApp - Waaku</span> من القائمة الجانبية</li>
                    <li>اضغط على "إنشاء جلسة جديدة"</li>
                    <li>امسح رمز QR من هاتفك</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        );

      case 'waha':
        return (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Link className="w-4 h-4 text-gray-600" />
                عنوان خادمahw
              </label>
              <input
                type="text"
                value={config.waha_server_url}
                onChange={(e) => setConfig({ ...config,ahw_server_url: e.target.value })}
                placeholder="https://api.progtalamid.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                required
                dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-1">عنوان خادمahw الخاص بك</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Server className="w-4 h-4 text-gray-600" />
                اسم الجلسة (Session Name)
              </label>
              <input
                type="text"
                value={config.waha_session_name}
                onChange={(e) => setConfig({ ...config,ahw_session_name: e.target.value })}
                placeholder="default"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                required
                dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-1">اسم الجلسة فيahw (عادة: default)</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-600" />
                مفتاح الـ API (اختياري)
              </label>
              <input
                type="password"
                value={config.waha_api_key}
                onChange={(e) => setConfig({ ...config,ahw_api_key: e.target.value })}
                placeholder="••••••••••••••••••••"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-1">المفتاح السري إذا كان الخادم محمياً</p>
            </div>
          </>
        );

      case 'evolution':
        return (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Link className="w-4 h-4 text-gray-600" />
                عنوان خادم Evolution API
              </label>
              <input
                type="text"
                value={config.evolution_api_url}
                onChange={(e) => setConfig({ ...config, evolution_api_url: e.target.value })}
                placeholder="https://evolution.example.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                required
                dir="ltr"
              />
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
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-600" />
                مفتاح الـ API
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
            </div>
          </>
        );

      case 'green_api':
        return (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">معرف المثيل (Instance ID)</label>
              <input
                type="text"
                value={config.green_api_instance}
                onChange={(e) => setConfig({ ...config, green_api_instance: e.target.value })}
                placeholder="1234567890"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                required
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">رمز الوصول (API Token)</label>
              <input
                type="password"
                value={config.green_api_token}
                onChange={(e) => setConfig({ ...config, green_api_token: e.target.value })}
                placeholder="••••••••••••••••••••"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                required
                dir="ltr"
              />
            </div>
          </>
        );

      case 'callmebot':
        return (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">معرف المثيل (Instance ID)</label>
              <input
                type="text"
                value={config.instance_id}
                onChange={(e) => setConfig({ ...config, instance_id: e.target.value })}
                placeholder="instance_id"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                required
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">رمز الوصول (Access Token)</label>
              <input
                type="password"
                value={config.access_token}
                onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
                placeholder="••••••••••••••••••••"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                required
                dir="ltr"
              />
            </div>
          </>
        );
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
                <h1 className="text-3xl font-bold">إعدادات واتساب الموحدة</h1>
                <p className="text-green-100 mt-1">اختر خدمة WhatsApp المناسبة وقم بإعدادها</p>
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

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-gray-600" />
                  نوع الخدمة
                </label>
                <select
                  value={config.service_type}
                  onChange={(e) => setConfig({ ...config, service_type: e.target.value as ServiceType })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                >
                  <option value="waaku">Waaku (الموصى به بشدة) ⭐</option>
                  <option value="waha">WAHA</option>
                  <option value="evolution">Evolution API</option>
                  <option value="green_api">Green API</option>
                  <option value="callmebot">CallMeBot / WhapiPlus</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {config.service_type === 'waaku' && 'Waaku: خادم مخصص وآمن بالكامل - الأفضل للمؤسسات 🏆'}
                  {config.service_type === 'waha' && 'WAHA: حل مفتوح المصدر وسهل الإعداد'}
                  {config.service_type === 'evolution' && 'Evolution API: حل قوي ومتقدم'}
                  {config.service_type === 'green_api' && 'Green API: خدمة سحابية مدفوعة'}
                  {config.service_type === 'callmebot' && 'CallMeBot: خدمة بسيطة ومجانية'}
                </p>
              </div>

              {renderServiceFields()}

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
