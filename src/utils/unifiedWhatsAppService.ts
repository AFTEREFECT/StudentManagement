import { waakuService } from "./waakuService";
import { dbManager } from "./database";

export interface SendMessageResult {
  success: boolean;
  message: string;
}

export type ServiceType = "waaku";

class UnifiedWhatsAppService {
  private async getInstitutionId(): Promise<string | null> {
    try {
      await dbManager.initialize();
      const settings = await dbManager.getInstitutionSettings();

      const institutionId =
        settings?.supabaseInstitutionId ||
        settings?.supabase_institution_id ||
        settings?.institutionId ||
        localStorage.getItem("institutionId") ||
        "";

      const cleanInstitutionId = String(institutionId).trim();

      return cleanInstitutionId ? cleanInstitutionId : null;
    } catch (error) {
      console.error("❌ خطأ في getInstitutionId:", error);
      return null;
    }
  }

  async sendMessage(phone: string, message: string): Promise<SendMessageResult> {
    try {
      const institutionId = await this.getInstitutionId();

      if (!institutionId) {
        return {
          success: false,
          message: "لم يتم العثور على معرف المؤسسة",
        };
      }

      if (!phone?.trim()) {
        return {
          success: false,
          message: "رقم الهاتف غير موجود",
        };
      }

      if (!message?.trim()) {
        return {
          success: false,
          message: "نص الرسالة فارغ",
        };
      }

      return await waakuService.sendMessage(institutionId, phone, message);
    } catch (error: any) {
      console.error("❌ خطأ في sendMessage:", error);
      return {
        success: false,
        message: error?.message || "خطأ في الإرسال",
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

    try {
      const institutionId = await this.getInstitutionId();

      if (!institutionId) {
        return { success: 0, failed: total, total };
      }

      for (let i = 0; i < recipients.length; i++) {
        const item = recipients[i];

        if (!item.phone?.trim() || !item.message?.trim()) {
          failed++;
          if (onProgress) onProgress(i + 1, total);
          continue;
        }

        const result = await waakuService.sendMessage(
          institutionId,
          item.phone,
          item.message
        );

        if (result.success) success++;
        else failed++;

        if (onProgress) onProgress(i + 1, total);
      }

      return { success, failed, total };
    } catch (error) {
      console.error("❌ خطأ في sendBulkMessages:", error);
      return { success, failed: total - success, total };
    }
  }

  async testConnection(): Promise<SendMessageResult> {
    try {
      const institutionId = await this.getInstitutionId();

      if (!institutionId) {
        return {
          success: false,
          message: "معرف المؤسسة غير موجود",
        };
      }

      const result = await waakuService.checkStatus(institutionId);

      return {
        success: result.status !== "DISCONNECTED",
        message: `حالة الاتصال: ${result.status}`,
      };
    } catch (error) {
      console.error("❌ خطأ في testConnection:", error);
      return {
        success: false,
        message: "فشل اختبار الاتصال",
      };
    }
  }
}

export const unifiedWhatsAppService = new UnifiedWhatsAppService();