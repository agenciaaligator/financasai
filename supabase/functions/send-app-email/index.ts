// Edge Function: send-app-email
// Envio genérico de e-mails transacionais via SMTP da Hostinger.
// Centraliza o envio de qualquer notificação do app a partir da conta
// contato@donawilma.com.br.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  to: z.union([
    z.string().trim().email().max(255),
    z.array(z.string().trim().email().max(255)).min(1).max(10),
  ]),
  subject: z.string().trim().min(1).max(250),
  html: z.string().min(1).max(200_000),
  text: z.string().max(200_000).optional(),
  replyTo: z.string().trim().email().max(255).optional(),
  fromName: z.string().trim().min(1).max(80).optional(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      console.log(
        "[send-app-email] validation failed",
        parsed.error.flatten(),
      );
      return jsonResponse({ error: "validation" }, 400);
    }

    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const SMTP_FROM_NAME = Deno.env.get("SMTP_FROM_NAME") ?? "Dona Wilma";

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.log("[send-app-email] missing SMTP secrets");
      return jsonResponse({ error: "smtp_misconfigured" }, 500);
    }

    const { to, subject, html, text, replyTo, fromName } = parsed.data;

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        // Porta 465 = TLS implícito; 587 = STARTTLS.
        tls: SMTP_PORT === 465,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    const fromDisplay = `${fromName ?? SMTP_FROM_NAME} <${SMTP_USER}>`;
    const recipients = Array.isArray(to) ? to : [to];

    try {
      await client.send({
        from: fromDisplay,
        to: recipients,
        replyTo: replyTo ?? undefined,
        subject,
        content: text ?? htmlToText(html),
        html,
      });
    } finally {
      await client.close();
    }

    console.log("[send-app-email] sent", {
      to: recipients,
      subject,
    });

    return jsonResponse({ success: true });
  } catch (err) {
    const message = (err as Error).message ?? "unknown";
    console.log("[send-app-email] exception", message);
    return jsonResponse({ error: "send_failed", detail: message }, 500);
  }
});
