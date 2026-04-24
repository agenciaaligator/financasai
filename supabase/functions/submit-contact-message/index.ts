import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
  website: z.string().optional(), // honeypot
  user_agent: z.string().max(500).optional(),
});

const SITE_URL = "https://donawilma.com.br";
const CONTACT_INBOX = "contato@donawilma.com.br";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAdminEmail(d: {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  ip: string | null;
}) {
  const phoneLine = d.phone
    ? `<tr><td style="padding:6px 12px;color:#6b7280;">Telefone</td><td style="padding:6px 12px;color:#111827;">${escapeHtml(d.phone)}</td></tr>`
    : "";
  return `
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-size:20px;margin:0 0 8px;color:#111827;">Nova mensagem de contato</h1>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">Recebida pelo formulário de ${SITE_URL}</p>
    <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:12px;overflow:hidden;font-size:14px;">
      <tr><td style="padding:6px 12px;color:#6b7280;width:120px;">Nome</td><td style="padding:6px 12px;color:#111827;">${escapeHtml(d.name)}</td></tr>
      <tr><td style="padding:6px 12px;color:#6b7280;">E-mail</td><td style="padding:6px 12px;color:#111827;"><a href="mailto:${escapeHtml(d.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(d.email)}</a></td></tr>
      ${phoneLine}
      <tr><td style="padding:6px 12px;color:#6b7280;">Assunto</td><td style="padding:6px 12px;color:#111827;">${escapeHtml(d.subject)}</td></tr>
    </table>
    <h2 style="font-size:14px;color:#6b7280;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Mensagem</h2>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(d.message)}</div>
    <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">IP: ${escapeHtml(d.ip ?? "—")}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">Para responder, basta usar "Responder" — o e-mail vai direto para ${escapeHtml(d.email)}.</p>
  </div>
</body></html>`.trim();
}

function buildUserConfirmationEmail(d: { name: string; subject: string }) {
  return `
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-size:22px;margin:0 0 16px;color:#111827;">Olá, ${escapeHtml(d.name)}! 👋</h1>
    <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
      Recebemos sua mensagem sobre <strong>"${escapeHtml(d.subject)}"</strong> e queremos agradecer pelo contato.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 24px;">
      Nossa equipe vai analisar sua mensagem e retornar em até <strong>1 dia útil</strong>. Fique de olho na sua caixa de entrada (e na pasta de spam, por garantia).
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${SITE_URL}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">Voltar ao site</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0;">
      Se precisar falar com a gente novamente, é só responder este e-mail.<br>
      Um abraço,<br><strong>Equipe Dona Wilma</strong>
    </p>
  </div>
</body></html>`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      console.log("[submit-contact-message] validation failed", parsed.error.flatten());
      return jsonResponse({ error: "validation" }, 400);
    }

    const { name, email, phone, subject, message, website, user_agent } = parsed.data;

    // Honeypot: se preenchido, finge sucesso e descarta
    if (website && website.trim().length > 0) {
      console.log("[submit-contact-message] honeypot triggered");
      return jsonResponse({ success: true });
    }

    const normalizedPhone = phone && phone.trim().length > 0 ? phone.trim() : null;

    // Captura IP real
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ip_address = xff.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      phone: normalizedPhone,
      subject,
      message,
      ip_address,
      user_agent: user_agent ?? req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });

    if (error) {
      console.log("[submit-contact-message] db error", error.message);
      const msg = error.message || "";
      if (msg.includes("ratelimit:")) return jsonResponse({ error: "rate_limit" }, 429);
      if (msg.includes("duplicate:")) return jsonResponse({ error: "duplicate" }, 409);
      if (msg.includes("validation:")) return jsonResponse({ error: "validation" }, 400);
      return jsonResponse({ error: "generic" }, 500);
    }

    console.log("[submit-contact-message] saved", { email, ip_address });

    // Disparo de e-mails (não bloqueia o sucesso da mensagem)
    try {
      const adminHtml = buildAdminEmail({
        name,
        email,
        phone: normalizedPhone,
        subject,
        message,
        ip: ip_address,
      });

      const userHtml = buildUserConfirmationEmail({ name, subject });

      // Envia em paralelo: notificação interna + confirmação ao usuário
      const sendPromises = [
        supabase.functions.invoke("send-app-email", {
          body: {
            to: CONTACT_INBOX,
            subject: `[Contato] ${subject}`,
            html: adminHtml,
            replyTo: email,
          },
        }),
        supabase.functions.invoke("send-app-email", {
          body: {
            to: email,
            subject: "Recebemos sua mensagem — Dona Wilma",
            html: userHtml,
            replyTo: CONTACT_INBOX,
          },
        }),
      ];

      const results = await Promise.allSettled(sendPromises);
      results.forEach((r, i) => {
        const label = i === 0 ? "admin" : "user";
        if (r.status === "rejected") {
          console.log(`[submit-contact-message] email ${label} failed`, r.reason);
        } else if ((r.value as { error?: unknown })?.error) {
          console.log(`[submit-contact-message] email ${label} returned error`, r.value);
        } else {
          console.log(`[submit-contact-message] email ${label} ok`);
        }
      });
    } catch (mailErr) {
      // Falha no envio de e-mail não deve afetar a resposta para o usuário
      console.log("[submit-contact-message] email dispatch exception", (mailErr as Error).message);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.log("[submit-contact-message] exception", (err as Error).message);
    return jsonResponse({ error: "generic" }, 500);
  }
});
