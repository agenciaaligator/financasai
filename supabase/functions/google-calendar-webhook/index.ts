/**
 * Recebe push notifications do Google Calendar.
 * Quando um evento muda, o Google bate aqui — disparamos sync sob demanda.
 * Sem polling, sem cron de 1 minuto.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    // Google envia headers X-Goog-*
    const channelId = req.headers.get("X-Goog-Channel-Id");
    const resourceState = req.headers.get("X-Goog-Resource-State");

    if (!channelId) {
      return new Response("ok", { status: 200 });
    }

    // 'sync' é o handshake inicial — só responde 200
    if (resourceState === "sync") {
      return new Response("ok", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conn } = await supabase
      .from("calendar_connections")
      .select("user_id")
      .eq("webhook_channel_id", channelId)
      .maybeSingle();

    if (!conn) {
      console.log("Webhook for unknown channel:", channelId);
      return new Response("ok", { status: 200 });
    }

    // Aciona sync interno (não-bloqueante)
    const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync-internal`;
    fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ user_id: conn.user_id }),
    }).catch((e) => console.error("trigger sync failed:", e));

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("webhook error:", err);
    return new Response("ok", { status: 200 }); // sempre 200 pro Google não desabilitar o canal
  }
});
