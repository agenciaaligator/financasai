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

// Message deduplication storage
const messageIdStore = new Map<string, number>();
const DEDUPE_WINDOW = 2 * 60 * 1000; // 2 minutes

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

// CRITICAL SECURITY: Enhanced signature verification
async function verifyWhatsAppSignature(payload: string, signature: string): Promise<boolean> {
  // NEVER allow unsigned requests
  if (!signature) {
    console.error('❌ SECURITY: Request rejected - no signature provided');
    await logSecurityEvent('NO_SIGNATURE', { timestamp: new Date().toISOString() });
    return false;
  }

  if (!whatsappAppSecret) {
    console.error('❌ SECURITY: WHATSAPP_APP_SECRET not configured');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(whatsappAppSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const calculatedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = calculatedSignature === signature;
    
    if (!isValid) {
      console.error('❌ SECURITY: Signature verification failed');
      await logSecurityEvent('INVALID_SIGNATURE', {
        signature_prefix: signature?.substring(0, 10),
        timestamp: new Date().toISOString()
      });
    }

    return isValid;
  } catch (error) {
    console.error('❌ SECURITY: Error verifying signature:', error);
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

// SECURITY: Enhanced security event logging without PII
async function logSecurityEvent(event: string, details: any): Promise<void> {
  try {
    // Hash phone numbers instead of storing plain text
    const phoneHash = details.phone ? 
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(details.phone))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16))
      : null;

    await supabase
      .from('security_events')
      .insert({
        event_type: event,
        details: {
          ...details,
          phone: undefined, // Remove plain phone
          phone_hash: phoneHash // Store hash instead
        },
        phone_number: null, // Never store plain phone
        ip_address: details.ip || null,
        user_agent: details.userAgent || null
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// SECURITY: Enhanced input validation and sanitization
function parseTransactionFromText(text: string): Partial<Transaction> | null {
  if (!text || typeof text !== 'string') return null;

  // Limit input length to prevent DoS
  const MAX_LENGTH = 500;
  if (text.length > MAX_LENGTH) {
    console.error('❌ SECURITY: Input too long, possible attack');
    return null;
  }

  // Remove any HTML/script tags to prevent XSS
  const sanitized = text.replace(/<[^>]*>/g, '').trim();
  if (sanitized !== text.trim()) {
    console.error('❌ SECURITY: HTML/script tags detected and removed');
  }

  // Padrões para identificar transações
  const patterns = [
    /^(gasto|receita|despesa|ganho)\s+(\d+(?:[\.,]\d{2})?)\s+(.+)$/i,
    /^(\d+(?:[\.,]\d{2})?)\s+(.+)$/i,
    /^([+-])(\d+(?:[\.,]\d{2})?)\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = sanitized.match(pattern);
    if (match) {
      let type: 'income' | 'expense' = 'expense';
      let amount: number;
      let title: string;

      if (match[1] && match[2] && match[3]) {
        const action = match[1].toLowerCase();
        type = ['receita', 'ganho'].includes(action) ? 'income' : 'expense';
        amount = parseFloat(match[2].replace(',', '.'));
        title = match[3];
      } else if (match[1] && match[2] && !match[3]) {
        amount = parseFloat(match[1].replace(',', '.'));
        title = match[2];
        type = 'expense';
      } else if (match[1] && match[2] && match[3]) {
        type = match[1] === '+' ? 'income' : 'expense';
        amount = parseFloat(match[2].replace(',', '.'));
        title = match[3];
      } else {
        continue;
      }

      // Validate amount limits
      const MAX_TRANSACTION_AMOUNT = 50000;
      if (amount <= 0 || amount > MAX_TRANSACTION_AMOUNT || isNaN(amount)) {
        console.error('❌ SECURITY: Invalid transaction amount');
        return null;
      }

      // Sanitize title - remove dangerous characters
      const sanitizedTitle = title
        .trim()
        .substring(0, 100)
        .replace(/[<>"']/g, '')
        .replace(/[\W\s\-.,áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/g, '');

      if (!sanitizedTitle || sanitizedTitle.length === 0) {
        console.error('❌ SECURITY: Title sanitization resulted in empty string');
        return null;
      }

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

// SECURITY: Enhanced phone number validation
async function findUserByPhone(phone: string) {
  if (!phone || typeof phone !== 'string') {
    console.error('❌ SECURITY: Invalid phone parameter');
    return null;
  }

  // Validate phone format
  const sanitizedPhone = phone.match(/^\+?[0-9]{10,20}$/)?.[0];
  if (!sanitizedPhone) {
    console.error('❌ SECURITY: Phone number failed format validation');
    return null;
  }

  try {
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => 
      u.user_metadata?.phone === sanitizedPhone || 
      u.phone === sanitizedPhone
    );
    return user;
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
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

    // CRITICAL: Verify WhatsApp signature
    const signature = req.headers.get('x-hub-signature-256');
    if (!(await verifyWhatsAppSignature(rawBody, signature || ''))) {
      await logSecurityEvent('INVALID_SIGNATURE', { 
        ip: clientIP, 
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

    console.log('WhatsApp webhook received (verified)');

    const isGPTMakerFormat = body.message || body.contactPhone;
    let from: string | undefined;
    let text: string | undefined;
    let messageId: string | undefined;

    if (isGPTMakerFormat) {
      if (body.role === 'assistant' || body.role === 'tool' || !body.message || body.message.trim() === '') {
        console.log('Ignoring GPT Maker assistant message - skipping to avoid duplication');
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: 'gpt_maker_assistant_message'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      from = body.contactPhone;
      text = body.message;
      messageId = body.messageId;
    } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      from = message.from;
      text = message.text?.body;
      messageId = message.id;
    }

    // Message deduplication
    if (messageId) {
      const now = Date.now();
      const lastSeen = messageIdStore.get(messageId);
      
      if (lastSeen && (now - lastSeen < DEDUPE_WINDOW)) {
        console.log('Duplicate message detected and ignored');
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: 'deduplicated'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      messageIdStore.set(messageId, now);
      
      for (const [id, timestamp] of messageIdStore.entries()) {
        if (now - timestamp > DEDUPE_WINDOW) {
          messageIdStore.delete(id);
        }
      }
    }

    if (from && text) {
      console.log('Message received from authenticated sender');

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
        console.log('Agent response received');

        if (agentResult.success && agentResult.response) {
          if (whatsappAccessToken && whatsappPhoneNumberId) {
            try {
              const reqId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
              
              let phoneForApi = String(from).replace(/[^\d+]/g, '');
              console.log('Phone validated for API');
              
              if (phoneForApi.includes('{') || phoneForApi.includes('}') || 
                  !/^\+?\d{10,15}$/.test(phoneForApi)) {
                console.log('Ignoring webhook with placeholder/invalid phone (GPT Maker legacy)');
                return new Response(JSON.stringify({ 
                  success: true, 
                  skipped: true
                }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              console.log('Sending response to WhatsApp Business API...');
              
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
                console.log('Message sent successfully via WhatsApp Business API');
              } else {
                let errorPayload: any = null;
                try {
                  const txt = await whatsappResponse.text();
                  try { errorPayload = JSON.parse(txt); } catch { errorPayload = { raw: txt }; }
                } catch { /* ignore */ }

                console.error('WhatsApp Business API error', {
                  status: whatsappResponse.status,
                  error: errorPayload
                });
              }
            } catch (whatsappError) {
              console.error('Error calling WhatsApp Business API:', whatsappError);
            }
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
          
        const user = await findUserByPhone(from);
        
        if (!user) {
          console.log('User not found - registration required');
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

          console.log('Transaction created');
          
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

    // Webhook verification
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
          timestamp: new Date().toISOString()
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);
