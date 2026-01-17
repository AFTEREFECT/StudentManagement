import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, FileSpreadsheet, Users, Key, Calendar, GraduationCap, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { settingsManager, ExcelImportSettings } from '../utils/settings';

const ImportSettings: React.FC = () => {
  const [settings, setSettings] = useState<ExcelImportSettings>(settingsManager.getSettings());
  const [activeTab, setActiveTab] = useState('students');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    setSettings(settingsManager.getSettings());
  }, []);

  // عرض رسالة للمستخدم
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  // حفظ الإعدادات
  const handleSaveSettings = () => {
    try {
      settingsManager.updateSettings(settings);
      showMessage('تم حفظ الإعدادات بنجاح!', 'success');
    } catch (error) {
      showMessage('خطأ في حفظ الإعدادات', 'error');
    }
  };

  // إعادة تعيين الإعدادات
  const handleResetSettings = () => {
    if (confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات للقيم الافتراضية؟')) {
      settingsManager.resetToDefaults();
      setSettings(settingsManager.getSettings());
      showMessage('تم إعادة تعيين الإعدادات للقيم الافتراضية', 'success');
    }
  };

  // تحديث إعدادات استيراد التلاميذ
  const updateStudentsSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      studentsImport: {
        ...prev.studentsImport,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات استيراد الأكواد السرية
  const updateCredentialsSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      credentialsImport: {
        ...prev.credentialsImport,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات استيراد الحضور
  const updateAttendanceSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      attendanceImport: {
        ...prev.attendanceImport,
        [key]: value
      }
    }));
  };

  // تحديث إعدادات استيراد النقط
  const updateGradesSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      gradesImport: {
        ...prev.gradesImport,
        [key]: value
      }
    }));
  };

  // تحديث الإعدادات العامة
  const updateGeneralSettings = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      general: {
        ...prev.general,
        [key]: value
      }
    }));
  };

  // التحقق من صحة رمز العمود
  const validateColumn = (column: string): boolean => {
    return settingsManager.isValidColumn(column.toUpperCase());
  };

  // التحقق من صحة رقم السطر
  const validateRow = (row: number): boolean => {
    return settingsManager.isValidRow(row);
  };

  // أقسام الإعدادات
  const settingsTabs = [
    { id: 'students', label: 'استيراد التلاميذ', icon: Users, color: 'blue' },
    { id: 'credentials', label: 'استيراد الأكواد السرية', icon: Key, color: 'purple' },
    { id: 'attendance', label: 'استيراد الحضور', icon: Calendar, color: 'green' },
    { id: 'grades', label: 'استيراد النقط', icon: GraduationCap, color: 'orange' },
    { id: 'general', label: 'الإعدادات العامة', icon: Settings, color: 'gray' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            إعدادات استيراد Excel
          </h1>
          <p className="text-gray-600 text-lg">تخصيص نقاط بداية استيراد البيانات من ملفات Excel</p>
          <div className="mt-4 w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto"></div>
        </div>

        {/* عرض الرسائل */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {messageType === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message}
          </div>
        )}

        {/* أزرار التحكم */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">إعدادات الاستيراد</h2>
                <p className="text-sm text-gray-600">تخصيص نقاط البداية لجميع عمليات الاستيراد</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleSaveSettings}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Save className="w-4 h-4" />
                حفظ الإعدادات
              </button>
              
              <button
                onClick={handleResetSettings}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                إعادة تعيين
              </button>
            </div>
          </div>
        </div>

        {/* قائمة الأقسام */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {settingsTabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 rounded-xl text-center transition-all duration-200 ${
                  activeTab === tab.id
                    ? `bg-${tab.color}-600 text-white shadow-lg transform scale-105`
                    : `bg-white text-gray-700 hover:bg-${tab.color}-50 shadow-sm hover:shadow-md border border-gray-100`
                }`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 ${
                  activeTab === tab.id 
                    ? 'bg-white bg-opacity-20' 
                    : `bg-${tab.color}-100`
                }`}>
                  <IconComponent className={`w-6 h-6 ${
                    activeTab === tab.id 
                      ? 'text-white' 
                      : `text-${tab.color}-600`
                  }`} />
                </div>
                <h3 className="font-semibold text-sm">{tab.label}</h3>
              </button>
            );
          })}
        </div>

        {/* محتوى الإعدادات */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* إعدادات استيراد التلاميذ */}
          {activeTab === 'students' && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">إعدادات استيراد التلاميذ</h2>
                  <p className="text-gray-600">تحديد نقطة البداية لاستيراد لوائح التلاميذ من ملفات Excel</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">معلومات مهمة</span>
                </div>
                <p className="text-blue-800 text-sm">
                  الإعداد الافتراضي: البداية من السطر 11، العمود A إلى العمود G (A11:G11)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم السطر للبداية *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1048576"
                    value={settings.studentsImport.startRow}
                    onChange={(e) => updateStudentsSettings('startRow', parseInt(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validateRow(settings.studentsImport.startRow) ? 'border-gray-300' : 'border-red-300'
                    }`}
                  />
                  {!validateRow(settings.studentsImport.startRow) && (
                    <p className="text-red-500 text-xs mt-1">رقم السطر غير صحيح</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العمود الأول *
                  </label>
                  <input
                    type="text"
                    value={settings.studentsImport.startColumn}
                    onChange={(e) => updateStudentsSettings('startColumn', e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validateColumn(settings.studentsImport.startColumn) ? 'border-gray-300' : 'border-red-300'
                    }`}
                    placeholder="A"
                  />
                  {!validateColumn(settings.studentsImport.startColumn) && (
                    <p className="text-red-500 text-xs mt-1">رمز العمود غير صحيح</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العمود الأخير *
                  </label>
                  <input
                    type="text"
                    value={settings.studentsImport.endColumn}
                    onChange={(e) => updateStudentsSettings('endColumn', e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validateColumn(settings.studentsImport.endColumn) ? 'border-gray-300' : 'border-red-300'
                    }`}
                    placeholder="G"
                  />
                  {!validateColumn(settings.studentsImport.endColumn) && (
                    <p className="text-red-500 text-xs mt-1">رمز العمود غير صحيح</p>
                  )}
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.studentsImport.enabled}
                      onChange={(e) => updateStudentsSettings('enabled', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="mr-2 text-sm font-medium text-gray-700">تفعيل استيراد التلاميذ</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">معاينة النطاق:</h4>
                <p className="text-gray-700">
                  سيتم استيراد البيانات من: <span className="font-mono bg-white px-2 py-1 rounded">
                    {settings.studentsImport.startColumn}{settings.studentsImport.startRow}:{settings.studentsImport.endColumn}{settings.studentsImport.startRow}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* إعدادات استيراد الأكواد السرية */}
          {activeTab === 'credentials' && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">إعدادات استيراد الأكواد السرية</h2>
                  <p className="text-gray-600">تحديد مواقع رقم التلميذ والكود السري في ملف Excel</p>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-purple-900">معلومات مهمة</span>
                </div>
                <p className="text-purple-800 text-sm">
                  الإعداد الافتراضي: البداية من السطر 11، رقم التلميذ في العمود B، الكود السري في العمود F
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم السطر للبداية *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1048576"
                    value={settings.credentialsImport.startRow}
                    onChange={(e) => updateCredentialsSettings('startRow', parseInt(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      validateRow(settings.credentialsImport.startRow) ? 'border-gray-300' : 'border-red-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عمود رقم التلميذ *
                  </label>
                  <input
                    type="text"
                    value={settings.credentialsImport.studentIdColumn}
                    onChange={(e) => updateCredentialsSettings('studentIdColumn', e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      validateColumn(settings.credentialsImport.studentIdColumn) ? 'border-gray-300' : 'border-red-300'
                    }`}
                    placeholder="B"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عمود الكود السري *
                  </label>
                  <input
                    type="text"
                    value={settings.credentialsImport.secretCodeColumn}
                    onChange={(e) => updateCredentialsSettings('secretCodeColumn', e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      validateColumn(settings.credentialsImport.secretCodeColumn) ? 'border-gray-300' : 'border-red-300'
                    }`}
                    placeholder="F"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.credentialsImport.enabled}
                      onChange={(e) => updateCredentialsSettings('enabled', e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50"
                    />
                    <span className="mr-2 text-sm font-medium text-gray-700">تفعيل استيراد الأكواد السرية</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">معاينة المواقع:</h4>
                <div className="space-y-1 text-gray-700">
                  <p>رقم التلميذ: <span className="font-mono bg-white px-2 py-1 rounded">
                    {settings.credentialsImport.studentIdColumn}{settings.credentialsImport.startRow}
                  </span></p>
                  <p>الكود السري: <span className="font-mono bg-white px-2 py-1 rounded">
                    {settings.credentialsImport.secretCodeColumn}{settings.credentialsImport.startRow}
                  </span></p>
                </div>
              </div>
            </div>
          )}

          {/* إعدادات استيراد الحضور */}
          {activeTab === 'attendance' && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">إعدادات استيراد الحضور</h2>
                  <p className="text-gray-600">تحديد نقطة البداية لاستيراد سجلات الحضور</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم السطر للبداية *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1048576"
                    value={settings.attendanceImport.startRow}
                    onChange={(e) => updateAttendanceSettings('startRow', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العمود الأول *
                  </label>
                  <input
                    type="text"
                    value={settings.attendanceImport.startColumn}
                    onChange={(e) => updateAttendanceSettings('startColumn', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العمود الأخير *
                  </label>
                  <input
                    type="text"
                    value={settings.attendanceImport.endColumn}
                    onChange={(e) => updateAttendanceSettings('endColumn', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="F"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.attendanceImport.enabled}
                      onChange={(e) => updateAttendanceSettings('enabled', e.target.checked)}
                      className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                    />
                    <span className="mr-2 text-sm font-medium text-gray-700">تفعيل استيراد الحضور</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* إعدادات استيراد النقط */}
          {activeTab === 'grades' && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">إعدادات استيراد النقط</h2>
                  <p className="text-gray-600">تحديد نقطة البداية لاستيراد نقط المراقبة المستمرة</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم السطر للبداية *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1048576"
                    value={settings.gradesImport.startRow}
                    onChange={(e) => updateGradesSettings('startRow', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العمود الأول *
                  </label>
                  <input
                    type="text"
                    value={settings.gradesImport.startColumn}
                    onChange={(e) => updateGradesSettings('startColumn', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العمود الأخير *
                  </label>
                  <input
                    type="text"
                    value={settings.gradesImport.endColumn}
                    onChange={(e) => updateGradesSettings('endColumn', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="H"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.gradesImport.enabled}
                      onChange={(e) => updateGradesSettings('enabled', e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                    />
                    <span className="mr-2 text-sm font-medium text-gray-700">تفعيل استيراد النقط</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* الإعدادات العامة */}
          {activeTab === 'general' && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Settings className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">الإعدادات العامة</h2>
                  <p className="text-gray-600">إعدادات عامة لجميع عمليات الاستيراد</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.general.skipEmptyRows}
                        onChange={(e) => updateGeneralSettings('skipEmptyRows', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="mr-2 text-sm font-medium text-gray-700">تخطي الصفوف الفارغة</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.general.validateData}
                        onChange={(e) => updateGeneralSettings('validateData', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="mr-2 text-sm font-medium text-gray-700">التحقق من صحة البيانات</span>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.general.showProgress}
                        onChange={(e) => updateGeneralSettings('showProgress', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="mr-2 text-sm font-medium text-gray-700">إظهار شريط التقدم</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.general.autoSave}
                        onChange={(e) => updateGeneralSettings('autoSave', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="mr-2 text-sm font-medium text-gray-700">الحفظ التلقائي للإعدادات</span>
                    </label>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">معلومات الإعدادات:</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p>• <strong>تخطي الصفوف الفارغة:</strong> تجاهل الصفوف التي لا تحتوي على بيانات</p>
                    <p>• <strong>التحقق من صحة البيانات:</strong> فحص البيانات قبل الاستيراد</p>
                    <p>• <strong>إظهار شريط التقدم:</strong> عرض تقدم عملية الاستيراد</p>
                    <p>• <strong>الحفظ التلقائي:</strong> حفظ الإعدادات تلقائياً عند التغيير</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* معلومات إضافية */}
        <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">ملاحظات مهمة</h3>
          <div className="space-y-2 text-blue-800">
            <p>• سيتم تطبيق هذه الإعدادات تلقائياً على جميع عمليات الاستيراد المستقبلية</p>
            <p>• يتم حفظ الإعدادات محلياً في متصفحك</p>
            <p>• يمكن إعادة تعيين الإعدادات للقيم الافتراضية في أي وقت</p>
            <p>• تأكد من صحة أرقام الصفوف ورموز الأعمدة قبل الحفظ</p>
            <p>• الحفظ التلقائي يحفظ الإعدادات فور تغييرها</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportSettings;