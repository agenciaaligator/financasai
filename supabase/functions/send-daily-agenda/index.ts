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
    message += `💡 Você receberá lembretes antes de cada compromisso!`;
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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar todos os usuários com WhatsApp configurado
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('user_id, phone_number')
      .not('phone_number', 'is', null);

    if (profilesError) {
      console.error('[DAILY-AGENDA] Error fetching profiles:', profilesError);
      throw profilesError;
    }

    console.log(`[DAILY-AGENDA] Found ${profiles?.length || 0} users with phone numbers`);

    let messagesSent = 0;
    let errors = 0;

    // Data de hoje (início e fim do dia em SP timezone)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    for (const profile of profiles || []) {
      try {
        // Buscar compromissos de hoje para este usuário
        const { data: commitments, error: commitmentsError } = await supabaseClient
          .from('commitments')
          .select('id, title, scheduled_at, duration_minutes, location')
          .eq('user_id', profile.user_id)
          .gte('scheduled_at', startOfDay.toISOString())
          .lte('scheduled_at', endOfDay.toISOString())
          .order('scheduled_at', { ascending: true });

        if (commitmentsError) {
          console.error(`[DAILY-AGENDA] Error fetching commitments for user ${profile.user_id}:`, commitmentsError);
          errors++;
          continue;
        }

        console.log(`[DAILY-AGENDA] User ${profile.user_id}: ${commitments?.length || 0} commitments today`);

        // Formatar mensagem
        const message = formatCommitments(commitments || []);

        // Enviar WhatsApp
        const sent = await sendWhatsAppMessage(profile.phone_number, message);

        if (sent) {
          messagesSent++;
          console.log(`✅ [DAILY-AGENDA] Message sent to ${profile.phone_number}`);
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

    return new Response(
      JSON.stringify(summary),
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
