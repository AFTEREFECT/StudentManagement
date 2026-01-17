/**
 * خدمة إرسال رسائل WhatsApp
 * تدعم Green API و CallMeBot/WhapiPlus وahw
 */

import { dbManager } from './database';
import { supabase } from './supabase';

interface WhatsAppMessage {
  phone: string;
  message: string;
  sessionId?: string;
}

interface GreenAPIResponse {
  idMessage?: string;
  error?: string;
}

interfaceahwResponse {
  id?: string;
  status?: string;
  error?: string;
  message?: string;
}

interfaceahwServer {
  id: string;
  name: string;
  server_url: string;
  api_key?: string;
  provider: string;
  is_active: boolean;
  is_default: boolean;
}

interfaceahwSession {
  id: string;
  server_id: string;
  session_name: string;
  phone_number?: string;
  status: string;
  qr_code?: string;
  last_activity: string;
}

/**
 * إرسال رسالة WhatsApp باستخدام الخدمة المحددة في الإعدادات
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  try {
    await dbManager.initialize();
    const settings = await dbManager.getWhatsAppSettings();

    if (!settings || !settings.isActive) {
      return {
        success: false,
        message: 'إعدادات WhatsApp غير مفعلة'
      };
    }

    if (settings.wahaEnabled) {
      return await sendViaWAHA(phone, message, settings.wahaSessionId);
    } else if (settings.greenApiEnabled) {
      return await sendViaGreenAPI(phone, message, settings);
    } else {
      return await sendViaCallMeBot(phone, message, settings);
    }
  } catch (error) {
    console.error('خطأ في إرسال رسالة WhatsApp:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'خطأ غير معروف'
    };
  }
}

/**
 * إرسال رسالة عبر Green API
 */
async function sendViaGreenAPI(
  phone: string,
  message: string,
  settings: any
): Promise<{ success: boolean; message: string }> {
  try {
    if (!settings.greenApiInstance || !settings.greenApiToken) {
      return {
        success: false,
        message: 'بيانات Green API غير مكتملة'
      };
    }

    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

    const url = `https://7103.api.green-api.com/waInstance${settings.greenApiInstance}/sendMessage/${settings.greenApiToken}`;

    console.log('🚀 إرسال رسالة عبر Green API...');
    console.log('📞 الرقم:', chatId);
    console.log('🔑 Instance:', settings.greenApiInstance);

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

    const result: GreenAPIResponse = await response.json();

    if (response.ok && result.idMessage) {
      console.log('✅ تم الإرسال بنجاح عبر Green API');
      return {
        success: true,
        message: 'تم إرسال الرسالة بنجاح عبر Green API'
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
async function sendViaCallMeBot(
  phone: string,
  message: string,
  settings: any
): Promise<{ success: boolean; message: string }> {
  try {
    if (!settings.instanceId || !settings.apiKey) {
      return {
        success: false,
        message: 'بيانات API غير مكتملة'
      };
    }

    const url = `https://whapiplus.com/my.whapiplus.com/api/send?` +
      `number=${encodeURIComponent(phone)}` +
      `&type=text` +
      `&message=${encodeURIComponent(message)}` +
      `&instance_id=${encodeURIComponent(settings.instanceId)}` +
      `&access_token=${encodeURIComponent(settings.apiKey)}`;

    console.log('🚀 إرسال رسالة عبر CallMeBot/WhapiPlus...');
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
        message: 'تم إرسال الرسالة بنجاح'
      };
    } else {
      throw new Error(result.message || 'فشل الإرسال');
    }
  } catch (error) {
    console.error('❌ خطأ في إرسال رسالة عبر CallMeBot:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'خطأ في الإرسال'
    };
  }
}

/**
 * تطبيع URL الخادم
 */
function normalizeServerUrl(url: string): string {
  url = url.trim();

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }

  return url.replace(/\/+$/, '');
}

/**
 * إرسال رسالة عبرahw
 */
async function sendViaWAHA(
  phone: string,
  message: string,
  sessionId?: string
): Promise<{ success: boolean; message: string; messageId?: string }> {
  try {
    let session:ahwSession | null = null;
    let server:ahwServer | null = null;

    if (sessionId) {
      const { data: sessionData } = await supabase
        .from('waha_sessions')
        .select('*,ahw_servers(*)')
        .eq('id', sessionId)
        .eq('status', 'connected')
        .maybeSingle();

      if (sessionData) {
        session = sessionData as any;
        server = (sessionData as any).waha_servers;
      }
    }

    if (!session || !server) {
      const { data: defaultServer } = await supabase
        .from('waha_servers')
        .select('*')
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle();

      if (!defaultServer) {
        return {
          success: false,
          message: 'لا يوجد خادمahw نشط'
        };
      }

      server = defaultServer;

      const { data: activeSession } = await supabase
        .from('waha_sessions')
        .select('*')
        .eq('server_id', server.id)
        .eq('status', 'connected')
        .maybeSingle();

      if (!activeSession) {
        return {
          success: false,
          message: 'لا توجد جلسة نشطة على الخادم'
        };
      }

      session = activeSession;
    }

    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

    console.log('🚀 إرسال رسالة عبرahw...');
    console.log('📞 الرقم:', chatId);
    console.log('🔑 Session:', session.session_name);
    console.log('🌐 Server:', server.server_url);

    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
    const proxyUrl = `${supabaseUrl}/functions/v1/waha-proxy?path=${encodeURIComponent('/api/sendText')}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-WAHA-Server': server.server_url
    };

    if (server.api_key) {
      headers['X-WAHA-API-Key'] = server.api_key;
    }

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: session.session_name,
        chatId: chatId,
        text: message
      })
    });

    const result:ahwResponse = await response.json();

    if (response.ok && result.id) {
      await supabase.from('waha_message_logs').insert({
        server_id: server.id,
        session_id: session.id,
        phone_number: phone,
        message: message,
        status: 'success',
        message_id: result.id
      });

      await supabase
        .from('waha_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', session.id);

      console.log('✅ تم الإرسال بنجاح عبرahw');
      return {
        success: true,
        message: 'تم إرسال الرسالة بنجاح عبرahw',
        messageId: result.id
      };
    } else {
      await supabase.from('waha_message_logs').insert({
        server_id: server.id,
        session_id: session.id,
        phone_number: phone,
        message: message,
        status: 'failed',
        error_message: result.error || result.message || 'فشل الإرسال'
      });

      throw new Error(result.error || result.message || 'فشل الإرسال عبرahw');
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
 * إرسال رسائل متعددة دفعة واحدة
 */
export async function sendBulkWhatsAppMessages(
  messages: WhatsAppMessage[]
): Promise<{ success: number; failed: number; total: number }> {
  let success = 0;
  let failed = 0;

  for (const msg of messages) {
    const result = await sendWhatsAppMessage(msg.phone, msg.message);
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    success,
    failed,
    total: messages.length
  };
}
