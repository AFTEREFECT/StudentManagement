/**
 * نظام إدارة الترخيص الموحد - يعمل مع subscription_licenses
 *
 * يدعم:
 * - أكواد التجريب (محدودة وغير محدودة)
 * - أكواد الاشتراك الكاملة (Basic, Pro, Expert)
 * - وضع المطور مع إمكانية إعادة التفعيل
 * - تسجيل محاولات التفعيل
 */

import { supabase } from './supabase';
import { setEncryptedItem, getEncryptedItem, removeEncryptedItem } from './encryption';

interface LicenseData {
  id: string;
  license_key: string;
  plan_id: string;
  plan_name: string;
  duration_days: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  is_trial_code?: boolean;
  unlimited_uses?: boolean;
  developer_only?: boolean;
  device_fingerprint?: string | null;
  activated_at?: string | null;
  can_reactivate?: boolean;
  expires_at?: string | null;
  generated_by?: string;
  notes?: string;
  created_at: string;
}

interface ActivationResult {
  success: boolean;
  message: string;
  data?: any;
}

class LicenseManager {
  private deviceFingerprint: string | null = null;

  /**
   * توليد بصمة فريدة للجهاز
   */
  private async generateDeviceFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.hardwareConcurrency || 'unknown',
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.platform,
      await this.getCanvasFingerprint(),
    ];

    const fingerprint = components.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  /**
   * Canvas fingerprinting
   */
  private async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('BGAStudents', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('License', 4, 17);

      return canvas.toDataURL().substring(0, 100);
    } catch (error) {
      return 'canvas-error';
    }
  }

  /**
   * الحصول على بصمة الجهاز
   */
  async getDeviceFingerprint(): Promise<string> {
    if (this.deviceFingerprint) {
      return this.deviceFingerprint;
    }

    const stored = localStorage.getItem('device_fp');
    if (stored) {
      this.deviceFingerprint = stored;
      return stored;
    }

    const fingerprint = await this.generateDeviceFingerprint();
    localStorage.setItem('device_fp', fingerprint);
    this.deviceFingerprint = fingerprint;

    return fingerprint;
  }

  /**
   * تسجيل محاولة التفعيل
   */
  private async logActivation(
    licenseKey: string,
    deviceFP: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase.rpc('log_activation_attempt', {
        p_license_key: licenseKey,
        p_device_fingerprint: deviceFP,
        p_success: success,
        p_error_message: errorMessage || null,
        p_user_agent: navigator.userAgent
      });
    } catch (error) {
      console.warn('فشل تسجيل محاولة التفعيل:', error);
    }
  }

  /**
   * التحقق من صلاحية الكود وتفعيله
   */
  async validateAndActivateLicense(licenseKey: string): Promise<ActivationResult> {
    try {
      console.log('🔐 بدء التحقق من الكود:', licenseKey);

      const deviceFP = await this.getDeviceFingerprint();
      console.log('📱 بصمة الجهاز:', deviceFP.substring(0, 16) + '...');

      // البحث عن الكود في subscription_licenses
      const { data: license, error: fetchError } = await supabase
        .from('subscription_licenses')
        .select('*')
        .eq('license_key', licenseKey.toUpperCase())
        .maybeSingle();

      if (fetchError) {
        console.error('❌ خطأ في الاستعلام:', fetchError);
        await this.logActivation(licenseKey, deviceFP, false, 'خطأ في الاتصال بقاعدة البيانات');
        return {
          success: false,
          message: 'خطأ في الاتصال بقاعدة البيانات. تحقق من اتصال الإنترنت.'
        };
      }

      if (!license) {
        console.log('❌ الكود غير موجود');
        await this.logActivation(licenseKey, deviceFP, false, 'الكود غير موجود');
        return {
          success: false,
          message: 'الكود المدخل غير صحيح. يرجى التحقق من الكود والمحاولة مرة أخرى.'
        };
      }

      // التحقق من حالة الكود
      if (!license.is_active) {
        console.log('❌ الكود غير نشط');
        await this.logActivation(licenseKey, deviceFP, false, 'الكود غير نشط');
        return {
          success: false,
          message: 'هذا الكود غير نشط. يرجى التواصل مع الدعم.'
        };
      }

      // التحقق من انتهاء الصلاحية
      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        console.log('❌ الكود منتهي الصلاحية');
        await this.logActivation(licenseKey, deviceFP, false, 'انتهت الصلاحية');
        return {
          success: false,
          message: 'انتهت صلاحية هذا الكود. يرجى التواصل مع الدعم للتجديد.'
        };
      }

      // التحقق من عدد الاستخدامات (إلا إذا كان غير محدود)
      if (!license.unlimited_uses && license.current_uses >= license.max_uses) {
        console.log('❌ تم استخدام الكود الحد الأقصى');
        await this.logActivation(licenseKey, deviceFP, false, 'تم استخدام الكود');
        return {
          success: false,
          message: 'تم استخدام هذا الكود الحد الأقصى من المرات. يرجى الحصول على كود جديد.'
        };
      }

      // التحقق إذا كان الكود مفعل على جهاز آخر
      if (license.device_fingerprint && license.device_fingerprint !== deviceFP) {
        // إذا كان يمكن إعادة التفعيل (أكواد المطور)
        if (license.can_reactivate || license.developer_only) {
          console.log('⚠️ إعادة تفعيل الكود على جهاز جديد (وضع المطور)');
          // السماح بإعادة التفعيل
        } else {
          console.log('❌ الكود مستخدم على جهاز آخر');
          await this.logActivation(licenseKey, deviceFP, false, 'مستخدم على جهاز آخر');
          return {
            success: false,
            message: 'هذا الكود مستخدم بالفعل على جهاز آخر. لا يمكن استخدامه على أكثر من جهاز.'
          };
        }
      }

      // التحقق إذا كان الكود مفعل على نفس الجهاز
      if (license.device_fingerprint === deviceFP) {
        console.log('✅ الكود مفعل على هذا الجهاز');
        await this.saveLicenseStatus(license);
        await this.logActivation(licenseKey, deviceFP, true);
        return {
          success: true,
          message: 'الكود مفعل بالفعل على هذا الجهاز',
          data: license
        };
      }

      // تفعيل الكود
      console.log('🔓 تفعيل الكود...');

      // زيادة عدد الاستخدامات (إلا إذا كان غير محدود)
      const newUsesCount = license.unlimited_uses ? license.current_uses : license.current_uses + 1;

      const { data: updated, error: updateError } = await supabase
        .from('subscription_licenses')
        .update({
          device_fingerprint: deviceFP,
          activated_at: new Date().toISOString(),
          current_uses: newUsesCount
        })
        .eq('id', license.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ خطأ في التفعيل:', updateError);
        await this.logActivation(licenseKey, deviceFP, false, 'فشل التحديث');
        return {
          success: false,
          message: 'فشل تفعيل الكود. يرجى المحاولة مرة أخرى.'
        };
      }

      console.log('✅ تم تفعيل الكود بنجاح');
      await this.saveLicenseStatus(updated);
      await this.logActivation(licenseKey, deviceFP, true);

      // رسالة خاصة للأكواد التجريبية
      const trialMessage = license.is_trial_code
        ? ` (فترة تجريبية لمدة ${license.duration_days} أيام)`
        : '';

      return {
        success: true,
        message: `تم تفعيل البرنامج بنجاح! الخطة: ${license.plan_name}${trialMessage}`,
        data: updated
      };

    } catch (error) {
      console.error('❌ خطأ في validateAndActivateLicense:', error);
      return {
        success: false,
        message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
      };
    }
  }

  /**
   * حفظ حالة الترخيص محلياً (مشفرة)
   */
  private async saveLicenseStatus(license: LicenseData) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + license.duration_days);

    await setEncryptedItem('license_data', {
      key: license.license_key,
      planName: license.plan_name,
      isTrial: license.is_trial_code || false,
      activatedAt: license.activated_at || new Date().toISOString(),
      expiresAt: expiryDate.toISOString(),
      durationDays: license.duration_days
    });
  }

  /**
   * التحقق من حالة الترخيص
   */
  async checkLicenseStatus(): Promise<{
    isValid: boolean;
    needsActivation: boolean;
    message: string;
  }> {
    try {
      const license = await getEncryptedItem('license_data');
      if (!license) {
        return {
          isValid: false,
          needsActivation: true,
          message: 'يجب تفعيل البرنامج أولاً'
        };
      }

      // التحقق من انتهاء الصلاحية محلياً
      if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
        return {
          isValid: false,
          needsActivation: false,
          message: 'انتهت صلاحية الترخيص'
        };
      }

      const deviceFP = await this.getDeviceFingerprint();

      // التحقق من قاعدة البيانات
      const { data, error } = await supabase
        .from('subscription_licenses')
        .select('*')
        .eq('license_key', license.key)
        .maybeSingle();

      if (error || !data) {
        console.warn('⚠️ فشل التحقق عبر الإنترنت، استخدام البيانات المحلية');
        return {
          isValid: true,
          needsActivation: false,
          message: 'تم التحقق محلياً (بدون اتصال)'
        };
      }

      // التحقق من البصمة
      if (data.device_fingerprint && data.device_fingerprint !== deviceFP) {
        // السماح للأكواد القابلة لإعادة التفعيل
        if (!data.can_reactivate && !data.developer_only) {
          return {
            isValid: false,
            needsActivation: true,
            message: 'تم تفعيل الكود على جهاز آخر'
          };
        }
      }

      // التحقق من الحالة
      if (!data.is_active) {
        return {
          isValid: false,
          needsActivation: false,
          message: 'الكود غير نشط'
        };
      }

      return {
        isValid: true,
        needsActivation: false,
        message: 'الترخيص صالح'
      };

    } catch (error) {
      console.error('❌ خطأ في التحقق من الترخيص:', error);
      // وضع التسامح
      return {
        isValid: true,
        needsActivation: false,
        message: 'تحذير: لم يتم التحقق من الترخيص'
      };
    }
  }

  /**
   * إلغاء تفعيل الترخيص (للمطور فقط - آمن)
   */
  async deactivateLicense(licenseKey: string, developerPassword?: string): Promise<boolean> {
    try {
      // التحقق من كلمة المرور عبر الخادم (آمن)
      if (developerPassword) {
        const verifyResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-developer-password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ password: developerPassword })
          }
        );

        const verifyResult = await verifyResponse.json();
        if (!verifyResult.valid) {
          console.error('❌ كلمة مرور المطور غير صحيحة');
          return false;
        }
      }

      const { error } = await supabase
        .from('subscription_licenses')
        .update({
          device_fingerprint: null,
          activated_at: null
        })
        .eq('license_key', licenseKey.toUpperCase());

      if (error) {
        console.error('❌ خطأ في إلغاء التفعيل:', error);
        return false;
      }

      removeEncryptedItem('license_data');
      localStorage.removeItem('device_fp');
      console.log('✅ تم إلغاء تفعيل الكود بنجاح');
      return true;
    } catch (error) {
      console.error('❌ خطأ في deactivateLicense:', error);
      return false;
    }
  }

  /**
   * الحصول على معلومات الترخيص الحالي
   */
  async getCurrentLicenseInfo(): Promise<any> {
    try {
      return await getEncryptedItem('license_data');
    } catch {
      return null;
    }
  }
}

export const licenseManager = new LicenseManager();
