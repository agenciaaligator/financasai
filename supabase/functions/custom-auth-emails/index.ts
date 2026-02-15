import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") as string;
const SITE_URL = Deno.env.get("SITE_URL") || "https://donawilma.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailHookPayload {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new: string;
    token_hash_new: string;
  };
}

function generateInviteEmail(email: string, tokenHash: string): { subject: string; html: string } {
  const confirmLink = `${SITE_URL}/set-password?token_hash=${tokenHash}&type=invite`;

  return {
    subject: "🎉 Sua conta Dona Wilma foi criada – Defina sua senha",
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); border-radius: 50%; padding: 16px; margin-bottom: 16px;">
            <span style="font-size: 32px;">✅</span>
          </div>
          <h1 style="color: #18181b; font-size: 24px; font-weight: 700; margin: 0;">Dona Wilma</h1>
        </div>
        <div style="text-align: center;">
          <h2 style="color: #18181b; font-size: 20px; font-weight: 600; margin: 0 0 12px;">Sua assinatura foi confirmada!</h2>
          <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
            Sua conta foi criada com sucesso. Clique no botão abaixo para definir sua senha e começar a usar o sistema.
          </p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${confirmLink}" 
             style="display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">
            Definir minha senha
          </a>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #71717a; font-size: 14px; line-height: 1.5; margin: 0;">
            Se o botão não funcionar, copie e cole este link no seu navegador:
          </p>
          <p style="color: #3b82f6; font-size: 12px; word-break: break-all; margin: 8px 0 0;">
            ${confirmLink}
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 16px;" />
        <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
          Este email foi enviado automaticamente. Se você não criou uma conta na Dona Wilma, ignore este email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function generateRecoveryEmail(email: string, tokenHash: string): { subject: string; html: string } {
  const confirmLink = `${SITE_URL}/reset-password?token_hash=${tokenHash}&type=recovery`;

  return {
    subject: "Redefinir sua senha – Dona Wilma",
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); border-radius: 50%; padding: 16px; margin-bottom: 16px;">
            <span style="font-size: 32px;">🔑</span>
          </div>
          <h1 style="color: #18181b; font-size: 24px; font-weight: 700; margin: 0;">Dona Wilma</h1>
        </div>
        <div style="text-align: center;">
          <h2 style="color: #18181b; font-size: 20px; font-weight: 600; margin: 0 0 12px;">Redefinir sua senha</h2>
          <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
            Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.
          </p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${confirmLink}" 
             style="display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">
            Redefinir minha senha
          </a>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #71717a; font-size: 14px; line-height: 1.5; margin: 0;">
            Se o botão não funcionar, copie e cole este link no seu navegador:
          </p>
          <p style="color: #3b82f6; font-size: 12px; word-break: break-all; margin: 8px 0 0;">
            ${confirmLink}
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 16px;" />
        <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
          Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function generateGenericEmail(
  email: string,
  tokenHash: string,
  actionType: string,
  redirectTo: string
): { subject: string; html: string } {
  const subjects: Record<string, string> = {
    signup: "Confirme seu cadastro – Dona Wilma",
    magic_link: "Seu link de acesso – Dona Wilma",
    email_change: "Confirme a alteração de email – Dona Wilma",
  };

  const confirmLink = redirectTo
    ? `${redirectTo}?token_hash=${tokenHash}&type=${actionType}`
    : `${SITE_URL}?token_hash=${tokenHash}&type=${actionType}`;

  const subject = subjects[actionType] || `Ação necessária – Dona Wilma`;

  return {
    subject,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 12px; padding: 40px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #18181b; font-size: 24px; margin: 0;">Dona Wilma</h1>
        </div>
        <div style="text-align: center;">
          <p style="color: #52525b; font-size: 16px; margin: 0 0 24px;">Clique no botão abaixo para continuar:</p>
          <a href="${confirmLink}" style="display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Confirmar
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 16px;" />
        <p style="color: #a1a1aa; font-size: 12px; text-align: center;">Se você não solicitou esta ação, ignore este email.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    let parsedPayload: EmailHookPayload;

    if (hookSecret) {
      const wh = new Webhook(hookSecret.replace("v1,whsec_", ""));
      parsedPayload = wh.verify(payload, headers) as EmailHookPayload;
    } else {
      console.warn("SEND_EMAIL_HOOK_SECRET not configured - skipping verification");
      parsedPayload = JSON.parse(payload) as EmailHookPayload;
    }

    const { user, email_data } = parsedPayload;
    const actionType = email_data.email_action_type;

    console.log(`Processing email hook: type=${actionType}, email=${user.email}`);

    let emailContent: { subject: string; html: string };

    if (actionType === "invite") {
      emailContent = generateInviteEmail(user.email, email_data.token_hash);
    } else if (actionType === "recovery") {
      emailContent = generateRecoveryEmail(user.email, email_data.token_hash);
    } else {
      emailContent = generateGenericEmail(
        user.email,
        email_data.token_hash,
        actionType,
        email_data.redirect_to
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Dona Wilma <noreply@donawilma.com.br>",
        to: [user.email],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error("Resend error:", resData);
      throw new Error(`Resend error: ${JSON.stringify(resData)}`);
    }

    console.log(`Email sent successfully to ${user.email}, id: ${resData.id}`);

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in custom-auth-emails:", error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: error.message || "Failed to send email",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
