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
import { dbManager } from './database';

const LICENSE_CHECK_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;
const TRIAL_DURATION_DAYS = 15;
const TRIAL_DATA_KEY = 'trial_data';
const WEB_CRYPTO_REQUIRED_MESSAGE = 'يتطلب التحقق من الترخيص والتجربة اتصال HTTPS آمنًا. على جهاز تشغيل التطبيق، افتح http://localhost:8580. عند الوصول من جهاز آخر، استخدم HTTPS بشهادة موثوقة. إذا استمرت المشكلة، استخدم متصفحًا حديثًا يدعم Web Crypto.';

interface LicenseData {
  id: string;
  license_key: string;
  plan_id: string;
  plan_name: string;
  duration_days: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  institution_id?: string | null;
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

  private isVerificationDue(lastVerifiedAt?: string): boolean {
    if (!lastVerifiedAt) return true;

    const lastVerifiedTime = Date.parse(lastVerifiedAt);
    return (
      !Number.isFinite(lastVerifiedTime) ||
      Date.now() - lastVerifiedTime >= LICENSE_CHECK_INTERVAL_MS
    );
  }

  private async saveLicenseVerification(
    license: Record<string, any>,
    checkedAt: string,
    result: { isValid: boolean; needsActivation: boolean; message: string },
  ): Promise<void> {
    await setEncryptedItem('license_data', {
      ...license,
      lastVerifiedAt: checkedAt,
      lastVerifiedValid: result.isValid,
      lastVerifiedNeedsActivation: result.needsActivation,
      lastVerifiedMessage: result.message,
    });
  }

  /**
   * توليد بصمة فريدة للجهاز
   */
  private async generateDeviceFingerprint(): Promise<string> {
    if (!globalThis.crypto?.subtle) {
      throw new Error(WEB_CRYPTO_REQUIRED_MESSAGE);
    }
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
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

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
    } catch {
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


  private async logActivation(
  licenseKey: string,
  deviceFP: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  // تم تعطيل تسجيل المحاولات مؤقتاً
  return;
}
  /**
   * تسجيل محاولة التفعيل
  

  /**
   * ربط المؤسسة بالترخيص عبر institution_id وحفظها محليًا
   */
  private async bindInstitutionToLocalSettings(license: Partial<LicenseData> | null | undefined): Promise<void> {
    try {
      if (!license?.institution_id) {
        console.warn('⚠️ الترخيص لا يحتوي على institution_id');
        return;
      }

      const { data: institution, error } = await supabase
        .from('institutions')
        .select('id, name, code')
        .eq('id', license.institution_id)
        .maybeSingle();

      if (error) {
        console.warn('⚠️ خطأ في جلب المؤسسة:', error);
        return;
      }

      if (!institution) {
        console.warn('⚠️ لم يتم العثور على المؤسسة');
        return;
      }

      await dbManager.initialize();

      const currentSettings = await dbManager.getInstitutionSettings();

      await dbManager.saveInstitutionSettings({
        ...(currentSettings || {}),
        institution: institution.name || '',
        institutionCode: institution.code || '',
        supabaseInstitutionId: institution.id || '',
        institutionActivationCode: license.license_key || '',
        updatedAt: new Date().toISOString(),
      });

      console.log('✅ تم ربط المؤسسة محليًا:', institution);
    } catch (error) {
      console.warn('⚠️ خطأ أثناء ربط المؤسسة:', error);
    }
  }

  /**
   * التحقق من صلاحية الكود وتفعيله
   */
  async validateAndActivateLicense(licenseKey: string): Promise<ActivationResult> {
    try {
      const normalizedKey = licenseKey.trim().toUpperCase();

      console.log('🔐 بدء التحقق من كود التفعيل');

      const deviceFP = await this.getDeviceFingerprint();
      console.log('📱 بصمة الجهاز:', deviceFP.substring(0, 16) + '...');

      const { data: license, error: fetchError } = await supabase
        .from('subscription_licenses')
        .select('*')
        .eq('license_key', normalizedKey)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ خطأ في الاستعلام:', fetchError);
        await this.logActivation(normalizedKey, deviceFP, false, 'خطأ في الاتصال بقاعدة البيانات');
        return {
          success: false,
          message: 'خطأ في الاتصال بقاعدة البيانات. تحقق من اتصال الإنترنت.',
        };
      }

      if (!license) {
        console.log('❌ الكود غير موجود');
        await this.logActivation(normalizedKey, deviceFP, false, 'الكود غير موجود');
        return {
          success: false,
          message: 'الكود المدخل غير صحيح. يرجى التحقق من الكود والمحاولة مرة أخرى.',
        };
      }

      if (!license.is_active) {
        console.log('❌ الكود غير نشط');
        await this.logActivation(normalizedKey, deviceFP, false, 'الكود غير نشط');
        return {
          success: false,
          message: 'هذا الكود غير نشط. يرجى التواصل مع الدعم.',
        };
      }

      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        console.log('❌ الكود منتهي الصلاحية');
        await this.logActivation(normalizedKey, deviceFP, false, 'انتهت الصلاحية');
        return {
          success: false,
          message: 'انتهت صلاحية هذا الكود. يرجى التواصل مع الدعم للتجديد.',
        };
      }

      const isSameDevice = license.device_fingerprint === deviceFP;

      // الجهاز نفسه لا يستهلك استعمالاً إضافياً، أما الأجهزة الجديدة فتُحتسب ضمن max_uses
      if (!isSameDevice && !license.unlimited_uses && license.current_uses >= license.max_uses) {
        console.log('❌ تم استخدام الكود الحد الأقصى');
        await this.logActivation(normalizedKey, deviceFP, false, 'تم استخدام الكود');
        return {
          success: false,
          message: 'تم استخدام هذا الكود الحد الأقصى من المرات (عدد الأجهزة المسموح به). يرجى الحصول على كود جديد.',
        };
      }

      if (isSameDevice) {
        console.log('✅ الكود مفعل على هذا الجهاز');

        await this.saveLicenseStatus(license as LicenseData);
        await this.bindInstitutionToLocalSettings(license as LicenseData);
        await this.logActivation(normalizedKey, deviceFP, true);

        return {
          success: true,
          message: 'الكود مفعل بالفعل على هذا الجهاز',
          data: license,
        };
      }

      console.log('🔓 تفعيل الكود...');

      const newUsesCount = license.unlimited_uses
        ? license.current_uses
        : license.current_uses + 1;

      const { data: updated, error: updateError } = await supabase
        .from('subscription_licenses')
        .update({
          device_fingerprint: deviceFP,
          activated_at: new Date().toISOString(),
          current_uses: newUsesCount,
        })
        .eq('id', license.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ خطأ في التفعيل:', updateError);
        await this.logActivation(normalizedKey, deviceFP, false, 'فشل التحديث');
        return {
          success: false,
          message: 'فشل تفعيل الكود. يرجى المحاولة مرة أخرى.',
        };
      }

      console.log('✅ تم تفعيل الكود بنجاح');

      await this.saveLicenseStatus(updated as LicenseData);
      await this.bindInstitutionToLocalSettings(updated as LicenseData);
      await this.logActivation(normalizedKey, deviceFP, true);

      const trialMessage = license.is_trial_code
        ? ` (فترة تجريبية لمدة ${license.duration_days} أيام)`
        : '';

      return {
        success: true,
        message: `تم تفعيل البرنامج بنجاح! الخطة: ${license.plan_name}${trialMessage}`,
        data: updated,
      };
    } catch (error) {
      console.error('❌ خطأ في validateAndActivateLicense:', error);
      return {
        success: false,
        message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
      };
    }
  }

  /**
   * حفظ حالة الترخيص محلياً (مشفرة)
   */
  private async saveLicenseStatus(license: LicenseData): Promise<void> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + license.duration_days);

    await setEncryptedItem('license_data', {
      key: license.license_key,
      planName: license.plan_name,
      isTrial: license.is_trial_code || false,
      activatedAt: license.activated_at || new Date().toISOString(),
      expiresAt: expiryDate.toISOString(),
      durationDays: license.duration_days,
      institutionId: license.institution_id || null,
      lastVerifiedAt: new Date().toISOString(),
      lastVerifiedValid: true,
      lastVerifiedNeedsActivation: false,
      lastVerifiedMessage: 'الترخيص صالح',
    });
    
  }

  /**
   * التحقق من حالة الترخيص
   */

  
  async checkLicenseStatus(): Promise<{
    isValid: boolean;
    needsActivation: boolean;
    message: string;
    trialError?: boolean;
  }
  
  > {
    // Both device hashing and encrypted license storage require Web Crypto.
    // Check before reading storage or starting a trial on the server.
    if (!globalThis.crypto?.subtle) {
      return {
        isValid: false,
        needsActivation: false,
        message: WEB_CRYPTO_REQUIRED_MESSAGE,
        trialError: true,
      };
    }
    try {

      const license = await getEncryptedItem('license_data');
      if (!license) {
        return this.checkTrialStatus();
      }

      if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
        return {
          isValid: false,
          needsActivation: false,
          message: 'انتهت صلاحية الترخيص',
        };
      }

      if (!this.isVerificationDue(license.lastVerifiedAt)) {
        return {
          isValid: license.lastVerifiedValid !== false,
          needsActivation: license.lastVerifiedNeedsActivation === true,
          message: license.lastVerifiedMessage || 'الترخيص محفوظ محليًا وما زال ضمن مدة التحقق',
        };
      }

      const deviceFP = await this.getDeviceFingerprint();
      const checkedAt = new Date().toISOString();

      try {
        const { data, error } = await supabase
          .from('subscription_licenses')
          .select('*')
          .eq('license_key', license.key)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          const result = {
            isValid: false,
            needsActivation: true,
            message: 'تعذر العثور على الترخيص في قاعدة البيانات.',
          };
          await this.saveLicenseVerification(license, checkedAt, result);
          return result;
        }

        await this.bindInstitutionToLocalSettings(data as LicenseData);

        if (data.device_fingerprint && data.device_fingerprint !== deviceFP) {
          if (!data.can_reactivate && !data.developer_only) {
            const result = {
              isValid: false,
              needsActivation: true,
              message: 'تم تفعيل الكود على جهاز آخر',
            };
            await this.saveLicenseVerification(license, checkedAt, result);
            return result;
          }
        }

        if (!data.is_active) {
          const result = {
            isValid: false,
            needsActivation: false,
            message: 'الكود غير نشط',
          };
          await this.saveLicenseVerification(license, checkedAt, result);
          return result;
        }

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          const result = {
            isValid: false,
            needsActivation: false,
            message: 'انتهت صلاحية الترخيص',
          };
          await this.saveLicenseVerification(license, checkedAt, result);
          return result;
        }

        const result = {
          isValid: true,
          needsActivation: false,
          message: 'الترخيص صالح',
        };
        await this.saveLicenseVerification(license, checkedAt, result);
        return result;
      } catch (error) {
        console.warn('⚠️ فشل التحقق عبر الإنترنت، استخدام الترخيص المحلي حتى موعد التحقق التالي:', error);
        const result = {
          isValid: license.lastVerifiedValid !== false,
          needsActivation: license.lastVerifiedNeedsActivation === true,
          message: license.lastVerifiedMessage || 'تعذر الاتصال؛ استُخدم الترخيص المحفوظ محليًا',
        };
        await this.saveLicenseVerification(license, checkedAt, result);
        return result;
      }
    } catch (error) {
      console.error('❌ خطأ في التحقق من الترخيص:', error);
      return {
        isValid: false,
        needsActivation: false,
        message: 'تعذر التحقق من الترخيص. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
        trialError: true,
      };
    }
  }

  private async checkTrialStatus(): Promise<{
    isValid: boolean;
    needsActivation: boolean;
    message: string;
    trialError?: boolean;
  }> {
    try {
      const trial = await getEncryptedItem(TRIAL_DATA_KEY);
      const now = new Date();

      if (trial?.lastVerifiedAt && !this.isVerificationDue(trial.lastVerifiedAt)) {
        if (trial.lastVerifiedValid === false) {
          return {
            isValid: false,
            needsActivation: true,
            message: trial.lastVerifiedMessage || 'انتهت الفترة التجريبية',
          };
        }
        if (trial.expiresAt && new Date(trial.expiresAt) > now) {
          return {
            isValid: true,
            needsActivation: false,
            message: 'الفترة التجريبية محفوظة محليًا وما زالت صالحة',
          };
        }
      }

      if (trial?.expiresAt && new Date(trial.expiresAt) <= now) {
        return {
          isValid: false,
          needsActivation: true,
          message: 'انتهت الفترة التجريبية',
        };
      }

      const deviceFP = await this.getDeviceFingerprint();
      let session = trial;
      let startedTrial = false;

      if (!session?.expiresAt) {
        const { data: startResult, error: startError } = await supabase.rpc(
          'start_trial_session',
          {
            p_device_fingerprint: deviceFP,
            p_browser_info: {
              userAgent: navigator.userAgent,
              language: navigator.language,
              platform: navigator.platform,
            },
            p_trial_duration_days: TRIAL_DURATION_DAYS,
          }
        );

        if (startError) throw startError;

        if (!startResult?.success) {
          const checkedAt = now.toISOString();
          const result = {
            isValid: false,
            needsActivation: true,
            message: startResult?.message || 'انتهت الفترة التجريبية',
          };
          await setEncryptedItem(TRIAL_DATA_KEY, {
            lastVerifiedAt: checkedAt,
            lastVerifiedValid: false,
            lastVerifiedMessage: result.message,
          });
          return {
            ...result,
          };
        }

        const serverSession = startResult.session;
        if (!serverSession?.trial_expires_at) {
          throw new Error('لم تُرجع خدمة بدء التجربة تاريخ الانتهاء.');
        }

        session = {
          startedAt: serverSession.trial_started_at,
          expiresAt: serverSession.trial_expires_at,
        };
        startedTrial = true;
      }

      const checkedAt = now.toISOString();
      if (startedTrial) {
        const isValid = new Date(session.expiresAt) > now;
        await setEncryptedItem(TRIAL_DATA_KEY, {
          ...session,
          lastVerifiedAt: checkedAt,
          lastVerifiedValid: isValid,
          lastVerifiedMessage: isValid ? 'الفترة التجريبية نشطة' : 'انتهت الفترة التجريبية',
        });
        return {
          isValid,
          needsActivation: !isValid,
          message: isValid ? 'الفترة التجريبية نشطة' : 'انتهت الفترة التجريبية',
        };
      }

      try {
        const { data: validity, error: validityError } = await supabase.rpc(
          'check_trial_validity',
          { p_device_fingerprint: deviceFP }
        );

        if (validityError) throw validityError;
        if (!validity) {
          throw new Error('لم تُرجع خدمة التحقق حالة الفترة التجريبية.');
        }

        await setEncryptedItem(TRIAL_DATA_KEY, {
          ...session,
          lastVerifiedAt: checkedAt,
          lastVerifiedValid: validity.is_valid === true,
          lastVerifiedMessage: validity.message || '',
        });

        return {
          isValid: validity.is_valid === true,
          needsActivation: validity.is_valid !== true,
          message: validity.message || '',
        };
      } catch (error) {
        if (!trial?.expiresAt) throw error;

        console.warn('⚠️ تعذر التحقق من التجربة عبر الإنترنت؛ استخدام الحالة المحفوظة:', error);
        await setEncryptedItem(TRIAL_DATA_KEY, {
          ...session,
          lastVerifiedAt: checkedAt,
          lastVerifiedValid: trial.lastVerifiedValid !== false,
          lastVerifiedMessage: trial.lastVerifiedMessage || '',
        });
      }

      if (new Date(session.expiresAt) <= new Date()) {
        return {
          isValid: false,
          needsActivation: true,
          message: 'انتهت الفترة التجريبية',
        };
      }

      return {
        isValid: true,
        needsActivation: false,
        message: 'الفترة التجريبية صالحة محليًا',
      };
    } catch (error) {
      console.error('❌ تعذر بدء الفترة التجريبية أو التحقق منها:', error);
      return {
        isValid: false,
        needsActivation: false,
        message: 'تعذر التحقق من الفترة التجريبية. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
        trialError: true,
      };
    }
  }

  /**
   * إلغاء تفعيل الترخيص (للمطور فقط - آمن)
   */
  async deactivateLicense(licenseKey: string, developerPassword?: string): Promise<boolean> {
    try {
      if (developerPassword) {
        const verifyResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-developer-password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ password: developerPassword }),
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
          activated_at: null,
        })
        .eq('license_key', licenseKey.trim().toUpperCase());

      if (error) {
        console.error('❌ خطأ في إلغاء التفعيل:', error);
        return false;
      }

      await removeEncryptedItem('license_data');
      localStorage.removeItem('device_fp');
      localStorage.removeItem('supabaseInstitutionId');
      localStorage.removeItem('institutionCode');
      localStorage.removeItem('institutionName');
      localStorage.removeItem('licenseKey');
      localStorage.removeItem('institution_settings_backup');
      localStorage.removeItem('institutionSettings');

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
