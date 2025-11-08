import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inicializar Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface MakeWebhookPayload {
  phone_number: string;
  action: 'send_auth_code' | 'send_report' | 'send_balance' | 'send_response';
  data?: any;
  message?: string;
}

function validatePhoneNumber(phone: string): boolean {
  // Remove any whitespace
  const cleaned = phone.trim();
  
  // Check format: optional + followed by 10-20 digits
  const phoneRegex = /^\+?[0-9]{10,20}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return false;
  }
  
  // Additional length validation
  if (cleaned.length < 10 || cleaned.length > 20) {
    return false;
  }
  
  return true;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: MakeWebhookPayload = await req.json();
    console.log('Make.com webhook received:', payload);

    const { phone_number, action, data, message } = payload;

    if (!phone_number) {
      throw new Error('Phone number is required');
    }

    // Validate phone number format
    if (!validatePhoneNumber(phone_number)) {
      throw new Error('Invalid phone number format. Must be 10-20 digits with optional + prefix');
    }

    // Sanitize phone number
    const sanitizedPhone = phone_number.trim().substring(0, 20);

    let responseMessage = '';

    switch (action) {
      case 'send_auth_code':
        if (data?.code) {
          responseMessage = `🔐 *Código de Autenticação*\n\n` +
                           `Seu código: *${data.code}*\n\n` +
                           `Digite: "codigo ${data.code}" para confirmar\n` +
                           `⏰ Válido por 10 minutos`;
        }
        break;

      case 'send_report':
        if (data?.report) {
          responseMessage = `📊 *Relatório Financeiro*\n\n${data.report}`;
        }
        break;

      case 'send_balance':
        if (data?.balance !== undefined) {
          const balanceEmoji = data.balance >= 0 ? '💚' : '🔴';
          responseMessage = `💰 *Seu Saldo Atual*\n\n` +
                           `📈 Receitas: R$ ${data.income?.toFixed(2) || '0.00'}\n` +
                           `📉 Despesas: R$ ${data.expenses?.toFixed(2) || '0.00'}\n` +
                           `${balanceEmoji} *Saldo: R$ ${data.balance.toFixed(2)}*`;
        }
        break;

      case 'send_response':
        responseMessage = message || 'Mensagem do sistema';
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Aqui você retornaria a mensagem para o Make.com enviar via WhatsApp
    // O Make.com deve estar configurado para enviar esta resposta via API do WhatsApp
    console.log('Response message for WhatsApp:', responseMessage);

    return new Response(JSON.stringify({
      success: true,
      response_message: responseMessage,
      phone_number: sanitizedPhone,
      action
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in Make.com webhook:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});