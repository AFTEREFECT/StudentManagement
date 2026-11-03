 import { API_BASE_URL2, normalizePhone } from "./appConfig";
import { dbManager } from "./database";
import { supabase } from "./supabase";

import { waakuService } from "../utils/waakuService";

const WAAKU_API_KEY = "my-secret-key";
const FN_CHANNELS_START = "channels-start";
const FN_CREATE_SESSION = "create-whatsapp-session";
const FN_CHECK_STATUS = "check-whatsapp-status";
const FN_GET_QR = "waaku-get-qr";
const FN_DELETE_SESSION = "waaku-session-delete";
const FN_SEND_MESSAGE = "send-whatsapp-message";
const FN_CHANNELS_DELETE = "channels-delete";
const FN_CHANNELS_HEALTH = "channels-health";
const FN_CHANNELS_CREATE = "channels-create";
const FN_CHANNELS_PUBLISH = "channels-publish";
const FN_CHANNELS_LOGOUT = "channels-logout";
const WA_TARGETS_TABLE = "wa_targets_registry";
const FN_CHANNELS_PUBLISH_MEDIA = "channels-publish-media";

async function invokeEdgeFunction(functionName: string, payload: Record<string, any>) {
  const supabaseUrl = "https://benjzaxxkcjwnrfllvel.supabase.co";
  const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(payload || {}),
  });

  const text = await res.text().catch(() => "");
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      JSON.stringify({
        functionName,
        status: res.status,
        response: data,
      })
    );
  }

  return data || {};
}

export interface Institution {
  id: string;
  name: string;
}

export interface WaakuSessionStatus {
  status: "CONNECTED" | "SCANNING" | "DISCONNECTED";
  instanceName?: string | null;
  qrCode?: string | null;
  phoneNumber?: string | null;
  source?: string;
}

export interface ChannelsLayerStatus {
  ready: boolean;
  authenticated: boolean;
  waState?: string | null;
  clientState?: string | null;
  hasQr?: boolean;
  qr?: string | null;
  lastError?: string | null;
}

export type WaTargetType = "group" | "channel";
export type WaScopeType = "section" | "level" | "institution" | "custom";

export interface WaTarget {
  id?: number;
  session_id?: number;
  institution_id?: string;
  target_type: WaTargetType;
  scope_type: WaScopeType;
  scope_value: string;
  title: string;
  target_id: string;
  invite_link?: string | null;
  is_active?: boolean;
}

export interface EnsureTargetParams {
  sessionId: string;
  targetType: WaTargetType;
  scopeType: WaScopeType;
  scopeValue: string;
  title: string;
  registry?: WaTarget[];
  participants?: string[];
}

export interface EnsureTargetsParams {
  sessionId: string;
  targetType: WaTargetType;
  scopeType: WaScopeType;
  scopeValues: string[];
  titleBuilder?: (scopeValue: string) => string;
  registry?: WaTarget[];
  participantsMap?: Record<string, string[]>;
}

export interface WaMediaPayload {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  caption?: string;
}

export interface WaSendPayload {
  message: string;
  media?: WaMediaPayload | null;
}

function normalizeStatus(value: unknown): WaakuSessionStatus["status"] {
  const s = String(value || "").toUpperCase();

  if (s === "CONNECTED" || s === "OPEN" || s === "READY") {
    return "CONNECTED";
  }

  if (
    s === "SCANNING" ||
    s === "QR" ||
    s === "PAIRING" ||
    s === "CONNECTING" ||
    s === "AUTHENTICATED" ||
    s === "QR_RECEIVED"
  ) {
    return "SCANNING";
  }

  return "DISCONNECTED";
}

function normalizeWhatsappParticipants(participants: string[] = []): string[] {
  return participants
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .map((p) => {
      if (p.endsWith("@c.us")) return p;
      const digits = p.replace(/\D/g, "");
      return digits ? `${digits}@c.us` : "";
    })
    .filter(Boolean);
}

function normalizeDirectChatId(phone: string): string {
  const p = normalizePhone(phone);
  return p.endsWith("@c.us") ? p : `${p}@c.us`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function pickSupabaseInstitutionId(...values: any[]): string {
  for (const value of values) {
    const v = String(value || "").trim();
    if (v && isUuid(v)) return v;
  }
  return "";
}

async function getInstitutionFromLocalDb(): Promise<Institution | null> {
  try {
    await dbManager.initialize();

    let settings: any = null;
    try {
      settings = await dbManager.getInstitutionSettings();
    } catch {}

    let dbInstitutionId = "";
    try {
      dbInstitutionId = String(dbManager.getSupabaseInstitutionId?.() || "").trim();
    } catch {}

    let backup: any = null;
    try {
      const rawBackup = localStorage.getItem("institution_settings_backup");
      if (rawBackup) backup = JSON.parse(rawBackup);
    } catch {}

    let legacy: any = null;
    try {
      const rawLegacy = localStorage.getItem("institutionSettings");
      if (rawLegacy) legacy = JSON.parse(rawLegacy);
    } catch {}

    const id = pickSupabaseInstitutionId(
      settings?.supabaseInstitutionId,
      settings?.supabase_institution_id,
      dbInstitutionId,
      backup?.supabaseInstitutionId,
      backup?.supabase_institution_id,
      legacy?.supabaseInstitutionId,
      legacy?.supabase_institution_id,
      "04b1dd76-b9f8-476f-99ba-afeef9fddba3"
    );

    const name = String(
      settings?.institution ||
        settings?.name ||
        backup?.institution ||
        backup?.name ||
        legacy?.institution ||
        legacy?.name ||
        "المؤسسة"
    ).trim();

    if (!id) {
      console.error("❌ لم يتم العثور على Supabase UUID صالح للمؤسسة");
      return null;
    }

    return { id, name };
  } catch (error) {
    console.error("❌ خطأ في getInstitutionFromLocalDb:", error);

    try {
      const rawBackup = localStorage.getItem("institution_settings_backup");
      if (rawBackup) {
        const backup = JSON.parse(rawBackup);

        const id = pickSupabaseInstitutionId(
          backup?.supabaseInstitutionId,
          backup?.supabase_institution_id
        );

        const name = String(backup?.institution || backup?.name || "المؤسسة").trim();

        if (id) return { id, name };
      }
    } catch {}

    return null;
  }
}

async function parseJsonSafe(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": WAAKU_API_KEY,
  };
}

function buildDefaultTitle(
  targetType: WaTargetType,
  scopeType: WaScopeType,
  scopeValue: string
) {
  const prefix = targetType === "group" ? "جروب" : "شانل";

  if (scopeType === "section") return `${prefix} القسم ${scopeValue}`;
  if (scopeType === "level") return `${prefix} المستوى ${scopeValue}`;
  if (scopeType === "institution") return `${prefix} المؤسسة`;

  return `${prefix} ${scopeValue}`;
}

function extractGroupId(data: any): string {
  return (
    data?.groupId ||
    data?.id ||
    data?.jid ||
    data?.result?.groupId ||
    data?.result?.id ||
    data?.result?.jid ||
    data?.result?.gid?._serialized ||
    data?.result?.gid ||
    data?.group?.id ||
    data?.group?.jid ||
    ""
  );
}

function extractChannelId(data: any): string {
  const value =
    data?.channelId ||
    data?.id ||
    data?.jid ||
    data?.result?.channelId ||
    data?.result?.id ||
    data?.result?.jid ||
    data?.result?.nid?._serialized ||
    data?.result?.nid?.user ||
    data?.result?.nid ||
    data?.channel?.id ||
    data?.channel?.jid ||
    "";

  return String(value || "").replace(/@newsletter$/, "").trim();
}

function extractInviteLink(data: any): string | null {
  return data?.inviteLink || data?.link || data?.result?.inviteLink || data?.result?.link || null;
}

function storageKey(institutionId: string) {
  return `wa_targets_registry:${institutionId}`;
}

function targetKey(item: Pick<WaTarget, "target_type" | "scope_type" | "scope_value">) {
  return `${item.target_type}::${item.scope_type}::${item.scope_value}`;
}

function dedupeTargets(targets: WaTarget[]): WaTarget[] {
  const map = new Map<string, WaTarget>();
  for (const item of targets) {
    map.set(targetKey(item), item);
  }
  return Array.from(map.values());
}

function normalizeTargetRecord(target: WaTarget, institutionId?: string): WaTarget {
  const inviteLink = String(target.invite_link || "").trim();

  return {
    ...target,
    institution_id: institutionId || target.institution_id || undefined,
    title: String(target.title || "").trim(),
    target_id: String(target.target_id || "").trim(),
    scope_value: String(target.scope_value || "").trim(),
    invite_link: inviteLink || null,
    is_active: target.is_active !== false,
  };
}

function serializeTargetsForDb(institutionId: string, targets: WaTarget[]) {
  return dedupeTargets(targets).map((target) => {
    const normalized = normalizeTargetRecord(target, institutionId);
    return {
      institution_id: institutionId,
      target_type: normalized.target_type,
      scope_type: normalized.scope_type,
      scope_value: normalized.scope_value,
      title: normalized.title,
      target_id: normalized.target_id,
      invite_link: normalized.invite_link || null,
      is_active: normalized.is_active !== false,
    };
  });
}

function upsertTarget(registry: WaTarget[], target: WaTarget): WaTarget[] {
  const key = targetKey(target);
  const previous = registry.find((item) => targetKey(item) === key);

  const mergedTarget: WaTarget = previous
    ? {
        ...previous,
        ...target,
        institution_id: target.institution_id || previous.institution_id,
        target_id: String(target.target_id || previous.target_id || "").trim(),
        invite_link:
          String(target.invite_link || "").trim() ||
          String(previous.invite_link || "").trim() ||
          null,
        is_active: target.is_active !== false,
      }
    : target;

  const filtered = registry.filter((item) => targetKey(item) !== key);
  return dedupeTargets([...filtered, mergedTarget]);
}

function removeTargetByScope(
  registry: WaTarget[],
  targetType: WaTargetType,
  scopeType: WaScopeType,
  scopeValue: string
): WaTarget[] {
  return registry.filter(
    (item) =>
      !(
        item.target_type === targetType &&
        item.scope_type === scopeType &&
        item.scope_value === scopeValue
      )
  );
}

function extractMessageSendResult(data: any): string | null {
  return (
    data?.upstreamResponse?.result?.messageSendResult ||
    data?.upstreamResponse?.messageSendResult ||
    data?.result?.result?.messageSendResult ||
    data?.result?.messageSendResult ||
    data?.messageSendResult ||
    null
  );
}

function isChannelSendSuccess(data: any): boolean {
  const messageSendResult = extractMessageSendResult(data);
  if (messageSendResult) return messageSendResult === "OK";

  return data?.upstreamResponse?.ok === true || data?.result?.ok === true;
}

function extractChannelErrorMessage(data: any, fallback: string): string {
  return (
    extractMessageSendResult(data) ||
    data?.upstreamResponse?.error ||
    data?.error?.error ||
    data?.error ||
    data?.message ||
    fallback
  );
}

export const waakuService = {
  async getDefaultInstitution(): Promise<Institution | null> {
    return await getInstitutionFromLocalDb();
  },

  loadTargetsRegistry(institutionId: string): WaTarget[] {
    try {
      const raw = localStorage.getItem(storageKey(institutionId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? dedupeTargets(parsed) : [];
    } catch (error) {
      console.error("❌ خطأ في loadTargetsRegistry:", error);
      return [];
    }
  },

  saveTargetsRegistry(institutionId: string, targets: WaTarget[]) {
    try {
      localStorage.setItem(storageKey(institutionId), JSON.stringify(dedupeTargets(targets)));
    } catch (error) {
      console.error("❌ خطأ في saveTargetsRegistry:", error);
    }
  },

  clearTargetsRegistry(institutionId: string) {
    try {
      localStorage.removeItem(storageKey(institutionId));
    } catch (error) {
      console.error("❌ خطأ في clearTargetsRegistry:", error);
    }
  },

  async fetchTargetsRegistry(institutionId: string): Promise<WaTarget[]> {
    try {
      const { data, error } = await supabase
        .from(WA_TARGETS_TABLE)
        .select("institution_id,target_type,scope_type,scope_value,title,target_id,invite_link,is_active")
        .eq("institution_id", institutionId)
        .order("scope_type", { ascending: true })
        .order("scope_value", { ascending: true });

      if (error) throw error;

      const targets = dedupeTargets(
        (data || []).map((row: any) => normalizeTargetRecord(row, institutionId))
      );

      this.saveTargetsRegistry(institutionId, targets);
      return targets;
    } catch (error) {
      console.error("❌ خطأ في fetchTargetsRegistry:", error);
      return this.loadTargetsRegistry(institutionId);
    }
  },

  async persistTargetsRegistry(institutionId: string, targets: WaTarget[]) {
    const deduped = dedupeTargets(targets.map((target) => normalizeTargetRecord(target, institutionId)));

    this.saveTargetsRegistry(institutionId, deduped);

    try {
      const { error: deleteError } = await supabase
        .from(WA_TARGETS_TABLE)
        .delete()
        .eq("institution_id", institutionId);

      if (deleteError) throw deleteError;

      if (deduped.length === 0) return;

      const payload = serializeTargetsForDb(institutionId, deduped);
      const { error: insertError } = await supabase.from(WA_TARGETS_TABLE).insert(payload);

      if (insertError) throw insertError;
    } catch (error) {
      console.error("❌ خطأ في persistTargetsRegistry:", error);
      throw error;
    }
  },

  async startChannelsSession() {
    const data = await invokeEdgeFunction(FN_CHANNELS_START, {});
    if (!data?.success) {
      throw new Error(data?.error || "فشل بدء جلسة الشنلات");
    }
    return data;
  },

  async resetChannelsSession() {
    const data = await invokeEdgeFunction(FN_CHANNELS_LOGOUT, {});
    if (!data?.success && !data?.ok) {
      throw new Error(data?.error || "فشل حذف ربط الشنلات");
    }
    return data;
  },

  async getResolvedRegistry(sessionId: string, fallback?: WaTarget[]) {
    const institution = await this.getDefaultInstitution();

    if (!institution?.id) {
      return {
        institution: null,
        registry: Array.isArray(fallback) ? dedupeTargets(fallback) : [],
      };
    }

    const registry =
      fallback && fallback.length > 0
        ? dedupeTargets(fallback)
        : this.loadTargetsRegistry(institution.id);

    return { institution, registry };
  },

  async persistTarget(sessionId: string, target: WaTarget, baseRegistry?: WaTarget[]) {
    const { institution, registry } = await this.getResolvedRegistry(sessionId, baseRegistry);
    if (!institution?.id) return;

    const updated = upsertTarget(registry, { ...target, institution_id: institution.id });
    this.saveTargetsRegistry(institution.id, updated);
    try {
      await this.persistTargetsRegistry(institution.id, updated);
    } catch {}
  },

  async removeTargetFromRegistry(
    sessionId: string,
    targetType: WaTargetType,
    scopeType: WaScopeType,
    scopeValue: string
  ) {
    const institution = await this.getDefaultInstitution();
    if (!institution?.id) return;

    const registry = this.loadTargetsRegistry(institution.id);
    const updated = removeTargetByScope(registry, targetType, scopeType, scopeValue);
    this.saveTargetsRegistry(institution.id, updated);
    try {
      await this.persistTargetsRegistry(institution.id, updated);
    } catch {}
  },

  async removeTargetByIdFromRegistry(
    sessionId: string,
    targetType: WaTargetType,
    targetId: string
  ) {
    const institution = await this.getDefaultInstitution();
    if (!institution?.id) return;

    const registry = this.loadTargetsRegistry(institution.id);
    const updated = registry.filter(
      (item) => !(item.target_type === targetType && item.target_id === targetId)
    );
    this.saveTargetsRegistry(institution.id, updated);
    try {
      await this.persistTargetsRegistry(institution.id, updated);
    } catch {}
  },

  async checkStatus(institutionId: string): Promise<WaakuSessionStatus> {
    try {
      if (!isUuid(institutionId)) {
        return {
          status: "DISCONNECTED",
          instanceName: null,
          phoneNumber: null,
          qrCode: null,
          source: "invalid_institution_id",
        };
      }

      const data = await invokeEdgeFunction(FN_CHECK_STATUS, { institutionId });

      if (!data?.success) {
        return {
          status: "DISCONNECTED",
          instanceName: null,
          phoneNumber: null,
          qrCode: null,
          source: "edge_error",
        };
      }

      return {
        status: normalizeStatus(data?.status),
        instanceName: data?.instanceName || institutionId,
        phoneNumber: data?.phoneNumber || null,
        qrCode: data?.qr || data?.qrCode || null,
        source: data?.source || "supabase_function",
      };
    } catch (error) {
      console.error("❌ خطأ في checkStatus:", error);
      return {
        status: "DISCONNECTED",
        instanceName: null,
        phoneNumber: null,
        qrCode: null,
        source: "network_error",
      };
    }
  },

  async sendToChannelMedia(
    _sessionId: string,
    channelId: string,
    payload: WaSendPayload
  ): Promise<{ success: boolean; message: string; raw?: any }> {
    try {
      console.log("MEDIA DEBUG BEFORE SEND", {
        channelId,
        hasMedia: !!payload?.media,
        mediaFileName: payload?.media?.fileName,
        mediaMimeType: payload?.media?.mimeType,
        mediaDataLength: payload?.media?.dataUrl?.length || 0,
        textLength: String(payload?.message || "").length,
      });

      const data = await invokeEdgeFunction(FN_CHANNELS_PUBLISH_MEDIA, {
        channelId,
        text: String(payload?.message || "").trim(),
        media: payload?.media || null,
      });

      if (!isChannelSendSuccess(data)) {
        return {
          success: false,
          message: extractChannelErrorMessage(data, "فشل إرسال الوسائط إلى الشانل"),
          raw: data,
        };
      }

      return {
        success: true,
        message: "تم إرسال الوسائط إلى الشانل بنجاح",
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في sendToChannelMedia:", error);
      return {
        success: false,
        message: error?.message || "فشل إرسال الوسائط إلى الشانل",
        raw: error,
      };
    }
  },

  async startSession(institutionId: string) {
    try {
      if (!isUuid(institutionId)) {
        return {
          success: false,
          error: "معرف المؤسسة غير صالح. يجب أن يكون Supabase UUID.",
        };
      }

      const data = await invokeEdgeFunction(FN_CREATE_SESSION, { institutionId });

      if (!data?.success) {
        return {
          success: false,
          error: data?.error || "فشل إنشاء الجلسة",
        };
      }

      return {
        success: true,
        instanceName: data?.sessionId || data?.instanceName || institutionId,
        status: normalizeStatus(data?.status || "SCANNING"),
        phoneNumber: data?.phoneNumber || null,
        qrCode: data?.qr || data?.qrCode || null,
      };
    } catch (error: any) {
      console.error("❌ خطأ في startSession:", error);
      return {
        success: false,
        error: error?.message || "فشل إنشاء الجلسة",
      };
    }
  },

  async getQr(sessionId: string) {
    try {
      const data = await invokeEdgeFunction(FN_GET_QR, {
        instanceName: sessionId,
        sessionId,
        institutionId: sessionId,
        id: sessionId,
      });

      if (!data?.success && !data?.qr) {
        return {
          success: false,
          error: data?.error || "تعذر جلب QR",
        };
      }

      return {
        success: true,
        qr: data?.qr || null,
      };
    } catch (error: any) {
      console.error("❌ خطأ في getQr:", error);
      return {
        success: false,
        error: error?.message || "تعذر جلب QR",
      };
    }
  },

  async stopSession(institutionId: string) {
    try {
      if (!isUuid(institutionId)) {
        return {
          success: false,
          error: "معرف المؤسسة غير صالح. يجب أن يكون Supabase UUID.",
        };
      }

      const data = await invokeEdgeFunction(FN_DELETE_SESSION, { institutionId });

      if (!data?.success) {
        return {
          success: false,
          error: data?.error || "فشل حذف الجلسة",
        };
      }

      return {
        success: true,
        instanceName: data?.sessionId || institutionId,
      };
    } catch (error: any) {
      console.error("❌ خطأ في stopSession:", error);
      return {
        success: false,
        error: error?.message || "فشل حذف الجلسة",
      };
    }
  },

  async sendMessage(
    institutionId: string,
    to: string,
    message: string
  ): Promise<{ success: boolean; message: string; raw?: any }> {
    try {
      const { data, error } = await supabase.functions.invoke(FN_SEND_MESSAGE, {
        body: {
          institutionId: String(institutionId || "").trim(),
          to: String(to || "").trim(),
          message: String(message || "").trim(),
        },
      });

      if (error) {
        return {
          success: false,
          message: error.message || "فشل الإرسال",
          raw: error,
        };
      }

      if (!data?.success) {
        return {
          success: false,
          message: data?.error || data?.message || "فشل الإرسال",
          raw: data,
        };
      }

      return {
        success: true,
        message: data?.message || "تم الإرسال بنجاح",
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في sendMessage:", error);
      return {
        success: false,
        message: error?.message || "فشل الإرسال",
      };
    }
  },

  async getChannelsLayerStatus(): Promise<ChannelsLayerStatus> {
    try {
      const data = await invokeEdgeFunction(FN_CHANNELS_HEALTH, {});

      return {
        ready: !!data?.ready,
        authenticated: !!data?.authenticated,
        waState: data?.waState || null,
        clientState: data?.clientState || null,
        hasQr: !!data?.hasQr,
        qr: data?.qr || null,
        lastError: data?.lastError || null,
      };
    } catch (error: any) {
      console.error("❌ خطأ في getChannelsLayerStatus:", error);
      return {
        ready: false,
        authenticated: false,
        waState: null,
        clientState: null,
        hasQr: false,
        qr: null,
        lastError: error?.message || "فشل فحص طبقة الشانلات",
      };
    }
  },

  async createGroup(
    sessionId: string,
    title: string,
    participants: string[] = []
  ): Promise<{
    success: boolean;
    message: string;
    groupId?: string;
    inviteLink?: string | null;
    raw?: any;
  }> {
    try {
      const normalizedParticipants = normalizeWhatsappParticipants(participants);

      const res = await fetch(`${API_BASE_URL2}/api/groups/${encodeURIComponent(sessionId)}/create`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          title,
          participants: normalizedParticipants,
        }),
      });

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        return {
          success: false,
          message: data?.error || "فشل إنشاء الجروب",
          raw: data,
        };
      }

      const groupId = extractGroupId(data);

      return {
        success: !!groupId,
        message: groupId ? "تم إنشاء الجروب بنجاح" : "تم الرد بدون groupId",
        groupId,
        inviteLink: extractInviteLink(data),
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في createGroup:", error);
      return {
        success: false,
        message: error?.message || "فشل إنشاء الجروب",
      };
    }
  },

  async getGroupInviteLink(
    sessionId: string,
    groupId: string
  ): Promise<{
    success: boolean;
    message: string;
    inviteLink?: string | null;
    raw?: any;
  }> {
    try {
      const res = await fetch(
        `${API_BASE_URL2}/api/groups/${encodeURIComponent(sessionId)}/${encodeURIComponent(groupId)}/invite-link`,
        {
          method: "GET",
          headers: jsonHeaders(),
        }
      );

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        return {
          success: false,
          message: data?.error || `فشل جلب رابط الدعوة (${res.status})`,
          raw: data,
        };
      }

      return {
        success: true,
        message: "تم جلب رابط الدعوة",
        inviteLink: extractInviteLink(data),
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في getGroupInviteLink:", error);
      return {
        success: false,
        message: error?.message || "فشل جلب رابط الدعوة",
      };
    }
  },

  async addParticipantsToGroup(
    sessionId: string,
    groupId: string,
    participants: string[]
  ): Promise<{
    success: boolean;
    message: string;
    raw?: any;
  }> {
    try {
      const normalizedParticipants = normalizeWhatsappParticipants(participants);

      const res = await fetch(
        `${API_BASE_URL2}/api/groups/${encodeURIComponent(sessionId)}/${encodeURIComponent(groupId)}/add-participants`,
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({ participants: normalizedParticipants }),
        }
      );

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        return {
          success: false,
          message: data?.error || "فشل إضافة المشاركين",
          raw: data,
        };
      }

      return {
        success: true,
        message: data?.message || "تمت إضافة المشاركين",
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في addParticipantsToGroup:", error);
      return {
        success: false,
        message: error?.message || "فشل إضافة المشاركين",
      };
    }
  },

  async createChannel(
    _sessionId: string,
    title: string
  ): Promise<{
    success: boolean;
    message: string;
    channelId?: string;
    inviteLink?: string | null;
    raw?: any;
  }> {
    try {
      const channelsLayer = await this.getChannelsLayerStatus();

      if (!channelsLayer.ready) {
        return {
          success: false,
          message: "طبقة الشنلات غير جاهزة بعد. يجب مسح QR الخاص بها أولًا",
          raw: channelsLayer,
        };
      }

      const supabaseUrl = "https://benjzaxxkcjwnrfllvel.supabase.co";
      const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/channels-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          title: String(title || "").trim(),
          description: "",
        }),
      });

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        return {
          success: false,
          message: data?.error || data?.message || `فشل إنشاء الشانل (${res.status})`,
          raw: data,
        };
      }

      const channelId = extractChannelId(data);

      if (!channelId) {
        return {
          success: false,
          message: "تم الرد بدون channelId",
          raw: data,
        };
      }

      return {
        success: true,
        message: "تم إنشاء الشانل بنجاح",
        channelId,
        inviteLink: extractInviteLink(data),
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في createChannel:", error);
      return {
        success: false,
        message: error?.message || "فشل إنشاء الشانل",
      };
    }
  },

  async sendToGroup(
    _sessionId: string,
    groupId: string,
    message: string
  ): Promise<{ success: boolean; message: string; raw?: any }> {
    try {
      const res = await fetch(`${API_BASE_URL2}/api/groups/send`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          groupId,
          message,
        }),
      });

 
      const data = await parseJsonSafe(res);

      if (!res.ok) {
        return {
          success: false,
          message: data?.error || data?.message || "فشل الإرسال إلى الجروب",
          raw: data,
        };
      }

      return {
        success: true,
        message: data?.message || "تم الإرسال إلى الجروب بنجاح",
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في sendToGroup:", error);
      return {
        success: false,
        message: error?.message || "فشل الإرسال إلى الجروب",
      };
    }
  },

  async sendToChannel(
    _sessionId: string,
    channelId: string,
    payload: string | WaSendPayload
  ): Promise<{ success: boolean; message: string; raw?: any }> {
    try {
      const normalizedPayload: WaSendPayload =
        typeof payload === "string"
          ? { message: payload, media: null }
          : {
              message: String(payload?.message || "").trim(),
              media: payload?.media || null,
            };

      const data = await invokeEdgeFunction(FN_CHANNELS_PUBLISH, {
        channelId,
        text: normalizedPayload.message,
      });

      if (!isChannelSendSuccess(data)) {
        return {
          success: false,
          message: extractChannelErrorMessage(data, "فشل الإرسال إلى الشانل"),
          raw: data,
        };
      }

      return {
        success: true,
        message: "تم الإرسال إلى الشانل بنجاح",
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في sendToChannel:", error);
      return {
        success: false,
        message: error?.message || "فشل الإرسال إلى الشانل",
        raw: error,
      };
    }
  },

  async sendToTarget(
    targetType: WaTargetType,
    sessionId: string,
    targetId: string,
    payload: string | WaSendPayload
  ): Promise<{ success: boolean; message: string; raw?: any }> {
    const normalizedPayload =
      typeof payload === "string" ? { message: payload, media: null } : payload;

    const textOnlyMessage = String(normalizedPayload?.message || "").trim();

    if (targetType === "group") {
      return this.sendToGroup(sessionId, targetId, textOnlyMessage);
    }

    if (normalizedPayload?.media) {
      const mediaRes = await this.sendToChannelMedia(sessionId, targetId, normalizedPayload);

      if (!mediaRes.success) {
        return {
          success: false,
          message: mediaRes.message || "فشل إرسال الصورة أو الملف إلى الشانل",
          raw: mediaRes.raw,
        };
      }

      return mediaRes;
    }

    return this.sendToChannel(sessionId, targetId, textOnlyMessage);
  },

  async deleteGroup(
    sessionId: string,
    groupId: string
  ): Promise<{ success: boolean; message: string; raw?: any }> {
    try {
      const res = await fetch(
        `${API_BASE_URL2}/api/groups/${encodeURIComponent(sessionId)}/${encodeURIComponent(groupId)}`,
        {
          method: "DELETE",
          headers: jsonHeaders(),
        }
      );

      const data = await parseJsonSafe(res);

      if (!res.ok) {
        return {
          success: false,
          message: data?.error || "فشل حذف الجروب",
          raw: data,
        };
      }

      await this.removeTargetByIdFromRegistry(sessionId, "group", groupId);

      return {
        success: true,
        message: data?.message || "تم حذف الجروب بنجاح",
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في deleteGroup:", error);
      return {
        success: false,
        message: error?.message || "فشل حذف الجروب",
      };
    }
  },

  async deleteChannel(
    sessionId: string,
    channelId: string
  ): Promise<{ success: boolean; message: string; raw?: any }> {
    try {
      const data = await invokeEdgeFunction(FN_CHANNELS_DELETE, { channelId });

      if (!data?.success && !data?.ok) {
        return {
          success: false,
          message: data?.error || data?.message || "فشل حذف الشانل",
          raw: data,
        };
      }

      await this.removeTargetByIdFromRegistry(sessionId, "channel", channelId);

      return {
        success: true,
        message: data?.message || "تم حذف الشانل بنجاح",
        raw: data,
      };
    } catch (error: any) {
      console.error("❌ خطأ في deleteChannel:", error);
      return {
        success: false,
        message: error?.message || "فشل حذف الشانل",
      };
    }
  },

  async ensureTarget(params: EnsureTargetParams) {
    const { institution, registry } = await this.getResolvedRegistry(params.sessionId, params.registry);

    const existing = registry.find(
      (item) =>
        item.target_type === params.targetType &&
        item.scope_type === params.scopeType &&
        item.scope_value === params.scopeValue &&
        item.is_active !== false
    );

    if (existing) {
      return {
        success: true,
        message: "الهدف موجود مسبقًا",
        target: {
          ...existing,
          invite_link: String(existing.invite_link || "").trim() || null,
        },
        created: false,
      };
    }

    if (params.targetType === "group") {
      const participants = Array.isArray(params.participants) ? params.participants : [];
      const cleanedParticipants = normalizeWhatsappParticipants(participants);

      if (cleanedParticipants.length === 0) {
        return {
          success: false,
          message: `لا توجد أرقام صالحة لإنشاء جروب لـ ${params.scopeValue}`,
        };
      }

      const created = await this.createGroup(params.sessionId, params.title, cleanedParticipants);

      if (!created.success || !created.groupId) {
        return {
          success: false,
          message: created.message || "فشل إنشاء الجروب",
        };
      }

      let inviteLink = created.inviteLink || null;

      if (!inviteLink) {
        try {
          const invite = await this.getGroupInviteLink(params.sessionId, created.groupId);
          if (invite.success) inviteLink = invite.inviteLink || null;
        } catch {}
      }

      const target: WaTarget = {
        institution_id: institution?.id || undefined,
        target_type: "group",
        scope_type: params.scopeType,
        scope_value: params.scopeValue,
        title: params.title,
        target_id: created.groupId,
        invite_link: inviteLink,
        is_active: true,
      };

      if (institution?.id) {
        const updatedRegistry = upsertTarget(registry, target);
        this.saveTargetsRegistry(institution.id, updatedRegistry);
        await this.persistTargetsRegistry(institution.id, updatedRegistry);
      }

      return {
        success: true,
        message: "تم إنشاء هدف group",
        target,
        created: true,
      };
    }

    
    const channelsLayer = await this.getChannelsLayerStatus();
    if (!channelsLayer.ready) {
      return {
        success: false,
        message: "يجب ربط طبقة الشنلات والجروبات أولًا ثم مسح QR الخاص بها",
      };
    }

    const created = await this.createChannel(params.sessionId, params.title);

    if (!created.success || !created.channelId) {
      return {
        success: false,
        message: created.message || "فشل إنشاء الشانل",
      };
    }

    const target: WaTarget = {
      institution_id: institution?.id || undefined,
      target_type: "channel",
      scope_type: params.scopeType,
      scope_value: params.scopeValue,
      title: params.title,
      target_id: created.channelId,
      invite_link: created.inviteLink || null,
      is_active: true,
    };

    if (institution?.id) {
      const updatedRegistry = upsertTarget(registry, target);
      this.saveTargetsRegistry(institution.id, updatedRegistry);
      await this.persistTargetsRegistry(institution.id, updatedRegistry);
    }

    return {
      success: true,
      message: "تم إنشاء هدف channel",
      target,
      created: true,
    };
  },

  async ensureTargets(params: EnsureTargetsParams) {
    const { institution, registry } = await this.getResolvedRegistry(params.sessionId, params.registry);

    let workingRegistry = [...registry];
    const targets: WaTarget[] = [];
    let createdCount = 0;
    let existingCount = 0;

    for (const scopeValue of params.scopeValues) {
      const cleanScopeValue = String(scopeValue || "").trim();
      if (!cleanScopeValue) continue;

      const title = params.titleBuilder
        ? params.titleBuilder(cleanScopeValue)
        : buildDefaultTitle(params.targetType, params.scopeType, cleanScopeValue);

      const ensured = await this.ensureTarget({
        sessionId: params.sessionId,
        targetType: params.targetType,
        scopeType: params.scopeType,
        scopeValue: cleanScopeValue,
        title,
        registry: workingRegistry,
        participants: params.participantsMap?.[cleanScopeValue] || [],
      });

      if (!ensured.success || !ensured.target) {
        return {
          success: false,
          message: ensured.message || `فشل تجهيز الهدف ${cleanScopeValue}`,
          targets,
          createdCount,
          existingCount,
        };
      }

      targets.push(ensured.target);

      if (ensured.created) {
        createdCount += 1;
        workingRegistry = upsertTarget(workingRegistry, ensured.target);
      } else {
        existingCount += 1;
      }
    }

    if (institution?.id) {
      this.saveTargetsRegistry(institution.id, workingRegistry);
      await this.persistTargetsRegistry(institution.id, workingRegistry);
    }

    return {
      success: true,
      message: "تم تجهيز الأهداف",
      targets,
      createdCount,
      existingCount,
    };
  },

  async sendToResolvedTargets(
    sessionId: string,
    targets: WaTarget[],
    payload: string | WaSendPayload
  ) {
    const results: Array<{
      target: WaTarget;
      success: boolean;
      message: string;
      raw?: any;
    }> = [];

    let sentCount = 0;
    let failedCount = 0;

    for (const target of targets) {
      const res = await this.sendToTarget(target.target_type, sessionId, target.target_id, payload);

      results.push({
        target,
        success: res.success,
        message: res.message,
        raw: res.raw,
      });

      if (res.success) sentCount += 1;
      else failedCount += 1;
    }

    return {
      success: failedCount === 0,
      sentCount,
      failedCount,
      results,
    };
  },
};