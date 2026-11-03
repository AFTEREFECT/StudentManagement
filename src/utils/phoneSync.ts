import { supabase } from "../lib/supabaseClient";
import { dbManager } from "./database";

/* تحويل رقم الهاتف إلى صيغة 212 */
function normalizePhone(phone: string): string {
  if (!phone) return "";

  let clean = String(phone).replace(/\D/g, "");

  if (clean.startsWith("0")) {
    clean = "212" + clean.substring(1);
  }

  if (clean.startsWith("212")) {
    return clean;
  }

  return clean;
}

export async function syncPhoneUpdates() {
  try {
    console.log("🚀 بدء مزامنة أرقام الهواتف...");

    await dbManager.initialize();

    const settings = await dbManager.getInstitutionSettings();

    const institutionId =
      String(
        settings?.supabaseInstitutionId ||
        settings?.supabase_institution_id ||
        settings?.institutionId ||
        ""
      ).trim();

    if (!institutionId) {
      throw new Error("❌ لم يتم العثور على institution_id");
    }

    const db: any = dbManager.getDatabaseInstance();

    if (!db) {
      throw new Error("❌ قاعدة البيانات غير مهيأة");
    }

    /* جلب التحديثات */
    const { data, error } = await supabase
      .from("phone_updates")
      .select("*")
      .eq("synced", false)
      .eq("institution_id", institutionId);

    if (error) {
      console.error("❌ خطأ في جلب البيانات:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log("ℹ️ لا توجد تحديثات جديدة");
      return {
        success: true,
        updated: 0,
        skipped: 0,
        notFound: 0
      };
    }

    console.log(`📦 عدد التحديثات: ${data.length}`);

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    for (const update of data) {
      const massar = String(update.massar_code || "").trim();
      const phone = normalizePhone(update.phone || "");

      if (!massar || !phone) {
        console.warn("⚠️ بيانات ناقصة:", update.id);
        skippedCount++;
        continue;
      }

      try {
        /* تحقق هل الطالب موجود */
        const checkStmt = db.prepare(`
          SELECT id FROM students WHERE nationalId = ?
        `);

        checkStmt.bind([massar]);

        const exists = checkStmt.step();
        checkStmt.free();

        if (!exists) {
          console.warn("❌ الطالب غير موجود:", massar);
          notFoundCount++;
          continue;
        }

        /* تحديث الهاتف */
        db.run(
          `
          UPDATE students
          SET phone = ?
          WHERE nationalId = ?
          `,
          [phone, massar]
        );

        /* تحديث Supabase فقط إذا نجح التحديث */
        const { error: updateError } = await supabase
          .from("phone_updates")
          .update({ synced: true })
          .eq("id", update.id);

        if (updateError) {
          console.error("❌ خطأ في تحديث synced:", updateError);
          skippedCount++;
          continue;
        }

        console.log("✅ تم تحديث:", massar, phone);
        updatedCount++;

      } catch (err) {
        console.error("💥 خطأ أثناء التحديث:", err);
        skippedCount++;
      }
    }

    if (typeof (dbManager as any).saveDatabase === "function") {
      await (dbManager as any).saveDatabase();
    }

    console.log("🎉 انتهت المزامنة");

    return {
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      notFound: notFoundCount
    };

  } catch (err) {
    console.error("💥 خطأ عام:", err);
    throw err;
  }
}