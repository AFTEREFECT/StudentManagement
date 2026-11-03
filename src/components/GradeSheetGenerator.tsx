import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { dbManager } from '../utils/database';

const FIRST_PAGE_ROWS = 28;
const FOLLOWING_PAGE_ROWS = 30;
const PDF_PAGE_WIDTH = 794;
const PDF_PAGE_HEIGHT = 1123;

interface GradeSheetStudent {
  id: string;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  national_id?: string;
  level?: string;
  section?: string;
}

interface InstitutionSettings {
  academicYear?: string;
}

const GradeSheetGenerator: React.FC = () => {
  const [students, setStudents] = useState<GradeSheetStudent[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [subject, setSubject] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const pdfPagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        await dbManager.initialize();
        const [studentRows, institutionSettings] = await Promise.all([
          dbManager.getStudents(),
          dbManager.getInstitutionSettings() as Promise<InstitutionSettings>,
        ]);

        if (isMounted) {
          setStudents(studentRows);
          setAcademicYear(institutionSettings?.academicYear || '');
        }
      } catch (loadError) {
        console.error('تعذر تحميل بيانات ورقة التنقيط:', loadError);
        if (isMounted) setError('تعذر تحميل بيانات التلاميذ. يرجى إعادة المحاولة.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const levels = useMemo(
    () => Array.from(new Set(students.map((student) => student.level?.trim()).filter(Boolean))).sort(),
    [students]
  );

  const sections = useMemo(
    () => Array.from(new Set(
      students
        .filter((student) => student.level?.trim() === selectedLevel)
        .map((student) => student.section?.trim())
        .filter(Boolean)
    )).sort(),
    [students, selectedLevel]
  );

  const classStudents = useMemo(
    () => students
      .filter(
        (student) =>
          student.level?.trim() === selectedLevel &&
          student.section?.trim() === selectedSection
      )
      .sort((a, b) => {
        const numberA = Number.parseInt(a.studentId || '', 10);
        const numberB = Number.parseInt(b.studentId || '', 10);
        const hasNumberA = Number.isFinite(numberA);
        const hasNumberB = Number.isFinite(numberB);

        if (hasNumberA && hasNumberB && numberA !== numberB) return numberA - numberB;
        if (hasNumberA !== hasNumberB) return hasNumberA ? -1 : 1;

        const nameA = `${a.lastName || ''} ${a.firstName || ''}`.toLocaleLowerCase();
        const nameB = `${b.lastName || ''} ${b.firstName || ''}`.toLocaleLowerCase();
        return nameA.localeCompare(nameB);
      }),
    [students, selectedLevel, selectedSection]
  );

  const studentPages = useMemo(() => {
    const pages: GradeSheetStudent[][] = [];
    let start = 0;
    let pageIndex = 0;

    while (start < classStudents.length) {
      const pageSize = pageIndex === 0 ? FIRST_PAGE_ROWS : FOLLOWING_PAGE_ROWS;
      pages.push(classStudents.slice(start, start + pageSize));
      start += pageSize;
      pageIndex += 1;
    }

    return pages;
  }, [classStudents]);

  const handleExportPdf = async () => {
    const pageElements = pdfPagesRef.current?.querySelectorAll<HTMLElement>('.grade-sheet-pdf-page');
    if (!pageElements?.length) return;

    setIsExporting(true);
    setExportError('');

    try {
      await document.fonts.ready;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let index = 0; index < pageElements.length; index += 1) {
        const pageElement = pageElements[index];
        const canvas = await html2canvas(pageElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          width: PDF_PAGE_WIDTH,
          height: PDF_PAGE_HEIGHT,
          windowWidth: PDF_PAGE_WIDTH,
          windowHeight: PDF_PAGE_HEIGHT,
          logging: false,
        });

        if (index > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight);
        canvas.width = 0;
        canvas.height = 0;
      }

      const fileName = `ورقة-التنقيط-${selectedLevel}-${selectedSection}`
        .replace(/[<>:"/\\|?*]/g, '-');
      pdf.save(`${fileName}.pdf`);
    } catch (exportError) {
      console.error('تعذر إنشاء ملف PDF لورقة التنقيط:', exportError);
      setExportError('تعذر إنشاء ملف PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderSheetPage = (pageStudents: GradeSheetStudent[], pageIndex: number) => (
    <section
      key={pageIndex}
      className="grade-sheet-pdf-page"
      dir="rtl"
      style={{
        boxSizing: 'border-box',
        width: PDF_PAGE_WIDTH,
        height: PDF_PAGE_HEIGHT,
        padding: 30,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        color: '#111827',
        fontFamily: 'Arial, Tahoma, sans-serif',
      }}
    >
      {pageIndex === 0 && (
        <header
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            border: '1px solid #334155',
            borderRadius: 6,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.1fr 1fr',
              alignItems: 'center',
              gap: 12,
              direction: 'ltr',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'grid', gap: 12, direction: 'rtl', textAlign: 'right' }}>
              <div>المادة: {subject || '................'}</div>
              <div>القسم: {selectedSection || '................'}</div>
            </div>
            <div style={{ direction: 'rtl', textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 25, fontWeight: 700 }}>ورقة التنقيط</h2>
              <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600 }}>
                الموسم الدراسي: {academicYear || '................'}
              </p>
            </div>
            <div style={{ display: 'grid', gap: 12, direction: 'rtl', textAlign: 'right' }}>
              <div>الأستاذ: {teacherName || '................'}</div>
              <div>المستوى: {selectedLevel || '................'}</div>
            </div>
          </div>
        </header>
      )}

      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'center', fontSize: 13 }}>
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '9.5%' }} />
          <col style={{ width: '9.5%' }} />
          <col style={{ width: '9.5%' }} />
          <col style={{ width: '9.5%' }} />
          <col style={{ width: '11%' }} />
        </colgroup>
        <thead>
          <tr>
            {['ر.ت', 'الاسم الكامل', 'رمز مسار', 'الفرض 1', 'الفرض 2', 'الفرض 3', 'الفرض 4', 'الأنشطة المندمجة'].map((title) => (
              <th
                key={title}
                style={{
                  height: 42,
                  padding: '4px 3px',
                  border: '1px solid #1f2937',
                  backgroundColor: '#e8eef5',
                  fontSize: title === 'الاسم الكامل' ? 16 : 12,
                  fontWeight: 700,
                }}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageStudents.map((student) => (
            <tr key={student.id}>
              <td style={{ height: 32, padding: 3, border: '1px solid #1f2937', fontSize: 12 }}>
                {student.studentId || ''}
              </td>
              <td style={{ height: 32, padding: '3px 7px', border: '1px solid #1f2937', textAlign: 'right', fontSize: 15, lineHeight: 1.2, fontWeight: 700, overflowWrap: 'anywhere' }}>
                {[student.firstName, student.lastName].filter(Boolean).join(' ')}
              </td>
              <td style={{ height: 32, padding: '3px 5px', border: '1px solid #1f2937', fontSize: 12, fontWeight: 600, overflowWrap: 'anywhere' }}>
                {student.nationalId || student.national_id || ''}
              </td>
              {[1, 2, 3, 4, 5].map((scoreColumn) => (
                <td key={scoreColumn} style={{ height: 32, padding: 3, border: '1px solid #1f2937' }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <footer style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 10 }}>
        {pageIndex === studentPages.length - 1 && (
          <div style={{ minWidth: 190, paddingBottom: 5, borderBottom: '1px solid #334155', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#111827' }}>
            توقيع الأستاذ
          </div>
        )}
      </footer>
    </section>
  );

  return (
    <div className="min-h-full bg-slate-50 p-6" dir="rtl">
      <div className="grade-sheet-controls mx-auto mb-6 max-w-5xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">ورقة التنقيط</h1>
        <p className="mb-6 text-sm text-slate-600">
          اختر المستوى والقسم لإظهار لائحة تلاميذه كاملة حتى آخر تلميذ، ثم حمّل الورقة بصيغة PDF.
        </p>

        {isLoading ? (
          <p className="text-slate-600">جاري تحميل بيانات التلاميذ...</p>
        ) : error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                المستوى
                <select
                  value={selectedLevel}
                  onChange={(event) => {
                    setSelectedLevel(event.target.value);
                    setSelectedSection('');
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
                >
                  <option value="">اختر المستوى</option>
                  {levels.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                القسم
                <select
                  value={selectedSection}
                  onChange={(event) => setSelectedSection(event.target.value)}
                  disabled={!selectedLevel}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 disabled:bg-slate-100"
                >
                  <option value="">اختر القسم</option>
                  {sections.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                اسم الأستاذ
                <input
                  value={teacherName}
                  onChange={(event) => setTeacherName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                  placeholder="أدخل اسم الأستاذ"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                المادة المدرسة
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                  placeholder="أدخل المادة"
                />
              </label>
            </div>

            {students.length === 0 && (
              <p className="mt-4 text-sm text-amber-700">لا توجد بيانات للتلاميذ في قاعدة البيانات.</p>
            )}
            {selectedLevel && selectedSection && classStudents.length === 0 && (
              <p className="mt-4 text-sm text-amber-700">لا يوجد تلاميذ مسجلون في هذا القسم.</p>
            )}

            {exportError && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{exportError}</p>
            )}

            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="text-sm text-slate-600">
                {classStudents.length > 0 ? `عدد التلاميذ: ${classStudents.length}` : ''}
              </span>
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={classStudents.length === 0 || isExporting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Download size={18} />
                {isExporting ? 'جاري إنشاء PDF...' : 'تحميل ورقة التنقيط PDF'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
        {studentPages.map((pageStudents, pageIndex) => renderSheetPage(pageStudents, pageIndex))}
      </div>

      <div
        ref={pdfPagesRef}
        aria-hidden="true"
        style={{ position: 'fixed', left: -10000, top: 0, zIndex: -1 }}
      >
        {studentPages.map((pageStudents, pageIndex) => renderSheetPage(pageStudents, pageIndex))}
      </div>
    </div>
  );
};

export default GradeSheetGenerator;
