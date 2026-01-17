import { dbManager } from './database';

export interface EvolutionWhatsAppSettings {
  evolutionApiUrl: string;
  evolutionInstanceName: string;
  evolutionApiKey: string;
  isActive: boolean;
}

export interface SendMessageResult {
  success: boolean;
  message: string;
  messageId?: string;
  details?: any;
}

class EvolutionWhatsAppService {
  private formatPhoneNumber(phone: string): string {
    let cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }

    if (!cleanPhone.startsWith('212')) {
      cleanPhone = '212' + cleanPhone;
    }

    return cleanPhone + '@s.whatsapp.net';
  }

  async getSettings(): Promise<EvolutionWhatsAppSettings | null> {
    try {
      const settings = await dbManager.getWhatsAppSettings();
      return settings;
    } catch (error) {
      console.error('خطأ في تحميل إعدادات Evolution:', error);
      return null;
    }
  }

  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    try {
      const settings = await this.getSettings();

      if (!settings) {
        return {
          success: false,
          message: 'لم يتم العثور على إعدادات WhatsApp'
        };
      }

      if (!settings.isActive) {
        return {
          success: false,
          message: 'خدمة WhatsApp غير مفعلة'
        };
      }

      if (!settings.evolutionApiUrl || !settings.evolutionInstanceName || !settings.evolutionApiKey) {
        return {
          success: false,
          message: 'بيانات الاتصال غير مكتملة. الرجاء التحقق من الإعدادات'
        };
      }

      const formattedPhone = this.formatPhoneNumber(phone);
      const url = `${settings.evolutionApiUrl}/message/sendText/${settings.evolutionInstanceName}`;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 إرسال رسالة عبر Evolution API');
      console.log('📞 الرقم الأصلي:', phone);
      console.log('📞 الرقم المنسق:', formattedPhone);
      console.log('🔗 URL:', url);
      console.log('🔑 API Key:', settings.evolutionApiKey.substring(0, 10) + '...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const payload = {
        number: formattedPhone,
        text: message
      };

      console.log('📦 Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.evolutionApiKey
        },
        body: JSON.stringify(payload)
      });

      console.log('📊 Response Status:', response.status);
      console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('📄 Response Body (raw):', responseText);

      let result: any;
      try {
        result = JSON.parse(responseText);
        console.log('✅ Response Body (parsed):', result);
      } catch (e) {
        console.error('❌ فشل تحليل JSON:', e);
        result = { raw: responseText };
      }

      if (response.status === 201 || response.status === 200) {
        console.log('✅ تم الإرسال بنجاح!');

        return {
          success: true,
          message: 'تم إرسال الرسالة بنجاح',
          messageId: result.key?.id || result.messageId || result.id,
          details: result
        };
      } else {
        const errorMessage = result.message || result.error || result.raw || 'فشل إرسال الرسالة';
        console.error('❌ فشل الإرسال:', errorMessage);

        return {
          success: false,
          message: errorMessage,
          details: result
        };
      }
    } catch (error) {
      console.error('❌❌❌ خطأ في إرسال الرسالة:', error);
      console.error('نوع الخطأ:', error instanceof TypeError ? 'TypeError' : typeof error);
      console.error('تفاصيل الخطأ:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ غير معروف',
        details: { error: String(error) }
      };
    }
  }

  async sendBulkMessages(
    recipients: Array<{ phone: string; message: string }>,
    onProgress?: (sent: number, total: number) => void
  ): Promise<{ success: number; failed: number; total: number }> {
    const total = recipients.length;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const { phone, message } = recipients[i];
      const result = await this.sendMessage(phone, message);

      if (result.success) {
        success++;
      } else {
        failed++;
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return { success, failed, total };
  }

  async testConnection(): Promise<SendMessageResult> {
    const settings = await this.getSettings();

    if (!settings) {
      return {
        success: false,
        message: 'لم يتم العثور على إعدادات WhatsApp'
      };
    }

    if (!settings.evolutionApiUrl || !settings.evolutionInstanceName || !settings.evolutionApiKey) {
      return {
        success: false,
        message: 'بيانات الاتصال غير مكتملة'
      };
    }

    try {
      const url = `${settings.evolutionApiUrl}/instance/connectionState/${settings.evolutionInstanceName}`;

      console.log('🔍 اختبار الاتصال...');
      console.log('🔗 URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': settings.evolutionApiKey
        }
      });

      console.log('📊 Response Status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ نتيجة الاختبار:', result);

        return {
          success: true,
          message: `الاتصال ناجح. حالة الاتصال: ${result.state || 'متصل'}`,
          details: result
        };
      } else {
        const errorText = await response.text();
        console.error('❌ فشل الاختبار:', errorText);

        return {
          success: false,
          message: 'فشل الاتصال بالخادم: ' + response.status
        };
      }
    } catch (error) {
      console.error('❌ خطأ في اختبار الاتصال:', error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'خطأ في الاتصال'
      };
    }
  }
}

export const evolutionWhatsAppService = new EvolutionWhatsAppService();
