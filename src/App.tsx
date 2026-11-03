import React, { useState, useEffect } from 'react';
import { dbManager } from './utils/database';
import { licenseManager } from './utils/licenseManager';

import WaakuMessagesConnection from './pages/WaakuMessagesConnection';
import WaakuChannelsConnection from './pages/WaakuChannelsConnection';

import WhatsAppCommunication from './components/WhatsAppCommunication';
import PhoneManagement from './components/PhoneManagement';
import { LicenseActivation } from './components/LicenseActivation';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import PhoneImportPage from './pages/PhoneImportPage';
import Dashboard from './components/Dashboard';
import StudentManagement from './components/StudentManagement';
import CredentialsImport from './components/CredentialsImport';
import CredentialsManagement from './components/CredentialsManagement';
import { WaakuWhatsAppConnection } from './components/WaakuWhatsAppConnection';
import MessageTemplates from './components/MessageTemplates';
import { ScheduleImport } from './components/ScheduleImport';
import { SubscriptionManagement } from './components/SubscriptionManagement';
import { SubscriptionAdmin } from './components/SubscriptionAdmin';
import VoucherGenerator from './components/VoucherGenerator';
import AboutProgram from './components/AboutProgram';
import ComprehensiveImport from './components/ComprehensiveImport';
import PhoneRequestsApproval from './components/PhoneRequestsApproval';
import { AbsenceManagement } from './components/AbsenceManagement';
import AttendanceSheetGenerator from './components/AttendanceSheetGenerator';
import GradeSheetGenerator from './components/GradeSheetGenerator';
import Settings from './components/Settings';
import AdvancedInstitutionSettings from './components/AdvancedInstitutionSettings';
import EducationalStructure from './components/EducationalStructure';
import PrintableReports from './components/PrintableReports';
import IncomingStudentsManagement from './components/IncomingStudentsManagement';
import OutgoingStudentsManagement from './components/OutgoingStudentsManagement';
import DisciplineManagement from './components/DisciplineManagement';
import AttendancePortal from './components/AttendancePortal';
import LocalAttendanceAdmin from './components/LocalAttendanceAdmin';
import { attendanceCloud } from './utils/attendanceCloud';
import { startAttendanceStartupSync, resetAttendanceStartupSync } from './utils/attendanceStartupSync';
import AttendanceSyncStatus from './components/AttendanceSyncStatus';

function AppContent({ initialTab = 'dashboard' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [licenseValid, setLicenseValid] = useState<boolean | null>(null);
  const [licenseChecking, setLicenseChecking] = useState(true);
  const [licenseCheckError, setLicenseCheckError] = useState<string | null>(null);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!isInitialized || !attendanceCloud || !window.desktopAttendance) return;
    void startAttendanceStartupSync();
    const { data } = attendanceCloud.auth.onAuthStateChange((event) => {
      // Supabase callbacks must return before starting another auth operation.
      if (event === 'SIGNED_IN') queueMicrotask(() => { void startAttendanceStartupSync(); });
      if (event === 'SIGNED_OUT') resetAttendanceStartupSync();
    });
    return () => data.subscription.unsubscribe();
  }, [isInitialized]);

  const isDeveloperMode = (): boolean => {
    return localStorage.getItem('developerMode') === 'true';
  };

  useEffect(() => {
    const checkLicenseAndTrial = async () => {
      try {
        const licenseStatus = await licenseManager.checkLicenseStatus();
        if (licenseStatus.trialError) {
          setLicenseCheckError(licenseStatus.message);
          return;
        }

        setLicenseCheckError(null);
        setLicenseValid(licenseStatus.isValid);
      } catch (error) {
        console.error('خطأ أثناء التحقق من الترخيص:', error);
        setLicenseCheckError('تعذر التحقق من صلاحية البرنامج. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
      } finally {
        setLicenseChecking(false);
      }
    };

    checkLicenseAndTrial();
  }, []);

  useEffect(() => {
    if (licenseValid === true) {
      dbManager
        .initialize()
        .then(() => setIsInitialized(true))
        .catch(() => setInitError('فشل في تهيئة قاعدة البيانات.'));
    }
  }, [licenseValid]);

  if (licenseChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (licenseCheckError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6" dir="rtl">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
          <p className="mb-6 text-slate-700">{licenseCheckError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (licenseValid === false) {
    return (
      <LicenseActivation onActivationSuccess={() => window.location.reload()} />
    );
  }

  const renderContent = () => {
    if (!isInitialized) return <div>جاري التهيئة...</div>;
    if (initError) return <div>{initError}</div>;

    const pages: Record<string, React.ReactNode> = {
      dashboard: <Dashboard />,
      students: <StudentManagement />,
      credentials: <CredentialsManagement />,

      'waaku-connection': <WaakuWhatsAppConnection />,
      'wa-messages': <WaakuMessagesConnection />,
      'wa-channels': <WaakuChannelsConnection />,

      'credentials-import': <CredentialsImport />,
      'comprehensive-import': <ComprehensiveImport />,
      'schedule-import': <ScheduleImport />,
      'voucher-generator': <VoucherGenerator />,

      'whatsapp-communication': <WhatsAppCommunication />,
      'message-templates': <MessageTemplates setActiveTab={setActiveTab} />,
      'phone-requests-approval': <PhoneRequestsApproval />,

      'subscription-management': <SubscriptionManagement />,
      'subscription-admin': <SubscriptionAdmin />,
      'about-program': <AboutProgram />,

      'phone-management': <PhoneManagement setActiveTab={setActiveTab} />,
      'phone-import': <PhoneImportPage />,
      'absence-management': <AbsenceManagement />,
      'attendance-portal': <LocalAttendanceAdmin onNavigate={handleTabChange} />,
      'teacher-attendance-management': <AttendancePortal onExit={() => handleTabChange('attendance-portal')} />,
      'attendance-sheet-generator': <AttendanceSheetGenerator />,
      'grade-sheet-generator': <GradeSheetGenerator />,
      settings: <Settings />,
      'institution-settings': <AdvancedInstitutionSettings />,
      'educational-structure': <EducationalStructure />,
      'printable-reports': <PrintableReports />,
      'discipline-management': <DisciplineManagement />,
      'incoming-students': <IncomingStudentsManagement />,
      'outgoing-students': <OutgoingStudentsManagement />,
    };

    return pages[activeTab] || <Dashboard />;
  };

  return (
    <div className="flex h-full overflow-hidden" dir="rtl">
      <div className="w-72 flex-shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          isDeveloperMode={isDeveloperMode}
        />
      </div>

      <main className="flex-1 overflow-y-auto bg-slate-50">
        <AttendanceSyncStatus />
        <ErrorBoundary>{renderContent()}</ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  // Cloud authentication is only used on explicitly cloud/teacher routes.
  if (window.location.pathname === '/attendance-cloud' || window.location.pathname === '/teacher') {
    return <AttendancePortal
      teacherOnly={window.location.pathname === '/teacher'}
      onExit={() => window.location.assign('/attendance')}
    />;
  }
  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  const initialTab = window.location.pathname === '/attendance'
    ? 'attendance-portal'
    : requestedTab === 'teacher-attendance-management' ? requestedTab : 'dashboard';
  return <AppContent initialTab={initialTab} />;
}

export default App;
