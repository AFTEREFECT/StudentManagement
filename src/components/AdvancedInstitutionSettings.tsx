import React, { useState, useEffect } from 'react';
import { Building2, Save, RefreshCw, Database, CheckCircle, AlertCircle, Info, Upload } from 'lucide-react';
import { dbManager } from '../utils/database';

interface InstitutionData {
  academy: string;
  directorate: string;
  municipality: string;
  institution: string;
  academicYear: string;
  updatedAt: string;
}

interface SaveStatus {
  database: boolean;
  localStorage: boolean;
  timestamp: string;
}

export default function AdvancedInstitutionSettings() {
  const [settings, setSettings] = useState<InstitutionData>({
    academy: '',
    directorate: '',
    municipality: '',
    institution: '',
    academicYear: '2025/2026',
    updatedAt: ''
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [importedData, setImportedData] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      let loadedSettings: InstitutionData | null = null;
      let source = '';

      try {
        const dbSettings = await dbManager.getInstitutionSettings();
        if (
          dbSettings &&
          typeof dbSettings.academy === 'string' &&
          typeof dbSettings.directorate === 'string' &&
          typeof dbSettings.municipality === 'string' &&
          typeof dbSettings.institution === 'string' &&
          typeof dbSettings.academicYear === 'string'
        ) {
          loadedSettings = {
            academy: dbSettings.academy,
            directorate: dbSettings.directorate,
            municipality: dbSettings.municipality,
            institution: dbSettings.institution,
            academicYear: dbSettings.academicYear,
            updatedAt: dbSettings.updatedAt || ''
          };
          source = 'database';
        }
      } catch {}

      if (!loadedSettings) {
        try {
          const localData = localStorage.getItem('institution_settings_backup');
          if (localData) {
            const parsed = JSON.parse(localData);
            loadedSettings = {
              academy: parsed.academy || '',
              directorate: parsed.directorate || '',
              municipality: parsed.municipality || '',
              institution: parsed.institution || '',
              academicYear: parsed.academicYear || '2025/2026',
              updatedAt: parsed.updatedAt || ''
            };
            source = 'localStorage';
          }
        } catch {}
      }

      if (!loadedSettings) {
        try {
          const students = await dbManager.getStudents();
          const studentsWithMetadata = students.filter(
            (s: any) =>
              s.region || s.province || s.municipality || s.institution
          );
          if (studentsWithMetadata.length > 0) {
            const latest = studentsWithMetadata.reduce((prev: any, current: any) =>
              new Date(current.createdAt) > new Date(prev.createdAt)
                ? current : prev
            );
            loadedSettings = {
              academy: latest.region || '',
              directorate: latest.province || '',
              municipality: latest.municipality || '',
              institution: latest.institution || '',
              academicYear: latest.academicYear || '2025/2026',
              updatedAt: new Date().toISOString()
            };
            source = 'import';
            setImportedData(latest);
          }
        } catch {}
      }

      if (loadedSettings) {
        setSettings(loadedSettings);
        showMessage(
          'success',
          `تم تحميل الإعدادات من ${
            source === 'database'
              ? 'قاعدة البيانات'
              : source === 'localStorage'
              ? 'التخزين المحلي'
              : 'البيانات المستوردة'
          }`
        );
        await checkSaveStatus();
      } else {
        showMessage('info', 'لا توجد إعدادات محفوظة. يرجى إدخال البيانات يدوياً.');
      }
    } catch {
      showMessage('error', 'حدث خطأ في تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const checkSaveStatus = async () => {
    const status: SaveStatus = {
      database: false,
      localStorage: false,
      timestamp: new Date().toISOString()
    };
    try {
      const dbSettings = await dbManager.getInstitutionSettings();
      status.database =
        !!(
          dbSettings &&
          typeof dbSettings.academy === 'string' &&
          dbSettings.academy.trim() !== ''
        );
    } catch {
      status.database = false;
    }
    try {
      const localData = localStorage.getItem('institution_settings_backup');
      status.localStorage = !!localData;
    } catch {
      status.localStorage = false;
    }
    setSaveStatus(status);
  };

  const handleInputChange = (field: keyof InstitutionData, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const forceSave = async () => {
    if (!settings.academy || !settings.directorate || !settings.institution) {
      showMessage('error', 'يرجى ملء جميع الحقول المطلوبة (الأكاديمية، المديرية، المؤسسة)');
      return;
    }
    setSaving(true);
    try {
      const dataToSave: InstitutionData = {
        ...settings,
        updatedAt: new Date().toISOString()
      };
      let dbSuccess = false;
      let localSuccess = false;
      try {
        await dbManager.saveInstitutionSettings(dataToSave);
        dbSuccess = true;
      } catch {}
      try {
        localStorage.setItem('institution_settings_backup', JSON.stringify(dataToSave));
        localStorage.setItem('institution_settings_timestamp', new Date().toISOString());
        localSuccess = true;
      } catch {}
      if (dbSuccess || localSuccess) {
        setSettings(dataToSave);
        setHasUnsavedChanges(false);
        await checkSaveStatus();
        if (dbSuccess && localSuccess) {
          showMessage('success', '✅ تم الحفظ بنجاح في قاعدة البيانات والتخزين المحلي');
        } else if (dbSuccess) {
          showMessage('success', '✅ تم الحفظ في قاعدة البيانات (فشل التخزين المحلي)');
        } else {
          showMessage('success', '⚠️ تم الحفظ في التخزين المحلي فقط (فشلت قاعدة البيانات)');
        }
      } else {
        throw new Error('فشل الحفظ في كل من قاعدة البيانات والتخزين المحلي');
      }
    } catch {
      showMessage('error', 'فشل حفظ الإعدادات بالكامل!');
    } finally {
      setSaving(false);
    }
  };

  const reloadFromImport = async () => {
    setLoading(true);
    try {
      const students = await dbManager.getStudents();
      const studentsWithMetadata = students.filter(
        (s: any) => s.region || s.province || s.municipality || s.institution
      );
      if (studentsWithMetadata.length === 0) {
        showMessage('error', 'لا توجد بيانات وصفية في البيانات المستوردة');
        return;
      }
      const latest = studentsWithMetadata.reduce((prev: any, current: any) =>
        new Date(current.createdAt) > new Date(prev.createdAt) ? current : prev
      );
      const extractedSettings: InstitutionData = {
        academy: latest.region || settings.academy,
        directorate: latest.province || settings.directorate,
        municipality: latest.municipality || settings.municipality,
        institution: latest.institution || settings.institution,
        academicYear: latest.academicYear || settings.academicYear,
        updatedAt: new Date().toISOString()
      };
      setSettings(extractedSettings);
      setImportedData(latest);
      setHasUnsavedChanges(true);
      showMessage('info', 'تم استخراج البيانات من آخر استيراد. اضغط "حفظ" لتثبيت التغييرات.');
    } catch {
      showMessage('error', 'فشل استخراج البيانات من الاستيراد');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">جاري تحميل الإعدادات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">الإعدادات المتقدمة للمؤسسة</h1>
        </div>
        <p className="text-gray-600 text-sm">
          إدارة شاملة ومتقدمة لإعدادات المؤسسة مع نظام حفظ قوي ومتعدد المستويات
        </p>
      </div>
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> :
           message.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" /> :
           <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />}
          <p className={`text-sm ${
            message.type === 'success' ? 'text-green-800' :
            message.type === 'error' ? 'text-red-800' :
            'text-blue-800'
          }`}>{message.text}</p>
        </div>
      )}
      {hasUnsavedChanges && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800 font-medium">لديك تغييرات غير محفوظة! اضغط "حفظ" لتثبيت التغييرات.</p>
        </div>
      )}
      {saveStatus && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Database className="w-5 h-5" />
            حالة النظام
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              {saveStatus.database ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="text-sm">
                قاعدة البيانات: {saveStatus.database ? 'محفوظة ✓' : 'غير محفوظة ✗'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus.localStorage ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="text-sm">
                التخزين المحلي: {saveStatus.localStorage ? 'محفوظ ✓' : 'غير محفوظ ✗'}
              </span>
            </div>
          </div>
          {settings.updatedAt && (
            <p className="text-xs text-gray-500 mt-2">
              آخر تحديث: {new Date(settings.updatedAt).toLocaleString('ar-MA')}
            </p>
          )}
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">بيانات المؤسسة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الأكاديمية الجهوية للتربية والتكوين *
            </label>
            <input
              type="text"
              value={settings.academy}
              onChange={(e) => handleInputChange('academy', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="مثال: سوس - ماسة"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              المديرية الإقليمية *
            </label>
            <input
              type="text"
              value={settings.directorate}
              onChange={(e) => handleInputChange('directorate', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="مثال: عمالة أكادير إداوتنان"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الجماعة
            </label>
            <input
              type="text"
              value={settings.municipality}
              onChange={(e) => handleInputChange('municipality', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="مثال: الدراركة"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              المؤسسة التعليمية *
            </label>
            <input
              type="text"
              value={settings.institution}
              onChange={(e) => handleInputChange('institution', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="مثال: ثانوية تاگاديرت الإعدادية"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              السنة الدراسية الحالية
            </label>
            <input
              type="text"
              value={settings.academicYear}
              onChange={(e) => handleInputChange('academicYear', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="مثال: 2025/2026"
            />
          </div>
        </div>
      </div>
      {importedData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            البيانات المستخرجة من آخر استيراد
          </h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p>التلميذ: {importedData.firstName} {importedData.lastName}</p>
            <p>القسم: {importedData.section}</p>
            <p>تاريخ الاستيراد: {new Date(importedData.createdAt).toLocaleString('ar-MA')}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={forceSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium shadow-md transition-all"
        >
          {saving ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              حفظ الإعدادات
            </>
          )}
        </button>
        <button
          onClick={reloadFromImport}
          disabled={loading || saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium shadow-md transition-all"
        >
          <RefreshCw className="w-5 h-5" />
          تحديث من آخر استيراد
        </button>
        <button
          onClick={() => {
            loadSettings();
            setHasUnsavedChanges(false);
          }}
          disabled={loading || saving}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium shadow-md transition-all"
        >
          <Database className="w-5 h-5" />
          إعادة التحميل
        </button>
      </div>
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">ملاحظات مهمة:</h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>يتم حفظ البيانات في قاعدة البيانات والتخزين المحلي للأمان المضاعف</li>
          <li>اضغط "حفظ الإعدادات" بعد أي تعديل لتثبيت التغييرات</li>
          <li>يمكنك استخراج البيانات تلقائياً من آخر استيراد</li>
          <li>الحقول المطلوبة (*) يجب ملؤها قبل الحفظ</li>
        </ul>
      </div>
    </div>
  );
}
