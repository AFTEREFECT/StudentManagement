import React, { useState, useEffect } from 'react';
import { dbManager } from './utils/database';
import { licenseManager } from './utils/licenseManager';
import { trialManager } from './utils/trialManager';
import { LicenseActivation } from './components/LicenseActivation';
import { TrialExpired } from './components/TrialExpired';
import { TrialCountdown } from './components/TrialCountdown';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './components/Dashboard';
import StudentManagement from './components/StudentManagement';
import SchoolEnrollmentImport from './components/SchoolEnrollmentImport';
import AdvancedReports from './components/AdvancedReports';
import DatabaseRelationships from './components/DatabaseRelationships';
import Settings from './components/Settings';
import CredentialsImport from './components/CredentialsImport';
import CredentialsManagement from './components/CredentialsManagement';
import SQLQueryTool from './components/SQLQueryTool';
import DataVerification from './components/DataVerification';
import CouncilDecisionsImport from './components/CouncilDecisionsImport';
import StudentMobilityManagement from './components/StudentMobilityManagement';
import EducationalStructure from './components/EducationalStructure';
import LevelsAndSectionsSetup from './components/LevelsAndSectionsSetup';
import ComprehensiveImport from './components/ComprehensiveImport';
import AdvancedInstitutionSettings from './components/AdvancedInstitutionSettings';
import SchoolEntryOverview from './components/SchoolEntryOverview';
import DeveloperConsole from './components/DeveloperConsole';
import DatabaseRelationshipsManager from './components/DatabaseRelationshipsManager';
import GuidanceManagement from './components/GuidanceManagement';
import GuidanceDataAnalysis from './components/GuidanceDataAnalysis';
import PrintableReports from './components/PrintableReports';
import QuizManagement from './components/QuizManagement';
import StudentFileManagement from './components/StudentFileManagement';
import QRCodeGenerator from './components/QRCodeGenerator';
import IncomingStudentsManagement from './components/IncomingStudentsManagement';
import OutgoingStudentsManagement from './components/OutgoingStudentsManagement';
import AboutProgram from './components/AboutProgram';
import AttendanceSheetGenerator from './components/AttendanceSheetGenerator';
import { WhatsAppSettings } from './components/WhatsAppSettings';
import { UnifiedWhatsAppSettings } from './components/UnifiedWhatsAppSettings';
import { WaakuWhatsAppConnection } from './components/WaakuWhatsAppConnection';
import { WhatsAppCommunication } from './components/WhatsAppCommunication';
import { AbsenceManagement } from './components/AbsenceManagement';
import { MessageTemplates } from './components/MessageTemplates';
import { ScheduleImport } from './components/ScheduleImport';
import { TimetablePrint } from './components/TimetablePrint';
import { TimetablePrintManager } from './components/TimetablePrintManager';
import { SubscriptionManagement } from './components/SubscriptionManagement';
import { SubscriptionAdmin } from './components/SubscriptionAdmin';
import { TrialAnalytics } from './components/TrialAnalytics';
import {ahwDashboard } from './components/WAHADashboard';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [licenseValid, setLicenseValid] = useState<boolean | null>(null);
  const [licenseChecking, setLicenseChecking] = useState(true);
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialHoursRemaining, setTrialHoursRemaining] = useState(0);
  const [isTrialMode, setIsTrialMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // دالة للتحقق من وضع المطور
  const isDeveloperMode = (): boolean => {
    return localStorage.getItem('developerMode') === 'true';
  };

  // اختصار Ctrl+Shift+D لتفعيل وضع المطور
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        const current = localStorage.getItem('developerMode') === 'true';
        localStorage.setItem('developerMode', (!current).toString());
        alert(
          !current 
            ? '✅ تم تفعيل وضع المطور' 
            : '❌ تم إلغاء تفعيل وضع المطور'
        );
        window.location.reload();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // التحقق من الترخيص والتجربة عند بدء التشغيل
  useEffect(() => {
    const checkLicenseAndTrial = async () => {
      try {
        console.log('🔒 التحقق من الترخيص والتجربة...');

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 10000);
        });

        let licenseStatus;
        try {
          licenseStatus = await Promise.race([
            licenseManager.checkLicenseStatus(),
            timeoutPromise
          ]);
          console.log('📊 حالة الترخيص:', licenseStatus);
        } catch (licenseError) {
          console.warn('⚠️ فشل التحقق من الترخيص، الانتقال للتجربة المجانية');
          licenseStatus = { isValid: false };
        }

        if (licenseStatus.isValid) {
          setLicenseValid(true);
          setIsTrialMode(false);

          trialManager.logAction('paid', 'app_opened', {
            license_info: licenseManager.getCurrentLicenseInfo()
          }).catch(err => console.warn('فشل تسجيل النشاط:', err));
        } else {
          let trialStatus;
          try {
            trialStatus = await Promise.race([
              trialManager.checkTrialStatus(),
              timeoutPromise
            ]);
            console.log('🎁 حالة التجربة:', trialStatus);
          } catch (trialError) {
            console.warn('⚠️ فشل التحقق من التجربة، عرض شاشة التفعيل');
            trialStatus = { needsActivation: true, isValid: false };
          }

          if (trialStatus.isValid) {
            setLicenseValid(true);
            setIsTrialMode(true);
            setTrialDaysRemaining(trialStatus.daysRemaining);
            setTrialHoursRemaining(trialStatus.hoursRemaining);

            trialManager.updateSessionActivity().catch(err => console.warn('فشل تحديث الجلسة:', err));
            trialManager.logAction('trial', 'app_opened', {
              days_remaining: trialStatus.daysRemaining
            }).catch(err => console.warn('فشل تسجيل النشاط:', err));
          } else if (trialStatus.needsActivation) {
            setLicenseValid(false);
            setShowTrialExpired(false);
          } else {
            setLicenseValid(false);
            setShowTrialExpired(true);
            setInitError(trialStatus.message);
          }
        }
      } catch (error) {
        console.error('❌ خطأ في التحقق:', error);
        setLicenseValid(false);
        setShowTrialExpired(false);
      } finally {
        setLicenseChecking(false);
      }
    };

    checkLicenseAndTrial();
  }, []);

  // تهيئة قاعدة البيانات بعد التحقق من الترخيص
  useEffect(() => {
    if (licenseValid === true) {
      const initializeApp = async () => {
        try {
          console.log('📦 تهيئة قاعدة البيانات المحلية...');
          await dbManager.initialize();
          setIsInitialized(true);
          console.log('✅ تمت التهيئة بنجاح');
        } catch (error) {
          console.error('❌ فشل في تهيئة التطبيق:', error);
          setInitError('فشل في تهيئة قاعدة البيانات. يرجى إعادة تحميل الصفحة.');
        }
      };

      initializeApp();
    }
  }, [licenseValid]);

  // معالج نجاح التفعيل
  const handleActivationSuccess = () => {
    setLicenseValid(true);
    window.location.reload();
  };

  // شاشة التحقق من الترخيص
  if (licenseChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-purple-900">
        <div className="relative">
          <div className="animate-spin rounded-full h-40 w-40 border-t-4 border-b-4 border-white"></div>
          <div className="absolute top-0 left-0 h-40 w-40 rounded-full border-4 border-white/40"></div>
        </div>
      </div>
    );
  }

  // شاشة التفعيل أو انتهاء التجربة
  if (licenseValid === false) {
    if (showTrialExpired) {
      return (
        <TrialExpired
          onEnterLicense={() => {
            setShowTrialExpired(false);
          }}
        />
      );
    } else {
      return <LicenseActivation onActivationSuccess={handleActivationSuccess} />;
    }
  }

  // عرض المحتوى حسب التبويب النشط
  const renderContent = () => {
    if (!isInitialized) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">جاري تهيئة نظام إدارة التلاميذ...</p>
          </div>
        </div>
      );
    }

    if (initError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600">{initError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'waaku-connection':
        return <WaakuWhatsAppConnection />;
      case 'dashboard':
        return <Dashboard />;
      case 'students':
        return <StudentManagement />;
      case 'enrollment':
        return <SchoolEnrollmentImport />;
      case 'levels-setup':
        return <LevelsAndSectionsSetup />;
      case 'comprehensive-import':
        return <ComprehensiveImport />;
      case 'credentials-import':
        return <CredentialsImport />;
      case 'credentials':
        return <CredentialsManagement />;
      case 'council-decisions':
        return <CouncilDecisionsImport />;
      case 'guidance':
        return <GuidanceManagement />;
      case 'guidance-analysis':
        return <GuidanceDataAnalysis />;
      case 'printable-reports':
        return <PrintableReports />;
      case 'student-mobility':
        return <StudentMobilityManagement />;
      case 'educational-structure':
        return <EducationalStructure />;
      case 'advanced-institution-settings':
        return <AdvancedInstitutionSettings />;
      case 'school-entry-overview':
        return <SchoolEntryOverview />;
      case 'database-relationships':
        return <DatabaseRelationships />;
      case 'reports':
        return <AdvancedReports />;
      case 'data-verification':
        return <DataVerification />;
      case 'sql-tool':
        return <SQLQueryTool />;
      case 'quiz-management':
        return <QuizManagement />;
      case 'qr-generator':
        return <QRCodeGenerator />;
      case 'file-management':
        return <StudentFileManagement />;
      case 'incoming-students':
        return <IncomingStudentsManagement />;
      case 'outgoing-students':
        return <OutgoingStudentsManagement />;
      case 'developer-console':
        return <DeveloperConsole />;
      case 'database-relationships-manager':
        return <DatabaseRelationshipsManager />;
      case 'settings':
        return <Settings />;
      case 'about-program':
        return <AboutProgram />;
      case 'attendance-sheet':
        return <AttendanceSheetGenerator />;
      case 'waha-dashboard':
        return <WAHADashboard />;
      case 'whatsapp-settings':
        return <UnifiedWhatsAppSettings />;
      case 'whatsapp-communication':
        return <WhatsAppCommunication />;
      case 'message-templates':
        return <MessageTemplates />;
      case 'schedule-import':
        return <ScheduleImport />;
      case 'timetable-print':
        return <TimetablePrintManager />;
      case 'absence-management':
        return <AbsenceManagement />;
      case 'subscription-management':
        return <SubscriptionManagement />;
      case 'subscription-admin':
        return <SubscriptionAdmin />;
      case 'trial-analytics':
        return <TrialAnalytics />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50" dir="rtl">
      {isTrialMode && trialDaysRemaining > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <TrialCountdown
            daysRemaining={trialDaysRemaining}
            hoursRemaining={trialHoursRemaining}
            onUpgradeClick={() => {
              setActiveTab('subscription-management');
            }}
          />
        </div>
      )}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed lg:relative inset-y-0 right-0 z-50 lg:z-auto
        transform ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0
        transition-transform duration-300 ease-in-out lg:transition-none
        w-64 lg:w-64 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 shadow-2xl flex flex-col h-full
      `}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setSidebarOpen(false);
          }}
          isDeveloperMode={isDeveloperMode}
        />
      </div>
      
      <main className={`flex-1 overflow-y-auto ${isTrialMode ? 'mt-0' : ''}`}>
        <div className={`lg:hidden bg-gradient-to-r from-blue-600 to-purple-600 border-b border-blue-400 p-3 sm:p-4 sticky z-30 shadow-lg ${isTrialMode ? 'top-24' : 'top-0'}`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-3 text-white hover:text-blue-100 bg-white/20 px-4 py-4 rounded-lg border border-white/30 hover:bg-white/30 transition-all duration-200 w-full backdrop-blur-sm"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="font-bold text-xl">القائمة الرئيسية</span>
          </button>
        </div>
        
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
