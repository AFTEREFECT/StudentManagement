import { supabase } from "./supabaseClient";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

type EnqueueArgs = {
  institutionId: string;
  phones: string[];
  message: string;
};

export async function enqueueAndStart({
  institutionId,
  phones,
  message,
}: EnqueueArgs) {
  if (!institutionId) throw new Error("institutionId required");
  if (!phones?.length) throw new Error("phones required");
  if (!message?.trim()) throw new Error("message required");

  // 1️⃣ إدخال الرسائل في Queue
  const payload = phones.map((phone) => ({
    institution_id: institutionId,
    session_id: `${institutionId}`,
    phone,
    message,
    status: "pending",
  }));

  const { error } = await supabase.from("message_queue").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  // 2️⃣ تشغيل الـ Worker مرة واحدة فقط
  await fetch(`${supabaseUrl}/functions/v1/process-message-queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });

  return {
    success: true,
    queued: phones.length,
  };
}