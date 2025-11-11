import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Commitment {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
}

async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  try {
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!whatsappToken || !phoneNumberId) {
      console.error('[DAILY-AGENDA] WhatsApp credentials missing');
      return false;
    }

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DAILY-AGENDA] WhatsApp API error:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[DAILY-AGENDA] Error sending WhatsApp:', error);
    return false;
  }
}

function formatCommitments(commitments: Commitment[]): string {
  if (commitments.length === 0) {
    return `🎉 *Bom dia!*

Hoje você não tem compromissos agendados.
Aproveite seu dia livre! 😊`;
  }

  let message = `📅 *Sua agenda para hoje:*\n\n`;

  commitments.forEach((commitment) => {
    const time = new Date(commitment.scheduled_at).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    const icon = getTimeIcon(time);
    message += `${icon} ${time} - ${commitment.title}`;
    
    if (commitment.location) {
      message += `\n   📍 ${commitment.location}`;
    }
    
    message += '\n\n';
  });

  if (commitments.length > 0) {
    // Contar compromissos da manhã (até 10h) e tarde (após 10h)
    const morningCount = commitments.filter(c => new Date(c.scheduled_at).getHours() <= 10).length;
    const afternoonCount = commitments.length - morningCount;

    if (morningCount > 0 && afternoonCount > 0) {
      message += `⏰ *Lembretes configurados:*\n`;
      message += `   🌅 Compromissos da manhã: avisados neste resumo\n`;
      message += `   ☀️ Compromissos da tarde: lembrete 1h antes`;
    } else if (afternoonCount > 0) {
      message += `💡 Você receberá um lembrete 1h antes de cada compromisso!`;
    } else {
      message += `💡 Seus compromissos estão próximos - fique atento! ⏰`;
    }
  }

  return message;
}

function getTimeIcon(time: string): string {
  const hour = parseInt(time.split(':')[0]);
  
  if (hour >= 6 && hour < 12) return '🌅';
  if (hour >= 12 && hour < 18) return '☀️';
  if (hour >= 18 && hour < 22) return '🌆';
  return '🌙';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📅 [DAILY-AGENDA] Starting daily agenda send');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    console.log('📱 [DAILY-AGENDA] WhatsApp credentials check:', {
      hasToken: !!whatsappToken,
      hasPhoneId: !!whatsappPhoneId
    });

    if (!whatsappToken || !whatsappPhoneId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais do WhatsApp ausentes no ambiente (WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID)',
          sent: 0,
          errors: 1
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Suporte a teste com user_id específico
    const body = await req.json().catch(() => ({}));
    const testUserId = body?.user_id;

    // Buscar usuários (todos ou apenas o de teste)
    let profilesQuery = supabaseClient
      .from('profiles')
      .select('user_id, phone_number, full_name')
      .not('phone_number', 'is', null);

    if (testUserId) {
      console.log('🧪 [DAILY-AGENDA] Test mode for user:', testUserId);
      profilesQuery = profilesQuery.eq('user_id', testUserId);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      console.error('[DAILY-AGENDA] Error fetching profiles:', profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      const message = testUserId 
        ? 'Usuário de teste não encontrado ou sem telefone cadastrado'
        : 'No users with phone numbers found';
      console.log(`ℹ️ [DAILY-AGENDA] ${message}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          sent: 0, 
          errors: testUserId ? 1 : 0, 
          error: message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: testUserId ? 400 : 200 }
      );
    }

    console.log(`👥 [DAILY-AGENDA] Found ${profiles.length} user(s) with phone numbers`);

    let messagesSent = 0;
    let errors = 0;

    // Data de hoje (início e fim do dia em SP timezone)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    for (const profile of profiles || []) {
      try {
        // ✅ BUG FIX: Buscar organizações do usuário para incluir compromissos organizacionais
        const { data: orgs } = await supabaseClient
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', profile.user_id);

        const orgIds = orgs?.map(o => o.organization_id) || [];

        // ✅ BUG FIX: Buscar compromissos PESSOAIS + DA ORGANIZAÇÃO
        let query = supabaseClient
          .from('commitments')
          .select('id, title, scheduled_at, duration_minutes, location')
          .gte('scheduled_at', startOfDay.toISOString())
          .lte('scheduled_at', endOfDay.toISOString())
          .order('scheduled_at', { ascending: true });

        // Se tiver organizações, buscar compromissos pessoais OU da organização
        if (orgIds.length > 0) {
          query = query.or(`user_id.eq.${profile.user_id},organization_id.in.(${orgIds.join(',')})`);
        } else {
          // Se não tiver organizações, buscar apenas compromissos pessoais
          query = query.eq('user_id', profile.user_id);
        }

        const { data: commitments, error: commitmentsError } = await query;

        if (commitmentsError) {
          console.error(`[DAILY-AGENDA] Error fetching commitments for user ${profile.user_id}:`, commitmentsError);
          errors++;
          continue;
        }

        const personalCount = commitments?.filter(c => c.user_id === profile.user_id).length || 0;
        const orgCount = (commitments?.length || 0) - personalCount;

        console.log(`[DAILY-AGENDA] User ${profile.user_id} (${profile.full_name}):`, {
          personalCommitments: personalCount,
          orgCommitments: orgCount,
          totalToday: commitments?.length || 0
        });

        // Formatar mensagem
        const message = formatCommitments(commitments || []);

        // Enviar WhatsApp
        console.log(`📤 [DAILY-AGENDA] Sending to ${profile.phone_number} (${profile.full_name})`);
        const sent = await sendWhatsAppMessage(profile.phone_number, message);

        if (sent) {
          messagesSent++;
          console.log(`✅ [DAILY-AGENDA] Message sent successfully to ${profile.phone_number}`);
        } else {
          errors++;
          console.error(`❌ [DAILY-AGENDA] Failed to send to ${profile.phone_number}`);
        }

        // Delay entre mensagens para respeitar rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (userError) {
        console.error(`[DAILY-AGENDA] Error processing user ${profile.user_id}:`, userError);
        errors++;
      }
    }

    const summary = {
      totalUsers: profiles?.length || 0,
      messagesSent,
      errors,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ [DAILY-AGENDA] Daily agenda send completed:', summary);

    const success = messagesSent > 0;
    const message = testUserId 
      ? (success ? `Resumo diário enviado para ${profiles[0].full_name}` : 'Falha ao enviar resumo de teste')
      : `${messagesSent} mensagens enviadas, ${errors} erros`;

    return new Response(
      JSON.stringify({ 
        success, 
        sent: messagesSent, 
        errors, 
        total: profiles?.length || 0,
        message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [DAILY-AGENDA] Failed:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
