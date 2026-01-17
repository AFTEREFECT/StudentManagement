/**
 *ahw Management Service
 * إدارة خوادمahw والجلسات
 */

import { supabase } from './supabase';

export interfaceahwServer {
  id: string;
  name: string;
  server_url: string;
  api_key?: string;
  provider: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interfaceahwSession {
  id: string;
  server_id: string;
  session_name: string;
  phone_number?: string;
  status: 'connected' | 'disconnected' | 'qr_needed';
  qr_code?: string;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

export interfaceahwMessageLog {
  id: string;
  server_id: string;
  session_id?: string;
  phone_number: string;
  message: string;
  status: 'success' | 'failed' | 'pending';
  error_message?: string;
  message_id?: string;
  created_at: string;
}

export classahwService {
  private useProxy = true;

  private getProxyUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/waha-proxy`;
  }

  private getProxyHeaders(serverUrl: string, apiKey?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-WAHA-Server': serverUrl
    };

    if (apiKey) {
      headers['X-WAHA-API-Key'] = apiKey;
    }

    return headers;
  }

  private normalizeServerUrl(url: string): string {
    url = url.trim();

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    return url.replace(/\/+$/, '');
  }

  private async proxyFetch(serverUrl: string, path: string, options: RequestInit & { apiKey?: string }): Promise<Response> {
    if (!this.useProxy) {
      const normalizedUrl = this.normalizeServerUrl(serverUrl);
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (options.apiKey) {
        headers['X-Api-Key'] = options.apiKey;
      }
      return fetch(`${normalizedUrl}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers }
      });
    }

    const proxyUrl = `${this.getProxyUrl()}?path=${encodeURIComponent(path)}`;
    const proxyHeaders = this.getProxyHeaders(serverUrl, options.apiKey);

    return fetch(proxyUrl, {
      ...options,
      headers: { ...proxyHeaders, ...options.headers }
    });
  }

  async getAllServers(): Promise<WAHAServer[]> {
    const { data, error } = await supabase
      .from('waha_servers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getActiveServers(): Promise<WAHAServer[]> {
    const { data, error } = await supabase
      .from('waha_servers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getServerById(id: string): Promise<WAHAServer | null> {
    const { data, error } = await supabase
      .from('waha_servers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createServer(server: Omit<WAHAServer, 'id' | 'created_at' | 'updated_at'>): Promise<WAHAServer> {
    if (server.is_default) {
      await supabase
        .from('waha_servers')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('waha_servers')
      .insert(server)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateServer(id: string, updates: Partial<WAHAServer>): Promise<WAHAServer> {
    if (updates.is_default) {
      await supabase
        .from('waha_servers')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', id);
    }

    const { data, error } = await supabase
      .from('waha_servers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteServer(id: string): Promise<void> {
    const { error } = await supabase
      .from('waha_servers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async testServerConnection(serverUrl: string, apiKey?: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await this.proxyFetch(serverUrl, '/api/sessions', {
          method: 'GET',
          apiKey,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error('فشل الاتصال بخادمahw:', error);
      return false;
    }
  }

  async getSessionsByServer(serverId: string): Promise<WAHASession[]> {
    const { data, error } = await supabase
      .from('waha_sessions')
      .select('*')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getSessionById(id: string): Promise<WAHASession | null> {
    const { data, error } = await supabase
      .from('waha_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createSession(serverId: string, sessionName: string): Promise<{ success: boolean; session?:ahwSession; error?: string }> {
    try {
      const server = await this.getServerById(serverId);
      if (!server) {
        return { success: false, error: 'الخادم غير موجود' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let response;
      try {
        response = await this.proxyFetch(server.server_url, '/api/sessions', {
          method: 'POST',
          apiKey: server.api_key,
          body: JSON.stringify({ name: sessionName }),
          signal: controller.signal
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          return { success: false, error: 'انتهت مهلة الاتصال بالخادم' };
        }
        return { success: false, error: `فشل الاتصال: ${fetchError.message}` };
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = 'فشل في إنشاء الجلسة';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch {
          errorMsg = await response.text() || errorMsg;
        }
        return { success: false, error: errorMsg };
      }

      const { data, error } = await supabase
        .from('waha_sessions')
        .insert({
          server_id: serverId,
          session_name: sessionName,
          status: 'qr_needed'
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, session: data };
    } catch (error) {
      console.error('خطأ في إنشاء الجلسة:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) {
        return { success: false, error: 'الجلسة غير موجودة' };
      }

      const server = await this.getServerById(session.server_id);
      if (!server) {
        return { success: false, error: 'الخادم غير موجود' };
      }

      await this.proxyFetch(server.server_url, `/api/sessions/${session.session_name}`, {
        method: 'DELETE',
        apiKey: server.api_key
      });

      const { error } = await supabase
        .from('waha_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('خطأ في حذف الجلسة:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  async getSessionQRCode(sessionId: string): Promise<{ qrCode?: string; error?: string }> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) {
        return { error: 'الجلسة غير موجودة' };
      }

      const server = await this.getServerById(session.server_id);
      if (!server) {
        return { error: 'الخادم غير موجود' };
      }

      const response = await this.proxyFetch(server.server_url, `/api/${session.session_name}/auth/qr`, {
        method: 'GET',
        apiKey: server.api_key
      });

      if (!response.ok) {
        return { error: 'فشل في الحصول على QR Code' };
      }

      const result = await response.json();

      if (result.qr) {
        await supabase
          .from('waha_sessions')
          .update({
            qr_code: result.qr,
            status: 'qr_needed'
          })
          .eq('id', sessionId);

        return { qrCode: result.qr };
      }

      return { error: 'QR Code غير متوفر' };
    } catch (error) {
      console.error('خطأ في الحصول على QR Code:', error);
      return {
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  async checkSessionStatus(sessionId: string): Promise<{ status?: string; phoneNumber?: string; error?: string }> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) {
        return { error: 'الجلسة غير موجودة' };
      }

      const server = await this.getServerById(session.server_id);
      if (!server) {
        return { error: 'الخادم غير موجود' };
      }

      const response = await this.proxyFetch(server.server_url, `/api/sessions/${session.session_name}`, {
        method: 'GET',
        apiKey: server.api_key
      });

      if (!response.ok) {
        return { error: 'فشل في التحقق من حالة الجلسة' };
      }

      const result = await response.json();

      const status = result.status === 'WORKING' ? 'connected' :
                    result.status === 'SCAN_QR_CODE' ? 'qr_needed' :
                    'disconnected';

      const updates: any = {
        status,
        last_activity: new Date().toISOString()
      };

      if (result.me && result.me.id) {
        updates.phone_number = result.me.id.replace('@c.us', '');
      }

      await supabase
        .from('waha_sessions')
        .update(updates)
        .eq('id', sessionId);

      return {
        status,
        phoneNumber: updates.phone_number
      };
    } catch (error) {
      console.error('خطأ في التحقق من حالة الجلسة:', error);
      return {
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  async restartSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) {
        return { success: false, error: 'الجلسة غير موجودة' };
      }

      const server = await this.getServerById(session.server_id);
      if (!server) {
        return { success: false, error: 'الخادم غير موجود' };
      }

      const response = await this.proxyFetch(server.server_url, `/api/sessions/${session.session_name}/restart`, {
        method: 'POST',
        apiKey: server.api_key
      });

      if (!response.ok) {
        return { success: false, error: 'فشل في إعادة تشغيل الجلسة' };
      }

      await supabase
        .from('waha_sessions')
        .update({
          status: 'qr_needed',
          qr_code: null
        })
        .eq('id', sessionId);

      return { success: true };
    } catch (error) {
      console.error('خطأ في إعادة تشغيل الجلسة:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      };
    }
  }

  async getMessageLogs(serverId?: string, sessionId?: string, limit = 50): Promise<WAHAMessageLog[]> {
    let query = supabase
      .from('waha_message_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (serverId) {
      query = query.eq('server_id', serverId);
    }

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getMessageStats(serverId?: string): Promise<{ total: number; success: number; failed: number }> {
    let query = supabase
      .from('waha_message_logs')
      .select('status');

    if (serverId) {
      query = query.eq('server_id', serverId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      success: data?.filter(log => log.status === 'success').length || 0,
      failed: data?.filter(log => log.status === 'failed').length || 0
    };

    return stats;
  }
}

export constahwService = newahwService();
