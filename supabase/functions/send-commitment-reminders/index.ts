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

// Map configured minutes to a semantic key used by the legacy reminders_sent column
function timeToKey(minutes: number): 'week' | 'day' | 'hours' | 'confirmed' | 'unknown' {
  if (minutes >= 10080) return 'week';
  if (minutes >= 1440) return 'day';
  if (minutes >= 60) return 'hours';
  return 'unknown';
}

function getTimeMessage(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  
  if (minutes >= 10080) return `⏰ Falta 1 semana!`;
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    return `⏰ ${days === 1 ? 'Falta 1 dia' : `Faltam ${days} dias`}!`;
  }
  if (minutes >= 60) {
    return `⏰ ${hours === 1 ? 'Falta 1 hora' : `Faltam ${hours} horas`}!`;
  }
  return `⏰ Faltam ${mins} minutos!`;
}

async function sendWhatsAppReminder(commitment: Commitment, minutesUntil: number) {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const recipientPhone = commitment.profiles.phone_number;

  console.log('📱 [REMINDER] WhatsApp config check:', {
    hasPhoneNumberId: !!phoneNumberId,
    hasAccessToken: !!accessToken,
    hasRecipientPhone: !!recipientPhone
  });

  if (!phoneNumberId || !accessToken || !recipientPhone) {
    console.error('❌ [REMINDER] Missing WhatsApp credentials:', {
      phoneNumberId: phoneNumberId ? 'SET' : 'MISSING',
      accessToken: accessToken ? 'SET' : 'MISSING',
      recipientPhone: recipientPhone || 'MISSING'
    });
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
    const executionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔔 [REMINDER] [${executionId}] Starting commitment reminders check at ${new Date().toISOString()}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    console.log('📱 [REMINDERS] WhatsApp credentials check:', {
      hasToken: !!whatsappToken,
      hasPhoneId: !!whatsappPhoneId
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // FASE 1: Suporte ao modo "force" para testes
    const body = await req.json().catch(() => ({}));
    const forceMode = body.force === true;
    const specificUserId = body.user_id || null;

    console.log(`[REMINDER] [${executionId}] Force mode: ${forceMode}, User ID: ${specificUserId || 'all'}`);

    if (forceMode && specificUserId) {
      // Validar credenciais WhatsApp
      if (!whatsappToken || !whatsappPhoneId) {
        console.error('❌ [REMINDERS] Missing WhatsApp credentials');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Credenciais do WhatsApp ausentes no ambiente (WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID)',
            remindersSent: 0,
            errors: 1
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Buscar telefone do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number, full_name')
        .eq('user_id', specificUserId)
        .single();

      if (!profile?.phone_number) {
        console.error('❌ [REMINDERS] User has no phone number');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Usuário não possui telefone cadastrado',
            remindersSent: 0,
            errors: 1
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Enviar mensagem de teste direta
      const testMessage = `✅ *Teste de Lembretes*\n\nOlá ${profile.full_name || 'Usuário'}! Este é um teste do sistema de lembretes via WhatsApp.\n\nSe você recebeu esta mensagem, significa que o sistema está funcionando corretamente! 🎉`;

      console.log('📤 [REMINDERS] Sending test message to:', profile.phone_number);

      try {
        const whatsappResponse = await fetch(
          `https://graph.facebook.com/v17.0/${whatsappPhoneId}/messages`,
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
              text: { body: testMessage }
            })
          }
        );

        const responseData = await whatsappResponse.json();

        if (!whatsappResponse.ok) {
          console.error('❌ [REMINDERS] WhatsApp API error:', responseData);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Erro da API WhatsApp: ${responseData.error?.message || 'Desconhecido'}`,
              remindersSent: 0,
              errors: 1
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log('✅ [REMINDERS] Test message sent successfully:', responseData);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Mensagem de teste enviada com sucesso',
            remindersSent: 1,
            errors: 0,
            phone: profile.phone_number
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('❌ [REMINDERS] Error sending test message:', error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao enviar mensagem: ${error.message}`,
            remindersSent: 0,
            errors: 1
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

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
      console.error(`[REMINDER] [${executionId}] Error fetching commitments:`, fetchError);
      throw fetchError;
    }

    if (!commitments || commitments.length === 0) {
      console.log(`[REMINDER] [${executionId}] No future commitments found`);
      return new Response(
        JSON.stringify({ success: true, remindersSent: 0, message: 'No commitments to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[REMINDER] [${executionId}] Found ${commitments.length} future commitments`);

    let remindersSent = 0;
    let errors = 0;
    let skipped = 0;

    for (const commitment of commitments as Commitment[]) {
      const scheduledAt = new Date(commitment.scheduled_at);
      const now = new Date();
      const minutesUntil = (scheduledAt.getTime() - now.getTime()) / (1000 * 60);

      console.log(`[REMINDER] [${executionId}] Processing commitment ${commitment.id} for user ${commitment.user_id}: "${commitment.title}" in ${Math.floor(minutesUntil)} minutes`);

      // Buscar configurações de lembrete do usuário
      const { data: settings, error: settingsError } = await supabase
        .from('reminder_settings')
        .select('default_reminders, send_via_whatsapp')
        .eq('user_id', commitment.user_id)
        .maybeSingle();

      if (settingsError) {
        console.error(`[REMINDER] [${executionId}] Error fetching settings for user ${commitment.user_id}:`, settingsError);
        skipped++;
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
        console.log(`[REMINDER] [${executionId}] WhatsApp disabled for user ${commitment.user_id}`);
        skipped++;
        continue;
      }

      const phoneNumber = commitment.profiles?.phone_number;
      if (!phoneNumber) {
        console.log(`[REMINDER] [${executionId}] No phone number for user ${commitment.user_id}, skipping`);
        skipped++;
        continue;
      }

      const scheduledReminders = commitment.scheduled_reminders || [];
      const remindersSentMap: Record<string, any> = (commitment as any).reminders_sent || {};

      // Verificar cada lembrete configurado
      for (const reminder of reminderSettings.default_reminders) {
        if (!reminder.enabled) continue;

        const key = timeToKey(reminder.time);
        const alreadySentInArray = scheduledReminders.find(
          (r) => r.time_minutes === reminder.time && r.sent
        );
        const alreadySentLegacy = remindersSentMap[key] === true;

        if (alreadySentInArray || alreadySentLegacy) {
          console.log(`[REMINDER] [${executionId}] ${reminder.time}min reminder already sent for ${commitment.id}`);
          continue;
        }

        // Anti-flood: se qualquer lembrete deste compromisso foi enviado nos últimos 9 minutos, pula
        const nowTs = Date.now();
        const sentRecently = scheduledReminders.some((r) => {
          if (!r.sent_at) return false;
          const diffMin = (nowTs - new Date(r.sent_at).getTime()) / (1000 * 60);
          return r.time_minutes === reminder.time && diffMin < 9;
        });
        if (sentRecently) {
          console.log(`[REMINDER] [${executionId}] Skipping ${reminder.time}min due to cooldown for commitment ${commitment.id}`);
          continue;
        }

        // Janela de envio reduzida para 10 minutos para evitar reenvios a cada execução de cron
        const shouldSend = minutesUntil <= reminder.time && minutesUntil > (reminder.time - 10);

        if (shouldSend) {
          console.log(`[REMINDER] [${executionId}] Sending ${reminder.time}min reminder for ${commitment.title} to user ${commitment.user_id} (${Math.floor(minutesUntil)}min until event)`);

          // Enviar lembrete via WhatsApp
          const sent = await sendWhatsAppReminder(commitment, minutesUntil);

          if (sent) {
            remindersSent++;
            console.log(`[REMINDER] [${executionId}] ✅ Sent ${reminder.time}min reminder for ${commitment.title}`);

            // Marcar como enviado nas duas colunas para idempotência
            const updatedReminders = [
              ...scheduledReminders.filter((r) => r.time_minutes !== reminder.time),
              {
                time_minutes: reminder.time,
                sent: true,
                sent_at: new Date().toISOString(),
              },
            ];

            const updatedLegacy = { ...remindersSentMap };
            if (key !== 'unknown') updatedLegacy[key] = true;

            const { error: updateError } = await supabase
              .from('commitments')
              .update({ scheduled_reminders: updatedReminders, reminders_sent: updatedLegacy })
              .eq('id', commitment.id);

            if (updateError) {
              console.error(`[REMINDER] [${executionId}] Error updating reminders state:`, updateError);
            } else {
              console.log(`[REMINDER] [${executionId}] Reminder marked as sent for commitment ${commitment.id}`);
            }
          } else {
            errors++;
            console.error(`[REMINDER] [${executionId}] ❌ Failed to send ${reminder.time}min reminder for ${commitment.title}`);
          }
        } else {
          console.log(`[REMINDER] [${executionId}] Skipping ${reminder.time}min reminder for ${commitment.id}: not in window (${Math.floor(minutesUntil)}min until event)`);
        }
      }
    }

    const summary = {
      executionId,
      totalCommitments: commitments.length,
      remindersSent,
      errors,
      skipped,
      timestamp: new Date().toISOString(),
    };

    console.log(`✅ [REMINDER] [${executionId}] Reminders check completed:`, summary);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...summary
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
