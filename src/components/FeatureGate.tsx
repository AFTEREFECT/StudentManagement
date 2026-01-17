import React from 'react';
import { Lock, ArrowUpCircle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgrade = true
}) => {
  const { hasFeature, planName, isActive } = useSubscription();

  if (!isActive) {
    return fallback || (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
        <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-gray-800 mb-2">الاشتراك منتهي</h3>
        <p className="text-gray-600 mb-4">
          يرجى تجديد اشتراكك للوصول إلى هذه الميزة
        </p>
        <a
          href="#subscription"
          className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          تجديد الاشتراك
        </a>
      </div>
    );
  }

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  return fallback || (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
      <ArrowUpCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
      <h3 className="text-2xl font-bold text-gray-800 mb-2">ميزة غير متوفرة في خطتك الحالية</h3>
      <p className="text-gray-600 mb-2">
        خطتك الحالية: <span className="font-bold">{planName}</span>
      </p>
      <p className="text-gray-600 mb-4">
        قم بالترقية إلى خطة أعلى للوصول إلى هذه الميزة
      </p>
      <a
        href="#subscription"
        className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
      >
        ترقية الخطة
      </a>
    </div>
  );
};

interface FeatureCheckProps {
  feature: string;
  children: (hasAccess: boolean) => React.ReactNode;
}

export const FeatureCheck: React.FC<FeatureCheckProps> = ({ feature, children }) => {
  const { hasFeature, isActive } = useSubscription();
  const hasAccess = isActive && hasFeature(feature);
  return <>{children(hasAccess)}</>;
};
