import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderConfig {
  time: number;
  enabled: boolean;
}

interface ScheduledReminder {
  time_minutes: number;
  sent: boolean;
  sent_at: string | null;
}

interface Commitment {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  category: string;
  location: string | null;
  participants: string | null;
  scheduled_reminders: ScheduledReminder[];
  profiles: {
    phone_number: string;
    full_name: string;
  };
}

interface ReminderSettings {
  default_reminders: ReminderConfig[];
  send_via_whatsapp: boolean;
}

function getTimeMessage(minutes: number): string {
  if (minutes >= 10080) return `⏰ Falta 1 semana!`;
  if (minutes >= 1440) return `⏰ Falta 1 dia!`;
  if (minutes >= 120) return `⏰ Faltam ${Math.floor(minutes/60)} horas!`;
  if (minutes >= 60) return `⏰ Falta 1 hora!`;
  return `⏰ Faltam ${minutes} minutos!`;
}

async function sendWhatsAppReminder(commitment: Commitment, minutesUntil: number) {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const recipientPhone = commitment.profiles.phone_number;

  if (!phoneNumberId || !accessToken || !recipientPhone) {
    console.log('[REMINDER] Missing WhatsApp config or phone number');
    return false;
  }

  const timeMessage = getTimeMessage(Math.floor(minutesUntil));
  const categoryLabels: Record<string, string> = {
    payment: "💰 Pagamento",
    meeting: "👥 Reunião",
    appointment: "🏥 Consulta",
    other: "📌 Compromisso"
  };
  
  const categoryEmoji = categoryLabels[commitment.category] || "📌 Compromisso";
  
  let message = `${timeMessage}\n\n${categoryEmoji}: *${commitment.title}*`;
  
  if (commitment.description) {
    message += `\n\n📝 ${commitment.description}`;
  }
  
  if (commitment.location) {
    message += `\n\n📍 Local: ${commitment.location}`;
  }
  
  if (commitment.participants) {
    message += `\n\n👥 Participantes: ${commitment.participants}`;
  }
  
  const scheduledDate = new Date(commitment.scheduled_at);
  const dateStr = scheduledDate.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  message += `\n\n🗓️ Data: ${dateStr}`;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: message }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[REMINDER] WhatsApp API error:', errorText);
      return false;
    }

    console.log('[REMINDER] WhatsApp reminder sent successfully:', commitment.id);
    return true;
  } catch (error) {
    console.error('[REMINDER] Error sending WhatsApp message:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[REMINDER] Starting commitment reminders job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar TODOS os compromissos futuros com informações do usuário
    const { data: commitments, error: fetchError } = await supabase
      .from('commitments')
      .select(`
        *,
        profiles!inner(phone_number, full_name)
      `)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (fetchError) {
      console.error('[REMINDER] Error fetching commitments:', fetchError);
      throw fetchError;
    }

    if (!commitments || commitments.length === 0) {
      console.log('[REMINDER] No future commitments found');
      return new Response(
        JSON.stringify({ success: true, remindersSent: 0, message: 'No commitments to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[REMINDER] Found ${commitments.length} future commitments`);

    let remindersSent = 0;
    let commitmentsProcessed = 0;

    for (const commitment of commitments as Commitment[]) {
      const scheduledAt = new Date(commitment.scheduled_at);
      const now = new Date();
      const minutesUntil = (scheduledAt.getTime() - now.getTime()) / (1000 * 60);

      console.log(`[REMINDER] Checking commitment ${commitment.id}: "${commitment.title}" in ${Math.floor(minutesUntil)} minutes`);

      // Buscar configurações de lembrete do usuário
      const { data: settings, error: settingsError } = await supabase
        .from('reminder_settings')
        .select('default_reminders, send_via_whatsapp')
        .eq('user_id', commitment.user_id)
        .maybeSingle();

      if (settingsError) {
        console.error('[REMINDER] Error fetching settings:', settingsError);
        continue;
      }

      // Usar configurações padrão se não houver configurações personalizadas
      const reminderSettings: ReminderSettings = settings || {
        default_reminders: [
          { time: 1440, enabled: true }, // 1 dia
          { time: 60, enabled: true }    // 1 hora
        ],
        send_via_whatsapp: true
      };

      if (!reminderSettings.send_via_whatsapp) {
        console.log(`[REMINDER] WhatsApp disabled for user ${commitment.user_id}`);
        continue;
      }

      const phoneNumber = commitment.profiles?.phone_number;
      if (!phoneNumber) {
        console.log(`[REMINDER] No phone number for user ${commitment.user_id}, skipping`);
        continue;
      }

      const scheduledReminders = commitment.scheduled_reminders || [];
      commitmentsProcessed++;

      // Verificar cada lembrete configurado
      for (const reminder of reminderSettings.default_reminders) {
        if (!reminder.enabled) continue;

        const alreadySent = scheduledReminders.find(
          r => r.time_minutes === reminder.time && r.sent
        );

        if (alreadySent) {
          console.log(`[REMINDER] ${reminder.time}min reminder already sent for ${commitment.id}`);
          continue;
        }

        // JANELA AMPLIADA: ±60min de tolerância para capturar lembretes mesmo sem sync perfeito
        const shouldSend = 
          minutesUntil <= reminder.time && 
          minutesUntil > (reminder.time - 60);

        if (shouldSend) {
          console.log(`[REMINDER] ✅ Sending ${reminder.time}min reminder for commitment ${commitment.id} (${Math.floor(minutesUntil)}min until event)`);

          // Enviar lembrete via WhatsApp
          const sent = await sendWhatsAppReminder(commitment, minutesUntil);

          if (sent) {
            // Marcar como enviado
            const updatedReminders = [
              ...scheduledReminders.filter(r => r.time_minutes !== reminder.time),
              { 
                time_minutes: reminder.time, 
                sent: true, 
                sent_at: new Date().toISOString() 
              }
            ];

            const { error: updateError } = await supabase
              .from('commitments')
              .update({ scheduled_reminders: updatedReminders })
              .eq('id', commitment.id);

            if (updateError) {
              console.error('[REMINDER] Error updating scheduled_reminders:', updateError);
            } else {
              remindersSent++;
              console.log(`[REMINDER] ✅ Reminder marked as sent for commitment ${commitment.id}`);
            }
          }
        } else {
          console.log(`[REMINDER] ⏭️ Skipping ${reminder.time}min reminder for ${commitment.id}: not in window (${Math.floor(minutesUntil)}min until event)`);
        }
      }
    }

    console.log(`[REMINDER] ✅ Job completed. Processed ${commitmentsProcessed} commitments, sent ${remindersSent} reminders.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        remindersSent,
        commitmentsProcessed,
        totalCommitments: commitments.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[REMINDER] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});