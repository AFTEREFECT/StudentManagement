import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Calendar, MessageSquare, Settings, Info, 
  FileSpreadsheet, Key, Building, BarChart3, UserX, 
  Printer, Send, Server, Scan, FileText, CreditCard,
  Smartphone, Calculator, Shield, Database, ChevronDown,
  Search as SearchIcon
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDeveloperMode: () => boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isDeveloperMode }) => {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'dashboard', 'students', 'whatsapp'
  ]);
  const [searchTerm, setSearchTerm] = useState('');

  // حفظ الأقسام المفتوحة في localStorage
  useEffect(() => {
    const saved = localStorage.getItem('expandedSections');
    if (saved) {
      try {
        setExpandedSections(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading expanded sections:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('expandedSections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // هيكل القائمة المنظم
  const menuSections = [
    {
      id: 'dashboard',
      title: 'لوحة التحكم',
      icon: Home,
      color: 'from-blue-500 to-cyan-500',
      items: [
        { id: 'dashboard', label: 'لوحة التحكم', icon: Home },
        { id: 'subscription-management', label: 'إدارة الاشتراك', icon: CreditCard },
        { id: 'waaku-connection', label: 'ربط WhatsApp', icon: Smartphone },
      ]
    },
    
    {
      id: 'institution',
      title: 'المؤسسة',
      icon: Building,
      color: 'from-purple-500 to-pink-500',
      items: [
        { id: 'advanced-institution-settings', label: 'إعدادات المؤسسة', icon: Building },
        { id: 'educational-structure', label: 'البنية التربوية', icon: BarChart3 },
      ]
    },

    {
      id: 'import',
      title: 'استيراد البيانات',
      icon: FileSpreadsheet,
      color: 'from-green-500 to-emerald-500',
      items: [
        { id: 'comprehensive-import', label: 'استيراد اللوائح والمستويات', icon: FileSpreadsheet },
        { id: 'credentials-import', label: 'استيراد الأكواد السرية', icon: Key },
        { id: 'schedule-import', label: 'استيراد جداول الحصص', icon: Calendar },
      ]
    },

    {
      id: 'students',
      title: 'إدارة التلاميذ',
      icon: Users,
      color: 'from-indigo-500 to-blue-500',
      items: [
        { id: 'students', label: 'إدارة التلاميذ', icon: Users },
        { id: 'incoming-students', label: 'التلاميذ الوافدين', icon: Users },
        { id: 'outgoing-students', label: 'التلاميذ المغادرين', icon: Users },
        { id: 'credentials', label: 'الأكواد السرية', icon: Key },
        { id: 'school-entry-overview', label: 'تتبع الدخول المدرسي', icon: Calculator },
      ]
    },

    {
      id: 'attendance',
      title: 'الحضور والغيابات',
      icon: UserX,
      color: 'from-red-500 to-orange-500',
      items: [
        { id: 'attendance-sheet', label: 'توليد ورقة الغياب', icon: FileSpreadsheet },
        { id: 'absence-management', label: 'تدبير الغيابات', icon: UserX },
      ]
    },

    {
      id: 'timetable',
      title: 'جداول الحصص',
      icon: Calendar,
      color: 'from-teal-500 to-cyan-500',
      items: [
        { id: 'timetable-print', label: 'طباعة جداول الحصص', icon: Printer },
      ]
    },

    {
      id: 'whatsapp',
      title: 'تواصلو اخبار',
      icon: MessageSquare,
      color: 'from-green-500 to-lime-500',
      items: [
        { id: 'whatsapp-communication', label: 'التواصل عبر واتساب', icon: Send },
        { id: 'message-templates', label: 'نماذج الرسائل', icon: FileText },
        { id: 'waha-dashboard', label: 'لوحة تحكمahw', icon: Server },
        { id: 'whatsapp-settings', label: 'إعدادات واتساب', icon: MessageSquare },
      ]
    },

    {
      id: 'quiz',
      title: 'الروائز',
      icon: Scan,
      color: 'from-yellow-500 to-orange-500',
      items: [
        { id: 'quiz-management', label: 'نظام الروائز', icon: Scan },
      ]
    },

    {
      id: 'reports',
      title: 'التقارير',
      icon: FileText,
      color: 'from-pink-500 to-rose-500',
      items: [
        { id: 'printable-reports', label: 'التقارير القابلة للطباعة', icon: FileText },
      ]
    },

    {
      id: 'system',
      title: 'النظام',
      icon: Settings,
      color: 'from-gray-500 to-slate-600',
      items: [
        { id: 'settings', label: 'الإعدادات العامة', icon: Settings },
        { id: 'about-program', label: 'حول البرنامج', icon: Info },
      ]
    },
  ];

  // قائمة المطور
  const developerSection = {
    id: 'developer',
    title: 'أدوات المطور',
    icon: Shield,
    color: 'from-red-600 to-pink-600',
    items: [
      { id: 'subscription-admin', label: 'لوحة تحكم الاشتراكات', icon: Shield },
    ]
  };

  const allSections = isDeveloperMode() 
    ? [...menuSections, developerSection] 
    : menuSections;

  // تصفية حسب البحث
  const filteredSections = allSections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="w-full h-full bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 shadow-2xl flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* شعار النظام */}
        <div className="sticky top-0 bg-gradient-to-b from-blue-600 to-blue-700 z-10 px-4 pt-6 pb-4">
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-all duration-300">
                <Database className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white leading-tight mb-1">
                نظام إدارة التلاميذ
              </h1>
              <p className="text-xs text-white/60">PROGTALAMID</p>
            </div>
          </div>

          {/* حقل البحث */}
          <div className="relative">
            <SearchIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="🔍 ابحث في القائمة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-white/10 text-white placeholder-white/40 rounded-xl focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm backdrop-blur-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white transition-colors"
              >
                ✖
              </button>
            )}
          </div>
        </div>

        {/* قائمة التنقل */}
        <nav className="px-4 pb-6 space-y-2">
          {filteredSections.length === 0 ? (
            <div className="text-center text-white/50 py-12">
              <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد نتائج</p>
            </div>
          ) : (
            filteredSections.map((section) => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections.includes(section.id);
              
              return (
                <div key={section.id} className="mb-1">
                  {/* عنوان القسم */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full group"
                  >
                    <div className="flex items-center justify-between px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-all backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${section.color} shadow-md group-hover:scale-110 transition-transform`}>
                          <SectionIcon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-sm">{section.title}</span>
                        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                          {section.items.length}
                        </span>
                      </div>
                      <ChevronDown 
                        className={`w-4 h-4 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* عناصر القسم */}
                  {isExpanded && (
                    <div className="mt-1 space-y-0.5 mr-2 animate-fadeIn">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = activeTab === item.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg text-right transition-all duration-200 group ${
                              isActive
                                ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 text-white shadow-lg scale-[1.02] border-r-4 border-white'
                                : 'text-white/70 hover:bg-white/10 hover:text-white hover:scale-[1.01]'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <ItemIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
                              <span className="text-sm truncate">{item.label}</span>
                            </div>
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
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-blue-900/50 border-t border-white/10 backdrop-blur-sm">
        <button
          onClick={() => {
            setExpandedSections(
              expandedSections.length === allSections.length 
                ? [] 
                : allSections.map(s => s.id)
            );
          }}
          className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
        >
          {expandedSections.length === allSections.length ? '📂 طي الكل' : '📁 فتح الكل'}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
