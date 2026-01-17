import React, { useState } from 'react';
import { Clock, Crown, Check, Mail, MessageCircle, Key, Sparkles } from 'lucide-react';

interface TrialExpiredProps {
  onEnterLicense: () => void;
}

export const TrialExpired: React.FC<TrialExpiredProps> = ({ onEnterLicense }) => {
  const [showContactForm, setShowContactForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      nameAr: 'أساسي',
      price: '399',
      duration: 'سنة',
      color: 'from-blue-500 to-cyan-600',
      features: [
        'إدارة التلاميذ الكاملة',
        'الاستيراد من Excel',
        'التقارير الأساسية',
        'إدارة المستويات والأقسام',
        'البنية التربوية',
        'نسخ احتياطية محلية',
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      nameAr: 'محترف',
      price: '699',
      duration: 'سنة',
      color: 'from-purple-500 to-pink-600',
      badge: 'الأكثر طلباً',
      features: [
        'جميع ميزات Basic',
        'نظام الروائز المتقدم',
        'إدارة الغياب والحضور',
        'نظام التوجيه',
        'إدارة الحركية',
        'WhatsApp Integration',
        'التقارير المتقدمة',
      ]
    },
    {
      id: 'expert',
      name: 'Expert',
      nameAr: 'خبير',
      price: '999',
      duration: 'سنة',
      color: 'from-orange-500 to-red-600',
      badge: 'الأفضل قيمة',
      features: [
        'جميع ميزات Pro',
        'أدوات المطور',
        'دعم فني مباشر',
        'تحديثات مدى الحياة',
        'تخصيص حسب الطلب',
        'تدريب مجاني',
        'أولوية الدعم',
      ]
    }
  ];

  const handleContactUs = () => {
    setShowContactForm(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* العنوان الرئيسي */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-full mb-6 shadow-2xl animate-pulse">
            <Clock className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            انتهت فترة التجربة المجانية
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            نأمل أنك استمتعت بتجربة البرنامج لمدة 7 أيام
          </p>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-3">
              اشترك الآن واستمر في الاستفادة من جميع الميزات
            </h3>
            <p className="text-gray-200">
              اختر الخطة المناسبة لك واحصل على وصول كامل وغير محدود
            </p>
          </div>
        </div>

        {/* خطط الاشتراك */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:scale-105 ${
                selectedPlan === plan.id ? 'ring-4 ring-yellow-400' : ''
              }`}
            >
              {plan.badge && (
                <div className={`absolute top-4 left-4 bg-gradient-to-r ${plan.color} text-white px-3 py-1 rounded-full text-xs font-bold z-10`}>
                  {plan.badge}
                </div>
              )}

              <div className={`bg-gradient-to-r ${plan.color} p-6 text-white`}>
                <div className="flex items-center gap-3 mb-2">
                  <Crown className="w-8 h-8" />
                  <h3 className="text-2xl font-bold">{plan.nameAr}</h3>
                </div>
                <div className="text-4xl font-bold mb-2">
                  {plan.price} <span className="text-xl">درهم</span>
                </div>
                <p className="text-white/90">لمدة {plan.duration}</p>
              </div>

              <div className="p-6">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    handleContactUs();
                  }}
                  className={`w-full bg-gradient-to-r ${plan.color} text-white py-3 px-6 rounded-lg font-bold text-lg hover:shadow-xl transition-all`}
                >
                  اختر هذه الخطة
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* نموذج التواصل أو أزرار الإجراءات */}
        {showContactForm && selectedPlan ? (
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">تواصل معنا للحصول على الاشتراك</h3>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Mail className="w-6 h-6 text-blue-600" />
                  <h4 className="text-lg font-bold text-gray-900">البريد الإلكتروني</h4>
                </div>
                <p className="text-gray-700 mb-2">تواصل معنا عبر البريد الإلكتروني:</p>
                <a
                  href="mailto:progmawarid@gmail.com?subject=طلب اشتراك في نظام BGAstudents"
                  className="text-blue-600 font-bold text-lg hover:underline"
                >
                  progmawarid@gmail.com
                </a>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                  <h4 className="text-lg font-bold text-gray-900">WhatsApp</h4>
                </div>
                <p className="text-gray-700 mb-2">تواصل معنا مباشرة عبر واتساب:</p>
                <a
                  href="https://wa.me/212XXXXXXXXX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 font-bold text-lg hover:underline"
                >
                  +212 XXX XXX XXX
                </a>
              </div>

              <div className="text-center text-sm text-gray-600 mt-4">
                أذكر اسم الخطة المختارة: <span className="font-bold text-gray-900">{plans.find(p => p.id === selectedPlan)?.nameAr}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onEnterLicense}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-8 rounded-xl font-bold text-lg flex items-center gap-3 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Key className="w-6 h-6" />
              لديك كود تفعيل؟ أدخله هنا
            </button>

            <button
              onClick={handleContactUs}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-8 rounded-xl font-bold text-lg flex items-center gap-3 hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Sparkles className="w-6 h-6" />
              تواصل معنا للاشتراك
            </button>
          </div>
        )}

        {/* معلومات إضافية */}
        <div className="mt-12 text-center">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 max-w-2xl mx-auto">
            <h4 className="text-lg font-bold text-white mb-3">لماذا تشترك في BGAstudents؟</h4>
            <div className="grid sm:grid-cols-3 gap-4 text-sm text-gray-200">
              <div>
                <div className="text-2xl mb-2">🔒</div>
                <div className="font-bold">أمان تام</div>
                <div>بياناتك محفوظة محلياً</div>
              </div>
              <div>
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-bold">سرعة عالية</div>
                <div>لا حاجة للإنترنت</div>
              </div>
              <div>
                <div className="text-2xl mb-2">💎</div>
                <div className="font-bold">تحديثات مستمرة</div>
                <div>ميزات جديدة دائماً</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>نظام إدارة التلاميذ BGAstudents - مصمم خصيصاً للمؤسسات التعليمية المغربية</p>
        </div>
      </div>
    </div>
  );
};
