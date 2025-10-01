import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

interface WhatsAppMessage {
  from: string;
  text: string;
  timestamp: string;
}

interface Transaction {
  title: string;
  amount: number;
  type: 'income' | 'expense';
  description?: string;
  date: string;
  source: 'whatsapp';
  user_id: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const whatsappVerifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'WHATSAPP_VERIFY_TOKEN';
const whatsappAppSecret = Deno.env.get('WHATSAPP_APP_SECRET');
const whatsappAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const whatsappPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const whatsappBusinessAccountId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Security functions
async function verifyWhatsAppSignature(payload: string, signature: string): Promise<boolean> {
  if (!whatsappAppSecret || !signature) {
    console.warn('WhatsApp signature verification skipped - missing secret or signature');
    return true; // Allow during development, but log warning
  }

  try {
    const expectedSignature = `sha256=${await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(whatsappAppSecret + payload)
    ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))}`;
    
    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const key = identifier;
  const current = rateLimitStore.get(key);
  
  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }
  
  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  current.count++;
  return true;
}

async function logSecurityEvent(event: string, details: any): Promise<void> {
  console.log(`SECURITY EVENT: ${event}`, details);
  // You could store this in a security_logs table if needed
}

function parseTransactionFromText(text: string): Partial<Transaction> | null {
  // Security: Validate input length
  if (!text || text.length > 500) {
    return null;
  }

  // Padrões para identificar transações
  const patterns = [
    // "gasto 50 mercado" ou "receita 1000 salario"
    /^(gasto|receita|despesa|ganho)\s+(\d+(?:[\.,]\d{2})?)\s+(.+)$/i,
    // "50 mercado" (assume despesa)
    /^(\d+(?:[\.,]\d{2})?)\s+(.+)$/i,
    // "+1000 salario" (receita) ou "-50 mercado" (despesa)
    /^([+-])(\d+(?:[\.,]\d{2})?)\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = text.trim().match(pattern);
    if (match) {
      let type: 'income' | 'expense' = 'expense';
      let amount: number;
      let title: string;

      if (match[1] && match[2] && match[3]) {
        // Primeiro padrão: "gasto 50 mercado"
        const action = match[1].toLowerCase();
        type = ['receita', 'ganho'].includes(action) ? 'income' : 'expense';
        amount = parseFloat(match[2].replace(',', '.'));
        title = match[3];
      } else if (match[1] && match[2] && !match[3]) {
        // Segundo padrão: "50 mercado"
        amount = parseFloat(match[1].replace(',', '.'));
        title = match[2];
        type = 'expense'; // Assume despesa por padrão
      } else if (match[1] && match[2] && match[3]) {
        // Terceiro padrão: "+1000 salario"
        type = match[1] === '+' ? 'income' : 'expense';
        amount = parseFloat(match[2].replace(',', '.'));
        title = match[3];
      } else {
        continue;
      }

      // Security: Transaction limits
      const MAX_TRANSACTION_AMOUNT = 50000; // R$ 50,000
      if (amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
        return null;
      }

      // Security: Sanitize title
      const sanitizedTitle = title.trim().substring(0, 100).replace(/[<>]/g, '');

      return {
        title: sanitizedTitle,
        amount,
        type,
        date: new Date().toISOString().split('T')[0],
        source: 'whatsapp'
      };
    }
  }

  return null;
}

async function findUserByPhone(phone: string) {
  // Buscar usuário pelo telefone nos metadados
  const { data: users } = await supabase.auth.admin.listUsers();
  
  const user = users?.users?.find(u => 
    u.user_metadata?.phone === phone || 
    u.phone === phone
  );
  
  return user;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      await logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip: clientIP, timestamp: new Date().toISOString() });
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Rate limit exceeded' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get raw body for signature verification
    const rawBody = await req.text();
    let body;
    
    try {
      body = JSON.parse(rawBody);
    } catch {
      await logSecurityEvent('INVALID_JSON', { ip: clientIP });
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid JSON' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Security: Verify WhatsApp signature
    const signature = req.headers.get('x-hub-signature-256');
    if (!(await verifyWhatsAppSignature(rawBody, signature || ''))) {
      await logSecurityEvent('INVALID_SIGNATURE', { 
        ip: clientIP, 
        signature,
        timestamp: new Date().toISOString()
      });
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid signature' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('WhatsApp webhook received (verified):', JSON.stringify(body, null, 2));

    // Detectar formato da mensagem (GPT Maker ou WhatsApp Business API)
    const isGPTMakerFormat = body.message || body.contactPhone;
    let from: string | undefined;
    let text: string | undefined;

    if (isGPTMakerFormat) {
      // Formato GPT Maker
      from = body.contactPhone;
      text = body.message;
    } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      // Formato WhatsApp Business API padrão
      const message = body.entry[0].changes[0].value.messages[0];
      from = message.from;
      text = message.text?.body;
    }

    // Processar mensagem se houver texto
    if (from && text) {

      console.log(`Message from ${from}: ${text}`);

      // Call the WhatsApp Agent to handle the message
      try {
        const agentResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone_number: from,
            message: {
              from: from,
              body: text,
              id: body.messageId || 'unknown',
              type: 'text'
            },
            action: 'process_message'
          })
        });

        const agentResult = await agentResponse.json();
        console.log('Agent response:', agentResult);

        if (agentResult.success && agentResult.response) {
          // Enviar resposta via WhatsApp Business API oficial
          if (whatsappAccessToken && whatsappPhoneNumberId) {
            try {
              const reqId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
              
              // Sanitizar e validar telefone
              let phoneForApi = String(from).replace(/[^\d+]/g, '');
              console.log('Phone sanitization:', { original: from, sanitized: phoneForApi });
              
              // Detectar placeholders ou números inválidos (silenciosamente ignorar GPT Maker)
              if (phoneForApi.includes('{') || phoneForApi.includes('}') || 
                  !/^\+?\d{10,15}$/.test(phoneForApi)) {
                console.log('Ignoring webhook with placeholder/invalid phone (GPT Maker legacy):', from);
                // Retornar sucesso silenciosamente para não gerar erro
                return new Response(JSON.stringify({ 
                  success: true, 
                  skipped: true
                }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              console.log('Sending response to WhatsApp Business API...', {
                reqId,
                phoneNumberIdPreview: whatsappPhoneNumberId.slice(0, 4) + '***' + whatsappPhoneNumberId.slice(-4),
                phonePreview: phoneForApi.slice(0, 5) + '***',
                messageLength: agentResult.response.length
              });
              
              const whatsappResponse = await fetch(
                `https://graph.facebook.com/v18.0/${whatsappPhoneNumberId}/messages`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${whatsappAccessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: phoneForApi,
                    type: 'text',
                    text: {
                      body: agentResult.response
                    }
                  })
                }
              );

              if (whatsappResponse.ok) {
                const responseData = await whatsappResponse.json();
                console.log('Message sent successfully via WhatsApp Business API', { 
                  reqId, 
                  messageId: responseData.messages?.[0]?.id 
                });
              } else {
                let errorPayload: any = null;
                try {
                  const txt = await whatsappResponse.text();
                  try { errorPayload = JSON.parse(txt); } catch { errorPayload = { raw: txt }; }
                } catch { /* ignore */ }

                const errMsg = JSON.stringify(errorPayload).toLowerCase();
                const hints: string[] = [];
                if (whatsappResponse.status === 401) hints.push('Token inválido ou expirado. Revise WHATSAPP_ACCESS_TOKEN.');
                if (whatsappResponse.status === 404) hints.push('Phone Number ID não encontrado. Confirme WHATSAPP_PHONE_NUMBER_ID.');
                if (whatsappResponse.status === 400 && (errMsg.includes('phone') || errMsg.includes('telefone'))) {
                  hints.push('Número de telefone inválido. O número deve incluir código do país (ex: 5511...).');
                }

                console.error('WhatsApp Business API error', {
                  reqId,
                  status: whatsappResponse.status,
                  error: errorPayload,
                  hints,
                });
              }
            } catch (whatsappError) {
              console.error('Error calling WhatsApp Business API:', whatsappError);
            }
          } else {
            console.warn('WhatsApp Business API credentials not configured', {
              hasAccessToken: !!whatsappAccessToken,
              hasPhoneNumberId: !!whatsappPhoneNumberId
            });
          }
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: agentResult.response,
            agent_handled: true
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.error('Agent error:', agentResult.error);
          throw new Error(agentResult.error || 'Agent processing failed');
        }

      } catch (agentError) {
        console.error('Error calling WhatsApp Agent, falling back to legacy:', agentError);
          
          // Fallback to legacy behavior
          const user = await findUserByPhone(from);
          
          if (!user) {
            console.log(`User not found for phone: ${from}`);
            return new Response(JSON.stringify({ 
              success: false, 
              message: 'Usuário não encontrado. Registre-se primeiro no app.' 
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const transaction = parseTransactionFromText(text);
          
          if (transaction) {
            const { data, error } = await supabase
              .from('transactions')
              .insert([{
                ...transaction,
                user_id: user.id
              }])
              .select()
              .single();

            if (error) {
              console.error('Error inserting transaction:', error);
              return new Response(JSON.stringify({ 
                success: false, 
                message: 'Erro ao salvar transação' 
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            console.log('Transaction created:', data);
            
            return new Response(JSON.stringify({ 
              success: true, 
              message: `Transação registrada: ${transaction.type === 'income' ? 'Receita' : 'Despesa'} de R$ ${transaction.amount.toFixed(2)} - ${transaction.title}`,
              transaction: data
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ 
              success: false, 
              message: 'Mensagem não reconhecida. Use formatos como: "gasto 50 mercado", "receita 1000 salario", "+100 freelance" ou "-30 combustível"'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
      }
    }

    // Verificação de webhook do WhatsApp
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === whatsappVerifyToken) {
        console.log('Webhook verified');
        return new Response(challenge, { status: 200 });
      } else {
        await logSecurityEvent('WEBHOOK_VERIFICATION_FAILED', { 
          mode, 
          token,
          timestamp: new Date().toISOString()
        });
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Webhook received' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in WhatsApp webhook:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);