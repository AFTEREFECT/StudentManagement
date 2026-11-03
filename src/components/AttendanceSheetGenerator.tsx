import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Calendar, Download, AlertCircle, Users, CheckCircle, Filter, Layers } from 'lucide-react';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { dbManager } from '../utils/database';

type SheetType = 'daily' | 'semi-weekly-1' | 'semi-weekly-2' | 'weekly';
type SelectionMode = 'single' | 'multiple' | 'all-by-level';
type ExportFormat = 'excel' | 'pdf' | 'both' | 'print';
type ExcelGrouping = 'separate' | 'combined';
type PeriodCount = 4 | 5;

const cellValueToText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value !== 'object') return '';
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText
      .map((part) => part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? part.text : '')
      .join('');
  }
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('result' in value) return cellValueToText(value.result);
  if ('error' in value && typeof value.error === 'string') return value.error;
  return '';
};

const makeUniqueWorksheetName = (section: string, existingNames: Set<string>) => {
  const baseName = section.replace(/[\\/?*[\]:]/g, '-').replace(/^'+|'+$/g, '').slice(0, 31) || 'قسم';
  let name = baseName;
  let suffix = 2;
  while (existingNames.has(name.toLowerCase())) {
    const suffixText = ` (${suffix})`;
    name = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix++;
  }
  existingNames.add(name.toLowerCase());
  return name;
};

const addWorksheetCopy = (
  source: ExcelJS.Worksheet,
  target: ExcelJS.Worksheet,
  name: string
) => {
  target.model.merges.forEach((range) => target.unMergeCells(range));
  const model = structuredClone(source.model) as ExcelJS.WorksheetModel & { mergeCells: string[] };
  model.id = target.id;
  model.name = name;
  model.mergeCells = model.merges;
  target.model = model;
  target.name = name;
};

const excelColumnNumber = (letters: string): number =>
  letters.split('').reduce((column, letter) => column * 26 + letter.charCodeAt(0) - 64, 0);

const renderWorksheetForPrint = async (worksheet: ExcelJS.Worksheet) => {
  const printArea = worksheet.pageSetup.printArea || 'A1:BK50';
  const rangeMatch = printArea.match(/^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/);
  if (!rangeMatch) {
    throw new Error('تعذر تحديد مساحة الطباعة في قالب ورقة الغياب.');
  }

  const [, startColumnLetters, startRowText, endColumnLetters, endRowText] = rangeMatch;
  const startColumn = excelColumnNumber(startColumnLetters);
  const startRow = Number(startRowText);
  const endColumn = excelColumnNumber(endColumnLetters);
  const endRow = Number(endRowText);
  const columnWidths = Array.from(
    { length: endColumn - startColumn + 1 },
    (_, index) => worksheet.getColumn(startColumn + index).width || 8.43
  );
  const totalColumnWidth = columnWidths.reduce((total, width) => total + width, 0);
  const mergeRanges = worksheet.model.merges.map((range) => {
    const [topLeft, bottomRight] = range.split(':');
    const parseAddress = (address: string) => {
      const match = address.match(/^([A-Z]+)(\d+)$/);
      if (!match) throw new Error(`عنوان خلية غير صالح في القالب: ${address}`);
      return { column: excelColumnNumber(match[1]), row: Number(match[2]) };
    };
    return { start: parseAddress(topLeft), end: parseAddress(bottomRight) };
  });
  const container = document.createElement('div');
  container.dir = 'rtl';
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:1800px;background:#fff;color:#000;font-family:Arial,Tahoma,sans-serif;';

  const table = document.createElement('table');
  table.dir = 'rtl';
  table.style.cssText = 'width:1800px;table-layout:fixed;border-collapse:collapse;background:#fff;color:#000;';
  const columnGroup = document.createElement('colgroup');
  columnWidths.forEach((width) => {
    const column = document.createElement('col');
    column.style.width = `${(width / totalColumnWidth) * 100}%`;
    columnGroup.appendChild(column);
  });
  table.appendChild(columnGroup);

  const colorToCss = (color?: Partial<ExcelJS.Color>) => {
    if (color?.argb) return `#${color.argb.slice(-6)}`;
    if (color?.theme === 0) return '#ffffff';
    if (color?.theme === 1) return '#000000';
    if (color?.theme === 9) return '#d9eaf7';
    return undefined;
  };
  const columnLetters = (column: number) => {
    let remaining = column;
    let letters = '';
    while (remaining > 0) {
      const remainder = (remaining - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      remaining = Math.floor((remaining - 1) / 26);
    }
    return letters;
  };
  const addressOf = (column: number, row: number) => `${columnLetters(column)}${row}`;
  const borderStyle = (style?: string) => {
    if (style === 'double') return 'double';
    if (style === 'dotted' || style === 'hair') return 'dotted';
    if (style === 'dashed' || style === 'dashDot' || style === 'dashDotDot') return 'dashed';
    if (style === 'medium' || style === 'thick') return 'solid';
    return 'solid';
  };
  const borderWidth = (style?: string) => {
    if (style === 'thick') return '2px';
    if (style === 'medium') return '1.5px';
    if (style === 'hair') return '0.5px';
    return '1px';
  };

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
    const row = document.createElement('tr');
    const rowHeight = worksheet.getRow(rowNumber).height;
    if (rowHeight) row.style.height = `${(rowHeight * 96) / 72}px`;

    for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber++) {
      const merge = mergeRanges.find(({ start, end }) =>
        rowNumber >= start.row && rowNumber <= end.row &&
        columnNumber >= start.column && columnNumber <= end.column
      );
      if (merge && (rowNumber !== merge.start.row || columnNumber !== merge.start.column)) continue;

      const cell = worksheet.getCell(addressOf(columnNumber, rowNumber));
      const tableCell = document.createElement('td');
      if (merge) {
        tableCell.rowSpan = merge.end.row - merge.start.row + 1;
        tableCell.colSpan = merge.end.column - merge.start.column + 1;
      }

      const style = cell.style;
      const font = style.font;
      const alignment = style.alignment;
      const fill = style.fill && 'fgColor' in style.fill ? colorToCss(style.fill.fgColor) : undefined;
      tableCell.style.cssText = [
        'overflow:hidden',
        'padding:1px 2px',
        'vertical-align:middle',
        'text-align:center',
        'white-space:pre-wrap',
        `font-size:${font?.size || 10}pt`,
        `font-weight:${font?.bold ? 'bold' : 'normal'}`,
        `font-style:${font?.italic ? 'italic' : 'normal'}`,
        `background-color:${fill || '#ffffff'}`,
        `color:${colorToCss(font?.color) || '#000000'}`,
        `text-align:${alignment?.horizontal || 'center'}`,
        `vertical-align:${alignment?.vertical === 'top' ? 'top' : alignment?.vertical === 'bottom' ? 'bottom' : 'middle'}`,
        `white-space:${alignment?.wrapText ? 'pre-wrap' : 'nowrap'}`
      ].join(';');

      const borders = style.border;
      (['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
        const border = borders?.[side];
        if (!border?.style) return;
        const color = colorToCss(border.color) || '#000000';
        tableCell.style.setProperty(
          `border-${side}`,
          `${borderWidth(border.style)} ${borderStyle(border.style)} ${color}`
        );
      });
      tableCell.textContent = cellValueToText(cell.value);
      row.appendChild(tableCell);
    }

    table.appendChild(row);
  }

  container.appendChild(table);
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false
    });
    return canvas.toDataURL('image/png');
  } finally {
    container.remove();
  }
};

const saveWorksheetAsPdf = (imageData: string, fileName: string) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(imageData, 'PNG', 3, 3, pageWidth - 6, pageHeight - 6);
  pdf.save(fileName);
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] || character);

const renderWorksheetAsPrintHtml = (worksheet: ExcelJS.Worksheet) => {
  const printArea = worksheet.pageSetup.printArea || 'A1:BK50';
  const rangeMatch = printArea.match(/^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/);
  if (!rangeMatch) {
    throw new Error('تعذر تحديد مساحة الطباعة في قالب ورقة الغياب.');
  }

  const [, startColumnLetters, startRowText, endColumnLetters, endRowText] = rangeMatch;
  const startColumn = excelColumnNumber(startColumnLetters);
  const startRow = Number(startRowText);
  const endColumn = excelColumnNumber(endColumnLetters);
  const endRow = Number(endRowText);
  const columnWidths = Array.from(
    { length: endColumn - startColumn + 1 },
    (_, index) => worksheet.getColumn(startColumn + index).width || 8.43
  );
  const totalColumnWidth = columnWidths.reduce((total, width) => total + width, 0);
  const rowHeights = Array.from(
    { length: endRow - startRow + 1 },
    (_, index) => worksheet.getRow(startRow + index).height || 15
  );
  const totalRowHeight = rowHeights.reduce((total, height) => total + height, 0);
  const mergeRanges = worksheet.model.merges.map((range) => {
    const [topLeft, bottomRight] = range.split(':');
    const parseAddress = (address: string) => {
      const match = address.match(/^([A-Z]+)(\d+)$/);
      if (!match) throw new Error(`عنوان خلية غير صالح في القالب: ${address}`);
      return { column: excelColumnNumber(match[1]), row: Number(match[2]) };
    };
    return { start: parseAddress(topLeft), end: parseAddress(bottomRight) };
  });
  const columnLetters = (column: number) => {
    let remaining = column;
    let letters = '';
    while (remaining > 0) {
      const remainder = (remaining - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      remaining = Math.floor((remaining - 1) / 26);
    }
    return letters;
  };
  const colorToCss = (color?: Partial<ExcelJS.Color>) => {
    if (color?.argb) return `#${color.argb.slice(-6)}`;
    if (color?.theme === 0) return '#ffffff';
    if (color?.theme === 1) return '#000000';
    if (color?.theme === 9) return '#d9eaf7';
    return undefined;
  };
  const borderStyle = (style?: string) => {
    if (style === 'double') return 'double';
    if (style === 'dotted' || style === 'hair') return 'dotted';
    if (style === 'dashed' || style === 'dashDot' || style === 'dashDotDot') return 'dashed';
    return 'solid';
  };
  const borderWidth = (style?: string) =>
    style === 'thick' ? '2px' : style === 'medium' ? '1.5px' : style === 'hair' ? '0.5px' : '1px';
  const columns = columnWidths
    .map((width) => `<col style="width:${(width / totalColumnWidth) * 100}%">`)
    .join('');
  const rows: string[] = [];

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
    const rowHeight = rowHeights[rowNumber - startRow];
    const cells: string[] = [];
    for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber++) {
      const merge = mergeRanges.find(({ start, end }) =>
        rowNumber >= start.row && rowNumber <= end.row &&
        columnNumber >= start.column && columnNumber <= end.column
      );
      if (merge && (rowNumber !== merge.start.row || columnNumber !== merge.start.column)) continue;

      const address = `${columnLetters(columnNumber)}${rowNumber}`;
      const cell = worksheet.getCell(address);
      const { font, alignment } = cell.style;
      const fill = cell.style.fill && 'fgColor' in cell.style.fill
        ? colorToCss(cell.style.fill.fgColor)
        : undefined;
      const styles = [
        'box-sizing:border-box',
        'overflow:hidden',
        'padding:0 1px',
        'text-align:center',
        `font-family:'${(font?.name || 'Arial').replace(/['\\]/g, '')}',Arial,sans-serif`,
        `font-size:${Math.max(4, (font?.size || 10) * 0.48)}pt`,
        `font-weight:${font?.bold ? 'bold' : 'normal'}`,
        `font-style:${font?.italic ? 'italic' : 'normal'}`,
        `color:${colorToCss(font?.color) || '#000000'}`,
        `background-color:${fill || '#ffffff'}`,
        `text-align:${alignment?.horizontal || 'center'}`,
        `vertical-align:${alignment?.vertical === 'top' ? 'top' : alignment?.vertical === 'bottom' ? 'bottom' : 'middle'}`,
        `white-space:${alignment?.wrapText ? 'pre-wrap' : 'nowrap'}`
      ];
      (['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
        const border = cell.style.border?.[side];
        if (border?.style) {
          styles.push(
            `border-${side}:${borderWidth(border.style)} ${borderStyle(border.style)} ${colorToCss(border.color) || '#000000'}`
          );
        }
      });

      const spans = merge
        ? ` rowspan="${merge.end.row - merge.start.row + 1}" colspan="${merge.end.column - merge.start.column + 1}"`
        : '';
      cells.push(`<td${spans} style="${escapeHtml(styles.join(';'))}">${escapeHtml(cellValueToText(cell.value))}</td>`);
    }
    rows.push(`<tr style="height:${(204 * rowHeight) / totalRowHeight}mm">${cells.join('')}</tr>`);
  }

  return `<section class="sheet"><table dir="rtl"><colgroup>${columns}</colgroup><tbody>${rows.join('')}</tbody></table></section>`;
};

const printAttendanceSheets = async (printWindow: Window, pages: string[]) => {
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>أوراق الغياب</title>
        <style>
          @page { size: A4 landscape; margin: 3mm; }
          html, body { margin: 0; padding: 0; font-family: Arial, Tahoma, sans-serif; }
          .sheet { width: 291mm; height: 204mm; break-after: page; page-break-after: always; }
          .sheet table { width: 100%; height: 100%; table-layout: fixed; border-collapse: collapse; }
          .sheet tr { break-inside: avoid; page-break-inside: avoid; }
          .sheet td { line-height: 1; }
          .sheet:last-child { break-after: auto; page-break-after: auto; }
        </style>
      </head>
      <body>${pages.join('')}</body>
    </html>`);
  printWindow.document.close();

  await new Promise((resolve) => setTimeout(resolve, 500));
  printWindow.focus();
  printWindow.print();
};

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  section: string;
  level: string;
  studentId?: string;
}

const AttendanceSheetGenerator: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);

  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [filteredSections, setFilteredSections] = useState<string[]>([]);

  const [sheetType, setSheetType] = useState<SheetType>('weekly');
  const [periodCount, setPeriodCount] = useState<PeriodCount>(4);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [excelGrouping, setExcelGrouping] = useState<ExcelGrouping>('separate');

  const [mondayDate, setMondayDate] = useState<string>('');
  const [calculatedDates, setCalculatedDates] = useState<any>(null);
  const [sheetNumber, setSheetNumber] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [institutionSettings, setInstitutionSettings] = useState<any>(null);

  useEffect(() => {
    loadData();
    loadInstitutionSettings();
  }, []);

  useEffect(() => {
    if (selectedLevel) {
      const sectionsForLevel = sections.filter(section => {
        const studentsInSection = students.filter(s => s.section === section);
        return studentsInSection.some(s => s.level === selectedLevel);
      });
      setFilteredSections(sectionsForLevel);
    } else {
      setFilteredSections(sections);
    }
  }, [selectedLevel, sections, students]);

  useEffect(() => {
    if (mondayDate) {
      const dates = calculateWeekDates(mondayDate);
      setCalculatedDates(dates);
    } else {
      setCalculatedDates(null);
    }
  }, [mondayDate]);

  /**
   * 🔧 تحميل إعدادات المؤسسة من قاعدة البيانات
   *
   * @description يقوم بجلب البيانات من قاعدة البيانات وتحويلها إلى التنسيق المطلوب لورقة الغياب
   * @note يتم استدعاءها تلقائياً عند تحميل الصفحة
   * @note البيانات المحملة تُستخدم في ملء ترويسة ورقة الغياب (D1, T1, BA2)
   */
  const loadInstitutionSettings = async () => {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('🔄 [ورقة الغياب] بدء تحميل إعدادات المؤسسة...');
      console.log('='.repeat(60));

      const settings = await dbManager.getInstitutionSettings();
console.log(settings)
      
      if (!settings) {
        console.error('❌ لم يتم العثور على إعدادات المؤسسة!');
        console.warn('⚠️ يجب حفظ إعدادات المؤسسة من صفحة "الإعدادات" أولاً');
        setInstitutionSettings(null);
        return;
      }

      console.log('✅ تم جلب الإعدادات من قاعدة البيانات:', settings);

      // ✅ تحويل أسماء الحقول من قاعدة البيانات إلى التنسيق المطلوب
      const mappedSettings = {
        name: settings.institution || settings.name || '', // اسم المؤسسة → D1
        directorateName: settings.directorate || settings.directorateName || '', // اسم المديرية → T1
        academicYear: settings.academicYear || '2025/2026', // السنة الدراسية → BA2
        province: settings.academy || '',
        municipality: settings.municipality || ''
      };

      console.log('\n📋 البيانات المُعدة لورقة الغياب:');
      console.log('  ├─ اسم المؤسسة (D1):', mappedSettings.name || '❌ فارغ');
      console.log('  ├─ اسم المديرية (T1):', mappedSettings.directorateName || '❌ فارغ');
      console.log('  ├─ السنة الدراسية (BA2):', mappedSettings.academicYear || '❌ فارغ');
      console.log('  ├─ الأكاديمية:', mappedSettings.province || '❌ فارغ');
      console.log('  └─ الجماعة:', mappedSettings.municipality || '❌ فارغ');

      // ✅ التحقق من البيانات الأساسية
      if (!mappedSettings.name) {
        console.warn('⚠️ تحذير: اسم المؤسسة فارغ! لن يظهر في ورقة الغياب');
      }
      if (!mappedSettings.directorateName) {
        console.warn('⚠️ تحذير: اسم المديرية فارغ! لن يظهر في ورقة الغياب');
      }

      setInstitutionSettings(mappedSettings);
      console.log('✅ تم حفظ الإعدادات في الذاكرة بنجاح');
      console.log('='.repeat(60) + '\n');

    } catch (error) {
      console.error('\n' + '='.repeat(60));
      console.error('❌ خطأ فادح في تحميل إعدادات المؤسسة:', error);
      console.error('='.repeat(60) + '\n');
      setInstitutionSettings(null);
    }
  };

  const loadData = async () => {
    try {
      await dbManager.initialize();
      const allStudents = await dbManager.getStudents();

      if (allStudents && allStudents.length > 0) {
        setStudents(allStudents);

        const uniqueLevels = new Set<string>();
        const uniqueSections = new Set<string>();

        allStudents.forEach(student => {
          if (student.level && student.level.trim() !== '') {
            uniqueLevels.add(student.level.trim());
          }
          if (student.section && student.section.trim() !== '') {
            uniqueSections.add(student.section.trim());
          }
        });

        setLevels(Array.from(uniqueLevels).sort());
        setSections(Array.from(uniqueSections).sort());

        if (uniqueSections.size === 0) {
          setMessage({ type: 'info', text: 'لا توجد أقسام في قاعدة البيانات. يرجى إضافة تلاميذ أولاً.' });
        }
      } else {
        setMessage({ type: 'info', text: 'لا توجد بيانات تلاميذ في النظام.' });
      }
    } catch (error: any) {
      console.error('خطأ في تحميل البيانات:', error);
      setMessage({ type: 'error', text: `خطأ في تحميل البيانات: ${error.message || 'خطأ غير معروف'}` });
    }
  };

  // إرجاع كائنات التلاميذ الكاملة مع الرقم الترتيبي
  const getStudentsBySection = (section: string): Array<{name: string, studentId: string}> => {
    return students
      .filter(student => student.section === section)
      .sort((a, b) => {
        // الترتيب حسب الرقم الترتيبي (studentId) من قاعدة البيانات
        const numA = a.studentId && !isNaN(parseInt(a.studentId)) ? parseInt(a.studentId) : 9999;
        const numB = b.studentId && !isNaN(parseInt(b.studentId)) ? parseInt(b.studentId) : 9999;

        // إذا كان الرقمان متساويان أو كلاهما غير موجود (9999)، الترتيب حسب الاسم
        if (numA === numB) {
          const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
          const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
          return nameA.localeCompare(nameB);
        }

        return numA - numB;
      })
      .map(student => ({
        name: `${student.firstName} ${student.lastName}`,
        studentId: student.studentId || ''
      }));
  };

  const handleDateInput = (input: string) => {
    if (!input) return '';
    const [year, month, day] = input.split("-");
    return `${day}/${month}/${year}`;
  };

  const calculateWeekDates = (mondayDateStr: string) => {
    if (!mondayDateStr || !mondayDateStr.includes('/')) return null;

    const parts = mondayDateStr.split('/');
    if (parts.length !== 3) return null;

    const [dayStr, monthStr, yearStr] = parts;
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    const getDateString = (date: Date) => {
      const d = date.getDate();
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    };

    const monday = new Date(year, month - 1, day);
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2);
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    return {
      monday: getDateString(monday),
      tuesday: getDateString(tuesday),
      wednesday: getDateString(wednesday),
      thursday: getDateString(thursday),
      friday: getDateString(friday),
      saturday: getDateString(saturday),
    };
  };

  const toggleSectionSelection = (section: string) => {
    setSelectedSections(prev => {
      if (prev.includes(section)) {
        return prev.filter(s => s !== section);
      } else {
        return [...prev, section];
      }
    });
  };

  const selectAllSections = () => {
    setSelectedSections(filteredSections);
  };

  const clearSectionSelection = () => {
    setSelectedSections([]);
  };

  const getTemplateFileName = (type: SheetType): string => {
    switch (type) {
      case 'daily':
        return './Absence_daily.xlsx';
      case 'semi-weekly-1':
        return './Absence_fatra1.xlsx';
      case 'semi-weekly-2':
        return './Absence_fatra2.xlsx';
      case 'weekly':
      default:
        return './feuilAbsence.xlsx';
    }
  };

  /**
   * 🔧 ملء بيانات ورقة الغياب في Excel
   *
   * @param worksheet - ورقة العمل Excel
   * @param section - القسم
   * @param dates - التواريخ المحسوبة
   * @param type - نوع الورقة (يومية، نصف أسبوعية، أسبوعية)
   * @param settings - إعدادات المؤسسة (اختياري - يستخدم institutionSettings إذا لم يُمرر)
   *
   * @description يقوم بملء جميع البيانات في ورقة الغياب:
   *   - B2: اسم القسم
   *   - D1: اسم المؤسسة ← من settings.name
   *   - T1: اسم المديرية ← من settings.directorateName
   *   - BA2: السنة الدراسية ← من settings.academicYear
   *   - AH2: رقم الورقة
   *   - التواريخ في الخلايا المناسبة حسب نوع الورقة
   *   - بيانات التلاميذ (الرقم الترتيبي والاسم)
   */
  const fillWorksheetData = async (
    worksheet: ExcelJS.Worksheet,
    section: string,
    dates: any,
    type: SheetType,
    periodCount: PeriodCount,
    settings?: any
  ) => {
    // ✅ استخدام الإعدادات الممررة أو الافتراضية
    const activeSettings = settings || institutionSettings;

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🔧 ملء بيانات ورقة: ${section} (${type})`);
    console.log(`${'─'.repeat(70)}`);

    console.log('🔍 [fillWorksheetData] الإعدادات المُستخدمة:');
    console.log('  - activeSettings:', activeSettings ? 'موجود ✅' : 'null ❌');
    if (activeSettings) {
      console.log('  - name:', activeSettings.name || 'فارغ');
      console.log('  - directorateName:', activeSettings.directorateName || 'فارغ');
      console.log('  - academicYear:', activeSettings.academicYear || 'فارغ');
    }
    console.log('');

    // حذف الصيغ المشتركة لتجنب الأخطاء
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 5) {
        row.eachCell((cell) => {
          if (cell.type === ExcelJS.ValueType.Formula) {
            if ((cell as any).sharedFormula) {
              delete (cell as any).sharedFormula;
            }
          }
        });
      }
    });

    // ✅ 1. تعبئة اسم القسم في B2
    const cellB2 = worksheet.getCell('B2');
    cellB2.value = section;
    console.log(`  ✅ [B2] القسم: "${section}"`);

    // ✅ 2. تعبئة اسم المؤسسة - الخلية تختلف حسب نوع الورقة
    // للأسبوعية: D2/AK2, للأخرى: D1/T1
    const institutionCell = type === 'weekly' ? 'D2' : 'D1';
    const cellD1 = worksheet.getCell(institutionCell);
    if (activeSettings?.name) {
      cellD1.value = activeSettings.name;
      console.log(`  ✅ [${institutionCell}] اسم المؤسسة: "${activeSettings.name}"`);
      console.log(`       → القيمة في الخلية: "${cellD1.value}"`);
    } else {
      cellD1.value = '';
      console.error(`  ❌ [${institutionCell}] اسم المؤسسة: فارغ!`);
      console.error(`       → activeSettings?.name = ${activeSettings?.name}`);
    }

    // ✅ 3. تعبئة اسم المديرية - الخلية تختلف حسب نوع الورقة
    const directorateCell = type === 'weekly' ? 'AK2' : 'T1';
    const cellT1 = worksheet.getCell(directorateCell);
    if (activeSettings?.directorateName) {
      cellT1.value = activeSettings.directorateName;
      console.log(`  ✅ [${directorateCell}] اسم المديرية: "${activeSettings.directorateName}"`);
      console.log(`       → القيمة في الخلية: "${cellT1.value}"`);
    } else {
      cellT1.value = '';
      console.error(`  ❌ [${directorateCell}] اسم المديرية: فارغ!`);
      console.error(`       → activeSettings?.directorateName = ${activeSettings?.directorateName}`);
    }

    // ✅ 4. تعبئة رقم الورقة في AH2
    if (sheetNumber) {
      const cellAH2 = worksheet.getCell('AH2');
      cellAH2.value = sheetNumber;
      console.log(`  ✅ [AH2] رقم الورقة: "${sheetNumber}"`);
    }

    // ✅ 5. تعبئة السنة الدراسية في BA2
    const cellBA2 = worksheet.getCell('BA2');
    if (activeSettings?.academicYear) {
      cellBA2.value = activeSettings.academicYear;
      console.log(`  ✅ [BA2] السنة الدراسية: "${activeSettings.academicYear}"`);
      console.log(`       → القيمة في الخلية: "${cellBA2.value}"`);
    } else {
      cellBA2.value = '';
      console.warn(`  ⚠️ [BA2] السنة الدراسية: فارغ`);
    }

    console.log(`${'─'.repeat(70)}\n`);

    // تعبئة التواريخ حسب نوع الورقة
    if (type === 'semi-weekly-1') {
      console.log('✓ ورقة نصف أسبوعية - الفترة 1 (الإثنين-الأربعاء)');
      worksheet.getCell('I3').value = dates.monday;
      worksheet.getCell('S3').value = dates.tuesday;
      worksheet.getCell('AC3').value = dates.wednesday;
      console.log(`  - I3 (الإثنين): ${dates.monday}`);
      console.log(`  - S3 (الثلاثاء): ${dates.tuesday}`);
      console.log(`  - AC3 (الأربعاء): ${dates.wednesday}`);
    } else if (type === 'semi-weekly-2') {
      console.log('✓ ورقة نصف أسبوعية - الفترة 2 (الخميس-السبت)');
      worksheet.getCell('I3').value = dates.thursday;
      worksheet.getCell('S3').value = dates.friday;
      worksheet.getCell('AC3').value = dates.saturday;
      console.log(`  - I3 (الخميس): ${dates.thursday}`);
      console.log(`  - S3 (الجمعة): ${dates.friday}`);
      console.log(`  - AC3 (السبت): ${dates.saturday}`);
    } else if (type === 'weekly') {
      console.log('✓ ورقة أسبوعية كاملة');
      worksheet.getCell('I3').value = dates.monday;
      worksheet.getCell('S3').value = dates.tuesday;
      worksheet.getCell('AC3').value = dates.wednesday;
      worksheet.getCell('AM3').value = dates.thursday;
      worksheet.getCell('AW3').value = dates.friday;
      worksheet.getCell('BG3').value = dates.saturday;
    } else if (type === 'daily') {
      console.log('✓ ورقة يومية');
      worksheet.getCell('I3').value = dates.monday;
    }

    const studentsInSection = getStudentsBySection(section);

    if (studentsInSection.length === 0) {
      throw new Error(`لا توجد بيانات تلاميذ للقسم: ${section}`);
    }

    let footerRow: number | undefined;
    for (let rowNumber = 5; rowNumber <= worksheet.rowCount && footerRow === undefined; rowNumber++) {
      let hasStudentCountLabel = false;
      worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => {
        const text = cellValueToText(cell.value);
        if (text.includes('عدد المتغيبين') || text.includes('عدد التلاميذ')) {
          hasStudentCountLabel = true;
        }
      });
      if (hasStudentCountLabel) footerRow = rowNumber;
    }

    if (!footerRow) {
      throw new Error('تعذر العثور على نهاية قائمة التلاميذ في قالب ورقة الغياب.');
    }

    if (periodCount === 5) {
      let fifthPeriodSlots = 0;
      worksheet.getRow(4).eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value !== 'H4') return;

        const groupStartColumn = cell.col - 3;
        for (let offset = 0; offset < 4; offset++) {
          const header = worksheet.getRow(4).getCell(groupStartColumn + offset);
          if (header.value !== `H${offset + 1}`) {
            throw new Error('ترتيب الحصص غير صالح في قالب ورقة الغياب.');
          }
        }

        const fifthPeriodCell = worksheet.getRow(4).getCell(cell.col + 1);
        const existingValue = fifthPeriodCell.value;
        if (
          existingValue !== null &&
          existingValue !== undefined &&
          existingValue !== '' &&
          existingValue !== 'H0' &&
          existingValue !== 'H5'
        ) {
          throw new Error('تعذر تجهيز خانة الحصة الخامسة في قالب ورقة الغياب.');
        }

        let groupWidth = 0;
        for (let column = groupStartColumn; column <= fifthPeriodCell.col; column++) {
          groupWidth += worksheet.getColumn(column).width || 8.43;
        }
        const periodColumnWidth = groupWidth / 5;
        for (let column = groupStartColumn; column <= fifthPeriodCell.col; column++) {
          worksheet.getColumn(column).width = periodColumnWidth;
        }

        for (let rowNumber = 4; rowNumber < footerRow; rowNumber++) {
          const sourceCell = worksheet.getRow(rowNumber).getCell(cell.col);
          const targetCell = worksheet.getRow(rowNumber).getCell(fifthPeriodCell.col);
          const targetBorder = structuredClone(targetCell.style.border);
          targetCell.style = {
            ...structuredClone(sourceCell.style),
            border: targetBorder
          };
        }

        fifthPeriodCell.value = 'H5';
        fifthPeriodSlots++;
      });

      if (fifthPeriodSlots === 0) {
        throw new Error('لم يتم العثور على أعمدة الحصص في قالب ورقة الغياب.');
      }
    }

    const rosterStartRow = 5;
    const availableRosterRows = footerRow - rosterStartRow;
    const requiredRosterRows = studentsInSection.length + 1;
    const rowDelta = requiredRosterRows - availableRosterRows;
    const rosterHeight = Array.from(
      { length: availableRosterRows },
      (_, index) => worksheet.getRow(rosterStartRow + index).height || 22.2
    ).reduce((total, height) => total + height, 0);
    const originalPrintArea = worksheet.pageSetup.printArea || '';
    const printAreaMatch = originalPrintArea.match(/^(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?)(\d+)$/);
    const mergeRanges = worksheet.model.merges.map((range) => {
      const [topLeft, bottomRight] = range.split(':');
      const parseAddress = (address: string) => {
        const match = address.match(/^([A-Z]+)(\d+)$/);
        if (!match) throw new Error(`عنوان دمج غير صالح في القالب: ${address}`);
        return { column: match[1], row: Number(match[2]) };
      };
      return { range, start: parseAddress(topLeft), end: parseAddress(bottomRight) };
    });
    const changedRow = rowDelta < 0 ? rosterStartRow + requiredRosterRows : footerRow;
    const affectedMerges = rowDelta === 0
      ? []
      : mergeRanges.filter(({ end }) => end.row >= changedRow);
    affectedMerges.forEach(({ range }) => worksheet.unMergeCells(range));

    if (rowDelta < 0) {
      worksheet.spliceRows(rosterStartRow + requiredRosterRows, -rowDelta);
    } else if (rowDelta > 0) {
      worksheet.spliceRows(footerRow, 0, ...Array.from({ length: rowDelta }, () => []));
      const styleSource = worksheet.getRow(footerRow - 1);
      for (let rowNumber = footerRow; rowNumber < footerRow + rowDelta; rowNumber++) {
        const insertedRow = worksheet.getRow(rowNumber);
        insertedRow.height = styleSource.height;
        for (let columnNumber = 2; columnNumber <= 63; columnNumber++) {
          insertedRow.getCell(columnNumber).style = structuredClone(styleSource.getCell(columnNumber).style);
        }
      }
    }

    affectedMerges.forEach(({ start, end }) => {
      const adjustedStartRow = start.row + rowDelta;
      const adjustedEndRow = end.row + rowDelta;
      worksheet.mergeCells(`${start.column}${adjustedStartRow}:${end.column}${adjustedEndRow}`);
    });

    if (printAreaMatch && rowDelta !== 0) {
      worksheet.pageSetup.printArea = `${printAreaMatch[1]}:${printAreaMatch[2]}${Number(printAreaMatch[3]) + rowDelta}`;
    }

    const evenRowHeight = rosterHeight / requiredRosterRows;
    for (let index = 0; index < requiredRosterRows; index++) {
      worksheet.getRow(rosterStartRow + index).height = evenRowHeight;
    }

    studentsInSection.forEach((student, index) => {
      const rowNumber = 5 + index;

      const setCellValueSafely = (columnLetter: string, value: any) => {
        try {
          const cell = worksheet.getRow(rowNumber).getCell(columnLetter);
          delete (cell as any).sharedFormula;
          if (cell.type === ExcelJS.ValueType.Formula) {
            cell.value = null;
          }
          cell.value = value;
        } catch (error) {
          console.warn(`⚠️ خطأ في تعيين قيمة الخلية ${columnLetter}${rowNumber}:`, error);
        }
      };

      // ✅ استخدام الرقم الترتيبي من قاعدة البيانات (من العمود A في ملف الاستيراد)
      let serialNumber = student.studentId || String(index + 1);

      // تحويل إلى رقم إذا كان نصاً
      if (typeof serialNumber === 'string') {
        const parsedId = parseInt(serialNumber);
        if (!isNaN(parsedId) && parsedId > 0) {
          serialNumber = parsedId;
        } else {
          serialNumber = index + 1; // احتياطي
        }
      }

      console.log(`📋 ${index + 1}. ${student.name} - الرقم الترتيبي: ${serialNumber} (من DB: ${student.studentId})`);

      // ✅ كتابة الرقم الترتيبي في العمود B (حسب القالب)
      setCellValueSafely('B', serialNumber);
      setCellValueSafely('C', student.name);
    });

    const reserveRow = rosterStartRow + studentsInSection.length;
    worksheet.getCell(`B${reserveRow}`).value = studentsInSection.length + 1;
    worksheet.getCell(`C${reserveRow}`).value = '';
  };

  const generateAttendanceSheet = async () => {
    if (selectionMode === 'single' && selectedSections.length === 0) {
      setMessage({ type: 'error', text: 'الرجاء اختيار قسم واحد على الأقل' });
      return;
    }

    if (selectionMode === 'multiple' && selectedSections.length === 0) {
      setMessage({ type: 'error', text: 'الرجاء اختيار الأقسام المطلوبة' });
      return;
    }

    if (selectionMode === 'all-by-level' && !selectedLevel) {
      setMessage({ type: 'error', text: 'الرجاء اختيار المستوى' });
      return;
    }

    if (!mondayDate) {
      setMessage({ type: 'error', text: 'الرجاء إدخال تاريخ يوم الاثنين' });
      return;
    }

    let printWindow: Window | null = null;
    const printPages: string[] = [];
    if (exportFormat === 'print') {
      printWindow = window.open('', '_blank');
      if (!printWindow) {
        setMessage({ type: 'error', text: 'تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' });
        return;
      }
      printWindow.document.write('<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>جاري تجهيز أوراق الغياب</title></head><body>جاري تجهيز أوراق الغياب للطباعة...</body></html>');
      printWindow.document.close();
    }

    setIsGenerating(true);
    setMessage({ type: 'info', text: 'جاري توليد ورقة/أوراق الغياب...' });

    try {
      console.log('🚀 بدء توليد أوراق الغياب');

      // ✅ CRITICAL FIX: التحقق من institutionSettings وإعادة جلبها إذا لزم الأمر
      console.log('🔍 التحقق من إعدادات المؤسسة...');
      console.log('📊 قيمة institutionSettings الحالية:', institutionSettings);

      let currentSettings = institutionSettings;

      if (!currentSettings || !currentSettings.name || !currentSettings.directorateName) {
        console.warn('⚠️ institutionSettings فارغ أو ناقص! إعادة الجلب من قاعدة البيانات...');

        const freshSettings = await dbManager.getInstitutionSettings();

        if (!freshSettings) {
          throw new Error('يجب حفظ إعدادات المؤسسة من صفحة "الإعدادات" أولاً!');
        }

        currentSettings = {
          name: freshSettings.institution || freshSettings.name || '',
          directorateName: freshSettings.directorate || freshSettings.directorateName || '',
          academicYear: freshSettings.academicYear || '2025/2026',
          province: freshSettings.academy || '',
          municipality: freshSettings.municipality || ''
        };

        setInstitutionSettings(currentSettings);
        console.log('✅ تم إعادة تحميل الإعدادات:', currentSettings);
      }

      console.log('\n✅ إعدادات المؤسسة المُستخدمة في التوليد:');
      console.log('  ├─ اسم المؤسسة (D1):', currentSettings.name || '❌ فارغ');
      console.log('  ├─ اسم المديرية (T1):', currentSettings.directorateName || '❌ فارغ');
      console.log('  ├─ السنة الدراسية (BA2):', currentSettings.academicYear || '❌ فارغ');
      console.log('  ├─ الأكاديمية:', currentSettings.province || '❌ فارغ');
      console.log('  └─ الجماعة:', currentSettings.municipality || '❌ فارغ\n');

      const templateFile = getTemplateFileName(sheetType);
      console.log('📂 ملف القالب:', templateFile);
      const response = await fetch(templateFile);

      if (!response.ok) {
        throw new Error(`لم يتم العثور على قالب ${sheetType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const arrayView = new Uint8Array(arrayBuffer);
      const isDummyFile = arrayView.length < 200 ||
        new TextDecoder().decode(arrayView.slice(0, 50)).includes('[ATTENDANCE TEMPLATE');

      if (isDummyFile) {
        throw new Error(`قالب ${templateFile} غير صالح. يرجى استبداله بملف Excel صحيح.`);
      }

      let sectionsToProcess: string[] = [];

      if (selectionMode === 'single' || selectionMode === 'multiple') {
        sectionsToProcess = selectedSections;
      } else if (selectionMode === 'all-by-level') {
        sectionsToProcess = filteredSections;
      }

      if (sectionsToProcess.length === 0) {
        throw new Error('لا توجد أقسام تحتوي على تلاميذ لتوليد أوراق الغياب.');
      }

      const dates = calculateWeekDates(mondayDate);
      if (!dates) {
        throw new Error('خطأ في حساب التواريخ');
      }

      const shouldCombineExcel =
        (exportFormat === 'excel' || exportFormat === 'both') && excelGrouping === 'combined';
      let combinedWorkbook: ExcelJS.Workbook | null = null;
      if (shouldCombineExcel) {
        combinedWorkbook = new ExcelJS.Workbook();
        await combinedWorkbook.xlsx.load(arrayBuffer, {
          ignoreNodes: ['dataValidations', 'conditionalFormatting']
        });
      }
      const worksheetNames = new Set<string>();
      let worksheetIndex = 0;
      const sheetTypeName = sheetType === 'daily' ? 'يومية' :
                           sheetType === 'semi-weekly-1' ? 'نصف_أسبوعية_فترة1' :
                           sheetType === 'semi-weekly-2' ? 'نصف_أسبوعية_فترة2' : 'أسبوعية';

      for (const section of sectionsToProcess) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer, {
          ignoreNodes: ['dataValidations', 'conditionalFormatting']
        });

        let worksheet = workbook.getWorksheet('Feuil1') || workbook.getWorksheet(1);

        if (!worksheet) {
          throw new Error('لم يتم العثور على ورقة العمل في القالب');
        }

        // ✅ تمرير currentSettings بشكل صريح لضمان استخدام البيانات الصحيحة
        await fillWorksheetData(worksheet, section, dates, sheetType, periodCount, currentSettings);

        const safeSectionName = section.replace(/[<>:"/\\|?*]/g, '-');
        const periodSuffix = periodCount === 5 ? '_H1-H5' : '';
        const fileBaseName = `ورقة_الغياب_${sheetTypeName}_${safeSectionName}_${mondayDate.replace(/\//g, '-')}${periodSuffix}`;

        if (combinedWorkbook) {
          const worksheetName = makeUniqueWorksheetName(section, worksheetNames);
          const targetWorksheet = worksheetIndex === 0
            ? combinedWorkbook.worksheets[0]
            : combinedWorkbook.addWorksheet(worksheetName);
          if (!targetWorksheet) {
            throw new Error('تعذر تجهيز ورقة القسم في ملف Excel الموحّد.');
          }
          addWorksheetCopy(worksheet, targetWorksheet, worksheetName);
          worksheetIndex++;
        } else if (exportFormat === 'excel' || exportFormat === 'both') {
          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileBaseName}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }

        if (exportFormat !== 'excel') {
          if (exportFormat === 'print') {
            printPages.push(renderWorksheetAsPrintHtml(worksheet));
          } else {
            const image = await renderWorksheetForPrint(worksheet);
            saveWorksheetAsPdf(image, `${fileBaseName}.pdf`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (combinedWorkbook) {
        const buffer = await combinedWorkbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const periodSuffix = periodCount === 5 ? '_H1-H5' : '';
        link.download = `أوراق_الغياب_${sheetTypeName}_${mondayDate.replace(/\//g, '-')}${periodSuffix}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      if (printWindow && printPages.length > 0) {
        await printAttendanceSheets(printWindow, printPages);
      }

      setMessage({
        type: 'success',
        text: exportFormat === 'print'
          ? `تم تجهيز ${sectionsToProcess.length} ورقة غياب وفتح نافذة الطباعة.`
          : `تم توليد ${sectionsToProcess.length} ورقة غياب بنجاح (${combinedWorkbook ? 'ملف Excel واحد بأوراق متعددة' : exportFormat === 'excel' ? 'Excel' : exportFormat === 'pdf' ? 'PDF' : 'Excel وPDF'}).`
      });
    } catch (error: any) {
      console.error('خطأ في توليد ورقة الغياب:', error);
      if (printWindow && !printWindow.closed) printWindow.close();
      setMessage({
        type: 'error',
        text: error.message || 'حدث خطأ غير متوقع'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-4">
          <div className="bg-white p-4 rounded-xl">
            <FileSpreadsheet className="w-10 h-10 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">توليد ورقة الغياب المتقدم</h1>
            <p className="text-blue-100 mt-1">نظام متكامل مع فلترة متقدمة وخيارات مرنة</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-yellow-800 mb-2">ملاحظات هامة:</h3>
            <ul className="text-gray-700 space-y-1 text-sm list-disc list-inside">
           
              <li>الفترة الأولى: الإثنين-الأربعاء | الفترة الثانية: الخميس-السبت</li>
               <li>يمكنك فلترة الأقسام حسب المستوى في جميع أوضاع الاختيار</li>
              <li>تُحذف صفوف الأسماء الفارغة وتُضاف خانة واحدة احتياطية، مع الحفاظ على التوقيعات</li>
              <li>يمكن اختيار 4 حصص كما في النموذج الحالي أو 5 حصص من H1 إلى H5</li>
              <li>يمكن اختيار Excel أو PDF أو تنزيل الصيغتين معاً، أو فتح الطباعة المباشرة</li>
              <li>الطباعة المباشرة تفتح نافذة الطباعة؛ اختر الطابعة أو الحفظ PDF من النافذة</li>
            </ul>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 border-green-300 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-300 text-red-800' :
          'bg-blue-50 border-blue-300 text-blue-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Filter className="w-6 h-6 text-blue-600" />
          خيارات التوليد
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-700 font-bold mb-2">
              نوع ورقة الغياب <span className="text-red-500">*</span>
            </label>
            <select
              value={sheetType}
              onChange={(e) => setSheetType(e.target.value as SheetType)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="daily">يومية</option>
              <option value="semi-weekly-1">نصف أسبوعية - الفترة 1 (الإثنين-الأربعاء)</option>
              <option value="semi-weekly-2">نصف أسبوعية - الفترة 2 (الخميس-السبت)</option>
              <option value="weekly">أسبوعية كاملة</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-2">
              طريقة الاختيار <span className="text-red-500">*</span>
            </label>
            <select
              value={selectionMode}
              onChange={(e) => {
                setSelectionMode(e.target.value as SelectionMode);
                setSelectedSections([]);
                setSelectedLevel('');
              }}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="single">قسم واحد</option>
              <option value="multiple">عدة أقسام (اختيار يدوي)</option>
              <option value="all-by-level">كل أقسام مستوى معين</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-gray-700 font-bold mb-2">
            عدد الحصص في كل فترة
          </label>
          <select
            value={periodCount}
            onChange={(event) => setPeriodCount(event.target.value === '5' ? 5 : 4)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={4}>4 حصص (H1-H4) - النموذج الحالي</option>
            <option value={5}>5 حصص (H1-H5)</option>
          </select>
        </div>

        {selectionMode === 'all-by-level' && (
          <div>
            <label className="block text-gray-700 font-bold mb-2">
              <Layers className="w-5 h-5 inline ml-2" />
              المستوى <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">اختر المستوى</option>
              {levels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        )}

        {(selectionMode === 'single' || selectionMode === 'multiple') && (
          <div>
            <div className="mb-4">
              <label className="block text-gray-700 font-bold mb-2">
                <Layers className="w-5 h-5 inline ml-2" />
                فلترة حسب المستوى (اختياري)
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">جميع المستويات</option>
                {levels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              {selectedLevel && (
                <p className="text-sm text-gray-600 mt-2">
                  عرض الأقسام الخاصة بالمستوى: {selectedLevel} ({filteredSections.length} قسم)
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="block text-gray-700 font-bold">
                <Users className="w-5 h-5 inline ml-2" />
                الأقسام <span className="text-red-500">*</span>
              </label>
              {selectionMode === 'multiple' && (
                <div className="flex gap-2">
                  <button
                    onClick={selectAllSections}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    تحديد الكل
                  </button>
                  <button
                    onClick={clearSectionSelection}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              )}
            </div>

            {selectionMode === 'single' ? (
              <select
                value={selectedSections[0] || ''}
                onChange={(e) => setSelectedSections(e.target.value ? [e.target.value] : [])}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">اختر القسم</option>
                {filteredSections.map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-4 border-2 border-gray-200 rounded-xl">
                {filteredSections.map((section) => (
                  <label
                    key={section}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedSections.includes(section)
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(section)}
                      onChange={() => toggleSectionSelection(section)}
                      className="rounded"
                    />
                    <span className="font-medium">{section}</span>
                  </label>
                ))}
              </div>
            )}

            {selectedSections.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                تم تحديد {selectedSections.length} قسم
              </p>
            )}
          </div>
        )}

        {selectionMode === 'all-by-level' && selectedLevel && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-blue-800 font-medium">
              سيتم توليد أوراق غياب لجميع أقسام المستوى "{selectedLevel}" ({filteredSections.length} قسم)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {filteredSections.map(section => (
                <span key={section} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                  {section}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-gray-700 font-bold mb-2">
            <Calendar className="w-5 h-5 inline ml-2" />
            التاريخ المرجعي (يوم الاثنين) <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            onChange={(e) => {
              const formatted = handleDateInput(e.target.value);
              setMondayDate(formatted);
            }}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {calculatedDates && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-300">
            <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              تواريخ أيام الأسبوع المحسوبة:
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">الاثنين</div>
                <div className="text-lg font-bold text-gray-800">{calculatedDates.monday}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">الثلاثاء</div>
                <div className="text-lg font-bold text-gray-800">{calculatedDates.tuesday}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">الأربعاء</div>
                <div className="text-lg font-bold text-gray-800">{calculatedDates.wednesday}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">الخميس</div>
                <div className="text-lg font-bold text-gray-800">{calculatedDates.thursday}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">الجمعة</div>
                <div className="text-lg font-bold text-gray-800">{calculatedDates.friday}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">السبت</div>
                <div className="text-lg font-bold text-gray-800">{calculatedDates.saturday}</div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-gray-700 font-bold mb-2">
            رقم ورقة الغياب (اختياري)
          </label>
          <input
            type="text"
            value={sheetNumber}
            onChange={(e) => setSheetNumber(e.target.value)}
            placeholder="أدخل رقم ورقة الغياب"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-bold mb-2">
            طريقة الإخراج
          </label>
          <select
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="excel">Excel فقط</option>
            <option value="pdf">PDF فقط</option>
            <option value="both">Excel وPDF</option>
            <option value="print">طباعة مباشرة</option>
          </select>
        </div>

        {(exportFormat === 'excel' || exportFormat === 'both') && (
          <div>
            <label className="block text-gray-700 font-bold mb-2">
              طريقة جمع أوراق Excel
            </label>
            <select
              value={excelGrouping}
              onChange={(event) => setExcelGrouping(event.target.value as ExcelGrouping)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="separate">ملف مستقل لكل قسم</option>
              <option value="combined">ملف واحد بأوراق متعددة (ورقة لكل قسم)</option>
            </select>
          </div>
        )}

        <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
          <h3 className="font-bold text-blue-800 mb-3">معلومات المؤسسة (من الإعدادات):</h3>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-semibold text-gray-700">اسم المؤسسة:</span>
              <span className="text-gray-600 mr-2">{institutionSettings?.name || 'غير محدد'}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">اسم المديرية:</span>
              <span className="text-gray-600 mr-2">{institutionSettings?.directorateName || 'غير محدد'}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">الموسم الدراسي:</span>
              <span className="text-gray-600 mr-2">{institutionSettings?.academicYear || 'غير محدد'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={generateAttendanceSheet}
          disabled={isGenerating || !mondayDate ||
            (selectionMode === 'single' && selectedSections.length === 0) ||
            (selectionMode === 'multiple' && selectedSections.length === 0) ||
            (selectionMode === 'all-by-level' && !selectedLevel)}
          className={`w-full py-4 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-3 transition-all ${
            isGenerating || !mondayDate ||
            (selectionMode === 'single' && selectedSections.length === 0) ||
            (selectionMode === 'multiple' && selectedSections.length === 0) ||
            (selectionMode === 'all-by-level' && !selectedLevel)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              جاري التوليد...
            </>
          ) : (
            <>
              <Download className="w-6 h-6" />
              {exportFormat === 'print' ? 'توليد وطباعة أوراق الغياب' : 'توليد وتنزيل أوراق الغياب'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AttendanceSheetGenerator;
