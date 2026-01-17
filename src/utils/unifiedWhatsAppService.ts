/**
 * خدمة موحدة لإرسال رسائل WhatsApp
 * تدعم Waaku وahw و Evolution API و Green API و CallMeBot
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ServiceType = 'waaku' | 'waha' | 'evolution' | 'green_api' | 'callmebot';

export interface WhatsAppSettings {
  id: string;
  service_type: ServiceType;
  is_active: boolean;

  //ahw settings
 ahw_server_url?: string;
 ahw_api_key?: string;
 ahw_session_name?: string;

  // Evolution API settings
  evolution_api_url?: string;
  evolution_instance_name?: string;
  evolution_api_key?: string;

  // Green API settings
  green_api_instance?: string;
  green_api_token?: string;

  // CallMeBot settings
  instance_id?: string;
  access_token?: string;
}

export interface SendMessageResult {
  success: boolean;
  message: string;
  messageId?: string;
  details?: any;
}

class UnifiedWhatsAppService {
  /**
   * تنسيق رقم الهاتف
   */
  private formatPhoneNumber(phone: string, format: 'whatsapp' | 'international' = 'whatsapp'): string {
    // إزالة كل الأحرف غير الرقمية
    let cleanPhone = phone.replace(/\D/g, '');

    // إزالة الصفر من البداية إذا كان موجوداً
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }

    // إضافة رمز الدولة إذا لم يكن موجوداً (المغرب: 212)
    if (!cleanPhone.startsWith('212')) {
      cleanPhone = '212' + cleanPhone;
    }

    // إرجاع التنسيق المطلوب
    if (format === 'whatsapp') {
      return cleanPhone + '@c.us';
    } else {
      return cleanPhone;
    }
  }

  /**
   * جلب الإعدادات من قاعدة البيانات
   */
  async getSettings(): Promise<WhatsAppSettings | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('خطأ في جلب إعدادات WhatsApp:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('خطأ في جلب الإعدادات:', error);
      return null;
    }
  }

  /**
   * إرسال رسالة WhatsApp (نقطة دخول رئيسية)
   */
  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    try {
      const settings = await this.getSettings();

      if (!settings) {
        // إذا لم توجد إعدادات، استخدم Waaku كـ fallback
        console.log('⚠️ لا توجد إعدادات WhatsApp. استخدام Waaku كخيار افتراضي...');
        return await this.sendViaWaaku(phone, message);
      }

      console.log('📱 إرسال رسالة WhatsApp...');
      console.log('🔧 نوع الخدمة:', settings.service_type);
      console.log('📞 الرقم:', phone);

      // توجيه الطلب حسب نوع الخدمة
      switch (settings.service_type) {
        case 'waaku':
          return await this.sendViaWaaku(phone, message);
        case 'waha':
          return await this.sendViaWAHA(phone, message, settings);
        case 'evolution':
          return await this.sendViaEvolution(phone, message, settings);
        case 'green_api':
          return await this.sendViaGreenAPI(phone, message, settings);
        case 'callmebot':
          return await this.sendViaCallMeBot(phone, message, settings);
        default:
          return {
            success: false,
            message: `نوع خدمة غير مدعوم: ${settings.service_type}`
          };
      }
    } catch (error) {
      console.error('❌ خطأ في إرسال رسالة WhatsApp:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  /**
   * إرسال رسالة عبر Waaku (الخيار الموصى به)
   */
  private async sendViaWaaku(
    phone: string,
    message: string
  ): Promise<SendMessageResult> {
    try {
      console.log('📤 [Waaku] Sending message to:', phone);
      
      // 1️⃣ الحصول على institutionId من localStorage
      const institutionId = localStorage.getItem('institutionId');
      
      if (!institutionId) {
        console.error('❌ [Waaku] No institutionId found in localStorage');
        return {
          success: false,
          message: 'لم يتم العثور على معرف المؤسسة. يرجى الذهاب إلى صفحة ربط WhatsApp أولاً.',
        };
      }

      console.log('🔑 [Waaku] Using institutionId:', institutionId);

      // 2️⃣ التحقق من أن الجلسة متصلة
      const { data: inst } = await supabase
        .from('institutions')
        .select('whatsapp_session_status, whatsapp_session_id')
        .eq('id', institutionId)
        .single();

      if (!inst || inst.whatsapp_session_status !== 'CONNECTED') {
        console.error('❌ [Waaku] Session not connected:', inst?.whatsapp_session_status);
        return {
          success: false,
          message: 'جلسة WhatsApp غير متصلة. يرجى الذهاب إلى صفحة ربط WhatsApp وإنشاء جلسة جديدة.'
        };
      }

      if (!inst.whatsapp_session_id) {
        console.error('❌ [Waaku] No sessionId in DB');
        return {
          success: false,
          message: 'لا يوجد معرف جلسة. يرجى إعادة إنشاء الجلسة.'
        };
      }

      console.log('✅ [Waaku] Session is CONNECTED. SessionId:', inst.whatsapp_session_id);

      // 3️⃣ تنظيف رقم الهاتف
      let cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
      
      if (!cleanPhone.startsWith('+')) {
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '+212' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('212')) {
          cleanPhone = '+212' + cleanPhone;
        } else {
          cleanPhone = '+' + cleanPhone;
        }
      }

      console.log('📞 [Waaku] Clean phone:', cleanPhone);

      // 4️⃣ استدعاء waaku-send-message Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/waaku-send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          id: institutionId,
          to: cleanPhone,
          message: message,
        }),
      });

      console.log('📊 [Waaku] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('❌ [Waaku] Error response:', errorText);
        
        let errorMessage = 'فشل إرسال الرسالة';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        return {
          success: false,
          message: errorMessage,
          details: { error: errorText, status: response.status }
        };
      }

      const result = await response.json();
      console.log('✅ [Waaku] Success:', result);

      return {
        success: true,
        message: result.message || 'تم إرسال الرسالة بنجاح عبر Waaku',
        messageId: result.messageId || result.id,
        details: result
      };

    } catch (error) {
      console.error('❌ خطأ في إرسال رسالة عبر Waaku:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في Waaku'
      };
    }
  }

  /**
   * إرسال رسالة عبرahw
   */
  private async sendViaWAHA(
    phone: string,
    message: string,
    settings: WhatsAppSettings
  ): Promise<SendMessageResult> {
    try {
      if (!settings.waha_server_url || !settings.waha_session_name) {
        return {
          success: false,
          message: 'إعدادات wh غير مكتملة'
        };
      }

      const chatId = this.formatPhoneNumber(phone, 'whatsapp');
      const sessionName = settings.waha_session_name || 'default';

      // تطبيع URL الخادم
      let serverUrl = settings.waha_server_url.trim();
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = 'https://' + serverUrl;
      }
      serverUrl = serverUrl.replace(/\/+$/, '');

      const url = `${serverUrl}/api/${sessionName}/send-message`;

      console.log('🚀 إرسال عبرahw...');
      console.log('🔗 URL:', url);
      console.log('📞 ChatId:', chatId);
      console.log('🔑 Session:', sessionName);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (settings.waha_api_key) {
        headers['apikey'] = settings.waha_api_key;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId: chatId,
          text: message
        })
      });

      console.log('📊 Response Status:', response.status);

      const responseText = await response.text();
      console.log('📄 Response Body:', responseText);

      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { raw: responseText };
      }

      if (response.ok && (result.id || result.messageId)) {
        console.log('✅ تم الإرسال بنجاح عبرahw');
        return {
          success: true,
          message: 'تم إرسال الرسالة بنجاح عبرahw',
          messageId: result.id || result.messageId,
          details: result
        };
      } else {
        const errorMessage = result.error || result.message || result.raw || 'فشل الإرسال';
        console.error('❌ فشل الإرسال عبرahw:', errorMessage);
        return {
          success: false,
          message: errorMessage,
          details: result
        };
      }
    } catch (error) {
      console.error('❌ خطأ في إرسال رسالة عبرahw:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ فيahw'
      };
    }
  }

  /**
   * إرسال رسالة عبر Evolution API
   */
  private async sendViaEvolution(
    phone: string,
    message: string,
    settings: WhatsAppSettings
  ): Promise<SendMessageResult> {
    try {
      if (!settings.evolution_api_url || !settings.evolution_instance_name || !settings.evolution_api_key) {
        return {
          success: false,
          message: 'إعدادات Evolution API غير مكتملة'
        };
      }

      const formattedPhone = this.formatPhoneNumber(phone, 'international') + '@s.whatsapp.net';

      // تطبيع URL الخادم
      let serverUrl = settings.evolution_api_url.trim();
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = 'https://' + serverUrl;
      }
      serverUrl = serverUrl.replace(/\/+$/, '');

      const url = `${serverUrl}/message/sendText/${settings.evolution_instance_name}`;

      console.log('🚀 إرسال عبر Evolution API...');
      console.log('🔗 URL:', url);
      console.log('📞 Number:', formattedPhone);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.evolution_api_key
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message
        })
      });

      console.log('📊 Response Status:', response.status);

      const responseText = await response.text();
      console.log('📄 Response Body:', responseText);

      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { raw: responseText };
      }

      if (response.status === 201 || response.status === 200) {
        console.log('✅ تم الإرسال بنجاح عبر Evolution API');
        return {
          success: true,
          message: 'تم إرسال الرسالة بنجاح عبر Evolution API',
          messageId: result.key?.id || result.messageId || result.id,
          details: result
        };
      } else {
        const errorMessage = result.message || result.error || result.raw || 'فشل الإرسال';
        console.error('❌ فشل الإرسال عبر Evolution API:', errorMessage);
        return {
          success: false,
          message: errorMessage,
          details: result
        };
      }
    } catch (error) {
      console.error('❌ خطأ في إرسال رسالة عبر Evolution API:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في Evolution API'
      };
    }
  }

  /**
   * إرسال رسالة عبر Green API
   */
  private async sendViaGreenAPI(
    phone: string,
    message: string,
    settings: WhatsAppSettings
  ): Promise<SendMessageResult> {
    try {
      if (!settings.green_api_instance || !settings.green_api_token) {
        return {
          success: false,
          message: 'إعدادات Green API غير مكتملة'
        };
      }

      const chatId = this.formatPhoneNumber(phone, 'whatsapp');
      const url = `https://7103.api.green-api.com/waInstance${settings.green_api_instance}/sendMessage/${settings.green_api_token}`;

      console.log('🚀 إرسال عبر Green API...');
      console.log('📞 ChatId:', chatId);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message
        })
      });

      const result = await response.json();

      if (response.ok && result.idMessage) {
        console.log('✅ تم الإرسال بنجاح عبر Green API');
        return {
          success: true,
          message: 'تم إرسال الرسالة بنجاح عبر Green API',
          messageId: result.idMessage,
          details: result
        };
      } else {
        throw new Error(result.error || 'فشل الإرسال عبر Green API');
      }
    } catch (error) {
      console.error('❌ خطأ في إرسال رسالة عبر Green API:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في Green API'
      };
    }
  }

  /**
   * إرسال رسالة عبر CallMeBot/WhapiPlus
   */
  private async sendViaCallMeBot(
    phone: string,
    message: string,
    settings: WhatsAppSettings
  ): Promise<SendMessageResult> {
    try {
      if (!settings.instance_id || !settings.access_token) {
        return {
          success: false,
          message: 'إعدادات CallMeBot غير مكتملة'
        };
      }

      const url = `https://whapiplus.com/my.whapiplus.com/api/send?` +
        `number=${encodeURIComponent(phone)}` +
        `&type=text` +
        `&message=${encodeURIComponent(message)}` +
        `&instance_id=${encodeURIComponent(settings.instance_id)}` +
        `&access_token=${encodeURIComponent(settings.access_token)}`;

      console.log('🚀 إرسال عبر CallMeBot...');
      console.log('📞 الرقم:', phone);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && (result.sent || result.status === 'success')) {
        console.log('✅ تم الإرسال بنجاح عبر CallMeBot');
        return {
          success: true,
          message: 'تم إرسال الرسالة بنجاح عبر CallMeBot',
          details: result
        };
      } else {
        throw new Error(result.message || 'فشل الإرسال عبر CallMeBot');
      }
    } catch (error) {
      console.error('❌ خطأ في إرسال رسالة عبر CallMeBot:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في CallMeBot'
      };
    }
  }

  /**
   * إرسال رسائل متعددة دفعة واحدة
   */
  async sendBulkMessages(
    recipients: Array<{ phone: string; message: string }>,
    onProgress?: (sent: number, total: number) => void
  ): Promise<{ success: number; failed: number; total: number; results: SendMessageResult[] }> {
    const total = recipients.length;
    let success = 0;
    let failed = 0;
    const results: SendMessageResult[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const { phone, message } = recipients[i];
      const result = await this.sendMessage(phone, message);

      results.push(result);

      if (result.success) {
        success++;
      } else {
        failed++;
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }

      // انتظار 1.5 ثانية بين كل رسالة لتجنب الحظر
      if (i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return { success, failed, total, results };
  }

  /**
   * اختبار الاتصال بالخدمة
   */
  async testConnection(): Promise<SendMessageResult> {
    const settings = await this.getSettings();

    if (!settings) {
      // إذا لم توجد إعدادات، اختبر Waaku
      console.log('⚠️ لا توجد إعدادات WhatsApp. اختبار Waaku...');
      return await this.testWaakuConnection();
    }

    console.log('🔍 اختبار الاتصال بخدمة:', settings.service_type);

    // اختبار حسب نوع الخدمة
    switch (settings.service_type) {
      case 'waaku':
        return await this.testWaakuConnection();
      case 'waha':
        return await this.testWAHAConnection(settings);
      case 'evolution':
        return await this.testEvolutionConnection(settings);
      case 'green_api':
        return await this.testGreenAPIConnection(settings);
      case 'callmebot':
        return {
          success: true,
          message: 'CallMeBot لا يحتوي على endpoint للاختبار. استخدم إرسال رسالة تجريبية.'
        };
      default:
        return {
          success: false,
          message: `نوع خدمة غير مدعوم: ${settings.service_type}`
        };
    }
  }

  /**
   * اختبار اتصال Waaku
   */
  private async testWaakuConnection(): Promise<SendMessageResult> {
    try {
      const institutionId = localStorage.getItem('institutionId');
      
      if (!institutionId) {
        return {
          success: false,
          message: 'لم يتم العثور على معرف المؤسسة في localStorage. يرجى الذهاب إلى صفحة ربط WhatsApp.'
        };
      }

      // التحقق من الحالة من DB مباشرة
      const { data: inst } = await supabase
        .from('institutions')
        .select('whatsapp_session_status, whatsapp_phone_number, whatsapp_session_id')
        .eq('id', institutionId)
        .single();

      if (!inst) {
        return {
          success: false,
          message: 'لم يتم العثور على المؤسسة في قاعدة البيانات'
        };
      }

      if (inst.whatsapp_session_status === 'CONNECTED') {
        return {
          success: true,
          message: `الاتصال ناجح. رقم الهاتف: ${inst.whatsapp_phone_number || 'غير معروف'}`,
          details: {
            status: inst.whatsapp_session_status,
            phoneNumber: inst.whatsapp_phone_number,
            sessionId: inst.whatsapp_session_id
          }
        };
      } else if (inst.whatsapp_session_status === 'SCANNING') {
        return {
          success: false,
          message: 'الجلسة في انتظار المسح. يرجى مسح رمز QR من صفحة الربط.'
        };
      } else {
        return {
          success: false,
          message: 'لا توجد جلسة نشطة. يرجى إنشاء جلسة من صفحة الربط.'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال'
      };
    }
  }

  /**
   * اختبار اتصالahw
   */
  private async testWAHAConnection(settings: WhatsAppSettings): Promise<SendMessageResult> {
    try {
      if (!settings.waha_server_url || !settings.waha_session_name) {
        return {
          success: false,
          message: 'إعداداتahw غير مكتملة'
        };
      }

      let serverUrl = settings.waha_server_url.trim();
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = 'https://' + serverUrl;
      }
      serverUrl = serverUrl.replace(/\/+$/, '');

      const url = `${serverUrl}/api/${settings.waha_session_name}/status`;

      const headers: Record<string, string> = {};
      if (settings.waha_api_key) {
        headers['apikey'] = settings.waha_api_key;
      }

      const response = await fetch(url, { method: 'GET', headers });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          message: `الاتصال ناجح. حالة الجلسة: ${result.status || 'connected'}`,
          details: result
        };
      } else {
        return {
          success: false,
          message: `فشل الاتصال: ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال'
      };
    }
  }

  /**
   * اختبار اتصال Evolution API
   */
  private async testEvolutionConnection(settings: WhatsAppSettings): Promise<SendMessageResult> {
    try {
      if (!settings.evolution_api_url || !settings.evolution_instance_name || !settings.evolution_api_key) {
        return {
          success: false,
          message: 'إعدادات Evolution API غير مكتملة'
        };
      }

      let serverUrl = settings.evolution_api_url.trim();
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = 'https://' + serverUrl;
      }
      serverUrl = serverUrl.replace(/\/+$/, '');

      const url = `${serverUrl}/instance/connectionState/${settings.evolution_instance_name}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': settings.evolution_api_key
        }
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          message: `الاتصال ناجح. حالة الاتصال: ${result.state || 'متصل'}`,
          details: result
        };
      } else {
        return {
          success: false,
          message: `فشل الاتصال: ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال'
      };
    }
  }

  /**
   * اختبار اتصال Green API
   */
  private async testGreenAPIConnection(settings: WhatsAppSettings): Promise<SendMessageResult> {
    try {
      if (!settings.green_api_instance || !settings.green_api_token) {
        return {
          success: false,
          message: 'إعدادات Green API غير مكتملة'
        };
      }

      const url = `https://7103.api.green-api.com/waInstance${settings.green_api_instance}/getStateInstance/${settings.green_api_token}`;

      const response = await fetch(url, { method: 'GET' });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          message: `الاتصال ناجح. حالة المثيل: ${result.stateInstance || 'authorized'}`,
          details: result
        };
      } else {
        return {
          success: false,
          message: `فشل الاتصال: ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال'
      };
    }
  }
}

export const unifiedWhatsAppService = new UnifiedWhatsAppService();
