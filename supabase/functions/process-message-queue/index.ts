import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {

  const { data: msg } = await supabase
    .from("message_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!msg) {
    return new Response("Queue empty");
  }

  try {

    await supabase
      .from("message_queue")
      .update({ status: "sending" })
      .eq("id", msg.id);

    await fetch(
      `https://progtalamid.com/api/messages/${msg.session_id}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Access-Client-Id": Deno.env.get("CF_ACCESS_CLIENT_ID")!,
          "CF-Access-Client-Secret": Deno.env.get("CF_ACCESS_CLIENT_SECRET")!,
        },
        body: JSON.stringify({
          to: msg.phone,
          message: msg.message,
        }),
      }
    );

    await supabase
      .from("message_queue")
      .update({
        status: "sent",
        sent_at: new Date(),
      })
      .eq("id", msg.id);

    const delay = 8000 + Math.floor(Math.random() * 7000);
    await sleep(delay);

    // 🔥 تستدعي نفسها مرة أخرى
    await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-message-queue`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
      }
    );

  } catch {
    await supabase
      .from("message_queue")
      .update({
        status: "failed",
        attempts: msg.attempts + 1,
      })
      .eq("id", msg.id);
  }

  return new Response("Processed one message");
});