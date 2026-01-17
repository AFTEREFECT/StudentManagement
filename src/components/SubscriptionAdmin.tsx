import React, { useState, useEffect } from 'react';
import { Shield, Key, Users, Calendar, Plus, Edit2, Trash2, CheckCircle, XCircle, Download, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { SubscriptionPlan, License, Subscription } from '../utils/subscriptionManager';

export const SubscriptionAdmin: React.FC = () => {
  const DEVELOPER_EMAIL = 'afterefectss@gmail.com';

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plans' | 'licenses' | 'subscriptions'>('licenses');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [licenseType, setLicenseType] = useState<'regular' | 'trial'>('regular');
  const [newLicense, setNewLicense] = useState({
    plan_id: '',
    duration_days: 30,
    max_uses: 1,
    is_trial_code: false,
    unlimited_uses: false,
    developer_only: false,
    can_reactivate: false,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'plans') {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .order('display_order');
        if (error) throw error;
        setPlans(data || []);
      } else if (activeTab === 'licenses') {
        const { data, error } = await supabase
          .from('subscription_licenses')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setLicenses(data || []);
      } else if (activeTab === 'subscriptions') {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setSubscriptions(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'فشل تحميل البيانات' });
    } finally {
      setLoading(false);
    }
  };

  const generateLicenseKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;

    let key = '';
    for (let i = 0; i < segments; i++) {
      if (i > 0) key += '-';
      for (let j = 0; j < segmentLength; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return key;
  };

  const handleGenerateLicense = async () => {
    if (!newLicense.plan_id) {
      setMessage({ type: 'error', text: 'يرجى اختيار الخطة' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const plan = plans.find(p => p.id === newLicense.plan_id);
      if (!plan) throw new Error('الخطة غير موجودة');

      const licenseKey = generateLicenseKey();

      const { error } = await supabase
        .from('subscription_licenses')
        .insert({
          license_key: licenseKey,
          plan_id: newLicense.plan_id,
          plan_name: plan.plan_name,
          duration_days: newLicense.duration_days,
          max_uses: newLicense.max_uses,
          current_uses: 0,
          is_active: true,
          is_trial_code: newLicense.is_trial_code,
          unlimited_uses: newLicense.unlimited_uses,
          developer_only: newLicense.developer_only,
          can_reactivate: newLicense.can_reactivate,
          generated_by: 'admin',
          notes: newLicense.notes
        });

      if (error) throw error;

      const licenseTypeText = newLicense.is_trial_code ? 'تجريبي' : 'كامل';
      setMessage({ type: 'success', text: `تم إنشاء رمز ${licenseTypeText}: ${licenseKey}` });
      setShowLicenseForm(false);
      setNewLicense({
        plan_id: '',
        duration_days: 30,
        max_uses: 1,
        is_trial_code: false,
        unlimited_uses: false,
        developer_only: false,
        can_reactivate: false,
        notes: ''
      });
      await loadData();
    } catch (error) {
      console.error('Error generating license:', error);
      setMessage({ type: 'error', text: 'فشل إنشاء رمز الترخيص' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLicense = async (license: License) => {
    try {
      const { error } = await supabase
        .from('subscription_licenses')
        .update({ is_active: !license.is_active })
        .eq('id', license.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `تم ${license.is_active ? 'تعطيل' : 'تفعيل'} الترخيص بنجاح`
      });
      await loadData();
    } catch (error) {
      console.error('Error toggling license:', error);
      setMessage({ type: 'error', text: 'فشل تحديث الترخيص' });
    }
  };

  const handleDeleteLicense = async (licenseId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الترخيص؟')) return;

    try {
      const { error } = await supabase
        .from('subscription_licenses')
        .delete()
        .eq('id', licenseId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'تم حذف الترخيص بنجاح' });
      await loadData();
    } catch (error) {
      console.error('Error deleting license:', error);
      setMessage({ type: 'error', text: 'فشل حذف الترخيص' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'تم نسخ الرمز' });
  };

  const handleResetActivation = async (licenseId: string, licenseKey: string) => {
    if (!confirm(`هل أنت متأكد من إلغاء تفعيل الكود ${licenseKey}؟\n\nسيتم حذف بصمة الجهاز ويمكن استخدام الكود مرة أخرى.`)) return;

    try {
      const { error } = await supabase
        .from('subscription_licenses')
        .update({
          device_fingerprint: null,
          activated_at: null
        })
        .eq('id', licenseId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'تم إلغاء التفعيل بنجاح. يمكن استخدام الكود مرة أخرى.' });
      await loadData();
    } catch (error) {
      console.error('Error resetting activation:', error);
      setMessage({ type: 'error', text: 'فشل إلغاء التفعيل' });
    }
  };

  const handleUpdateSubscriptionStatus = async (subscriptionId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'تم تحديث حالة الاشتراك' });
      await loadData();
    } catch (error) {
      console.error('Error updating subscription:', error);
      setMessage({ type: 'error', text: 'فشل تحديث الاشتراك' });
    }
  };

  useEffect(() => {
    if (!showLicenseForm) return;

    const loadPlans = async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (!error && data) {
        setPlans(data);
      }
    };

    loadPlans();
  }, [showLicenseForm]);

  const handleLogin = async () => {
    if (!password.trim()) {
      setAuthError('يرجى إدخال كلمة المرور');
      return;
    }

    setAuthenticating(true);
    setAuthError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-developer-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ password })
        }
      );

      const result = await response.json();

      if (result.valid) {
        setIsAuthenticated(true);
        setAuthError('');
        setPassword('');
        localStorage.setItem('isDeveloper', 'true');
        console.log('✅ تم تسجيل الدخول بنجاح');
      } else {
        setAuthError('كلمة المرور غير صحيحة');
        console.error('❌ كلمة المرور غير صحيحة');
      }
    } catch (error) {
      console.error('❌ خطأ في التحقق من كلمة المرور:', error);
      setAuthError('فشل التحقق من كلمة المرور. تحقق من الاتصال بالإنترنت.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handlePasswordReset = () => {
    alert(`لاسترداد كلمة المرور، يرجى التواصل مع المطور على البريد الإلكتروني:\n\n${DEVELOPER_EMAIL}`);
    setShowPasswordReset(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">لوحة تحكم الاشتراكات</h1>
            <p className="text-gray-600">مخصصة للمطور فقط</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-center">
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="أدخل كلمة المرور"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={authenticating}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {authenticating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>جاري التحقق...</span>
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>

            <button
              onClick={() => setShowPasswordReset(true)}
              className="w-full text-blue-600 py-2 text-sm hover:underline"
            >
              نسيت كلمة المرور؟
            </button>
          </div>

          {showPasswordReset && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full">
                <h3 className="text-xl font-bold text-gray-800 mb-4">استرداد كلمة المرور</h3>
                <p className="text-gray-600 mb-4">
                  للحصول على كلمة المرور، يرجى التواصل مع المطور على:
                </p>
                <div className="bg-gray-100 p-3 rounded-lg mb-4 text-center">
                  <p className="font-mono text-blue-600 font-bold">{DEVELOPER_EMAIL}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handlePasswordReset}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    حسناً
                  </button>
                  <button
                    onClick={() => setShowPasswordReset(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">لوحة تحكم الاشتراكات</h1>
          </div>
          <p className="text-gray-600 text-lg">إدارة الخطط والتراخيص والاشتراكات</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
            message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
            'bg-blue-100 text-blue-800 border border-blue-300'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {message.type === 'error' && <XCircle className="w-5 h-5" />}
              <p className="font-medium">{message.text}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('licenses')}
                className={`flex-1 px-6 py-4 text-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'licenses'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Key className="w-5 h-5" />
                التراخيص
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`flex-1 px-6 py-4 text-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'subscriptions'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Users className="w-5 h-5" />
                الاشتراكات
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'licenses' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">إدارة التراخيص</h2>
                  <button
                    onClick={() => setShowLicenseForm(!showLicenseForm)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    إنشاء ترخيص جديد
                  </button>
                </div>

                {showLicenseForm && (
                  <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">إنشاء ترخيص جديد</h3>

                    {/* نوع الترخيص */}
                    <div className="mb-6 flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setLicenseType('regular');
                          setNewLicense({ ...newLicense, is_trial_code: false });
                        }}
                        className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors ${
                          licenseType === 'regular'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        ترخيص كامل
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLicenseType('trial');
                          setNewLicense({ ...newLicense, is_trial_code: true, duration_days: 7 });
                        }}
                        className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors ${
                          licenseType === 'trial'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        ترخيص تجريبي
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 font-medium mb-2">الخطة</label>
                        <select
                          value={newLicense.plan_id}
                          onChange={(e) => setNewLicense({ ...newLicense, plan_id: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">اختر الخطة</option>
                          {plans.map(plan => (
                            <option key={plan.id} value={plan.id}>
                              {plan.plan_name_ar} ({plan.plan_name})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-2">المدة (بالأيام)</label>
                        <input
                          type="number"
                          value={newLicense.duration_days}
                          onChange={(e) => setNewLicense({ ...newLicense, duration_days: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-2">عدد مرات الاستخدام</label>
                        <input
                          type="number"
                          value={newLicense.max_uses}
                          onChange={(e) => setNewLicense({ ...newLicense, max_uses: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-2">ملاحظات</label>
                        <input
                          type="text"
                          value={newLicense.notes}
                          onChange={(e) => setNewLicense({ ...newLicense, notes: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="ملاحظات اختيارية"
                        />
                      </div>
                    </div>

                    {/* خيارات متقدمة */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-bold text-gray-800 mb-3">خيارات متقدمة (للمطور فقط)</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newLicense.unlimited_uses}
                            onChange={(e) => setNewLicense({ ...newLicense, unlimited_uses: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">استخدامات غير محدودة</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newLicense.developer_only}
                            onChange={(e) => setNewLicense({ ...newLicense, developer_only: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">للمطور فقط</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newLicense.can_reactivate}
                            onChange={(e) => setNewLicense({ ...newLicense, can_reactivate: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">يمكن إعادة التفعيل</span>
                        </label>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={handleGenerateLicense}
                        disabled={loading}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        توليد الترخيص
                      </button>
                      <button
                        onClick={() => setShowLicenseForm(false)}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">رمز الترخيص</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الخطة</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المدة</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الاستخدام</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الحالة</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {licenses.map(license => (
                        <tr key={license.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                {license.license_key}
                              </code>
                              <button
                                onClick={() => copyToClipboard(license.license_key)}
                                className="text-blue-600 hover:text-blue-700"
                                title="نسخ"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                              {license.plan_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {license.duration_days} يوم
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {license.current_uses} / {license.max_uses}
                          </td>
                          <td className="px-4 py-3">
                            {license.is_active ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
                            ) : (
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">معطل</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {license.device_fingerprint && (
                                <button
                                  onClick={() => handleResetActivation(license.id, license.license_key)}
                                  className="text-orange-600 hover:text-orange-700"
                                  title="إلغاء التفعيل"
                                >
                                  <RefreshCw className="w-5 h-5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleLicense(license)}
                                className="text-blue-600 hover:text-blue-700"
                                title={license.is_active ? 'تعطيل' : 'تفعيل'}
                              >
                                {license.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteLicense(license.id)}
                                className="text-red-600 hover:text-red-700"
                                title="حذف"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {licenses.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      لا توجد تراخيص حالياً
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'subscriptions' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">الاشتراكات الحالية</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المؤسسة</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الخطة</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الحالة</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">تاريخ الانتهاء</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {subscriptions.map(sub => (
                        <tr key={sub.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {sub.institution_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                              {sub.plan_name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={sub.status}
                              onChange={(e) => handleUpdateSubscriptionStatus(sub.id, e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="active">نشط</option>
                              <option value="trial">تجريبي</option>
                              <option value="expired">منتهي</option>
                              <option value="suspended">معلق</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {sub.end_date ? new Date(sub.end_date).toLocaleDateString('ar-MA') :
                             sub.trial_end_date ? new Date(sub.trial_end_date).toLocaleDateString('ar-MA') :
                             '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-5 h-5 text-gray-400" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {subscriptions.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      لا توجد اشتراكات حالياً
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
