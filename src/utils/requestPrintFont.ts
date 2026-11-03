import { useState } from 'react';

const STORAGE_KEY = 'studentFileRequestPrintFont';
const HEADER_STORAGE_KEY = 'studentFileRequestPrintHeader';

export const REQUEST_PRINT_FONTS = [
  {
    value: 'tahoma',
    label: 'Tahoma - واضح للمراسلات',
    family: 'Tahoma, Arial, sans-serif',
  },
  {
    value: 'arial',
    label: 'Arial - بسيط وحديث',
    family: 'Arial, Tahoma, sans-serif',
  },
  {
    value: 'arabic-typesetting',
    label: 'Arabic Typesetting - نسخي رسمي',
    family: '"Arabic Typesetting", "Traditional Arabic", serif',
  },
  {
    value: 'traditional-arabic',
    label: 'Traditional Arabic - كلاسيكي',
    family: '"Traditional Arabic", "Arabic Typesetting", serif',
  },
  {
    value: 'segoe-ui',
    label: 'Segoe UI - حديث',
    family: '"Segoe UI", Tahoma, sans-serif',
  },
] as const;

export type RequestPrintFont = (typeof REQUEST_PRINT_FONTS)[number]['value'];

export interface RequestPrintHeaderSettings {
  enabled: boolean;
  image: string;
  ministryText: string;
  frenchText: string;
}

export interface RequestInstitutionDetails {
  academy: string;
  directorate: string;
  municipality: string;
  institution: string;
}

const DEFAULT_HEADER_SETTINGS: RequestPrintHeaderSettings = {
  enabled: true,
  image: '',
  ministryText: 'المملكة المغربية\nوزارة التربية الوطنية\nوالتعليم الأولي والرياضة',
  frenchText: 'ROYAUME DU MAROC\nMINISTÈRE DE L’ÉDUCATION NATIONALE\nDU PRÉSCOLAIRE ET DES SPORTS',
};

const DEFAULT_FONT: RequestPrintFont = 'tahoma';

const findFont = (value: string | null) =>
  REQUEST_PRINT_FONTS.find(font => font.value === value);

export const getRequestPrintFontFamily = (font: RequestPrintFont): string =>
  findFont(font)?.family ?? REQUEST_PRINT_FONTS[0].family;

export const getAcademyRegionName = (academy: string): string =>
  academy
    .trim()
    .replace(/^(?:الأكاديمية\s+الجهوية\s+للتربية\s+والتكوين|أكاديمية|جهة)\s*/i, '')
    .replace(/^لجهة\s*/i, '')
    .replace(/^[\s:：-]+/, '')
    .trim();

const readSavedFont = (): RequestPrintFont => {
  try {
    return findFont(localStorage.getItem(STORAGE_KEY))?.value ?? DEFAULT_FONT;
  } catch (error) {
    console.warn('تعذر تحميل إعداد خط الطباعة:', error);
    return DEFAULT_FONT;
  }
};

export const useRequestPrintFont = () => {
  const [font, setFont] = useState<RequestPrintFont>(readSavedFont);

  const updateFont = (nextFont: RequestPrintFont) => {
    setFont(nextFont);
    try {
      localStorage.setItem(STORAGE_KEY, nextFont);
    } catch (error) {
      console.error('تعذر حفظ إعداد خط الطباعة:', error);
    }
  };

  return { font, setFont: updateFont };
};

export const useRequestPrintHeader = () => {
  const [header, setHeader] = useState<RequestPrintHeaderSettings>(() => {
    try {
      const saved = localStorage.getItem(HEADER_STORAGE_KEY);
      if (!saved) return DEFAULT_HEADER_SETTINGS;
      const parsed = JSON.parse(saved) as Partial<RequestPrintHeaderSettings>;
      const validImage = typeof parsed.image === 'string' &&
        /^data:image\/(?:png|jpeg);base64,/i.test(parsed.image)
        ? parsed.image
        : '';
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
        image: validImage,
        ministryText: typeof parsed.ministryText === 'string'
          ? parsed.ministryText
          : DEFAULT_HEADER_SETTINGS.ministryText,
        frenchText: typeof parsed.frenchText === 'string'
          ? parsed.frenchText
          : DEFAULT_HEADER_SETTINGS.frenchText,
      };
    } catch (error) {
      console.warn('تعذر تحميل إعدادات ترويسة الطباعة:', error);
      return DEFAULT_HEADER_SETTINGS;
    }
  });

  const updateHeader = (nextHeader: RequestPrintHeaderSettings) => {
    setHeader(nextHeader);
    try {
      localStorage.setItem(HEADER_STORAGE_KEY, JSON.stringify(nextHeader));
    } catch (error) {
      console.error('تعذر حفظ إعدادات ترويسة الطباعة:', error);
      alert('تم تطبيق التعديل لهذه الجلسة، لكن تعذر حفظه للاستخدام التالي.');
    }
  };

  return { header, setHeader: updateHeader };
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);

export const getRequestInstitutionNameHTML = (institution: string): string =>
  institution.trim()
    ? `<div style="margin:0 auto 3mm;text-align:center;font-size:16px;font-weight:700;line-height:1.25;">${escapeHtml(institution.trim())}</div>`
    : '';

export const getRequestPrintHeaderHTML = (
  header: RequestPrintHeaderSettings,
  logoHTML: string,
): string => {
  if (!header.enabled) return '';

  if (header.image) {
    return `
      <div style="box-sizing:border-box;width:125mm;max-width:100%;margin:0 auto 2mm;text-align:center;">
        <img src="${header.image}" alt="ترويسة المؤسسة" style="display:block;width:100%;max-height:24mm;object-fit:contain;margin:0 auto;" />
      </div>
    `;
  }

  const ministryLines = escapeHtml(header.ministryText)
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => `<div>${line}</div>`)
    .join('');
  const frenchLines = escapeHtml(header.frenchText)
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => `<div>${line}</div>`)
    .join('');
  const containedLogoHTML = logoHTML.replace(
    /style="/g,
    'style="max-width:100%;max-height:100%;',
  );

  return `
    <div style="box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:3mm;width:125mm;max-width:100%;min-height:22mm;margin:0 auto 2mm;padding:0;color:#172554;direction:ltr;text-align:center;">
      <div style="flex:1;min-width:0;text-align:center;font-size:8.5px;line-height:1.5;color:#293783;direction:ltr;">
        ${frenchLines}
      </div>
      <div style="display:flex;flex:0 0 22mm;align-items:center;justify-content:center;width:22mm;height:21mm;overflow:hidden;">${containedLogoHTML}</div>
      <div style="flex:1;min-width:0;font-size:11.5px;font-weight:700;line-height:1.5;direction:rtl;">
        ${ministryLines}
      </div>
    </div>
  `;
};

export const loadRequestInstitutionDetails = async (
  dbManager: {
    getInstitutionSettings: () => Promise<Partial<RequestInstitutionDetails> | null>;
    getStudents: () => Promise<Array<{
      region?: string;
      province?: string;
      municipality?: string;
      institution?: string;
    }>>;
  },
): Promise<RequestInstitutionDetails> => {
  let databaseSettings: Partial<RequestInstitutionDetails> = {};
  try {
    databaseSettings = (await dbManager.getInstitutionSettings()) ?? {};
  } catch (error) {
    console.warn('تعذر تحميل بيانات المؤسسة من قاعدة البيانات:', error);
  }

  let importedSettings: Partial<RequestInstitutionDetails> = {};
  try {
    const saved = localStorage.getItem('institution_settings_backup');
    if (saved) importedSettings = JSON.parse(saved) as Partial<RequestInstitutionDetails>;
  } catch (error) {
    console.warn('تعذر تحميل بيانات المؤسسة المحفوظة من الاستيراد:', error);
  }

  let student: {
    region?: string;
    province?: string;
    municipality?: string;
    institution?: string;
  } = {};
  const hasStoredDetails = [
    importedSettings.academy || databaseSettings.academy,
    importedSettings.directorate || databaseSettings.directorate,
    importedSettings.municipality || databaseSettings.municipality,
    importedSettings.institution || databaseSettings.institution,
  ].every(Boolean);

  if (!hasStoredDetails) {
    try {
      const students = await dbManager.getStudents();
      student = students.find(item =>
        item.region || item.province || item.municipality || item.institution
      ) ?? {};
    } catch (error) {
      console.warn('تعذر استنتاج بيانات المؤسسة من التلاميذ المستوردين:', error);
    }
  }

  return {
    academy: importedSettings.academy || databaseSettings.academy || student.region || 'الأكاديمية الجهوية للتربية والتكوين',
    directorate: importedSettings.directorate || databaseSettings.directorate || student.province || 'المديرية الإقليمية',
    municipality: importedSettings.municipality || databaseSettings.municipality || student.municipality || 'الجماعة',
    institution: importedSettings.institution || databaseSettings.institution || student.institution || 'المؤسسة التعليمية',
  };
};
