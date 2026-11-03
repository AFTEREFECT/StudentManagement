import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Save,
  CheckCircle,
  AlertCircle,
  Server,
  Settings as SettingsIcon,
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { unifiedWhatsAppService } from '../utils/unifiedWhatsAppService';
import { syncPhoneUpdates } from '../utils/phoneSync';

type WhatsAppConfig = {
  service_type: 'waaku';
  is_active: boolean;
};

export const UnifiedWhatsAppSettings: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppConfig>({
    service_type: 'waaku',
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('service_type, is_active')
        .eq('service_type', 'waaku')
        .maybeSingle();

      if (error) {
        console.error('❌ خطأ في تحميل الإعدادات:', error);
        return;
      }

      if (data) {
        setConfig({
          service_type: 'waaku',
          is_active: data.is_active ?? true,
        });
      }
    } catch (error) {
      console.error('❌ خطأ في loadSettings:', error);
    }
  };

  const validateSettings = (): boolean => {
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

      const { error: deleteError } = await supabase
        .from('whatsapp_settings')
        .delete()
        .neq('service_type', '');

      if (deleteError) {
        throw deleteError;
      }

      const { error: insertError } = await supabase.from('whatsapp_settings').insert({
        service_type: 'waaku',
        is_active: config.is_active,
      });

      if (insertError) {
        throw insertError;
      }

      showMessage('تم حفظ إعدادات Waaku بنجاح', 'success');
      await loadSettings();
    } catch (error) {
      console.error('❌ خطأ في الحفظ:', error);
      showMessage(error instanceof Error ? error.message : 'فشل حفظ الإعدادات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!validateSettings()) return;

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

    if (!validateSettings()) return;

    setTestLoading(true);
    setMessage(null);

    try {
      const testMessage = 'مرحباً! هذه رسالة تجريبية من نظام إدارة التلاميذ PROGTALAMID 📚';
      const result = await unifiedWhatsAppService.sendMessage(testPhone, testMessage);

      if (result.success) {
        showMessage(result.message, 'success');
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      console.error('❌ خطأ في الإرسال التجريبي:', error);
      showMessage(
        `فشل إرسال الرسالة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        'error'
      );
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
                <h1 className="text-3xl font-bold">إعدادات واتساب</h1>
                <p className="text-green-100 mt-1">النظام يعمل حاليًا عبر Waaku فقط</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {message && (
              <div
                className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-gray-600" />
                  نوع الخدمة
                </label>

                <input
                  type="text"
                  value="Waaku"
                  readOnly
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                />

                <p className="text-xs text-gray-500 mt-1">
                  تم توحيد النظام حاليًا على Waaku فقط لتفادي تعارض الإعدادات.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-blue-900 mb-2">استخدام نظام Waaku</h3>
                    <p className="text-sm text-blue-800 mb-3">
                      Waaku هو خادم الإرسال المعتمد حاليًا. الإعدادات التفصيلية تُدار من السيرفر وواجهة ربط
                      الجلسة.
                    </p>

                    <div className="bg-white rounded-lg p-4 border border-blue-300">
                      <p className="text-sm font-semibold text-gray-800 mb-2">الخطوات:</p>
                      <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                        <li>احفظ هذه الإعدادات أولاً</li>
                        <li>اذهب إلى صفحة ربط WhatsApp - Waaku</li>
                        <li>أنشئ جلسة جديدة</li>
                        <li>امسح رمز QR من الهاتف</li>
                      </ol>
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={syncPhoneUpdates}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      >
                        مزامنة أرقام الهواتف من الموقع
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={config.is_active}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                  تفعيل إرسال الإشعارات
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
                  type="button"
                  onClick={handleTest}
                  disabled={testLoading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  <MessageSquare className="w-5 h-5" />
                  {testLoading ? 'جاري الإرسال...' : 'إرسال تجريبي'}
                </button>
              </div>

              <p className="text-sm text-gray-600 mt-2">
                💡 أدخل الرقم المغربي بدون رمز البلد، وسيتم تنسيقه تلقائيًا.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};