import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';

interface TrialCountdownProps {
  daysRemaining: number;
  hoursRemaining: number;
  onUpgradeClick: () => void;
}

export const TrialCountdown: React.FC<TrialCountdownProps> = ({
  daysRemaining,
  hoursRemaining,
  onUpgradeClick,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // تحديد اللون بناءً على الأيام المتبقية
  const getColorClass = () => {
    if (daysRemaining >= 5) {
      return {
        bg: 'bg-gradient-to-r from-green-500 to-emerald-600',
        icon: 'text-green-100',
        text: 'text-white',
      };
    } else if (daysRemaining >= 2) {
      return {
        bg: 'bg-gradient-to-r from-yellow-500 to-orange-600',
        icon: 'text-yellow-100',
        text: 'text-white',
      };
    } else {
      return {
        bg: 'bg-gradient-to-r from-red-500 to-pink-600',
        icon: 'text-red-100',
        text: 'text-white',
      };
    }
  };

  const colors = getColorClass();
  const Icon = daysRemaining >= 5 ? CheckCircle : daysRemaining >= 2 ? Clock : AlertTriangle;

  // رسالة مخصصة حسب الأيام المتبقية
  const getMessage = () => {
    if (daysRemaining >= 5) {
      return 'استمتع بالتجربة المجانية';
    } else if (daysRemaining >= 2) {
      return 'اشترك الآن ولا تفوت الفرصة';
    } else if (daysRemaining === 1) {
      return 'آخر يوم في التجربة المجانية';
    } else {
      return 'التجربة تنتهي اليوم';
    }
  };

  if (!isVisible) {
    // زر صغير لإعادة إظهار الشريط
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-4 left-4 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        <Clock className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className={`${colors.bg} shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* المعلومات */}
          <div className="flex items-center gap-4">
            <Icon className={`w-6 h-6 ${colors.icon}`} />

            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                  {daysRemaining}
                </span>
                <span className={`text-sm font-medium ${colors.text}`}>
                  {daysRemaining === 1 ? 'يوم' : daysRemaining === 2 ? 'يومان' : 'أيام'}
                </span>
              </div>

              <div className="h-8 w-px bg-white/30"></div>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {Math.floor(hoursRemaining % 24)}
                </span>
                <span className={`text-sm font-medium ${colors.text}`}>
                  {Math.floor(hoursRemaining % 24) === 1 ? 'ساعة' : 'ساعات'}
                </span>
              </div>

              <div className="hidden md:block text-sm font-medium text-white/90">
                متبقية من التجربة المجانية
              </div>
            </div>
          </div>

          {/* الرسالة والزر */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm font-bold text-white/90">
              {getMessage()}
            </span>

            <button
              onClick={onUpgradeClick}
              className="bg-white text-gray-900 px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-gray-100 transition-all shadow-md hover:shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              اشترك الآن
            </button>

            <button
              onClick={() => setIsVisible(false)}
              className="text-white/80 hover:text-white p-1 rounded transition-colors"
              title="إخفاء الشريط"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* شريط التقدم */}
        <div className="mt-3">
          <div className="bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-1000"
              style={{
                width: `${(daysRemaining / 7) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
