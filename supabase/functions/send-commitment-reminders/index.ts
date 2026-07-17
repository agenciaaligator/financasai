/**
 * Cron a cada 5 min: envia lembrete WhatsApp 1h antes de cada compromisso.
 * Idempotente via flag commitments.reminder_sent_1h.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) {
    console.error("WhatsApp credentials missing");
    return false;
  }
  const cleanTo = to.startsWith("+") ? to.substring(1) : to;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanTo,
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("WhatsApp API error:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("WhatsApp send error:", e);
    return false;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Janela: compromissos entre +55min e +65min (cobre o atraso do cron de 5 min)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 55 * 60_000).toISOString();
    const windowEnd = new Date(now.getTime() + 65 * 60_000).toISOString();

    const { data: commitments, error } = await supabase
      .from("commitments")
      .select("id, user_id, title, scheduled_at, location")
      .eq("reminder_sent_1h", false)
      .gte("scheduled_at", windowStart)
      .lte("scheduled_at", windowEnd);

    if (error) throw error;

    console.log(`[reminders] window ${windowStart} → ${windowEnd}: ${commitments?.length ?? 0} pending`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const c of commitments ?? []) {
      // 1) Assinatura ativa? Sem plano ativo NÃO gastamos msg WhatsApp paga.
      //    Aceita active/trialing e past_due (grace period de 3 dias — memory).
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("status")
        .eq("user_id", c.user_id)
        .in("status", ["active", "trialing", "past_due"])
        .maybeSingle();

      if (!sub) {
        skipped++;
        await supabase
          .from("commitments")
          .update({ reminder_sent_1h: true })
          .eq("id", c.id);
        continue;
      }

      // 2) Buscar telefone do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone_number, full_name")
        .eq("user_id", c.user_id)
        .maybeSingle();

      if (!profile?.phone_number) {
        skipped++;
        await supabase
          .from("commitments")
          .update({ reminder_sent_1h: true })
          .eq("id", c.id);
        continue;
      }

      const firstName = (profile.full_name ?? "").split(" ")[0] || "";
      const greeting = firstName ? `Oi, ${firstName}!` : "Oi, querido(a)!";
      const locationLine = c.location ? `\n📍 ${c.location}` : "";

      const message =
        `${greeting} 💙\n\n` +
        `Passando pra lembrar do seu compromisso *${c.title}* daqui a 1 hora, ` +
        `às ${formatTime(c.scheduled_at)}.${locationLine}\n\n` +
        `Qualquer coisa, é só me chamar!`;

      const ok = await sendWhatsAppMessage(profile.phone_number, message);

      if (ok) {
        sent++;
        await supabase
          .from("commitments")
          .update({ reminder_sent_1h: true })
          .eq("id", c.id);
      } else {
        failed++;
      }
    }

    // Log resumido em security_events para auditoria
    await supabase.from("security_events").insert({
      event_type: "commitment_reminders_run",
      details: { sent, skipped, failed, window_start: windowStart, window_end: windowEnd },
    });

    return new Response(
      JSON.stringify({ success: true, sent, skipped, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-commitment-reminders error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
