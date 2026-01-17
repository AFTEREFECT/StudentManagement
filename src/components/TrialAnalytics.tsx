import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Clock, DollarSign, Activity, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface TrialStats {
  total_trials: number;
  active_trials: number;
  expired_trials: number;
  converted_trials: number;
  conversion_rate: number;
  today_trials: number;
}

export const TrialAnalytics: React.FC = () => {
  const [stats, setStats] = useState<TrialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [topActions, setTopActions] = useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // جلب الإحصائيات الرئيسية
      const { data: statsData, error: statsError } = await supabase.rpc('get_trial_statistics');

      if (statsError) throw statsError;
      setStats(statsData);

      // جلب آخر 10 جلسات
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('trial_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessionsError) throw sessionsError;
      setRecentSessions(sessionsData || []);

      // جلب أكثر الإجراءات استخداماً
      const { data: actionsData, error: actionsError } = await supabase
        .from('user_analytics')
        .select('action_type')
        .limit(100);

      if (!actionsError && actionsData) {
        // حساب الإحصائيات
        const actionCounts: { [key: string]: number } = {};
        actionsData.forEach((action) => {
          actionCounts[action.action_type] = (actionCounts[action.action_type] || 0) + 1;
        });

        const topActionsArray = Object.entries(actionCounts)
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setTopActions(topActionsArray);
      }
    } catch (error) {
      console.error('خطأ في تحميل الإحصائيات:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">فشل تحميل الإحصائيات</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">إحصائيات المستخدمين</h2>
          <p className="text-gray-600 mt-1">تتبع استخدام البرنامج والتجارب المجانية</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      {/* بطاقات الإحصائيات الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* إجمالي التجارب */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-12 h-12 opacity-80" />
            <div className="text-right">
              <div className="text-4xl font-bold">{stats.total_trials}</div>
              <div className="text-blue-100 text-sm">مستخدم إجمالاً</div>
            </div>
          </div>
          <div className="text-sm text-blue-100">جميع التجارب المسجلة</div>
        </div>

        {/* التجارب النشطة */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-12 h-12 opacity-80" />
            <div className="text-right">
              <div className="text-4xl font-bold">{stats.active_trials}</div>
              <div className="text-green-100 text-sm">مستخدم نشط</div>
            </div>
          </div>
          <div className="text-sm text-green-100">التجارب السارية حالياً</div>
        </div>

        {/* التجارب المنتهية */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-12 h-12 opacity-80" />
            <div className="text-right">
              <div className="text-4xl font-bold">{stats.expired_trials}</div>
              <div className="text-orange-100 text-sm">تجربة منتهية</div>
            </div>
          </div>
          <div className="text-sm text-orange-100">انتهت فترة التجربة</div>
        </div>

        {/* المتحولون لمشتركين */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-12 h-12 opacity-80" />
            <div className="text-right">
              <div className="text-4xl font-bold">{stats.converted_trials}</div>
              <div className="text-purple-100 text-sm">مشترك مدفوع</div>
            </div>
          </div>
          <div className="text-sm text-purple-100">تحولوا من تجريبي لمدفوع</div>
        </div>

        {/* معدل التحويل */}
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-12 h-12 opacity-80" />
            <div className="text-right">
              <div className="text-4xl font-bold">{stats.conversion_rate}%</div>
              <div className="text-pink-100 text-sm">معدل التحويل</div>
            </div>
          </div>
          <div className="text-sm text-pink-100">نسبة المتحولين لمشتركين</div>
        </div>

        {/* تجارب اليوم */}
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="w-12 h-12 opacity-80" />
            <div className="text-right">
              <div className="text-4xl font-bold">{stats.today_trials}</div>
              <div className="text-cyan-100 text-sm">مستخدم جديد اليوم</div>
            </div>
          </div>
          <div className="text-sm text-cyan-100">بدأوا التجربة المجانية</div>
        </div>
      </div>

      {/* أكثر الإجراءات استخداماً */}
      {topActions.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">أكثر الميزات استخداماً</h3>
          <div className="space-y-3">
            {topActions.map((action, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{action.action}</span>
                    <span className="text-gray-600">{action.count} مرة</span>
                  </div>
                  <div className="mt-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{
                        width: `${(action.count / topActions[0].count) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* آخر الجلسات */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">آخر المستخدمين</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-right py-3 px-4 font-bold text-gray-700">تاريخ البدء</th>
                <th className="text-right py-3 px-4 font-bold text-gray-700">تاريخ الانتهاء</th>
                <th className="text-right py-3 px-4 font-bold text-gray-700">عدد الجلسات</th>
                <th className="text-right py-3 px-4 font-bold text-gray-700">الحالة</th>
                <th className="text-right py-3 px-4 font-bold text-gray-700">مشترك</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((session) => (
                <tr key={session.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(session.trial_started_at).toLocaleDateString('ar-MA')}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(session.trial_expires_at).toLocaleDateString('ar-MA')}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{session.session_count}</td>
                  <td className="py-3 px-4">
                    {session.is_expired || new Date(session.trial_expires_at) < new Date() ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        منتهية
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        نشطة
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {session.converted_to_paid ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                        نعم
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                        لا
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* معلومات إضافية */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">معلومات مهمة</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>يتم تسجيل جميع المحاولات والإجراءات تلقائياً في قاعدة البيانات</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>البيانات محمية ولا يتم مشاركتها مع أي طرف ثالث</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold">•</span>
            <span>يمكنك تصدير الإحصائيات في أي وقت للتحليل</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
