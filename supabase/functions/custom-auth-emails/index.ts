import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'signup' | 'recovery' | 'confirmation';
  email: string;
  token_hash?: string;
  redirect_to?: string;
  site_url?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, email, token_hash, redirect_to, site_url }: EmailRequest = await req.json();

    let subject = "";
    let html = "";
    
    const confirmUrl = `${site_url}/auth/v1/verify?token=${token_hash}&type=signup&redirect_to=${redirect_to}`;

    switch (type) {
      case 'signup':
      case 'confirmation':
        subject = "🎉 Confirme seu cadastro no FinançasAI";
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6, #06b6d4); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
              .button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: white; margin: 0;">💰 FinançasAI</h1>
                <p style="color: white; margin: 10px 0 0 0;">Gestão Financeira Inteligente</p>
              </div>
              <div class="content">
                <h2 style="color: #1f2937;">Bem-vindo ao FinançasAI! 🎉</h2>
                <p>Olá! Estamos muito felizes em ter você conosco.</p>
                <p>Para começar a usar sua conta e ter acesso a todas as funcionalidades do FinançasAI, você precisa confirmar seu endereço de email clicando no botão abaixo:</p>
                
                <center>
                  <a href="${confirmUrl}" class="button">
                    ✅ Confirmar minha conta
                  </a>
                </center>
                
                <p><strong>O que você pode fazer com o FinançasAI:</strong></p>
                <ul>
                  <li>📊 Acompanhar suas receitas e despesas</li>
                  <li>📈 Ver relatórios detalhados das suas finanças</li>
                  <li>🤖 Usar IA para análises inteligentes</li>
                  <li>📱 Integração com WhatsApp</li>
                  <li>🏷️ Organizar por categorias personalizadas</li>
                </ul>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  Se você não criou uma conta no FinançasAI, pode ignorar este email com segurança.
                </p>
              </div>
              <div class="footer">
                <p>© 2024 FinançasAI - Sua gestão financeira mais inteligente</p>
                <p>Este email foi enviado automaticamente, não responda.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;
        
      case 'recovery':
        subject = "🔐 Redefinir senha - FinançasAI";
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6, #06b6d4); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; }
              .button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: white; margin: 0;">💰 FinançasAI</h1>
                <p style="color: white; margin: 10px 0 0 0;">Redefinição de Senha</p>
              </div>
              <div class="content">
                <h2 style="color: #1f2937;">Redefinir sua senha 🔐</h2>
                <p>Olá!</p>
                <p>Recebemos uma solicitação para redefinir a senha da sua conta no FinançasAI.</p>
                <p>Se foi você quem solicitou, clique no botão abaixo para criar uma nova senha:</p>
                
                <center>
                  <a href="${confirmUrl}" class="button">
                    🔑 Redefinir minha senha
                  </a>
                </center>
                
                <p style="color: #dc2626; background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <strong>⚠️ Importante:</strong> Este link expira em 1 hora por motivos de segurança.
                </p>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  Se você não solicitou a redefinição de senha, pode ignorar este email com segurança. Sua senha permanecerá inalterada.
                </p>
              </div>
              <div class="footer">
                <p>© 2024 FinançasAI - Sua gestão financeira mais inteligente</p>
                <p>Este email foi enviado automaticamente, não responda.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;
    }

    const emailResponse = await resend.emails.send({
      from: "FinançasAI <noreply@financasai.com.br>",
      to: [email],
      subject: subject,
      html: html,
    });

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Erro ao enviar email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);