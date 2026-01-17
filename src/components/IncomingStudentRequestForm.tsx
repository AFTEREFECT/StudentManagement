


import React, { useState, useEffect } from 'react';
import { X, Send, FileText, Building, Calendar, Users, Download, Printer, AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { logoManager } from '../utils/logoManager';
import { correspondenceReminder, ReminderAlert } from '../utils/correspondenceReminder';
import ServiceManager from '../utils/serviceManager';
import { dbManager } from '../utils/database';

interface IncomingStudent {
  id: string;
  studentId: string; 
  lastName: string;
  firstName: string;
  transferDate: string;
  transferType: string;
  originalInstitution: string;
  originalDirectorate: string;
  originalAcademy: string;
  academy: string;
  directorate: string;
  level: string;
  municipality: string;
  institution: string;
  academicYear: string;
  fileStatus: 'لم يتم الإرسال' | 'طلب مرسل' | 'ملف تم التوصل به' | 'مكرر' | 'غير معروف';
  requestCount: number;
  notes: string;
  linkedGender?: 'ذكر' | 'أنثى' | 'غير محدد';
  linkedSection?: string;
  linkedNationalId?: string;
  isLinked: boolean;
}

interface IncomingStudentRequestFormProps {
  students: IncomingStudent[];
  onRequestSent: () => void;
  onCancel: () => void;
}

const IncomingStudentRequestForm: React.FC<IncomingStudentRequestFormProps> = ({
  students,
  onRequestSent,
  onCancel,
}) => {
  const [requestData, setRequestData] = useState({
    serviceType: 'مصلحة التأطير و تنشيط المؤسسات التعليمية ،و التوجيه',
    institutionName: '',
    requestDate: new Date().toISOString().split('T')[0],
    sendingNumber: '',
    requestNumber: '1',
    reference: '',
    lastCorrespondenceDate: '',
    notes: '',
    requestType: 'فردي' as 'فردي' | 'جماعي',
    regionalScope: 'داخل الإقليم' as 'داخل الإقليم' | 'خارج الإقليم',
    includeSendingNumber: true,
    includeReference: true,
    includeLastCorrespondenceDate: true,
  });

  const [generating, setGenerating] = useState(false);
  const [reminderAlert, setReminderAlert] = useState<ReminderAlert | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [includeReminderInReport, setIncludeReminderInReport] = useState(false);
  const [services, setServices] = useState(ServiceManager.getServices());
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [showDeleteServiceModal, setShowDeleteServiceModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [institutionSettings, setInstitutionSettings] = useState({
    academy: '',
    directorate: '',
    municipality: '',
    institution: '',
  });

  useEffect(() => {
    checkForSimilarRequests();
    loadInstitutionSettings();

    const uniqueInstitutions = new Set(students.map(s => s.originalInstitution));
    if (uniqueInstitutions.size === 1 && students.length > 1) {
      setRequestData(prev => ({
        ...prev,
        requestType: 'جماعي',
        institutionName: Array.from(uniqueInstitutions)[0] || '',
        reference: generateReference(),
      }));
    } else {
      setRequestData(prev => ({
        ...prev,
        requestType: 'فردي',
        institutionName: students[0]?.originalInstitution || '',
        reference: generateReference(),
      }));
    }
  }, [students]);

  const loadInstitutionSettings = async () => {
    try {
      try {
        const settings = await dbManager.getInstitutionSettings();
        if (settings && settings.academy) {
          setInstitutionSettings({
            academy: settings.academy,
            directorate: settings.directorate,
            municipality: settings.municipality,
            institution: settings.institution,
          });
          return;
        }
      } catch {
        // لا توجد إعدادات في قاعدة البيانات
      }
      try {
        const allStudents = await dbManager.getStudents();
        const studentWithData = allStudents.find(
          s => s.region || s.province || s.municipality || s.institution
        );
        if (studentWithData) {
          setInstitutionSettings({
            academy: studentWithData.region || 'الأكاديمية الجهوية للتربية والتكوين',
            directorate: studentWithData.province || 'المديرية الإقليمية',
            municipality: studentWithData.municipality || 'الجماعة',
            institution: studentWithData.institution || 'المؤسسة التعليمية',
          });
          return;
        }
      } catch {
        // لا توجد بيانات في التلاميذ
      }
      setInstitutionSettings({
        academy: 'الأكاديمية الجهوية للتربية والتكوين',
        directorate: 'المديرية الإقليمية',
        municipality: 'الجماعة',
        institution: 'المؤسسة التعليمية',
      });
    } catch (error) {
      setInstitutionSettings({
        academy: 'الأكاديمية الجهوية للتربية والتكوين',
        directorate: 'المديرية الإقليمية',
        municipality: 'الجماعة',
        institution: 'المؤسسة التعليمية',
      });
    }
  };

  const handleAddService = () => {
    try {
      if (!newServiceName.trim()) {
        alert('يرجى إدخال اسم المصلحة');
        return;
      }
      const newService = ServiceManager.addService(newServiceName, newServiceDescription);
      setServices(ServiceManager.getServices());
      setRequestData(prev => ({ ...prev, serviceType: newService.name }));
      setShowAddServiceModal(false);
      setNewServiceName('');
      setNewServiceDescription('');
      alert('تم إضافة المصلحة بنجاح!');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'خطأ في إضافة المصلحة');
    }
  };

  const handleDeleteService = () => {
    if (!serviceToDelete) return;
    try {
      const canDelete = ServiceManager.canDeleteService(serviceToDelete);
      if (!canDelete) {
        alert('لا يمكن حذف المصالح الافتراضية');
        return;
      }
      const success = ServiceManager.deleteService(serviceToDelete);
      if (success) {
        setServices(ServiceManager.getServices());
        const deletedService = services.find(s => s.id === serviceToDelete);
        if (deletedService && requestData.serviceType === deletedService.name) {
          setRequestData(prev => ({ ...prev, serviceType: 'مصلحة الشؤون التربوية' }));
        }
        setShowDeleteServiceModal(false);
        setServiceToDelete(null);
        alert('تم حذف المصلحة بنجاح!');
      } else {
        alert('خطأ في حذف المصلحة');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'خطأ في حذف المصلحة');
    }
  };

  const checkForSimilarRequests = () => {
    if (students.length > 0) {
      const firstStudent = students[0];
      const institutionName = firstStudent.originalInstitution || '';
      if (institutionName) {
        const reminder = correspondenceReminder.checkForSimilarRequests(
          firstStudent.studentId,
          institutionName
        );
        if (reminder && reminder.hasReminder) {
          setReminderAlert(reminder);
          setShowReminderModal(true);
        }
      }
    }
  };

  const generateRequestNumber = (studentIndex: number = 0): string => {
    const userRequestNumber = requestData.requestNumber;
    if (userRequestNumber === 'طلب التدخل') {
      return 'طلب التدخل';
    }
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const sequence = userRequestNumber.padStart(2, '0');
    return ` ${sequence}`;
  };

  const generateReference = (): string => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `REF-${year}${month}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
  };

  const generateRecipientSection = (student: IncomingStudent) => {
    if (requestData.regionalScope === 'خارج الإقليم') {
      return `
        <div style="display: inline-block; border: 3px ; border-radius: 60px; padding:20px 100px; max-width: 600px;">
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            إلى السيد مدير ثانوية ${student?.originalInstitution}
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            -تحت إشراف السيد(ة) المدير(ة) الإقليمي-
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            -${requestData.serviceType || "مصلحة التأطير و تنشيط المؤسسات التعليمية، و التوجيه"}
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            -المديرية الإقليمية بـ${student?.originalDirectorate || student?.directorate}
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            -تحت إشراف السيد(ة) المدير(ة) الإقليمي
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            -المديرية الإقليمية بـ${institutionSettings?.directorate}
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; line-height: 1.6;">
            -بأكاديمية:${student?.originalAcademy || student?.academy}
          </div>
        </div>
      `;
    } else {
      return `
        <div style="display: inline-block; border: 3px solid transparent; border-radius: 60px; padding: 15px 50px; max-width: 650px;">
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            إلى السيد مدير ثانوية ${student?.originalInstitution || requestData.institutionName}
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            -تحت إشراف السيد(ة) المدير(ة) الإقليمي-
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; margin-bottom: 3px; line-height: 1.6;">
            -${requestData.serviceType || "مصلحة التأطير و تنشيط المؤسسات التعليمية، و التوجيه"}
          </div>
          <div style="font-weight: bold; font-size: 14px; text-align: right; line-height: 1.6;">
            -المديرية الإقليمية بـ${institutionSettings?.directorate}
          </div>
        </div>
      `;
    }
  };

  const generateRequestHTML = (
    student: IncomingStudent,
    requestNumber: string,
    isMultiple: boolean = false
  ) => {
    const logoHTML = logoManager.getLogoHTML();
    return `
      <div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 4mm; line-height: 1.7; background: white; color: #000;">
        <div style="text-align: center; margin-bottom: 4mm; border-bottom: 1.5px solid #1e40af; padding-bottom: 2mm;">
          ${logoHTML}
          <div style="font-size: 16px; font-weight: bold; color: #1e40af; margin: 2mm 0;">
            المديرية الإقليمية بـ ${institutionSettings.directorate}
          </div>
          <div style="font-size: 16px; color: #1e40af; margin: 2mm 0;">
            ${institutionSettings.institution}
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div style="font-weight: bold; font-size: 14px;">من مدير المؤسسة</div>
          <div style="font-weight: bold; font-size: 14px;">
            ${requestData.requestDate ? `تاريخ: ${new Date(requestData.requestDate).toLocaleDateString('fr-MA')}` : ''}
          </div>
        </div>
        <div style="margin: 18px 0 12px 0; display: flex; flex-direction: column; align-items: center;">
          ${generateRecipientSection(student)}
        </div>
        <div style="margin: 16px 0 18px 0; width: 100%; max-width: 950px; padding: 11px 28px 7px 28px; text-align: right; font-weight: bold;">
          <div style="font-size: 14px; color: #222; margin-bottom: 11px; text-align: right;">
            الموضوع: طلب ملف مدرسي ${isMultiple ? 'للتلاميذ' : 'للتلميذ(ة)'} رقم : ${requestNumber}
          </div>
          <div style="display: flex; justify-content: flex-start; align-items: center; gap: 44px; font-size: 14px;">
            ${requestData.includeSendingNumber && requestData.sendingNumber ? `<span style="color: #1e40af;">رقم الإرسال: ${requestData.sendingNumber}</span>` : ''}
            ${requestData.includeReference && requestData.reference ? `<span style="color: #1e40af;">المرجع: ${requestData.reference}</span>` : ''}
          </div>
        </div>

        <div style="margin-bottom: 12px; text-align: center; font-size: 14px;">
          <p style="margin-bottom: 3mm; font-weight: bold;">سلام تام بوجود مولانا الإمام أيده الله،</p>
          <p style="margin-bottom: 2mm; font-weight: bold;">
            وبعد، نرجو منكم التكرم بإرسال ${isMultiple ? 'الملفات المدرسية للتلاميذ' : 'الملف المدرسي للتلميذ(ة)'} المذكور${isMultiple ? 'ين' : ''} أدناه، وذلك لاستكمال إجراءات تسجيل${isMultiple ? 'هم' : 'ه'} بمؤسستنا للموسم الدراسي الحالي.
          </p>
        </div>
      
        <div style="margin-bottom: 5mm;">
     

<table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 2px solid #374151;">
  <thead>
    <tr style="background: #e5e7eb;">
      <th style="border: 1px solid #374151; padding: 7px; text-align: center; font-weight: bold; width: 7%;">الرقم الترتيبي</th>
      <th style="border: 1px solid #374151; padding: 7px; text-align: center; font-weight: bold; width: 18%;">الرقم الوطني</th>
      <th style="border: 1px solid #374151; padding: 7px; text-align: center; font-weight: bold; width: 20%;">الاسم الكامل</th>
      <th style="border: 1px solid #374151; padding: 7px; text-align: center; font-weight: bold; width: 10%;">النوع</th>
      <th style="border: 1px solid #374151; padding: 7px; text-align: center; font-weight: bold; width: 32%;">المستوى</th>
      <th style="border: 1px solid #374151; padding: 7px; text-align: center; font-weight: bold; width: 13%;">تاريخ التحويل</th>
    </tr>
  </thead>
 

            
            <tbody>
              ${students.map((s, index) => `
                <tr style="${index % 2 === 0 ? 'background: white;' : 'background: #f9fafb;'}">
                  <td style="border: 1px solid #374151; padding: 2mm; text-align: center; font-weight: bold;">${index + 1}</td>
       
                  <td style="border: 1px solid #374151; padding: 2mm; text-align: center; font-weight: bold;">${s.massar || s.studentId || ''}</td>
                  <td style="border: 1px solid #374151; padding: 2mm; text-align: center; font-weight: bold;">${s.firstName || ''} ${s.lastName || ''}</td>
                  <td style="border: 1px solid #374151; padding: 2mm; text-align: center; font-weight: bold;">${s.gender === 'male' ? 'ذكر' : 'أنثى'}</td>
                  <td style="border: 1px solid #374151; padding: 2mm; text-align: center; font-weight: bold;">${s.level || ''}</td>
                  <td style="border: 1px solid #374151; padding: 2mm; text-align: center; font-weight: bold;">${s.transferDate ? new Date(s.transferDate).toLocaleDateString('fr-MA') : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${includeReminderInReport && reminderAlert ? `
          <div style="margin-bottom: 5mm;">
            <h4 style="font-size: 12px; font-weight: bold; color: #374151; margin-bottom: 3mm; text-align: center;">
              سجل المراسلات السابقة
            </h4>
            <p style="font-size: 12px; color: #000; text-align: center; margin-bottom: 2mm; font-weight: bold;">
              ${reminderAlert.message}
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #d1d5db;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="border: 1px solid #d1d5db; padding: 2mm; text-align: center; font-weight: bold;">تاريخ الإرسال</th>
                  <th style="border: 1px solid #d1d5db; padding: 2mm; text-align: center; font-weight: bold;">رقم الإرسال</th>
                  <th style="border: 1px solid #d1d5db; padding: 2mm; text-align: center; font-weight: bold;">المرجع</th>
                  <th style="border: 1px solid #d1d5db; padding: 2mm; text-align: center; font-weight: bold;">نوع الطلب</th>
                </tr>
              </thead>
              <tbody>
                ${(reminderAlert.previousRequests ?? []).map((req, index) => `
                  <tr style="${index % 2 === 0 ? 'background: white;' : 'background: #f9fafb;'}">
                    <td style="border: 1px solid #d1d5db; padding: 2mm; text-align: center; font-weight: bold;">${new Date(req.requestDate).toLocaleDateString('fr-MA')}</td>
                    <td style="border: 1px solid #d1d5db; padding: 2mm; text-align: center; font-family: monospace; font-weight: bold;">${req.sendingNumber || 'غير محدد'}</td>
                    <td style="border: 1px solid #d1d5db; padding: 2mm; text-align: center; font-family: monospace; font-weight: bold;">${req.reference || 'غير محدد'}</td>
                    <td style="border: 1px solid #d1d5db; padding: 2mm; text-align: center; font-weight: bold;">${req.requestType}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="margin-bottom:2mm; text-align: center; line-height: 1.8;">
              <p style="margin-bottom: 2mm; font-weight: bold;">
                نشكركم مسبقاً على تعاونكم وسرعة استجابتكم، ونؤكد لكم استعدادنا للتعاون المتبادل.
              </p>
              <p style="font-weight: bold;">وتقبلوا فائق الاحترام والتقدير.</p>
            </div>
          </div>
        ` : ''}
        <div style="padding: 5mm; display: flex; justify-content: space-between; text-align: center;">
          <span style="font-size: 11px; text-align: right;  font-weight: bold;">
            توقيع السيد الحارس العام
          </span>
          <span style="font-size: 11px; text-align: left; flex: 1; font-weight: bold;">
            توقيع السيد(ة) المدير(ة)
          </span>
        </div>
      </div>
    `;
  };

  const generateRequestPDF = async () => {
    if (students.length === 0) {
      alert('لا توجد تلاميذ محددين');
      return;
    }

    setGenerating(true);

    try {
      const firstStudent = students[0];
      correspondenceReminder.saveRequest({
        studentId: firstStudent.studentId,
        studentName: `${firstStudent.firstName} ${firstStudent.lastName}`,
        institutionName: requestData.institutionName || firstStudent.originalInstitution,
        requestType: requestData.requestType,
        requestDate: requestData.requestDate,
        sendingNumber: requestData.sendingNumber,
        reference: requestData.reference,
        subject: `طلب ملف مدرسي ${requestData.requestType === 'جماعي' ? 'جماعي' : 'فردي'}`,
        content: `طلب ملف مدرسي للتلميذ ${firstStudent.firstName} ${firstStudent.lastName}`
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      let isFirstPage = true;

      if (requestData.requestType === 'جماعي' && students.length > 1) {
        const requestNumber = generateRequestNumber();
        const htmlContent = generateRequestHTML(students[0], requestNumber, true);
        await addPageToPDF(pdf, htmlContent, isFirstPage);
      } else {
        for (let i = 0; i < students.length; i++) {
          const student = students[i];
          const requestNumber = generateRequestNumber(i);
          const htmlContent = generateRequestHTML(student, requestNumber, false);
          if (!isFirstPage) {
            pdf.addPage();
          }
          await addPageToPDF(pdf, htmlContent, isFirstPage);
          isFirstPage = false;
        }
      }

      const fileName = requestData.requestType === 'جماعي'
        ? `طلب_ملفات_جماعي_${(requestData.institutionName || 'مؤسسة').replace(/\s+/g, '_')}_${requestData.requestDate}.pdf`
        : `طلبات_ملفات_فردية_${requestData.requestDate}.pdf`;

      pdf.save(fileName);
      onRequestSent();
      alert(
        `تم توليد ${requestData.requestType === 'جماعي'
          ? 'طلب جماعي واحد'
          : `${students.length} طلب فردي`} بنجاح!`
      );
    } catch (error) {
      console.error('خطأ في توليد PDF:', error);
      alert('خطأ في توليد ملف PDF');
    } finally {
      setGenerating(false);
    }
  };

  const addPageToPDF = async (pdf: jsPDF, htmlContent: string, isFirstPage: boolean) => {
    const printElement = document.createElement('div');
    printElement.innerHTML = htmlContent;
    printElement.style.position = 'absolute';
    printElement.style.left = '-9999px';
    printElement.style.top = '0';
    printElement.style.width = '210mm';
    printElement.style.background = 'white';
    document.body.appendChild(printElement);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const canvas = await html2canvas(printElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    } finally {
      document.body.removeChild(printElement);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRequestData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

 

// بداية JSX (لاحظ إغلاق الأقواس بشكل صحيح في النهاية)
return (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      {/* رأس النموذج */}
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-900">
          طلب ملف مدرسي ({students.length} تلميذ)
        </h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* محتوى النموذج */}
      <div className="p-6 space-y-6">
        {/* معلومات التلاميذ */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            التلاميذ المحددين ({students.length})
          </h3>
          <div className="max-h-32 overflow-y-auto space-y-2">
            {students.map((student, index) => (
              <div key={student.id} className="bg-white p-3 rounded border flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-900">{student.firstName} {student.lastName}</div>
                  <div className="text-sm text-gray-600">{student.studentId} - {student.level}</div>
                  {student.isLinked && (
                    <div className="text-xs text-green-600">مرتبط: {student.linkedGender} - {student.linkedSection}</div>
                  )}
                </div>
                <div className="text-sm text-gray-500">{student.originalInstitution}</div>
              </div>
            ))}
          </div>
        </div>
  
{/* إعدادات الطلب */}
<div className="bg-green-50 p-4 rounded-lg border border-green-200">
  <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
    <FileText className="w-5 h-5" />
    إعدادات الطلب
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* نوع الطلب */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        نوع الطلب
      </label>
      <select
        name="requestType"
        value={requestData.requestType}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
      >
        <option value="فردي">طلبات فردية لكل تلميذ</option>
        <option value="جماعي">طلب جماعي واحد</option>
      </select>
    </div>
    {/* نطاق الإرسال */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        نطاق الإرسال *
      </label>
      <select
        name="regionalScope"
        value={requestData.regionalScope}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
      >
        <option value="داخل الإقليم">داخل الإقليم</option>
        <option value="خارج الإقليم">خارج الإقليم</option>
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {requestData.regionalScope === 'خارج الإقليم'
          ? 'سيتم استخدام التنسيق المفصل مع الأكاديمية'
          : 'سيتم استخدام التنسيق العادي داخل الإقليم'
        }
      </p>
    </div>
    {/* تاريخ الطلب */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        تاريخ الطلب
      </label>
      <input
        type="date"
        name="requestDate"
        value={requestData.requestDate}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>
    {/* نوع المصلحة */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        نوع المصلحة *
      </label>
      <div className="flex gap-2">
        <select
          className="flex-1 min-w-[120px] max-w-[200px] px-2 py-1 rounded border border-gray-300"
          value={requestData.serviceType}
          onChange={e => setRequestData({ ...requestData, serviceType: e.target.value })}
        >
          <option value="">اختر المصلحة</option>
          {services.map(service => (
            <option key={service.id} value={service.name}>
              {service.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAddServiceModal(true)}
          className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
          title="إضافة مصلحة جديدة"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            const selectedService = services.find(
              s => s.name === requestData.serviceType
            );
            if (
              selectedService &&
              ServiceManager.canDeleteService(selectedService.id)
            ) {
              setServiceToDelete(selectedService.id);
              setShowDeleteServiceModal(true);
            } else {
              alert('لا يمكن حذف المصالح الافتراضية');
            }
          }}
          disabled={
            !requestData.serviceType ||
            !services.find(
              s =>
                s.name === requestData.serviceType &&
                ServiceManager.canDeleteService(s.id)
            )
          }
          className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          title="حذف المصلحة المحددة"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
    {/* رقم الإرسال */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        رقم الإرسال
      </label>
      <input
        type="text"
        name="sendingNumber"
        value={requestData.sendingNumber}
        onChange={handleChange}
        placeholder="مثال: 001/2025"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>
    {/* رقم الطلب */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        رقم الطلب
      </label>
      <input
        type="text"
        name="requestNumber"
        value={requestData.requestNumber}
        onChange={handleChange}
        placeholder="مثال: 1"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>
    {/* المرجع */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        المرجع
      </label>
      <input
        type="text"
        name="reference"
        value={requestData.reference}
        onChange={handleChange}
        placeholder="مثال: REF-202501-001"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>
    {/* تاريخ آخر مراسلة */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        تاريخ آخر مراسلة
      </label>
      <input
        type="date"
        name="lastCorrespondenceDate"
        value={requestData.lastCorrespondenceDate}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
    </div>
  </div>
</div>
{/* خيارات التقرير المطبوع */}
<div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
  <h4 className="font-semibold text-blue-900 mb-3">خيارات التقرير المطبوع</h4>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <label className="flex items-center">
      <input
        type="checkbox"
        name="includeSendingNumber"
        checked={requestData.includeSendingNumber}
        onChange={e => setRequestData(prev => ({ ...prev, includeSendingNumber: e.target.checked }))}
        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
      />
      <span className="mr-2 text-sm font-medium text-gray-700">تضمين رقم الإرسال</span>
    </label>
    <label className="flex items-center">
      <input
        type="checkbox"
        name="includeReference"
        checked={requestData.includeReference}
        onChange={e => setRequestData(prev => ({ ...prev, includeReference: e.target.checked }))}
        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
      />
      <span className="mr-2 text-sm font-medium text-gray-700">تضمين المرجع</span>
    </label>
    <label className="flex items-center">
      <input
        type="checkbox"
        name="includeLastCorrespondenceDate"
        checked={requestData.includeLastCorrespondenceDate}
        onChange={e => setRequestData(prev => ({ ...prev, includeLastCorrespondenceDate: e.target.checked }))}
        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
      />
      <span className="mr-2 text-sm font-medium text-gray-700">تضمين تاريخ آخر مراسلة</span>
    </label>
    <label className="flex items-center">
      <input
        type="checkbox"
        checked={includeReminderInReport}
        onChange={e => setIncludeReminderInReport(e.target.checked)}
        className="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
      />
      <span className="mr-2 text-sm font-medium text-gray-700">تضمين سجل المراسلات السابقة</span>
    </label>
  </div>
</div>
{/* ملاحظات إضافية */}
<div className="mt-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    ملاحظات إضافية
  </label>
  <textarea
    name="notes"
    value={requestData.notes}
    onChange={handleChange}
    rows={3}
    placeholder="أي ملاحظات إضافية للطلب..."
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
  />
</div>
{/* معاينة الطلب */}
<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">معاينة الطلب</h3>
  <div className="text-sm text-gray-700 space-y-2">
    <p><strong>نوع الطلب:</strong> {requestData.requestType}</p>
    <p><strong>نطاق الإرسال:</strong>
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ml-2 ${
        requestData.regionalScope === 'خارج الإقليم'
          ? 'bg-red-100 text-red-800'
          : 'bg-green-100 text-green-800'
      }`}>
        {requestData.regionalScope}
      </span>
    </p>
    <p><strong>عدد التلاميذ:</strong> {students.length}</p>
    <p><strong>المؤسسة المرسل إليها:</strong> {requestData.institutionName}</p>
    <p><strong>نوع المصلحة:</strong> {requestData.serviceType || 'مصلحة الشؤون التربوية'}</p>
    <p><strong>رقم الطلب:</strong> {generateRequestNumber()}</p>
    {requestData.includeSendingNumber && requestData.sendingNumber && (
      <p><strong>رقم الإرسال:</strong> {requestData.sendingNumber}</p>
    )}
    {requestData.includeReference && requestData.reference && (
      <p><strong>المرجع:</strong> {requestData.reference}</p>
    )}
    {requestData.includeLastCorrespondenceDate && requestData.lastCorrespondenceDate && (
      <p><strong>تاريخ آخر مراسلة:</strong> {new Date(requestData.lastCorrespondenceDate).toLocaleDateString('fr-MA')}</p>
    )}
    {requestData.requestType === 'فردي' && students.length > 1 && (
      <p className="text-blue-600"><strong>ملاحظة:</strong> سيتم توليد {students.length} طلب منفصل</p>
    )}
    {requestData.regionalScope === 'خارج الإقليم' && (
      <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
        <p className="text-xs text-red-700 font-medium">
          <strong>تنبيه:</strong> سيتم استخدام التنسيق المفصل للإرسال خارج الإقليم مع ذكر الأكاديمية والمديرية الأصلية
        </p>
      </div>
    )}
    <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
      <p className="text-xs text-blue-700">
        <strong>الربط التلقائي:</strong> سيتم جلب الجنس والقسم من قاعدة البيانات الرئيسية تلقائياً للتلاميذ المرتبطين
      </p>
    </div>
  </div>
</div>

        
        <div className="flex gap-4 pt-4">
  <button
    onClick={generateRequestPDF}
    disabled={generating || students.length === 0 || !requestData.sendingNumber.trim()}
    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
  >
    {generating ? (
      <>
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        جاري التوليد...
      </>
    ) : (
      <>
        <Send className="w-5 h-5" />
        توليد وإرسال الطلب
      </>
    )}
  </button>
  <button
    onClick={onCancel}
    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
  >
    إلغاء
  </button>
</div>

{/* مودال التذكير بالمراسلات السابقة */}
{showReminderModal && reminderAlert && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 text-center">
        <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">🚨 تنبيه: مراسلات سابقة</h2>
        <p className="text-red-100">تم العثور على طلبات سابقة لنفس التلميذ</p>
      </div>
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-900">رسالة التذكير</span>
          </div>
          <p className="text-red-800 font-medium">{reminderAlert.message}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <div className="bg-gray-50 p-3 border-b">
            <h3 className="font-semibold text-gray-900">تفاصيل المراسلات السابقة</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-center font-bold text-gray-700">تاريخ الإرسال</th>
                  <th className="px-4 py-2 text-center font-bold ">رقم الإرسال</th>
                  <th className="px-4 py-2 text-center font-bold text-gray-700">المرجع</th>
                  <th className="px-4 py-2 text-center font-bold text-gray-700">نوع الطلب</th>
                </tr>
              </thead>
              <tbody>
                {reminderAlert.previousRequests.map((req, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}>
                    <td className="px-4 py-2 text-center font-bold text-red-600">
                      {new Date(req.requestDate).toLocaleDateString('fr-MA')}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-gray-700">
                      {req.sendingNumber || 'غير محدد'}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-gray-700">
                      {req.reference || 'غير محدد'}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-700">{req.requestType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">خيارات المتابعة</span>
          </div>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeReminderInReport}
                onChange={(e) => setIncludeReminderInReport(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="mr-2 text-sm font-medium text-blue-800">
                تضمين سجل المراسلات السابقة في التقرير المطبوع
              </span>
            </label>
            <p className="text-xs text-blue-700 mr-6">
              سيتم إضافة جدول بجميع المراسلات السابقة في التقرير النهائي
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setShowReminderModal(false);
              // تابع التوليد أو دع الزر يعيد الاستدعاء
            }}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            متابعة رغم التذكير
          </button>
          <button
            onClick={() => {
              setShowReminderModal(false);
              onCancel();
            }}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          >
            إلغاء والمراجعة
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{showAddServiceModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
    <div className="bg-white rounded-xl max-w-md w-full">
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-bold text-gray-900">إضافة مصلحة جديدة</h2>
        <button
          onClick={() => {
            setShowAddServiceModal(false);
            setNewServiceName('');
            setNewServiceDescription('');
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            اسم المصلحة *
          </label>
          <input
            type="text"
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            placeholder="مثال: مصلحة التأطير والتوجيه"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            وصف المصلحة (اختياري)
          </label>
          <textarea
            value={newServiceDescription}
            onChange={(e) => setNewServiceDescription(e.target.value)}
            rows={3}
            placeholder="وصف مختصر للمصلحة..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-4 pt-4">
          <button
            onClick={handleAddService}
            disabled={!newServiceName.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            إضافة المصلحة
          </button>
          <button
            onClick={() => {
              setShowAddServiceModal(false);
              setNewServiceName('');
              setNewServiceDescription('');
            }}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  </div>
)}
{showDeleteServiceModal && serviceToDelete && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
    <div className="bg-white rounded-xl max-w-md w-full">
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-xl font-bold text-gray-900">تأكيد حذف المصلحة</h2>
        <button
          onClick={() => {
            setShowDeleteServiceModal(false);
            setServiceToDelete(null);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">حذف المصلحة</h3>
            <p className="text-red-700 text-sm">
              هل أنت متأكد من حذف هذه المصلحة؟
            </p>
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg mb-6 border border-red-200">
          <p className="text-red-800 font-medium">
            المصلحة: {services.find(s => s.id === serviceToDelete)?.name}
          </p>
          <p className="text-red-700 text-sm mt-1">
            سيتم حذف هذه المصلحة نهائياً من القائمة
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleDeleteService}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            تأكيد الحذف
          </button>
          <button
            onClick={() => {
              setShowDeleteServiceModal(false);
              setServiceToDelete(null);
            }}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  </div>
)}

</div>
</div>
</div>
);
};

export default IncomingStudentRequestForm;
