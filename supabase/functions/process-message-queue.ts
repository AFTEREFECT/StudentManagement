import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async () => {

  // خذ رسالة واحدة من كل session (Round Robin)
  const { data: sessions } = await supabase
    .from("message_queue")
    .select("session_id")
    .eq("status", "pending")
    .limit(10);

  if (!sessions || sessions.length === 0) {
    return new Response("No pending messages");
  }

  const uniqueSessions = [...new Set(sessions.map(s => s.session_id))];

  for (const sessionId of uniqueSessions) {

    const { data: msg } = await supabase
      .from("message_queue")
      .select("*")
      .eq("status", "pending")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!msg) continue;

    try {

      await supabase
        .from("message_queue")
        .update({ status: "sending" })
        .eq("id", msg.id);

      await fetch(
        `https://progtalamid.com/api/messages/${sessionId}/send`,
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

      // Delay عشوائي بين 8 و 15 ثانية لكل Session
      const delay = 8000 + Math.floor(Math.random() * 7000);
      await sleep(delay);

    } catch (e) {

      await supabase
        .from("message_queue")
        .update({
          status: "failed",
          attempts: msg.attempts + 1,
        })
        .eq("id", msg.id);
    }
  }

  return new Response("Processed");
});