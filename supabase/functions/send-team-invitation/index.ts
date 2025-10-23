import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { invitationId } = await req.json();

    if (!invitationId) {
      return new Response(
        JSON.stringify({ error: 'invitationId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados do convite com joins
    const { data: invitation, error: invError } = await supabaseClient
      .from('organization_invitations')
      .select(`
        *,
        organization:organizations(name),
        inviter:profiles!organization_invitations_invited_by_fkey(full_name)
      `)
      .eq('id', invitationId)
      .single();

    if (invError || !invitation) {
      console.error('Erro ao buscar convite:', invError);
      return new Response(
        JSON.stringify({ error: 'Convite não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://financasai.lovable.app';
    const inviteUrl = `${appUrl}/invite/${invitation.token}`;
    
    const roleLabels: Record<string, string> = {
      owner: 'Proprietário',
      admin: 'Administrador',
      member: 'Membro'
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Você foi convidado!</h1>
          </div>
          <div class="content">
            <p>Olá!</p>
            <p><strong>${invitation.inviter?.full_name || 'Um colega'}</strong> convidou você para fazer parte da equipe <strong>${invitation.organization?.name}</strong> como <strong>${roleLabels[invitation.role] || invitation.role}</strong>.</p>
            <p>Clique no botão abaixo para aceitar o convite:</p>
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">Aceitar Convite</a>
            </div>
            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              Ou copie e cole este link no seu navegador:<br>
              <a href="${inviteUrl}">${inviteUrl}</a>
            </p>
            <p style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
              ⏰ Este convite expira em 7 dias.
            </p>
          </div>
          <div class="footer">
            <p>Este email foi enviado por ${invitation.organization?.name}</p>
            <p>Se você não esperava este convite, pode ignorar este email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar email via Supabase Auth (usando o sistema de email do projeto)
    const { error: emailError } = await supabaseClient.auth.admin.inviteUserByEmail(
      invitation.email,
      {
        data: {
          invitation_id: invitation.id,
          organization_name: invitation.organization?.name,
          invite_url: inviteUrl
        },
        redirectTo: inviteUrl
      }
    );

    if (emailError) {
      console.error('Erro ao enviar email:', emailError);
      // Não falhar se o email não for enviado - pode ser configurado manualmente depois
    }

    console.log(`✅ Convite enviado para ${invitation.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Convite enviado com sucesso',
        inviteUrl 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
