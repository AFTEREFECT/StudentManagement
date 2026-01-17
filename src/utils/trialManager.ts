/**
 * مدير جلسات التجربة المجانية - نظام محمي ومتقدم
 *
 * الميزات:
 * - تجربة مجانية لمدة 7 أيام بدون كود
 * - حماية قوية ضد التلاعب (الوقت، المتصفح، التخزين)
 * - كشف الوضع الخاص (Incognito)
 * - تتبع إحصائيات الاستخدام
 * - مزامنة مع خادم Supabase
 */

import { supabase } from './supabase';

interface TrialSession {
  id: string;
  device_fingerprint: string;
  trial_started_at: string;
  trial_expires_at: string;
  is_expired: boolean;
  session_count: number;
  last_activity: string;
  browser_info: any;
  converted_to_paid: boolean;
}

interface TrialStatus {
  isValid: boolean;
  needsActivation: boolean;
  message: string;
  daysRemaining: number;
  hoursRemaining: number;
  session: TrialSession | null;
}

class TrialManager {
  private deviceFingerprint: string | null = null;
  private localStorageKey = 'trial_session_data';
  private fingerprintKey = 'device_fp_secure';

  /**
   * توليد بصمة فريدة للجهاز (محسّنة)
   */
  private async generateDeviceFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.languages?.join(',') || '',
      navigator.hardwareConcurrency || 'unknown',
      screen.width,
      screen.height,
      screen.colorDepth,
      screen.pixelDepth,
      new Date().getTimezoneOffset(),
      navigator.platform,
      navigator.maxTouchPoints || 0,
      // معلومات إضافية
      window.devicePixelRatio || 1,
      navigator.vendor || '',
      // كشف WebGL
      await this.getWebGLFingerprint(),
      // كشف Canvas
      await this.getCanvasFingerprint(),
      // كشف Audio
      await this.getAudioFingerprint(),
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
   * Canvas fingerprinting محسّن
   */
  private async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      canvas.width = 280;
      canvas.height = 60;

      // رسم معقد لزيادة الفرادة
      ctx.textBaseline = 'top';
      ctx.font = '16px "Arial"';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('BGAStudents 2025 🔒', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('TrialSystem', 4, 45);

      // إضافة أشكال
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.beginPath();
      ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();

      const dataURL = canvas.toDataURL();

      // Hash للـ canvas data
      const encoder = new TextEncoder();
      const data = encoder.encode(dataURL);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
    } catch (error) {
      return 'canvas-error';
    }
  }

  /**
   * WebGL fingerprinting
   */
  private async getWebGLFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      if (!gl) return 'no-webgl';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return 'no-debug-info';

      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

      return `${vendor}|${renderer}`.substring(0, 50);
    } catch (error) {
      return 'webgl-error';
    }
  }

  /**
   * Audio fingerprinting
   */
  private async getAudioFingerprint(): Promise<string> {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return 'no-audio';

      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gainNode = context.createGain();
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

      gainNode.gain.value = 0;
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(0);

      return new Promise((resolve) => {
        scriptProcessor.onaudioprocess = function(event) {
          const output = event.outputBuffer.getChannelData(0);
          const hash = Array.from(output.slice(0, 30))
            .map(v => Math.abs(v).toFixed(6))
            .join('');

          oscillator.stop();
          scriptProcessor.disconnect();
          context.close();

          resolve(hash.substring(0, 32));
        };
      });
    } catch (error) {
      return 'audio-error';
    }
  }

  /**
   * الحصول على بصمة الجهاز
   */
  async getDeviceFingerprint(): Promise<string> {
    if (this.deviceFingerprint) {
      return this.deviceFingerprint;
    }

    const stored = localStorage.getItem(this.fingerprintKey);
    if (stored) {
      this.deviceFingerprint = stored;
      return stored;
    }

    const fingerprint = await this.generateDeviceFingerprint();
    localStorage.setItem(this.fingerprintKey, fingerprint);
    this.deviceFingerprint = fingerprint;

    return fingerprint;
  }

  /**
   * كشف الوضع الخاص (Incognito Mode)
   */
  async detectIncognitoMode(): Promise<boolean> {
    try {
      // طريقة 1: فحص storage quota
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { quota = 0 } = await navigator.storage.estimate();
        // في الوضع الخاص، الحد الأقصى للتخزين عادة أقل بكثير
        if (quota < 120000000) { // أقل من 120MB
          return true;
        }
      }

      // طريقة 2: فحص IndexedDB
      return new Promise((resolve) => {
        const db = indexedDB.open('test');
        db.onerror = () => resolve(true);
        db.onsuccess = () => {
          resolve(false);
          indexedDB.deleteDatabase('test');
        };
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * الحصول على معلومات المتصفح
   */
  private getBrowserInfo(): any {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints,
      vendor: navigator.vendor,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
    };
  }

  /**
   * التحقق من تزامن الوقت مع الخادم
   */
  async checkTimeSync(): Promise<{ isValid: boolean; serverTime: Date; timeDiff: number; isSuspicious: boolean }> {
    try {
      const clientTime = new Date();
      const deviceFP = await this.getDeviceFingerprint();

      // استدعاء دالة فحص الوقت في Supabase
      const { data, error } = await supabase.rpc('check_time_sync', {
        p_device_fingerprint: deviceFP,
        p_client_time: clientTime.toISOString()
      });

      if (error) {
        console.error('خطأ في فحص تزامن الوقت:', error);
        return {
          isValid: true,
          serverTime: clientTime,
          timeDiff: 0,
          isSuspicious: false
        };
      }

      const serverTime = new Date(data.server_time);
      const timeDiff = data.time_difference_seconds;
      const isSuspicious = data.is_suspicious;

      return {
        isValid: !isSuspicious,
        serverTime,
        timeDiff,
        isSuspicious
      };
    } catch (error) {
      console.error('خطأ في checkTimeSync:', error);
      return {
        isValid: true,
        serverTime: new Date(),
        timeDiff: 0,
        isSuspicious: false
      };
    }
  }

  /**
   * بدء جلسة تجريبية جديدة
   */
  async startTrialSession(): Promise<{ success: boolean; message: string; session?: TrialSession }> {
    try {
      // كشف الوضع الخاص
      const isIncognito = await this.detectIncognitoMode();
      if (isIncognito) {
        return {
          success: false,
          message: 'لا يمكن استخدام البرنامج في وضع التصفح الخاص. يرجى استخدام وضع التصفح العادي.'
        };
      }

      // التحقق من تزامن الوقت
      const timeCheck = await this.checkTimeSync();
      if (!timeCheck.isValid) {
        return {
          success: false,
          message: 'تم اكتشاف تلاعب في توقيت النظام. يرجى ضبط الوقت بشكل صحيح.'
        };
      }

      const deviceFP = await this.getDeviceFingerprint();
      const browserInfo = this.getBrowserInfo();

      // استدعاء دالة بدء التجربة في Supabase
      const { data, error } = await supabase.rpc('start_trial_session', {
        p_device_fingerprint: deviceFP,
        p_browser_info: browserInfo,
        p_trial_duration_days: 7
      });

      if (error) {
        console.error('خطأ في بدء التجربة:', error);
        return {
          success: false,
          message: 'فشل بدء التجربة المجانية. يرجى المحاولة مرة أخرى.'
        };
      }

      if (!data.success) {
        return {
          success: false,
          message: data.message
        };
      }

      // حفظ البيانات محلياً
      const sessionData = {
        session: data.session,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(this.localStorageKey, JSON.stringify(sessionData));

      // تسجيل في الإحصائيات
      await this.logAction('trial', 'trial_started', {
        trial_duration: 7,
        browser_info: browserInfo
      });

      return {
        success: true,
        message: data.message,
        session: data.session
      };
    } catch (error) {
      console.error('خطأ في startTrialSession:', error);
      return {
        success: false,
        message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
      };
    }
  }

  /**
   * التحقق من صلاحية جلسة التجربة
   */
  async checkTrialStatus(): Promise<TrialStatus> {
    try {
      // التحقق من تزامن الوقت أولاً
      const timeCheck = await this.checkTimeSync();
      if (!timeCheck.isValid) {
        return {
          isValid: false,
          needsActivation: false,
          message: 'تم اكتشاف تلاعب في توقيت النظام',
          daysRemaining: 0,
          hoursRemaining: 0,
          session: null
        };
      }

      const deviceFP = await this.getDeviceFingerprint();

      // استدعاء دالة التحقق في Supabase
      const { data, error } = await supabase.rpc('check_trial_validity', {
        p_device_fingerprint: deviceFP
      });

      if (error) {
        console.error('خطأ في التحقق من التجربة:', error);
        // محاولة الاعتماد على البيانات المحلية
        return this.checkLocalTrialStatus();
      }

      const daysRemaining = data.days_remaining || 0;
      const hoursRemaining = daysRemaining * 24;

      // تحديث البيانات المحلية
      if (data.session) {
        const sessionData = {
          session: data.session,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(this.localStorageKey, JSON.stringify(sessionData));
      }

      return {
        isValid: data.is_valid,
        needsActivation: data.needs_activation,
        message: data.message,
        daysRemaining: Math.max(0, Math.ceil(daysRemaining)),
        hoursRemaining: Math.max(0, Math.ceil(hoursRemaining)),
        session: data.session
      };
    } catch (error) {
      console.error('خطأ في checkTrialStatus:', error);
      return this.checkLocalTrialStatus();
    }
  }

  /**
   * التحقق من التجربة باستخدام البيانات المحلية (fallback)
   */
  private checkLocalTrialStatus(): TrialStatus {
    try {
      const stored = localStorage.getItem(this.localStorageKey);
      if (!stored) {
        return {
          isValid: false,
          needsActivation: true,
          message: 'لم يتم بدء التجربة المجانية بعد',
          daysRemaining: 0,
          hoursRemaining: 0,
          session: null
        };
      }

      const { session } = JSON.parse(stored);
      const now = new Date();
      const expiresAt = new Date(session.trial_expires_at);
      const diffMs = expiresAt.getTime() - now.getTime();
      const daysRemaining = diffMs / (1000 * 60 * 60 * 24);
      const hoursRemaining = diffMs / (1000 * 60 * 60);

      if (daysRemaining <= 0) {
        return {
          isValid: false,
          needsActivation: false,
          message: 'انتهت فترة التجربة المجانية',
          daysRemaining: 0,
          hoursRemaining: 0,
          session
        };
      }

      return {
        isValid: true,
        needsActivation: false,
        message: 'التجربة المجانية نشطة (وضع غير متصل)',
        daysRemaining: Math.max(0, Math.ceil(daysRemaining)),
        hoursRemaining: Math.max(0, Math.ceil(hoursRemaining)),
        session
      };
    } catch (error) {
      return {
        isValid: false,
        needsActivation: true,
        message: 'خطأ في التحقق من التجربة',
        daysRemaining: 0,
        hoursRemaining: 0,
        session: null
      };
    }
  }

  /**
   * تسجيل إجراء مستخدم للإحصائيات
   */
  async logAction(
    sessionType: 'trial' | 'paid' | 'developer',
    actionType: string,
    actionDetails: any = {}
  ): Promise<void> {
    try {
      const deviceFP = await this.getDeviceFingerprint();

      await supabase.rpc('log_user_action', {
        p_device_fingerprint: deviceFP,
        p_session_type: sessionType,
        p_action_type: actionType,
        p_action_details: actionDetails,
        p_user_agent: navigator.userAgent
      });
    } catch (error) {
      console.warn('فشل تسجيل الإجراء:', error);
    }
  }

  /**
   * تحديث حالة الجلسة (زيادة العداد)
   */
  async updateSessionActivity(): Promise<void> {
    try {
      const deviceFP = await this.getDeviceFingerprint();

      await supabase
        .from('trial_sessions')
        .update({
          session_count: supabase.rpc('session_count + 1'),
          last_activity: new Date().toISOString()
        })
        .eq('device_fingerprint', deviceFP);
    } catch (error) {
      console.warn('فشل تحديث نشاط الجلسة:', error);
    }
  }

  /**
   * تحويل التجربة لاشتراك مدفوع
   */
  async markAsConverted(): Promise<boolean> {
    try {
      const deviceFP = await this.getDeviceFingerprint();

      const { data, error } = await supabase.rpc('mark_trial_as_converted', {
        p_device_fingerprint: deviceFP
      });

      if (error) {
        console.error('خطأ في تحديث حالة التحويل:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('خطأ في markAsConverted:', error);
      return false;
    }
  }

  /**
   * مسح بيانات التجربة المحلية (للاختبار فقط)
   */
  clearLocalTrialData(): void {
    localStorage.removeItem(this.localStorageKey);
    localStorage.removeItem(this.fingerprintKey);
    this.deviceFingerprint = null;
  }
}

export const trialManager = new TrialManager();
