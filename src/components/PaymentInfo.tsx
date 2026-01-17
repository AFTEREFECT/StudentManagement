import React, { useState } from 'react';
import { CreditCard, Copy, CheckCircle, MessageCircle, DollarSign, Building, ArrowRight } from 'lucide-react';

interface PaymentInfoProps {
  planName: string;
  planPrice: number;
  onClose: () => void;
}

export const PaymentInfo: React.FC<PaymentInfoProps> = ({ planName, planPrice, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const BANK_INFO = {
    fullAccountNumber: '',
    localAccountNumber: '',
    bankName: 'البنك ',
    whatsappNumber: '+212662705774',
    developerEmail: 'progmawarid@gmail.com'
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-bold">معلومات الدفع</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-4">
            <CreditCard className="w-12 h-12" />
            <div>
              <p className="text-xl font-bold">{planName}</p>
              <p className="text-2xl font-bold">{planPrice} درهم</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* تعليمات الدفع */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <DollarSign className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-blue-900 text-lg mb-2">دعم صاحب البرنام </h3>
                <p className="text-blue-800 leading-relaxed">
                  يرجى دعم المطور صاحب البرنام بثمن رمزي، ثم التواصل معه عبر واتساب لتأكيد وتفعيل اشتراكك.
                </p>
              </div>
            </div>
          </div>

          {/* معلومات الحساب البنكي 
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Building className="w-6 h-6 text-gray-700" />
              <h3 className="text-xl font-bold text-gray-800">معلومات الحساب البنكي</h3>
            </div>

            {/* اسم البنك  
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                اسم البنك
              </label>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold text-gray-800">{BANK_INFO.bankName}</p>
              </div>
            </div>

            {/* الرقم الكامل (للحسابات الخارجية)  
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4">
              <label className="block text-sm font-medium text-green-800 mb-2">
                الرقم الكامل (للحسابات خارج البنك الشعبي)
              </label>
              <div className="flex items-center gap-2">
                <p className="text-lg font-mono font-bold text-green-900 flex-1 bg-white px-3 py-2 rounded border border-green-200">
                  {BANK_INFO.fullAccountNumber}
                </p>
                <button
                  onClick={() => copyToClipboard(BANK_INFO.fullAccountNumber, 'full')}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  title="نسخ"
                >
                  {copiedField === 'full' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* الرقم المختصر (للحسابات المحلية)  
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-800 mb-2">
                الرقم المختصر (للحسابات داخل البنك الشعبي)
              </label>
              <div className="flex items-center gap-2">
                <p className="text-lg font-mono font-bold text-blue-900 flex-1 bg-white px-3 py-2 rounded border border-blue-200">
                  {BANK_INFO.localAccountNumber}
                </p>
                <button
                  onClick={() => copyToClipboard(BANK_INFO.localAccountNumber, 'local')}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="نسخ"
                >
                  {copiedField === 'local' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>*/}

          {/* التواصل عبر واتساب */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-bold text-green-900">خطوة مهمة</h3>
            </div>
            <p className="text-green-800 mb-4 leading-relaxed">
               يرجى التواصل معنا عبر واتساب لإرسال إثبات الدفع الرمزي حسب طبيعة الخطة المختارة لتفعيل اشتراكك.
            </p>
            <a
              href={`https://wa.me/${BANK_INFO.whatsappNumber.replace('+', '')}?text=مرحباً، أريد تفعيل اشتراك ${planName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-bold"
            >
              <MessageCircle className="w-5 h-5" />
              تواصل عبر واتساب
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>

          {/* ملاحظة إضافية */}
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>ملاحظة:</strong> يرجى الاحتفاظ بإثبات الدفع (صورة أو لقطة شاشة) لإرسالها عبر واتساب.
              سيتم تفعيل اشتراكك خلال ساعات قليلة من التحقق من الدفع.
            </p>
          </div>

          {/* زر الإغلاق */}
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentInfo;
