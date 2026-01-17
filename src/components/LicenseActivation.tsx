import React, { useState } from 'react';
import { Key, Shield, CheckCircle, AlertCircle, Loader, Sparkles, Clock } from 'lucide-react';
import { licenseManager } from '../utils/licenseManager';
import { trialManager } from '../utils/trialManager';

interface LicenseActivationProps {
  onActivationSuccess: () => void;
}

export const LicenseActivation: React.FC<LicenseActivationProps> = ({ onActivationSuccess }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!licenseKey.trim()) {
      setMessage({ type: 'error', text: 'يرجى إدخال الكود السري' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await licenseManager.validateAndActivateLicense(licenseKey.trim());

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        // الانتظار قليلاً قبل إعادة التحميل
        setTimeout(() => {
          onActivationSuccess();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('خطأ في التفعيل:', error);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء التفعيل. يرجى المحاولة مرة أخرى.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestCode = () => {
    setLicenseKey('TRIAL-DEV-UNLIMITED-2025');
    setMessage({ type: 'info', text: 'تم إدراج كود تجريبي غير محدود (للمطور). اضغط "تفعيل البرنامج" للمتابعة.' });
  };

  const handleStartTrial = async () => {
    setTrialLoading(true);
    setMessage(null);

    try {
      const result = await trialManager.startTrialSession();

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setTimeout(() => {
          onActivationSuccess();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('خطأ في بدء التجربة:', error);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء بدء التجربة. يرجى المحاولة مرة أخرى.' });
    } finally {
      setTrialLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* الشعار والعنوان */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-lg">
            <Shield className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            نظام إدارة التلاميذ
          </h1>
          <p className="text-indigo-200 text-lg">
            يرجى تفعيل البرنامج للمتابعة
          </p>
        </div>

        {/* نموذج التفعيل */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-8 h-8 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">تفعيل البرنامج</h2>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> :
               message.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> :
               <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleActivate} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                الكود السري
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="مثال: DEMO-2025-STUDENT-DB-001"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-mono text-lg"
                dir="ltr"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">
                أدخل الكود الذي حصلت عليه من المطور
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  تفعيل البرنامج
                </>
              )}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-600 font-bold">أو</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartTrial}
              disabled={trialLoading || loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 px-6 rounded-lg font-bold text-lg flex items-center justify-center gap-3 hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {trialLoading ? (
                <>
                  <Loader className="w-6 h-6 animate-spin" />
                  جاري البدء...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  ابدأ التجربة المجانية - 7 أيام
                </>
              )}
            </button>

          
          </form>

          {/* معلومات إضافية */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-3">ملاحظات هامة:</h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium text-green-700">التجربة المجانية: استخدم البرنامج بالكامل لمدة 7 أيام بدون قيود</span>
              </li>
              
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>جميع بياناتك محفوظة بشكل آمن على جهازك</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>للحصول على كود دائم، تواصل مع الدعم بعد انتهاء التجربة</span>
              </li>
              
            </ul>
          </div>
        </div>

        {/* معلومات الاتصال */}
        <div className="mt-6 text-center">
          <p className="text-indigo-200 text-sm">
            هل تحتاج إلى مساعدة؟
          </p>
          <p className="text-white font-medium text-sm mt-1">
            تواصل معنا: progmawarid@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
};
