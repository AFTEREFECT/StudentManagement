import { useEffect, useState } from 'react';
import { subscriptionManager, Subscription } from '../utils/subscriptionManager';

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [planName, setPlanName] = useState<string>('None');

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const sub = await subscriptionManager.getCurrentSubscription();
      setSubscription(sub);
      setIsActive(subscriptionManager.isSubscriptionActive());
      setPlanName(subscriptionManager.getPlanName());
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (feature: string): boolean => {
    return subscriptionManager.hasFeature(feature);
  };

  const getDaysRemaining = (): number | null => {
    return subscriptionManager.getDaysRemaining();
  };

  const refresh = async () => {
    await loadSubscription();
  };

  return {
    subscription,
    loading,
    isActive,
    planName,
    hasFeature,
    getDaysRemaining,
    refresh
  };
};
