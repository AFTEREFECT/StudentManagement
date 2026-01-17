// نظام إدارة إعدادات البرنامج
export interface ExcelImportSettings {
  // إعدادات استيراد التلاميذ
  studentsImport: {
    startRow: number;
    startColumn: string;
    endColumn: string;
    enabled: boolean;
  };
  
  // إعدادات استيراد الأكواد السرية
  credentialsImport: {
    startRow: number;
    studentIdColumn: string;
    secretCodeColumn: string;
    enabled: boolean;
  };
  
  // إعدادات استيراد الحضور
  attendanceImport: {
    startRow: number;
    startColumn: string;
    endColumn: string;
    enabled: boolean;
  };
  
  // إعدادات استيراد النقط
  gradesImport: {
    startRow: number;
    startColumn: string;
    endColumn: string;
    enabled: boolean;
  };
  
  // إعدادات عامة
  general: {
    skipEmptyRows: boolean;
    validateData: boolean;
    showProgress: boolean;
    autoSave: boolean;
    currentAcademicYear: string;
  };
}

// الإعدادات الافتراضية
export const DEFAULT_SETTINGS: ExcelImportSettings = {
  studentsImport: {
    startRow: 14,
    startColumn: 'A',
    endColumn: 'G',
    enabled: true
  },
  credentialsImport: {
    startRow: 11,
    studentIdColumn: 'B',
    secretCodeColumn: 'F',
    enabled: true
  },
  attendanceImport: {
    startRow: 2,
    startColumn: 'A',
    endColumn: 'F',
    enabled: true
  },
  gradesImport: {
    startRow: 2,
    startColumn: 'A',
    endColumn: 'H',
    enabled: true
  },
  general: {
    skipEmptyRows: true,
    validateData: true,
    showProgress: true,
    autoSave: true,
    currentAcademicYear: '2025/2026'
  }
};

class SettingsManager {
  private static readonly STORAGE_KEY = 'excelImportSettings';
  private settings: ExcelImportSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  // تحميل الإعدادات من التخزين المحلي
  private loadSettings(): ExcelImportSettings {
    try {
      const savedSettings = localStorage.getItem(SettingsManager.STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // دمج الإعدادات المحفوظة مع الافتراضية لضمان وجود جميع الحقول
        return this.mergeSettings(DEFAULT_SETTINGS, parsed);
      }
    } catch (error) {
      console.warn('خطأ في تحميل الإعدادات:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  // دمج الإعدادات
  private mergeSettings(defaultSettings: ExcelImportSettings, savedSettings: any): ExcelImportSettings {
    return {
      studentsImport: { ...defaultSettings.studentsImport, ...savedSettings.studentsImport },
      credentialsImport: { ...defaultSettings.credentialsImport, ...savedSettings.credentialsImport },
      attendanceImport: { ...defaultSettings.attendanceImport, ...savedSettings.attendanceImport },
      gradesImport: { ...defaultSettings.gradesImport, ...savedSettings.gradesImport },
      general: { ...defaultSettings.general, ...savedSettings.general }
    };
  }

  // حفظ الإعدادات
  private saveSettings(): void {
    try {
      localStorage.setItem(SettingsManager.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('خطأ في حفظ الإعدادات:', error);
    }
  }

  // الحصول على الإعدادات الحالية
  getSettings(): ExcelImportSettings {
    return { ...this.settings };
  }

  // تحديث الإعدادات
  updateSettings(newSettings: Partial<ExcelImportSettings>): void {
    this.settings = this.mergeSettings(this.settings, newSettings);
    if (this.settings.general.autoSave) {
      this.saveSettings();
    }
  }

  // إعادة تعيين الإعدادات للقيم الافتراضية
  resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }

  // الحصول على إعدادات استيراد محددة
  getStudentsImportSettings() {
    return this.settings.studentsImport;
  }

  getCredentialsImportSettings() {
    return this.settings.credentialsImport;
  }

  getAttendanceImportSettings() {
    return this.settings.attendanceImport;
  }

  getGradesImportSettings() {
    return this.settings.gradesImport;
  }

  getGeneralSettings() {
    return this.settings.general;
  }

  // تحديث إعدادات محددة
  updateStudentsImportSettings(settings: Partial<ExcelImportSettings['studentsImport']>): void {
    this.settings.studentsImport = { ...this.settings.studentsImport, ...settings };
    if (this.settings.general.autoSave) {
      this.saveSettings();
    }
  }

  updateCredentialsImportSettings(settings: Partial<ExcelImportSettings['credentialsImport']>): void {
    this.settings.credentialsImport = { ...this.settings.credentialsImport, ...settings };
    if (this.settings.general.autoSave) {
      this.saveSettings();
    }
  }

  updateAttendanceImportSettings(settings: Partial<ExcelImportSettings['attendanceImport']>): void {
    this.settings.attendanceImport = { ...this.settings.attendanceImport, ...settings };
    if (this.settings.general.autoSave) {
      this.saveSettings();
    }
  }

  updateGradesImportSettings(settings: Partial<ExcelImportSettings['gradesImport']>): void {
    this.settings.gradesImport = { ...this.settings.gradesImport, ...settings };
    if (this.settings.general.autoSave) {
      this.saveSettings();
    }
  }

  updateGeneralSettings(settings: Partial<ExcelImportSettings['general']>): void {
    this.settings.general = { ...this.settings.general, ...settings };
    if (this.settings.general.autoSave) {
      this.saveSettings();
    }
  }

  // تحويل رمز العمود إلى فهرس
  columnToIndex(column: string): number {
    let result = 0;
    for (let i = 0; i < column.length; i++) {
      result = result * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return result - 1;
  }

  // تحويل الفهرس إلى رمز العمود
  indexToColumn(index: number): string {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode((index % 26) + 'A'.charCodeAt(0)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }

  // التحقق من صحة رمز العمود
  isValidColumn(column: string): boolean {
    return /^[A-Z]+$/.test(column);
  }

  // التحقق من صحة رقم السطر
  isValidRow(row: number): boolean {
    return row > 0 && row <= 1048576; // حد Excel الأقصى
  }
}

// إنشاء مثيل واحد للاستخدام في جميع أنحاء التطبيق
export const settingsManager = new SettingsManager();

// إعدادات المؤسسة
export interface InstitutionSettings {
  name: string;
  directorateName: string;
  academicYear: string;
  province: string;
  logo?: string;
}

const INSTITUTION_SETTINGS_KEY = 'institutionSettings';

// حفظ إعدادات المؤسسة
export const saveInstitutionSettings = (settings: InstitutionSettings): void => {
  try {
    localStorage.setItem(INSTITUTION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('خطأ في حفظ إعدادات المؤسسة:', error);
  }
};

// تحميل إعدادات المؤسسة
export const getInstitutionSettings = (): InstitutionSettings => {
  try {
    const saved = localStorage.getItem(INSTITUTION_SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('خطأ في تحميل إعدادات المؤسسة:', error);
  }

  // القيم الافتراضية
  return {
    name: '',
    directorateName: '',
    academicYear: '2025/2026',
    province: ''
  };
};