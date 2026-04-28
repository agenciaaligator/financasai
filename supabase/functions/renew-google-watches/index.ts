/**
 * Único cron deste sistema. Roda 1x/dia às 03:00.
 * Renova webhooks (watches) do Google Calendar que vencem em <24h.
 * Custo: ~30 execuções/mês. Sem envio de mensagens, só renovação.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidGoogleToken } from "../_shared/google-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Conexões sem webhook OU com webhook prestes a expirar
    const { data: conns } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("provider", "google")
      .eq("is_active", true)
      .eq("needs_reauth", false)
      .or(`webhook_expires_at.is.null,webhook_expires_at.lt.${cutoff}`);

    if (!conns?.length) {
      return new Response(JSON.stringify({ renewed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-webhook`;
    let renewed = 0;
    let failed = 0;

    for (const conn of conns) {
      try {
        const token = await getValidGoogleToken(supabase, conn as any);

        // Para o canal antigo se houver
        if (conn.webhook_channel_id && conn.webhook_resource_id) {
          await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: conn.webhook_channel_id,
              resourceId: conn.webhook_resource_id,
            }),
          }).catch(() => {});
        }

        const newChannelId = crypto.randomUUID();
        const watchRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${conn.calendar_id || "primary"}/events/watch`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: newChannelId,
              type: "web_hook",
              address: webhookUrl,
              expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
            }),
          }
        );

        if (!watchRes.ok) {
          failed++;
          console.error(`Watch failed for ${conn.id}:`, await watchRes.text());
          continue;
        }

        const watchData = await watchRes.json();
        await supabase
          .from("calendar_connections")
          .update({
            webhook_channel_id: newChannelId,
            webhook_resource_id: watchData.resourceId,
            webhook_expires_at: new Date(Number(watchData.expiration)).toISOString(),
          })
          .eq("id", conn.id);

        renewed++;
      } catch (e) {
        failed++;
        console.error(`Renew failed for ${conn.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ renewed, failed, total: conns.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("renew-google-watches error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
