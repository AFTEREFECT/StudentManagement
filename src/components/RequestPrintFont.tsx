import React from 'react';
import { REQUEST_PRINT_FONTS } from '../utils/requestPrintFont';
import type {
  RequestPrintFont,
  RequestPrintHeaderSettings,
} from '../utils/requestPrintFont';

interface RequestPrintFontSelectorProps {
  value: RequestPrintFont;
  onChange: (font: RequestPrintFont) => void;
  header: RequestPrintHeaderSettings;
  onHeaderChange: (header: RequestPrintHeaderSettings) => void;
}

const RequestPrintFontSelector: React.FC<RequestPrintFontSelectorProps> = ({
  value,
  onChange,
  header,
  onHeaderChange,
}) => {
  const selectedFont = REQUEST_PRINT_FONTS.find(font => font.value === value) ?? REQUEST_PRINT_FONTS[0];

  const handleHeaderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      alert('يرجى اختيار صورة ترويسة بصيغة PNG أو JPG.');
      return;
    }
    if (file.size > 1024 * 1024) {
      alert('حجم صورة الترويسة يجب ألا يتجاوز 1 ميغابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        alert('تعذر قراءة صورة الترويسة.');
        return;
      }
      onHeaderChange({ ...header, image: reader.result });
    };
    reader.onerror = () => alert('تعذر قراءة صورة الترويسة.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="md:col-span-2 space-y-4">
      <div>
        <label htmlFor="request-print-font" className="mb-2 block text-sm font-medium text-gray-700">
          نوع الخط في الوثيقة المطبوعة
        </label>
        <select
          id="request-print-font"
          value={value}
          onChange={event => {
            const nextFont = REQUEST_PRINT_FONTS.find(font => font.value === event.target.value);
            if (nextFont) onChange(nextFont.value);
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          style={{ fontFamily: selectedFont.family }}
        >
          {REQUEST_PRINT_FONTS.map(font => (
            <option key={font.value} value={font.value} style={{ fontFamily: font.family }}>
              {font.label}
            </option>
          ))}
        </select>
        <p
          className="mt-2 rounded border border-gray-200 bg-white p-2 text-sm text-gray-700"
          style={{ fontFamily: selectedFont.family }}
          dir="rtl"
        >
          معاينة الخط: طلب الملف المدرسي للتلميذ(ة)
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={header.enabled}
            onChange={event => onHeaderChange({ ...header, enabled: event.target.checked })}
          />
          إضافة الترويسة إلى الوثيقة (مفعّلة افتراضياً)
        </label>

        {header.enabled && (
          <div className="mt-3 space-y-3">
            {header.image ? (
              <div className="space-y-2">
                <img
                  src={header.image}
                  alt="معاينة الترويسة المخصصة"
                  className="max-h-24 w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => onHeaderChange({ ...header, image: '' })}
                  className="text-sm font-medium text-red-700 hover:text-red-800"
                >
                  استعادة الترويسة النصية الافتراضية
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <textarea
                  value={header.ministryText}
                  onChange={event => onHeaderChange({ ...header, ministryText: event.target.value })}
                  aria-label="النص العربي في الترويسة"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  dir="rtl"
                />
                <textarea
                  value={header.frenchText}
                  onChange={event => onHeaderChange({ ...header, frenchText: event.target.value })}
                  aria-label="النص الفرنسي في الترويسة"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  dir="ltr"
                />
                <p
                  className="rounded border border-gray-200 p-3 text-center text-sm font-bold leading-7 text-blue-900"
                  style={{ fontFamily: selectedFont.family }}
                  dir="rtl"
                >
                  {header.ministryText}
                </p>
                <p
                  className="rounded border border-gray-200 p-3 text-center text-xs font-bold leading-7 text-blue-900"
                  dir="ltr"
                >
                  {header.frenchText}
                </p>
              </div>
            )}
            <label className="block text-sm text-gray-700">
              استبدال الترويسة بصورة مخصصة (PNG أو JPG، حتى 1 ميغابايت)
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleHeaderUpload}
                className="mt-2 block w-full text-sm"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestPrintFontSelector;
