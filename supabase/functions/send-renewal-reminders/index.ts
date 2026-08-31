/**
 * Cron diario: avisa por WhatsApp 3 dias antes da renovacao da assinatura.
 * Idempotente via user_subscriptions.renewal_reminder_sent_for (guarda o
 * current_period_end ja avisado, entao cada novo ciclo manda um aviso novo).
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
    console.error("[send-renewal-reminders] WhatsApp credentials missing");
    return false;
  }
  const cleanTo = to.startsWith("+") ? to.substring(1) : to;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanTo,
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) {
      console.error("[send-renewal-reminders] WhatsApp API error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[send-renewal-reminders] WhatsApp send error:", e);
    return false;
  }
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
}

function formatMoney(value: number, locale: string): string {
  const currency = locale === "en-US" ? "USD" : locale === "it-IT" ? "EUR" : "BRL";
  // Preco sempre gravado em BRL na tabela subscription_plans; mantemos BRL na mensagem
  // independente do idioma, pra nao exibir conversao incorreta.
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const MESSAGES: Record<string, (name: string, date: string, price: string) => string> = {
  "pt-BR": (name, date, price) =>
    `Oi, ${name}! 💙\n\nSua assinatura da Dona Wilma renova automaticamente em *${date}*, no valor de *${price}*.\n\nSe estiver tudo certo, não precisa fazer nada. Qualquer dúvida, é só me chamar por aqui!`,
  "pt-PT": (name, date, price) =>
    `Olá, ${name}! 💙\n\nA sua subscrição da Dona Wilma renova automaticamente em *${date}*, no valor de *${price}*.\n\nSe estiver tudo bem, não precisa de fazer nada. Qualquer dúvida, fale comigo por aqui!`,
  "en-US": (name, date, price) =>
    `Hi, ${name}! 💙\n\nYour Dona Wilma subscription renews automatically on *${date}*, for *${price}*.\n\nIf everything looks good, you don't need to do anything. Just message me here if you have any questions!`,
  "es-ES": (name, date, price) =>
    `¡Hola, ${name}! 💙\n\nTu suscripción de Dona Wilma se renueva automáticamente el *${date}*, por *${price}*.\n\nSi todo está bien, no necesitas hacer nada. ¡Escríbeme aquí si tienes alguna duda!`,
  "it-IT": (name, date, price) =>
    `Ciao, ${name}! 💙\n\nIl tuo abbonamento a Dona Wilma si rinnova automaticamente il *${date}*, per *${price}*.\n\nSe va tutto bene, non devi fare nulla. Scrivimi qui per qualsiasi domanda!`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const windowStart = new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(Date.now() + 3.5 * 24 * 60 * 60 * 1000).toISOString();

    const { data: subs, error } = await supabase
      .from("user_subscriptions")
      .select("id, user_id, current_period_end, renewal_reminder_sent_for, billing_cycle, plan_id")
      .in("status", ["active", "trialing"])
      .gte("current_period_end", windowStart)
      .lte("current_period_end", windowEnd);

    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const sub of subs ?? []) {
      if (sub.renewal_reminder_sent_for === sub.current_period_end) {
        skipped++;
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("phone_number, full_name, preferred_language")
        .eq("user_id", sub.user_id)
        .maybeSingle();

      if (!profile?.phone_number) {
        skipped++;
        continue;
      }

      const { data: plan } = sub.plan_id
        ? await supabase.from("subscription_plans").select("price_monthly, price_yearly").eq("id", sub.plan_id).maybeSingle()
        : { data: null };

      const price = sub.billing_cycle === "yearly" ? plan?.price_yearly : plan?.price_monthly;
      const locale = MESSAGES[profile.preferred_language ?? ""] ? profile.preferred_language! : "pt-BR";
      const firstName = (profile.full_name ?? "").split(" ")[0] || "";
      const message = MESSAGES[locale](
        firstName || "tudo bem?",
        formatDate(sub.current_period_end, locale),
        price != null ? formatMoney(price, locale) : "—"
      );

      const ok = await sendWhatsAppMessage(profile.phone_number, message);

      if (ok) {
        sent++;
        await supabase
          .from("user_subscriptions")
          .update({ renewal_reminder_sent_for: sub.current_period_end })
          .eq("id", sub.id);
      } else {
        failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, sent, skipped, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-renewal-reminders error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
