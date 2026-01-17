import { supabase } from './supabase';

export interface SubscriptionPlan {
  id: string;
  plan_name: 'Basic' | 'Pro' | 'Expert';
  plan_name_ar: string;
  description: string;
  features: string[];
  price_monthly: number;
  price_yearly: number;
  is_active: boolean;
  display_order: number;
}

export interface Subscription {
  id: string;
  institution_id: string;
  institution_name: string;
  plan_id: string;
  plan_name: string;
  status: 'active' | 'expired' | 'suspended' | 'trial';
  start_date: string;
  end_date: string | null;
  trial_end_date: string | null;
  is_trial: boolean;
  auto_renew: boolean;
  payment_method?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  license_key: string;
  plan_id: string;
  plan_name: string;
  duration_days: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  generated_by?: string;
  notes?: string;
  created_at: string;
  expires_at?: string;
}

const INSTITUTION_ID_KEY = 'bga_institution_id';
const INSTITUTION_NAME_KEY = 'bga_institution_name';

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private currentSubscription: Subscription | null = null;

  private constructor() {}

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data || [];
  }

  async getCurrentSubscription(): Promise<Subscription | null> {
    const institutionId = this.getInstitutionId();
    if (!institutionId) return null;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    this.currentSubscription = data;
    return data;
  }

  async activateLicense(licenseKey: string, institutionName: string): Promise<{ success: boolean; message: string; subscription?: Subscription }> {
    try {
      const { data: license, error: licenseError } = await supabase
        .from('subscription_licenses')
        .select('*')
        .eq('license_key', licenseKey.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (licenseError) throw licenseError;

      if (!license) {
        return { success: false, message: 'رمز الترخيص غير صحيح أو غير نشط' };
      }

      if (license.max_uses && license.current_uses >= license.max_uses) {
        return { success: false, message: 'تم استخدام هذا الرمز الحد الأقصى من المرات' };
      }

      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        return { success: false, message: 'انتهت صلاحية رمز الترخيص' };
      }

      const institutionId = this.getOrCreateInstitutionId();
      this.setInstitutionName(institutionName);

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + license.duration_days);

      const subscriptionData = {
        institution_id: institutionId,
        institution_name: institutionName,
        plan_id: license.plan_id,
        plan_name: license.plan_name,
        status: 'active' as const,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        is_trial: false,
        auto_renew: false,
        payment_method: 'license_key'
      };

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

      if (subError) throw subError;

      await supabase
        .from('subscription_licenses')
        .update({ current_uses: license.current_uses + 1 })
        .eq('id', license.id);

      await supabase
        .from('subscription_history')
        .insert({
          subscription_id: subscription.id,
          action: 'activated',
          previous_status: null,
          new_status: 'active',
          changed_by: 'user',
          details: { license_key: licenseKey, duration_days: license.duration_days }
        });

      await supabase
        .from('institution_settings')
        .upsert({
          institution_id: institutionId,
          institution_name: institutionName,
          subscription_id: subscription.id,
          config: {}
        }, {
          onConflict: 'institution_id'
        });

      this.currentSubscription = subscription;

      return {
        success: true,
        message: `تم تفعيل الاشتراك بنجاح! الخطة: ${license.plan_name} - صالح حتى ${endDate.toLocaleDateString('ar-MA')}`,
        subscription
      };

    } catch (error) {
      console.error('Error activating license:', error);
      return { success: false, message: 'حدث خطأ أثناء تفعيل الترخيص' };
    }
  }

  async startTrial(institutionName: string, planName: string = 'Basic'): Promise<{ success: boolean; message: string; subscription?: Subscription }> {
    try {
      const institutionId = this.getOrCreateInstitutionId();
      this.setInstitutionName(institutionName);

      const existingTrial = await this.hasUsedTrial();
      if (existingTrial) {
        return { success: false, message: 'لقد استخدمت الفترة التجريبية مسبقاً' };
      }

      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('plan_name', planName)
        .maybeSingle();

      if (planError || !plan) {
        return { success: false, message: 'الخطة غير موجودة' };
      }

      const startDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7);

      const subscriptionData = {
        institution_id: institutionId,
        institution_name: institutionName,
        plan_id: plan.id,
        plan_name: plan.plan_name,
        status: 'trial' as const,
        start_date: startDate.toISOString().split('T')[0],
        end_date: null,
        trial_end_date: trialEndDate.toISOString().split('T')[0],
        is_trial: true,
        auto_renew: false
      };

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

      if (subError) throw subError;

      await supabase
        .from('subscription_history')
        .insert({
          subscription_id: subscription.id,
          action: 'trial_started',
          previous_status: null,
          new_status: 'trial',
          changed_by: 'user',
          details: { trial_days: 7 }
        });

      await supabase
        .from('institution_settings')
        .upsert({
          institution_id: institutionId,
          institution_name: institutionName,
          subscription_id: subscription.id,
          config: {}
        }, {
          onConflict: 'institution_id'
        });

      this.currentSubscription = subscription;

      return {
        success: true,
        message: `تم بدء الفترة التجريبية! صالحة لمدة 7 أيام حتى ${trialEndDate.toLocaleDateString('ar-MA')}`,
        subscription
      };

    } catch (error) {
      console.error('Error starting trial:', error);
      return { success: false, message: 'حدث خطأ أثناء بدء الفترة التجريبية' };
    }
  }

  async hasUsedTrial(): Promise<boolean> {
    const institutionId = this.getInstitutionId();
    if (!institutionId) return false;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('institution_id', institutionId)
      .eq('is_trial', true)
      .limit(1);

    if (error) return false;
    return (data?.length || 0) > 0;
  }

  isSubscriptionActive(): boolean {
    if (!this.currentSubscription) return false;

    if (this.currentSubscription.status === 'suspended') return false;

    if (this.currentSubscription.status === 'trial') {
      if (!this.currentSubscription.trial_end_date) return false;
      const trialEnd = new Date(this.currentSubscription.trial_end_date);
      return new Date() <= trialEnd;
    }

    if (this.currentSubscription.status === 'active') {
      if (!this.currentSubscription.end_date) return true;
      const endDate = new Date(this.currentSubscription.end_date);
      return new Date() <= endDate;
    }

    return false;
  }

  getPlanName(): string {
    return this.currentSubscription?.plan_name || 'None';
  }

  hasFeature(feature: string): boolean {
    if (!this.isSubscriptionActive()) return false;

    const planName = this.getPlanName();

    const basicFeatures = [
      'student_management',
      'import_lists',
      'educational_structure',
      'school_entry_tracking',
      'incoming_students',
      'outgoing_students',
      'credentials_management',
      'schedule_import',
      'schedule_print',
      'absence_management',
      'absence_sheets',
      'print_documents'
    ];

    const proFeatures = [
      ...basicFeatures,
      'whatsapp_communication',
      'absence_notifications',
      'behavior_notifications',
      'student_communication',
      'section_communication',
      'level_communication',
      'auto_credentials_send',
      'message_templates',
      'message_history'
    ];

    const expertFeatures = [
      ...proFeatures,
      'quiz_management',
      'quiz_auto_correction',
      'quiz_templates',
      'quiz_scanning',
      'quiz_qrcode',
      'quiz_statistics',
      'quiz_reports',
      'advanced_exams'
    ];

    if (planName === 'Expert') {
      return expertFeatures.includes(feature);
    } else if (planName === 'Pro') {
      return proFeatures.includes(feature);
    } else if (planName === 'Basic') {
      return basicFeatures.includes(feature);
    }

    return false;
  }

  getDaysRemaining(): number | null {
    if (!this.currentSubscription) return null;

    let endDate: Date | null = null;

    if (this.currentSubscription.status === 'trial' && this.currentSubscription.trial_end_date) {
      endDate = new Date(this.currentSubscription.trial_end_date);
    } else if (this.currentSubscription.end_date) {
      endDate = new Date(this.currentSubscription.end_date);
    }

    if (!endDate) return null;

    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }

  private getInstitutionId(): string | null {
    return localStorage.getItem(INSTITUTION_ID_KEY);
  }

  private getOrCreateInstitutionId(): string {
    let id = this.getInstitutionId();
    if (!id) {
      id = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(INSTITUTION_ID_KEY, id);
    }
    return id;
  }

  getInstitutionName(): string | null {
    return localStorage.getItem(INSTITUTION_NAME_KEY);
  }

  private setInstitutionName(name: string): void {
    localStorage.setItem(INSTITUTION_NAME_KEY, name);
  }

  clearInstitutionData(): void {
    localStorage.removeItem(INSTITUTION_ID_KEY);
    localStorage.removeItem(INSTITUTION_NAME_KEY);
    this.currentSubscription = null;
  }
}

export const subscriptionManager = SubscriptionManager.getInstance();
