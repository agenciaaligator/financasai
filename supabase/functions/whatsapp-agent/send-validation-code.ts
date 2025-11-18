import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

export async function sendValidationCode(phoneNumber: string, supabase: any) {
  try {
    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`[SEND-VALIDATION-CODE] Sending code to ${phoneNumber}`);
    
    // Enviar via WhatsApp Business API
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: `🔐 *Código de Verificação Aligator*\n\nSeu código: *${code}*\n\nVálido por 10 minutos.\n\n_Não compartilhe este código._`
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
    }

    // Salvar no banco de dados
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    const { error: dbError } = await supabase
      .from('whatsapp_validation_codes')
      .insert({
        phone_number: phoneNumber,
        code,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (dbError) {
      console.error('[SEND-VALIDATION-CODE] DB Error:', dbError);
      throw dbError;
    }

    console.log(`[SEND-VALIDATION-CODE] Code sent and saved successfully`);
    return { success: true, code_sent: true };
    
  } catch (error) {
    console.error('[SEND-VALIDATION-CODE] Error:', error);
    throw error;
  }
}
