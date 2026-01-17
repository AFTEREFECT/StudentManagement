import React, { useState, useEffect } from 'react';
import { Key, Shield, CheckCircle, XCircle, AlertCircle, Calendar, Gift, CreditCard } from 'lucide-react';
import { subscriptionManager, SubscriptionPlan, Subscription } from '../utils/subscriptionManager';
import PaymentInfo from './PaymentInfo';

export const SubscriptionManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'activate' | 'trial'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansData, subscription] = await Promise.all([
        subscriptionManager.getPlans(),
        subscriptionManager.getCurrentSubscription()
      ]);
      setPlans(plansData);
      setCurrentSubscription(subscription);

      const savedName = subscriptionManager.getInstitutionName();
      if (savedName) setInstitutionName(savedName);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'فشل تحميل البيانات' });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) {
      setMessage({ type: 'error', text: 'يرجى إدخال رمز الترخيص' });
      return;
    }

    if (!institutionName.trim()) {
      setMessage({ type: 'error', text: 'يرجى إدخال اسم المؤسسة' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await subscriptionManager.activateLicense(licenseKey, institutionName);

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setLicenseKey('');
        await loadData();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('Error activating license:', error);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء تفعيل الترخيص' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async (planName: string) => {
    if (!institutionName.trim()) {
      setMessage({ type: 'error', text: 'يرجى إدخال اسم المؤسسة' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await subscriptionManager.startTrial(institutionName, planName);

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await loadData();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      console.error('Error starting trial:', error);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء بدء الفترة التجريبية' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, isTrial: boolean) => {
    if (isTrial) {
      return (
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium flex items-center gap-1">
          <Gift className="w-4 h-4" />
          تجريبي
        </span>
      );
    }

    switch (status) {
      case 'active':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            نشط
          </span>
        );
      case 'expired':
        return (
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium flex items-center gap-1">
            <XCircle className="w-4 h-4" />
            منتهي
          </span>
        );
      case 'suspended':
        return (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            معلق
          </span>
        );
      default:
        return null;
    }
  };

  const getPlanBadge = (planName: string) => {
    const colors = {
      Basic: 'bg-gray-100 text-gray-800 border-gray-300',
      Pro: 'bg-blue-100 text-blue-800 border-blue-300',
      Expert: 'bg-purple-100 text-purple-800 border-purple-300'
    };

    return (
      <span className={`px-4 py-2 rounded-lg text-lg font-bold border-2 ${colors[planName as keyof typeof colors] || colors.Basic}`}>
        {planName}
      </span>
    );
  };

  const daysRemaining = subscriptionManager.getDaysRemaining();
  const isActive = subscriptionManager.isSubscriptionActive();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">إدارة الاشتراكات</h1>
          </div>
          <p className="text-gray-600 text-lg">اختر الخطة المناسبة لمؤسستك التعليمية</p>
        </div>

        {currentSubscription && (
          <div className={`mb-6 p-6 rounded-xl border-2 ${isActive ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <h3 className="text-xl font-bold text-gray-800">الاشتراك الحالي:</h3>
                {getPlanBadge(currentSubscription.plan_name)}
                {getStatusBadge(currentSubscription.status, currentSubscription.is_trial)}
              </div>
              {daysRemaining !== null && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-5 h-5" />
                  <span className="font-medium">
                    {daysRemaining > 0 ? `${daysRemaining} يوم متبقي` : 'انتهت الصلاحية'}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 text-gray-600">
              <p><strong>المؤسسة:</strong> {currentSubscription.institution_name}</p>
              <p><strong>تاريخ البداية:</strong> {new Date(currentSubscription.start_date).toLocaleDateString('ar-MA')}</p>
              {currentSubscription.end_date && (
                <p><strong>تاريخ الانتهاء:</strong> {new Date(currentSubscription.end_date).toLocaleDateString('ar-MA')}</p>
              )}
              {currentSubscription.is_trial && currentSubscription.trial_end_date && (
                <p><strong>نهاية الفترة التجريبية:</strong> {new Date(currentSubscription.trial_end_date).toLocaleDateString('ar-MA')}</p>
              )}
            </div>
          </div>
        )}

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
            message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
            'bg-blue-100 text-blue-800 border border-blue-300'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {message.type === 'error' && <XCircle className="w-5 h-5" />}
              {message.type === 'info' && <AlertCircle className="w-5 h-5" />}
              <p className="font-medium">{message.text}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('plans')}
                className={`flex-1 px-6 py-4 text-lg font-medium transition-colors ${
                  activeTab === 'plans'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                الخطط المتاحة
              </button>
              <button
                onClick={() => setActiveTab('activate')}
                className={`flex-1 px-6 py-4 text-lg font-medium transition-colors ${
                  activeTab === 'activate'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                تفعيل رمز الترخيص
              </button>
              <button
                onClick={() => setActiveTab('trial')}
                className={`flex-1 px-6 py-4 text-lg font-medium transition-colors ${
                  activeTab === 'trial'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                الفترة التجريبية
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'plans' && (
              <div className="grid md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border-2 rounded-xl p-6 transition-all hover:shadow-xl ${
                      plan.plan_name === 'Pro'
                        ? 'border-blue-500 bg-blue-50'
                        : plan.plan_name === 'Expert'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <div className="text-center mb-4">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">{plan.plan_name_ar}</h3>
                      <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-gray-800">{plan.price_yearly}</span>
                        <span className="text-gray-600"> د.م / سنوياً</span>
                      </div>
                    </div>
                    <div className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPlan(plan);
                        setShowPaymentInfo(true);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
                    >
                      اختر هذه الخطة
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'activate' && (
              <div className="max-w-md mx-auto">
                <div className="text-center mb-6">
                  <Key className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">تفعيل رمز الترخيص</h3>
                  <p className="text-gray-600">أدخل رمز الترخيص الخاص بك لتفعيل الاشتراك</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      اسم المؤسسة
                    </label>
                    <input
                      type="text"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="أدخل اسم المؤسسة"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      رمز الترخيص
                    </label>
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg tracking-wider"
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      disabled={loading}
                    />
                  </div>

                  <button
                    onClick={handleActivateLicense}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>جاري التفعيل...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        <span>تفعيل الترخيص</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'trial' && (
              <div className="max-w-md mx-auto">
                <div className="text-center mb-6">
                  <Gift className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">الفترة التجريبية المجانية</h3>
                  <p className="text-gray-600">جرب النظام مجاناً لمدة 7 أيام</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      اسم المؤسسة
                    </label>
                    <input
                      type="text"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="أدخل اسم المؤسسة"
                      disabled={loading}
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">ما ستحصل عليه:</h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        7 أيام مجانية كاملة
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        جميع ميزات الخطة الأساسية
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        بدون بطاقة ائتمان
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        إلغاء في أي وقت
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => handleStartTrial('Basic')}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>جاري البدء...</span>
                      </>
                    ) : (
                      <>
                        <Gift className="w-5 h-5" />
                        <span>ابدأ الفترة التجريبية</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentInfo && selectedPlan && (
        <PaymentInfo
          planName={selectedPlan.plan_name}
          planPrice={selectedPlan.price_monthly}
          onClose={() => {
            setShowPaymentInfo(false);
            setSelectedPlan(null);
          }}
        />
      )}
    </div>
  );
};
