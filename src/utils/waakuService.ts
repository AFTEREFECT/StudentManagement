import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY يجب ضبطهما في env.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Institution {
  id: string;
  name: string;
  greza: string;
}

export interface WaakuSessionStatus {
  status: 'CONNECTED' | 'SCANNING' | 'DISCONNECTED';
  sessionId?: string | null;
  qrCode?: string | null;
  phoneNumber?: string | null;
  source?: string;
}

const invokeFunction = async (name: string, body: any) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Function ${name} failed: ${res.status} ${text}`);
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
};

export const waakuService = {
  async getInstitutionByGreza(greza: string): Promise<Institution | null> {
    try {
      const clean = greza.trim().toUpperCase();
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name, greza')
        .eq('greza', clean)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching institution:', error);
        return null;
      }

      return data as Institution | null;
    } catch (error) {
      console.error('Error fetching institution:', error);
      return null;
    }
  },

  async ensureInstitutionByGreza(greza: string): Promise<Institution> {
    const clean = greza.trim().toUpperCase();

    const existing = await this.getInstitutionByGreza(clean);
    if (existing) return existing;

    const { data, error } = await supabase
      .from('institutions')
      .insert({
        greza: clean,
        name: `مؤسسة ${clean}`,
      })
      .select('id, name, greza')
      .single();

    if (error || !data) {
      console.error('Error creating institution:', error);
      throw new Error('فشل إنشاء المؤسسة الجديدة في قاعدة البيانات.');
    }

    return data as Institution;
  },

  async getDefaultInstitution(): Promise<Institution | null> {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name, greza')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching default institution:', error);
        return null;
      }

      return data as Institution | null;
    } catch (error) {
      console.error('Error fetching default institution:', error);
      return null;
    }
  },

  async checkStatus(institutionId: string): Promise<WaakuSessionStatus> {
    try {
      console.log('🔍 [checkStatus] Starting check for institution:', institutionId);
      
      const data = await invokeFunction('waaku-check-status', { id: institutionId });
      
      console.log('📊 [checkStatus] Response from server:', data);
      
      if (!data) {
        console.error('❌ [checkStatus] No data received');
        return { status: 'DISCONNECTED', sessionId: null };
      }
      
      const result = {
        status: data?.status ?? 'DISCONNECTED',
        sessionId: data?.sessionId ?? null,
        phoneNumber: data?.phoneNumber ?? null,
        qrCode: data?.qrCode ?? null,
        source: data?.source ?? 'unknown'
      };
      
      console.log('✅ [checkStatus] Final result:', result);
      
      return result;
    } catch (error) {
      console.error('❌ [checkStatus] Error:', error);
      return { status: 'DISCONNECTED', sessionId: null };
    }
  },

  async startSession(institutionId: string): Promise<{ 
    success: boolean; 
    sessionId?: string; 
    status?: string;
    phoneNumber?: string;
    error?: string;
  }> {
    try {
      const data = await invokeFunction('waaku-session-start', { id: institutionId });
      return { 
        success: true, 
        sessionId: data?.sessionId,
        status: data?.status,
        phoneNumber: data?.phoneNumber
      };
    } catch (error: any) {
      console.error('Start session error:', error);
      return { success: false, error: error?.message ?? 'startSession failed' };
    }
  },

  async getQrCode(sessionId: string): Promise<{ qr: string | null; error?: string; notFound?: boolean }> {
    try {
      console.log('🔍 [getQrCode] Fetching QR for session:', sessionId);
      
      const data = await invokeFunction('waaku-get-qr', { sessionId });
      
      if (data?.qr) {
        console.log('✅ [getQrCode] QR received');
        return { qr: data.qr };
      } else {
        console.log('⚠️ [getQrCode] No QR in response - session may be connected');
        return { qr: null, error: 'Session connected' };
      }
    } catch (error: any) {
      console.error('❌ [getQrCode] Error:', error);
      
      // إذا كان الخطأ 404، معناها الجلسة لا توجد أصلاً
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.log('❌ [getQrCode] 404 = Session does NOT exist on server');
        return { qr: null, error: 'Session not found', notFound: true };
      }
      
      return { qr: null, error: error.message };
    }
  },

  async stopSession(institutionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await invokeFunction('waaku-session-stop', { id: institutionId });
      return { success: true };
    } catch (error: any) {
      console.error('Stop session error:', error);
      return { success: false, error: error?.message ?? 'stopSession failed' };
    }
  },

  async sendMessage(
    institutionId: string,
    to: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const data = await invokeFunction('waaku-send-message', {
        id: institutionId,
        to,
        message,
      });
      return {
        success: data?.success ?? false,
        message: data?.message ?? (data?.success ? 'تم الإرسال' : 'فشل الإرسال'),
      };
    } catch (error: any) {
      console.error('Send message error:', error);
      return { success: false, message: error?.message ?? 'sendMessage failed' };
    }
  },
};
