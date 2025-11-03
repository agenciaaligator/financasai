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

function timeToKey(minutes: number): 'week' | 'day' | 'hours' | 'confirmed' | 'unknown' {
  if (minutes >= 10080) return 'week';
  if (minutes >= 1440) return 'day';
  if (minutes >= 60) return 'hours';
  return 'unknown';
}

function getTimeMessage(minutes: number): string {
  const hours = Math.round(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (minutes >= 10080) return `⏰ Falta 1 semana!`;
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return `⏰ ${days === 1 ? 'Falta 1 dia' : `Faltam ${days} dias`}!`;
  }
  if (minutes >= 60) {
    return `⏰ ${hours === 1 ? 'Falta 1 hora' : `Faltam ${hours} horas`}!`;
  }
  return `⏰ Faltam ${mins} minutos!`;
}

async function sendWhatsAppReminder(
  commitment: Commitment,
  minutesUntil: number,
  forceMode: boolean = false
): Promise<{ success: boolean; deliverability?: string; error?: string }> {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const rawPhone = commitment.profiles.phone_number;

  // Normalizar para E.164 (apenas dígitos)
  const recipientPhone = rawPhone?.replace(/\D/g, '') || '';

  console.log('📱 [REMINDER] WhatsApp config check:', {
    hasPhoneNumberId: !!phoneNumberId,
    hasAccessToken: !!accessToken,
    hasRecipientPhone: !!recipientPhone,
    rawPhone,
    recipientPhone,
    forceMode
  });

  if (!phoneNumberId || !accessToken || !recipientPhone) {
    console.error('❌ [REMINDER] Missing WhatsApp credentials:', {
      phoneNumberId: phoneNumberId ? 'SET' : 'MISSING',
      accessToken: accessToken ? 'SET' : 'MISSING',
      recipientPhone: recipientPhone || 'MISSING'
    });
    return { success: false, error: 'Missing credentials or phone' };
  }

  if (recipientPhone.length < 10) {
    console.error('❌ [REMINDER] Invalid phone format:', recipientPhone);
    return { success: false, error: 'Invalid phone number format (too short)' };
  }

  const timeMessage = getTimeMessage(Math.round(minutesUntil));
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

  if (forceMode) {
    console.log(`🔔 [FORCE REMINDER] Sending immediate test to ${recipientPhone} for: "${commitment.title}"`);
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  // Tentar enviar mensagem de texto normal
  const textPayload = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'text',
    text: { body: message }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(textPayload),
    });

    const result = await response.json();

    if (!response.ok || !result.messages?.[0]?.id) {
      console.error('❌ [REMINDER] WhatsApp API error:', {
        status: response.status,
        result: JSON.stringify(result)
      });
      
      // Se for erro 470/131026 (fora da janela de 24h) e estiver em modo force, tentar template
      const errorCode = result?.error?.code;
      const errorSubcode = result?.error?.error_subcode;
      
      if (forceMode && (errorCode === 470 || errorSubcode === 131026 || result?.error?.message?.includes('template'))) {
        console.log(`🔄 [FALLBACK] Trying template message for ${recipientPhone}...`);
        
        // Usar variáveis de ambiente para template de teste
        const templateName = Deno.env.get('WHATSAPP_TEMPLATE_TEST_NAME') || 'hello_word';
        const templateLang = Deno.env.get('WHATSAPP_TEMPLATE_LANG') || 'pt_BR';
        
        const templatePayload = {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: templateLang
            }
          }
        };

        const templateResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templatePayload),
        });

        const templateResult = await templateResponse.json();

        if (!templateResponse.ok || !templateResult.messages?.[0]?.id) {
          console.error('❌ [FALLBACK] Template also failed:', {
            status: templateResponse.status,
            result: JSON.stringify(templateResult)
          });
          return { 
            success: false,
            code: 'whatsapp_send_failed',
            status: templateResponse.status,
            error: templateResult?.error?.message || 'Template send failed',
            error_type: templateResult?.error?.type,
            deliverability: 'failed'
          };
        }

        console.log(`✅ [FALLBACK] Template sent successfully to ${recipientPhone}`, {
          message_id: templateResult.messages[0].id
        });
        return { 
          success: true, 
          deliverability: 'sent_template',
          message_id: templateResult.messages[0].id
        };
      }
      
      return { success: false, error: result?.error?.message || 'WhatsApp API error' };
    }

    console.log(`✅ [REMINDER] WhatsApp message sent successfully to ${recipientPhone}`, {
      message_id: result.messages[0].id
    });
    return { 
      success: true, 
      deliverability: 'sent_text',
      message_id: result.messages[0].id
    };
  } catch (error) {
    console.error('❌ [REMINDER] Error sending WhatsApp message:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const executionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const forceMode = body.force === true;
    const specificUserId = body.user_id || null;

    console.log(`🔔 [REMINDER] [${executionId}] Starting commitment reminders check at ${new Date().toISOString()}`);
    console.log(`[REMINDER] [${executionId}] Request details:`, {
      method: req.method,
      hasBody: !!body,
      forceMode,
      specificUserId: specificUserId || 'none'
    });

    if (forceMode && specificUserId) {
      if (!whatsappToken || !whatsappPhoneId) {
        console.error('❌ [REMINDERS] Missing WhatsApp credentials');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'missing_whatsapp_secrets',
            remindersSent: 0,
            errors: 1
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Buscar profile do usuário para criar compromisso sintético
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone_number, full_name')
        .eq('user_id', specificUserId)
        .single();

      if (profileError || !profile?.phone_number) {
        console.error('❌ [TEST MODE] User profile missing or no phone number');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Perfil sem número de telefone configurado',
            suggestion: 'Configure seu telefone no perfil antes de testar lembretes'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Tentar buscar compromisso real futuro
      const { data: testCommitment, error: commitmentError } = await supabase
        .from('commitments')
        .select(`
          *,
          profiles!inner(phone_number, full_name)
        `)
        .eq('user_id', specificUserId)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      let commitmentToUse = testCommitment;

      // Se não encontrou compromisso real, criar um sintético para teste
      if (!testCommitment) {
        console.log('📝 [TEST MODE] No future commitment found - creating synthetic test commitment');
        const now = new Date();
        const testTime = new Date(now.getTime() + 65 * 60000); // 65 minutos no futuro
        
        commitmentToUse = {
          id: 'synthetic-test-' + Date.now(),
          user_id: specificUserId,
          title: '🧪 Teste de Lembrete',
          description: 'Esta é uma mensagem de teste do sistema de lembretes',
          scheduled_at: testTime.toISOString(),
          category: 'other',
          location: null,
          participants: null,
          scheduled_reminders: [],
          profiles: profile
        };
      }

      console.log(`📤 [TEST MODE] Sending test message for commitment: ${commitmentToUse.title}`);
      const result = await sendWhatsAppReminder(commitmentToUse, 60, true);

      return new Response(
        JSON.stringify({ 
          success: result.success,
          deliverability: result.deliverability,
          message_id: result.message_id,
          status: result.status,
          error: result.error,
          error_type: result.error_type,
          code: result.code,
          message: result.success 
            ? `Teste enviado (${result.deliverability})` 
            : `Falha: ${result.error}`,
          commitment: {
            id: commitmentToUse.id,
            title: commitmentToUse.title,
            scheduled_at: commitmentToUse.scheduled_at,
            is_synthetic: !testCommitment
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar TODOS os compromissos futuros
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

      const reminderSettings: ReminderSettings = settings || {
        default_reminders: [
          { time: 1440, enabled: true },
          { time: 120, enabled: true },
          { time: 60, enabled: true }
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

        const windowSize = 30;
        const windowStart = reminder.time - windowSize;
        const windowEnd = reminder.time;
        const shouldSend = minutesUntil <= windowEnd && minutesUntil > windowStart;
        
        console.log('[Reminder Debug] Window check:', { 
          commitmentId: commitment.id,
          minutesUntil, 
          reminderTime: reminder.time,
          windowStart,
          windowEnd,
          shouldSend 
        });

        if (shouldSend) {
          console.log(`🔔 [REMINDER] [${executionId}] ENVIANDO: ${reminder.time}min para "${commitment.title}" (faltam ${Math.floor(minutesUntil)}min)`);

          const result = await sendWhatsAppReminder(commitment, minutesUntil, false);

          if (result.success) {
            remindersSent++;
            console.log(`[REMINDER] [${executionId}] ✅ Sent ${reminder.time}min reminder for ${commitment.title}`);

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
            console.error(`[REMINDER] [${executionId}] ❌ Failed to send ${reminder.time}min reminder for ${commitment.title}: ${result.error}`);
          }
        } else {
          console.log(`⏭️ [REMINDER] [${executionId}] PULANDO: ${reminder.time}min para "${commitment.title}" (faltam ${Math.floor(minutesUntil)}min, janela: ${windowStart}-${windowEnd})`);
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
    console.error('Error in send-commitment-reminders function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
