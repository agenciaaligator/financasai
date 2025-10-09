import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Starting commitment reminders check...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar compromissos que:
    // 1. Estão entre 24h e 23h antes do horário agendado
    // 2. Ainda não tiveram lembrete enviado (reminder_sent = false)
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

    console.log('🔍 Searching commitments between:', {
      start: in23Hours.toISOString(),
      end: in24Hours.toISOString()
    });

    const { data: commitments, error } = await supabase
      .from('commitments')
      .select(`
        *,
        profiles!inner(phone_number, full_name)
      `)
      .eq('reminder_sent', false)
      .gte('scheduled_at', in23Hours.toISOString())
      .lte('scheduled_at', in24Hours.toISOString());

    if (error) {
      console.error('❌ Error fetching commitments:', error);
      throw error;
    }

    console.log(`📋 Found ${commitments?.length || 0} commitments to remind`);

    if (!commitments || commitments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar lembretes via WhatsApp
    let successCount = 0;
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;

    for (const commitment of commitments) {
      try {
        const profile = commitment.profiles;
        if (!profile?.phone_number) {
          console.log(`⚠️ No phone for commitment ${commitment.id}`);
          continue;
        }

        // Formatar data e hora
        const scheduledDate = new Date(commitment.scheduled_at);
        const formattedDate = scheduledDate.toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });

        const categoryIcons = {
          payment: '💳',
          meeting: '👥',
          appointment: '🏥',
          other: '📌'
        };
        const icon = categoryIcons[commitment.category as keyof typeof categoryIcons] || '📌';

        const message = `🔔 *Lembrete de Compromisso*\n\n` +
                       `${icon} *${commitment.title}*\n` +
                       `🗓️ ${formattedDate}\n` +
                       `${commitment.description ? `📝 ${commitment.description}\n` : ''}\n` +
                       `⏰ Faltam aproximadamente 24 horas!\n\n` +
                       `Para remarcar: "remarcar compromisso"`;

        // Enviar mensagem via WhatsApp
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: profile.phone_number,
              type: 'text',
              text: { body: message }
            })
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error(`❌ Failed to send reminder for ${commitment.id}:`, error);
          continue;
        }

        console.log(`✅ Reminder sent for commitment ${commitment.id} to ${profile.phone_number}`);

        // Marcar como enviado
        const { error: updateError } = await supabase
          .from('commitments')
          .update({ reminder_sent: true })
          .eq('id', commitment.id);

        if (updateError) {
          console.error(`❌ Failed to update reminder_sent for ${commitment.id}:`, updateError);
        } else {
          successCount++;
        }

      } catch (error) {
        console.error(`❌ Error processing commitment ${commitment.id}:`, error);
      }
    }

    console.log(`✅ Reminders sent: ${successCount}/${commitments.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reminders_sent: successCount,
        total_found: commitments.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
