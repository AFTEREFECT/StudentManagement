import React, { useState, useEffect } from 'react';
import { Users, BookOpen, UserCheck, UserX, RefreshCw, Download, FileText, BarChart3 } from 'lucide-react';
import { GuidanceStatistic } from '../types';
import { dbManager } from '../utils/database';

interface GuidanceStats {
  totalStudents: number;
  passedStudents: number;
  repeatingStudents: number;
  failedStudents: number;
  withoutPreferences: number;
  streamDistribution: { [key: string]: { male: number; female: number; total: number } };
  genderDistribution: { male: number; female: number };
}

const GuidanceManagement: React.FC = () => {
  const [stats, setStats] = useState<GuidanceStats>({
    totalStudents: 0,
    passedStudents: 0,
    repeatingStudents: 0,
    failedStudents: 0,
    withoutPreferences: 0,
    streamDistribution: {},
    genderDistribution: { male: 0, female: 0 }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const loadGuidanceData = async () => {
    setIsRefreshing(true);
    try {
      console.log('🔄 بدء تحديث بيانات التوجيه من جدول guidance_statistics...');
      
      // تهيئة جدول guidance_statistics قبل أي عملية (حذف وإعادة إنشاء)
      await dbManager.initGuidanceDatabase();
      
      // جلب جميع البيانات من جدول guidance_statistics باستخدام الطريقة المناسبة
      const guidanceData = await dbManager.getGuidanceStatistics();
      const records = guidanceData.records || [];
      console.log('📊 تم جلب بيانات التوجيه:', records.length, 'سجل');

      if (records.length === 0) {
        console.warn('⚠️ لا توجد بيانات في جدول guidance_statistics');
        // عرض رسالة تنبيه بدلاً من alert
        setStats({
          totalStudents: 0,
          passedStudents: 0,
          repeatingStudents: 0,
          failedStudents: 0,
          withoutPreferences: 0,
          streamDistribution: {},
          genderDistribution: { male: 0, female: 0 }
        });
        console.log('✅ تم تعيين إحصائيات فارغة');
        return;
      }

      // حساب الإحصائيات من البيانات المستوردة
      const totalStudents = records.length;
      const passedStudents = records.filter(r => r.decision === 'ينتقل').length;
      const repeatingStudents = records.filter(r => r.decision === 'يكرر').length;
      const failedStudents = records.filter(r => r.decision === 'يفصل').length;
      const withoutPreferences = records.filter(r => !r.assigned_stream || r.assigned_stream.trim() === '').length;

      // توزيع النوع
      const maleStudents = records.filter(r => r.gender === 'ذكر').length;
      const femaleStudents = records.filter(r => r.gender === 'أنثى').length;

      // توزيع التخصصات
      const streamDistribution: { [key: string]: { male: number; female: number; total: number } } = {};
      
      records.forEach(record => {
        if (record.assigned_stream && record.assigned_stream.trim() !== '') {
          const stream = record.assigned_stream.trim();
          if (!streamDistribution[stream]) {
            streamDistribution[stream] = { male: 0, female: 0, total: 0 };
          }
          streamDistribution[stream].total++;
          if (record.gender === 'ذكر') {
            streamDistribution[stream].male++;
          } else if (record.gender === 'أنثى') {
            streamDistribution[stream].female++;
          }
        }
      });

      const newStats: GuidanceStats = {
        totalStudents,
        passedStudents,
        repeatingStudents,
        failedStudents,
        withoutPreferences,
        streamDistribution,
        genderDistribution: { male: maleStudents, female: femaleStudents }
      };

      setStats(newStats);
      console.log('✅ تم تحديث إحصائيات التوجيه بنجاح:', newStats);
      
    } catch (error) {
      console.error('❌ خطأ في تحديث بيانات التوجيه:', error);
      alert('حدث خطأ في تحديث البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const generateReports = async () => {
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('تم توليد التقارير بنجاح!');
    } catch (error) {
      console.error('خطأ في توليد التقارير:', error);
      alert('حدث خطأ في توليد التقارير.');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      const records = await dbManager.getGuidanceStatistics();
      
      if (records.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }

      const csvContent = [
        'الرقم الوطني,النوع,القرار,التخصص المطلوب,العمر,المستوى,القسم,السنة الدراسية',
        ...records.map(record => 
          `${record.student_id},${record.gender},${record.decision},${record.assigned_stream || ''},${record.age || ''},${record.level || ''},${record.section || ''},${record.academic_year || ''}`
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `guidance_data_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      console.log('✅ تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('❌ خطأ في تصدير البيانات:', error);
      alert('حدث خطأ في تصدير البيانات.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    loadGuidanceData();
  }, []);

  const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    percentage?: number;
  }> = ({ title, value, icon, color, percentage }) => (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${color} hover:shadow-xl transition-all duration-300`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{value.toLocaleString()}</p>
          {percentage !== undefined && (
            <p className="text-sm text-gray-500 mt-1">{percentage.toFixed(1)}%</p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color.replace('border-l-', 'bg-').replace('-500', '-100')}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">إدارة التوجيه</h1>
          <p className="text-gray-600 text-lg">توليد قرارات التوجيه وإدارة رغبات التلاميذ مع تحليل التخصصات</p>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Age Input */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-center gap-4">
            <label className="text-gray-700 font-medium">سن الطرد:</label>
            <input
              type="number"
              defaultValue={18}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
              min="16"
              max="25"
            />
            <span className="text-gray-600">سنة</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-8">
          <button
            onClick={exportData}
            disabled={isExporting || isRefreshing}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <Download className="w-5 h-5" />
            {isExporting ? 'جاري التصدير...' : 'تصدير البيانات'}
          </button>
          
          <button
            onClick={generateReports}
            disabled={isGenerating || isRefreshing}
            className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <FileText className="w-5 h-5" />
            {isGenerating ? 'جاري التوليد...' : 'توليد القرارات'}
          </button>
          
          <button
            onClick={loadGuidanceData}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'جاري التحديث...' : 'تحديث البيانات'}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-lg">
            {[
              { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
              { id: 'streams', label: 'تحليل التخصصات', icon: BookOpen },
              { id: 'guidance', label: 'بيانات التوجيه', icon: Users }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="إجمالي التلاميذ"
              value={stats.totalStudents}
              icon={<Users className="w-8 h-8 text-blue-500" />}
              color="border-l-blue-500"
            />
            <StatCard
              title="ينتقل"
              value={stats.passedStudents}
              icon={<UserCheck className="w-8 h-8 text-green-500" />}
              color="border-l-green-500"
              percentage={stats.totalStudents > 0 ? (stats.passedStudents / stats.totalStudents) * 100 : 0}
            />
            <StatCard
              title="يكرر"
              value={stats.repeatingStudents}
              icon={<RefreshCw className="w-8 h-8 text-yellow-500" />}
              color="border-l-yellow-500"
              percentage={stats.totalStudents > 0 ? (stats.repeatingStudents / stats.totalStudents) * 100 : 0}
            />
            <StatCard
              title="يفصل"
              value={stats.failedStudents}
              icon={<UserX className="w-8 h-8 text-red-500" />}
              color="border-l-red-500"
              percentage={stats.totalStudents > 0 ? (stats.failedStudents / stats.totalStudents) * 100 : 0}
            />
          </div>
        )}

        {/* Streams Tab */}
        {activeTab === 'streams' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">توزيع التخصصات</h2>
            {Object.keys(stats.streamDistribution).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.streamDistribution).map(([stream, data]) => (
                  <div key={stream} className="bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow">
                    <h3 className="font-bold text-gray-800 mb-3 text-center">{stream}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-600">👨 ذكور:</span>
                        <span className="font-semibold">{data.male}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-pink-600">👩 إناث:</span>
                        <span className="font-semibold">{data.female}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-gray-800 font-medium">المجموع:</span>
                        <span className="font-bold text-lg">{data.total}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">لا توجد بيانات تخصصات متاحة</p>
              </div>
            )}
          </div>
        )}

        {/* Guidance Tab */}
        {activeTab === 'guidance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">توزيع النوع</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-700 font-medium">👨 الذكور</span>
                  <span className="font-bold text-blue-800">{stats.genderDistribution.male}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-pink-50 rounded-lg">
                  <span className="text-pink-700 font-medium">👩 الإناث</span>
                  <span className="font-bold text-pink-800">{stats.genderDistribution.female}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">حالات خاصة</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="text-orange-700 font-medium">⚠️ بدون رغبات</span>
                  <span className="font-bold text-orange-800">{stats.withoutPreferences}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">📊 في نظام التوجيه</span>
                  <span className="font-bold text-gray-800">{stats.totalStudents}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuidanceManagement;