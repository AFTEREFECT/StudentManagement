import React, { useState, useEffect } from 'react';
import {
  Home,
  Users,
  Calendar,
  FileSpreadsheet,
  Key,
  FileText,
  CreditCard,
  Shield,
  Database,
  ChevronDown,
  Search as SearchIcon,
  ChevronLeft,
  Layers,
  Send,
  Building2,
  BarChart3,
  Printer,
  Settings as SettingsIcon,
  Cloud,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDeveloperMode: () => boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isDeveloperMode }) => {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'setup',
    'institution',
    'attendance',
    'mobility',
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('expandedSections');

    if (saved) {
      try {
        const validSections = ['setup', 'institution', 'attendance', 'mobility', 'reports', 'settings', 'developer'];
        const parsed = (JSON.parse(saved) as string[]).filter((id) =>
          validSections.includes(id) && (id !== 'developer' || isDeveloperMode())
        );
        setExpandedSections(parsed.includes('setup') ? parsed : ['setup', ...parsed]);
      } catch (e) {
        console.error('Error loading expanded sections:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('expandedSections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const menuSections = [
    {
      id: 'setup',
      title: 'التهيئة واستيراد البيانات',
      icon: Building2,
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-400/20',
      accentColor: 'border-emerald-400',
      headingColor: 'text-emerald-300',
      activeColor: 'bg-gradient-to-l from-emerald-500 to-emerald-600 shadow-emerald-500/20',
      items: [
        { id: 'institution-settings', label: 'إعدادات المؤسسة', icon: Building2 },
        { id: 'comprehensive-import', label: 'استيراد اللوائح والمستويات', icon: FileSpreadsheet },
        { id: 'students', label: 'لوائح التلاميذ ومسك البيانات', icon: Users },
        { id: 'credentials-import', label: 'استيراد قن متمدرس', icon: Key },
        { id: 'credentials', label: 'الأكواد السرية', icon: Key },
        { id: 'schedule-import', label: 'استيراد جداول الحصص', icon: Calendar },
      ],
    },
    {
      id: 'institution',
      title: 'التدبير التربوي والمؤسسة',
      icon: BarChart3,
      iconColor: 'text-blue-400',
      bgColor: 'bg-blue-400/20',
      accentColor: 'border-blue-400',
      headingColor: 'text-blue-300',
      activeColor: 'bg-gradient-to-l from-blue-500 to-blue-600 shadow-blue-500/20',
      items: [
        { id: 'dashboard', label: 'لوحة التحكم', icon: Home },
        { id: 'educational-structure', label: 'البنية التربوية والإحصائيات', icon: BarChart3 },
        { id: 'discipline-management', label: 'تدبير السلوك والمخالفات', icon: Shield },
      ],
    },
    {
      id: 'attendance',
      title: 'الحضور والغياب',
      icon: Calendar,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-400/20',
      accentColor: 'border-amber-400',
      headingColor: 'text-amber-300',
      activeColor: 'bg-gradient-to-l from-amber-500 to-amber-600 shadow-amber-500/20',
      items: [
        { id: 'attendance-portal', label: 'إدارة الغياب المحلية', icon: Users },
        { id: 'teacher-attendance-management', label: 'غيابات الأساتذة (المنصة)', icon: Cloud },
        { id: 'absence-management', label: 'تدبير الغيابات', icon: Users },
        { id: 'attendance-sheet-generator', label: 'توليد أوراق الغياب', icon: FileSpreadsheet },
      ],
    },
    {
      id: 'mobility',
      title: 'حركية التلاميذ',
      icon: Send,
      iconColor: 'text-orange-400',
      bgColor: 'bg-orange-400/20',
      accentColor: 'border-orange-400',
      headingColor: 'text-orange-300',
      activeColor: 'bg-gradient-to-l from-orange-500 to-orange-600 shadow-orange-500/20',
      items: [
        { id: 'incoming-students', label: 'تدبير الوافدين وطلب الملفات', icon: FileText },
        { id: 'outgoing-students', label: 'تدبير المغادرين وإرسال الملفات', icon: Send },
      ],
    },
    {
      id: 'reports',
      title: 'التقارير والخدمات',
      icon: Printer,
      iconColor: 'text-violet-400',
      bgColor: 'bg-violet-400/20',
      accentColor: 'border-violet-400',
      headingColor: 'text-violet-300',
      activeColor: 'bg-gradient-to-l from-violet-500 to-violet-600 shadow-violet-500/20',
      items: [
        { id: 'printable-reports', label: 'التقارير والطباعة', icon: Printer },
        { id: 'grade-sheet-generator', label: 'ورقة التنقيط الدورية', icon: FileSpreadsheet },
        { id: 'voucher-generator', label: 'توليد القسائم', icon: CreditCard },
        { id: 'subscription-management', label: 'الاشتراك', icon: CreditCard },
      ],
    },
    {
      id: 'settings',
      title: 'الإعدادات والدعم',
      icon: SettingsIcon,
      iconColor: 'text-slate-400',
      bgColor: 'bg-slate-400/20',
      accentColor: 'border-slate-400',
      headingColor: 'text-slate-300',
      activeColor: 'bg-gradient-to-l from-slate-500 to-slate-600 shadow-slate-500/20',
      items: [
        { id: 'settings', label: 'إعدادات النظام والنسخ الاحتياطي', icon: SettingsIcon },
        { id: 'about-program', label: 'حول البرنامج', icon: FileText },
      ],
    },
  ];

  const developerSection = {
    id: 'developer',
    title: 'أدوات المطور',
    icon: Shield,
    iconColor: 'text-red-400',
    bgColor: 'bg-red-400/20',
    accentColor: 'border-red-400',
    headingColor: 'text-red-300',
    activeColor: 'bg-gradient-to-l from-red-500 to-red-600 shadow-red-500/20',
    items: [
      { id: 'subscription-admin', label: 'لوحة تحكم الاشتراكات', icon: Shield },
    ],
  };

  const allSections = isDeveloperMode()
    ? [...menuSections, developerSection]
    : menuSections;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredSections = allSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.label.toLowerCase().includes(normalizedSearch)
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="w-full h-full bg-[#0f172a] flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-[#1e293b]">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Database className="w-6 h-6 text-white" />
          </div>

          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              نظام إدارة التلاميذ
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider">
              PROGTALAMID
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

          <input
            type="text"
            placeholder="ابحث في القائمة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-9 py-2.5 bg-[#0f172a] text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm border border-slate-700 focus:border-cyan-500/50"
          />

          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              aria-label="مسح البحث"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {filteredSections.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">لا توجد نتائج</p>
          </div>
        ) : (
          filteredSections.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections.includes(section.id);
            const hasActiveItem = section.items.some((item) => item.id === activeTab);

            return (
              <div key={section.id} className={`mb-3 border-r-2 pr-2 ${section.accentColor}`}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    hasActiveItem ? 'bg-[#1e293b]' : 'hover:bg-[#1e293b]/50'
                  }`}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${section.bgColor} rounded-lg flex items-center justify-center`}>
                      <SectionIcon className={`w-4 h-4 ${section.iconColor}`} />
                    </div>

                    <span
                      className={`font-semibold text-sm ${
                        hasActiveItem ? 'text-white' : section.headingColor
                      }`}
                    >
                      {section.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-medium">
                      {section.items.length}
                    </span>

                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Items */}
                {isExpanded && (
                  <div className="mt-1 mr-4 space-y-0.5">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition-all duration-200 ${
                            isActive
                              ? `${section.activeColor} text-white shadow-lg`
                              : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'
                          }`}
                          type="button"
                        >
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center ${
                              isActive ? 'bg-white/20' : 'bg-slate-800'
                            }`}
                          >
                            <ItemIcon
                              className={`w-3.5 h-3.5 ${
                                isActive ? 'text-white' : 'text-slate-500'
                              }`}
                            />
                          </div>

                          <span className="text-sm font-medium truncate flex-1">
                            {item.label}
                          </span>

                          {isActive && <ChevronLeft className="w-4 h-4 text-white/70" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 bg-[#1e293b] border-t border-slate-800">
        <button
          onClick={() => {
            setExpandedSections(
              expandedSections.length === allSections.length
                ? []
                : allSections.map((s) => s.id)
            );
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
          type="button"
        >
          <Layers className="w-4 h-4" />
          {expandedSections.length === allSections.length ? 'طي الكل' : 'فتح الكل'}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
