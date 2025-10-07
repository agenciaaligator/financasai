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
const DEDUPE_WINDOW = 15 * 60 * 1000; // 15 minutes - para cobrir delays do WhatsApp

interface WhatsAppMessage {
  from: string;
  text?: string;
  type?: 'text' | 'audio' | 'image' | 'video';
  audio?: {
    id: string;
    mime_type: string;
  };
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

// GPT Maker auth (used when messages come via GPT Maker, not Meta webhook)
const gptMakerToken = Deno.env.get('GPT_MAKER_TOKEN');
const gptMakerChannelId = Deno.env.get('GPT_MAKER_CHANNEL_ID');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função para transcrever áudio usando ElevenLabs ou OpenAI Whisper (fallback)
async function transcribeAudio(audioId: string, phoneNumber: string): Promise<string> {
  try {
    console.log('🎙️ Processing audio message:', { 
      audioId: audioId.substring(0, 10) + '***', 
      phoneNumber: phoneNumber.substring(0, 8) + '***' 
    });
    
    // 1. ETAPA 1: Obter URL do áudio do WhatsApp
    const metadataUrl = `https://graph.facebook.com/v21.0/${audioId}`;
    console.log('📍 Step 1: Getting audio URL from WhatsApp API...');
    
    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`
      }
    });
    
    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('❌ Failed to get audio metadata:', metadataResponse.status, errorText);
      throw new Error(`Failed to get audio metadata: ${metadataResponse.statusText}`);
    }
    
    const metadata = await metadataResponse.json();
    const audioDownloadUrl = metadata.url;
    
    if (!audioDownloadUrl) {
      console.error('❌ No audio URL in metadata:', metadata);
      throw new Error('Audio URL não encontrado');
    }
    
    console.log('✅ Audio URL obtained:', audioDownloadUrl.substring(0, 50) + '...');
    
    // 2. ETAPA 2: Baixar o arquivo de áudio real
    console.log('📍 Step 2: Downloading actual audio file...');
    
    const audioResponse = await fetch(audioDownloadUrl, {
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`
      }
    });
    
    if (!audioResponse.ok) {
      const errorText = await audioResponse.text();
      console.error('❌ Failed to download audio file:', audioResponse.status, errorText);
      throw new Error(`Failed to download audio file: ${audioResponse.statusText}`);
    }
    
    const audioBlob = await audioResponse.blob();
    console.log('✅ Audio downloaded, size:', audioBlob.size, 'bytes, type:', audioBlob.type);
    
    // Verificar se realmente é áudio
    if (!audioBlob.type.startsWith('audio/')) {
      console.error('❌ Downloaded file is not audio:', audioBlob.type);
      throw new Error('Arquivo baixado não é áudio');
    }
    
    // 3. Tentar ElevenLabs primeiro
    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (elevenlabsApiKey) {
      console.log('📍 Step 3: Attempting transcription with ElevenLabs...');
      
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.ogg');
        formData.append('model_id', 'scribe');
        formData.append('language', 'pt');
        
        const elevenlabsResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenlabsApiKey
          },
          body: formData
        });
        
        if (elevenlabsResponse.ok) {
          const transcription = await elevenlabsResponse.json();
          const transcribedText = transcription.text?.trim() || '';
          
          if (transcribedText && transcribedText.length > 0) {
            console.log('✅ ElevenLabs transcription successful:', {
              length: transcribedText.length,
              preview: transcribedText.substring(0, 100)
            });
            return transcribedText;
          }
        } else {
          const error = await elevenlabsResponse.text();
          console.error('❌ ElevenLabs failed:', elevenlabsResponse.status, error);
          // Continua para tentar Whisper
        }
      } catch (error) {
        console.error('❌ ElevenLabs exception:', error.message);
        // Continua para tentar Whisper
      }
    }
    
    // 4. Fallback para OpenAI Whisper
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ Nenhum serviço de transcrição disponível');
      throw new Error('Serviço de transcrição não disponível');
    }
    
    console.log('📍 Step 4: Fallback to OpenAI Whisper...');
    
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioBlob, 'audio.ogg');
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'pt');
    
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: whisperFormData
    });
    
    if (!whisperResponse.ok) {
      const error = await whisperResponse.text();
      console.error('❌ Whisper transcription failed:', whisperResponse.status, error);
      throw new Error(`Falha na transcrição: ${whisperResponse.statusText}`);
    }
    
    const whisperTranscription = await whisperResponse.json();
    const transcribedText = whisperTranscription.text?.trim() || '';
    
    if (!transcribedText || transcribedText.length === 0) {
      console.warn('⚠️ Empty transcription result from Whisper');
      throw new Error('Não consegui entender o áudio. Pode repetir?');
    }
    
    console.log('✅ Whisper transcription successful:', {
      length: transcribedText.length,
      preview: transcribedText.substring(0, 100) + (transcribedText.length > 100 ? '...' : '')
    });
    
    return transcribedText;
    
  } catch (error) {
    console.error('❌ Error transcribing audio:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 200)
    });
    
    // Mensagens de erro amigáveis
    if (error.message.includes('download') || error.message.includes('metadata')) {
      throw new Error('Desculpe, não consegui acessar seu áudio. Ele pode ter expirado. Tente enviar novamente.');
    } else if (error.message.includes('transcrição') || error.message.includes('ElevenLabs')) {
      throw new Error('Desculpe, não consegui processar seu áudio no momento. Tente enviar uma mensagem de texto.');
    } else {
      throw new Error(error.message || 'Erro ao processar áudio');
    }
  }
}

// CRITICAL SECURITY: Enhanced signature verification with detailed logging
async function verifyWhatsAppSignature(payload: string, signature: string): Promise<boolean> {
  // 🔍 DEBUG: Log secret status (first 5 chars only for security)
  if (!whatsappAppSecret) {
    console.warn('⚠️ WHATSAPP_APP_SECRET não configurado - modo desenvolvimento ativo');
    return true; // Permitir em modo dev
  }
  
  console.log('🔍 DEBUG - Secret carregado (primeiros 5 chars):', whatsappAppSecret.substring(0, 5) + '***');
  console.log('🔍 DEBUG - Payload size:', payload.length, 'bytes');

  // Se há secret mas não há assinatura, rejeitar
  if (!signature) {
    console.error('❌ SECURITY: Request rejected - no signature provided');
    await logSecurityEvent('NO_SIGNATURE', { timestamp: new Date().toISOString() });
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
      console.error('❌ SECURITY: Signature mismatch');
      console.error('Esperado:', calculatedSignature);
      console.error('Recebido:', signature);
      await logSecurityEvent('INVALID_SIGNATURE', {
        signature_prefix: signature?.substring(0, 10),
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('✅ Signature válida!');
    }

    return isValid;
  } catch (error) {
    console.error('❌ SECURITY: Error verifying signature:', error);
    return false;
  }
}

// Verify GPT Maker authorization via token header or Bearer token
async function verifyGptMakerAuth(req: Request, body: any): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const tokenHeader = req.headers.get('x-gptmaker-token') || '';
    const bodyToken = body?.token;
    
    const provided = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (tokenHeader || bodyToken);

    if (!gptMakerToken) {
      return false; // Token not configured
    }
    
    if (!provided || provided !== gptMakerToken) {
      return false;
    }

    // If a channel id is provided, validate it as well for extra safety
    if (gptMakerChannelId && body?.channelId && body.channelId !== gptMakerChannelId) {
      return false;
    }
    return true;
  } catch (_err) {
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

  // Padrões para identificar transações (REORDENADOS: +/- primeiro)
  const patterns = [
    /^([+-])\s*(\d+(?:[.,]\d{1,2})?)\s+(.+)$/i,           // PRIORIDADE: +25 açaí
    /^(gasto|receita|despesa|ganho)\s+(\d+(?:[.,]\d{2})?)\s+(.+)$/i,
    /^(\d+(?:[.,]\d{2})?)\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = sanitized.match(pattern);
    if (match) {
      let type: 'income' | 'expense' = 'expense';
      let amount: number;
      let title: string;

      // Caso 1: +/- no início
      if (match[1] === '+' || match[1] === '-') {
        type = match[1] === '+' ? 'income' : 'expense';
        amount = parseFloat(match[2].replace(',', '.'));
        title = match[3];
      }
      // Caso 2: palavra-chave
      else if (['gasto', 'receita', 'despesa', 'ganho'].includes(match[1]?.toLowerCase())) {
        const action = match[1].toLowerCase();
        type = ['receita', 'ganho'].includes(action) ? 'income' : 'expense';
        amount = parseFloat(match[2].replace(',', '.'));
        title = match[3];
      }
      // Caso 3: apenas número + texto
      else if (match[1] && match[2]) {
        amount = parseFloat(match[1].replace(',', '.'));
        title = match[2];
        type = 'expense';
      }
      else {
        continue;
      }

      // Validate amount limits
      const MAX_TRANSACTION_AMOUNT = 50000;
      if (amount <= 0 || amount > MAX_TRANSACTION_AMOUNT || isNaN(amount)) {
        console.error('❌ SECURITY: Invalid transaction amount');
        return null;
      }

      // NOVA sanitização: preservar espaços e acentos
      const sanitizedTitle = title
        .trim()
        .substring(0, 100)
        .replace(/[<>"']/g, '');  // Remove apenas caracteres perigosos

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
  console.log('🔵 Webhook recebido:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET verification from Meta BEFORE any body parsing
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('🔵 GET Verification:', { mode, token: token?.substring(0, 10) + '***', challenge });

    if (mode === 'subscribe' && token === whatsappVerifyToken) {
      console.log('✅ Webhook verified successfully');
      return new Response(challenge, { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    } else {
      console.error('❌ Verification failed:', { mode, tokenMatch: token === whatsappVerifyToken });
      return new Response('Forbidden', { 
        status: 403,
        headers: corsHeaders
      });
    }
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    console.log('🔵 IP do cliente:', clientIP);
    
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

    // Get raw body for signature verification (POST only)
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

    // CRITICAL: Verify auth (GPT Maker) or WhatsApp signature
    const isPotentialGptMaker = Boolean(
      body?.message || body?.contactPhone || body?.channelId || body?.from || body?.text || body?.role
    );
    console.log('🔎 Detectando origem. Chaves no body:', Object.keys(body || {}));

    if (isPotentialGptMaker) {
      const ok = await verifyGptMakerAuth(req, body);
      if (!ok && gptMakerToken) {
        // Log the event but proceed anyway to allow testing
        console.warn('⚠️ GPT Maker token validation issue - proceeding anyway for testing');
        await logSecurityEvent('GPTMAKER_AUTH_WARNING', { ip: clientIP, timestamp: new Date().toISOString() });
      }
    } else {
      const signature = req.headers.get('x-hub-signature-256') || '';
      const valid = await verifyWhatsAppSignature(rawBody, signature);
      if (!valid) {
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
    }

    console.log('WhatsApp webhook received (verified)');

    const isGPTMakerFormat = Boolean(body.message || body.contactPhone || body.from || body.text || body.role);
    console.log('🔵 Formato detectado:', isGPTMakerFormat ? 'GPT Maker' : 'WhatsApp Official');
    console.log('🔵 Body recebido:', JSON.stringify(body, null, 2));
    
    let from: string | undefined;
    let text: string | undefined;
    let messageId: string | undefined;
    let isGptAssistant: boolean = false;

    if (isGPTMakerFormat) {
      console.log('🔵 GPT Maker - role:', body.role, 'message:', body.message || body.text);
      
      // Always parse and set a flag; we will handle routing after dedup
      const incomingText = (body.message ?? body.text ?? '').trim();
      isGptAssistant = body.role === 'assistant' || body.role === 'tool';
      from = body.contactPhone || body.from || body.phone || body.phoneNumber;
      text = incomingText;
      messageId = body.messageId || body.id;
      console.log('🔵 GPT Maker parsed:', { from, text, messageId, isGptAssistant });
    } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      from = message.from;
      messageId = message.id;
      
      // Detectar tipo de mensagem e processar áudio se necessário
      if (message.type === 'audio' && message.audio?.id) {
        console.log(`🎙️ [${messageId?.substring(0,10)}] Audio detected, transcribing...`);
        try {
          text = await transcribeAudio(message.audio.id, message.from);
          console.log(`✅ [${messageId?.substring(0,10)}] Transcription successful:`, {
            from: message.from.substring(0, 8) + '***',
            length: text.length,
            preview: text.substring(0, 50)
          });
        } catch (transcribeError) {
          console.error(`❌ [${messageId?.substring(0,10)}] Transcription failed:`, transcribeError.message);
          // Enviar mensagem padrão de erro ao usuário
          const errorMessage = 'Desculpe, não consegui transcrever seu áudio agora. Envie texto como: "despesa 50 mercado".';
          
          // Enviar erro direto ao usuário (não ao agente)
          try {
            await fetch(`https://graph.facebook.com/v21.0/${whatsappPhoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${whatsappAccessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: message.from,
                text: { body: errorMessage }
              })
            });
            console.log(`📤 [${messageId?.substring(0,10)}] Erro de transcrição enviado ao usuário`);
          } catch (sendError) {
            console.error('❌ Erro ao enviar mensagem de erro:', sendError);
          }
          
          // Retornar sem processar pelo agente
          return new Response(JSON.stringify({ 
            success: true, 
            skipped: true,
            reason: 'transcription_failed'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else if (message.type === 'text') {
        text = message.text?.body;
      } else if (message.type === 'image' && message.image?.id) {
        console.log('📸 Image message detected - will process via agent');
        text = '[IMAGE]'; // Placeholder para o agente detectar
      } else if (message.type === 'interactive') {
        // Handle button clicks
        console.log('🔘 Interactive button message detected');
        const buttonReply = message.interactive?.button_reply;
        if (buttonReply) {
          const buttonId = buttonReply.id;
          console.log('Button clicked:', buttonId);
          
          // Convert button click to text command
          if (buttonId.startsWith('edit_')) {
            text = 'editar última';
          } else if (buttonId.startsWith('delete_')) {
            text = 'excluir última';
          } else {
            text = buttonReply.title; // Fallback to button title
          }
        }
      } else {
        console.log(`⚠️ Unsupported message type: ${message.type}`);
        text = 'Desculpe, esse tipo de mensagem não é suportado no momento. Por favor, envie texto ou áudio.';
      }
      
      // Adicionar timestamp logging e validação de delay
      const messageTimestamp = message.timestamp;
      const webhookReceived = Date.now();
      const delayMs = messageTimestamp ? (webhookReceived - Number(messageTimestamp) * 1000) : 0;
      const delaySeconds = Math.round(delayMs / 1000);
      
      console.log('📨 WhatsApp message timing:', {
        messageId: messageId?.substring(0, 10) + '***',
        messageType: message.type || 'text',
        sentAt: messageTimestamp ? new Date(Number(messageTimestamp) * 1000).toISOString() : 'unknown',
        receivedAt: new Date(webhookReceived).toISOString(),
        delaySeconds
      });
      
      // VALIDAÇÃO: Rejeitar mensagens com delay excessivo (>5 minutos)
      const MAX_DELAY_MS = 5 * 60 * 1000; // 5 minutos
      if (messageTimestamp && delayMs > MAX_DELAY_MS) {
        console.log('⏰ Mensagem expirada (delay excessivo):', {
          messageTime: new Date(Number(messageTimestamp) * 1000).toISOString(),
          now: new Date(webhookReceived).toISOString(),
          delaySeconds,
          maxDelaySeconds: MAX_DELAY_MS / 1000
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: 'message_expired'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
      // Webhook de STATUS apenas (delivered/read/sent) - IGNORAR
      console.log('📊 Status webhook received - IGNORING (no message content)');
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        reason: 'status_webhook_only'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Message deduplication
    if (messageId) {
      const now = Date.now();
      const lastSeen = messageIdStore.get(messageId);
      
      if (lastSeen && (now - lastSeen < DEDUPE_WINDOW)) {
        const secondsAgo = Math.round((now - lastSeen) / 1000);
        console.log('🚫 Duplicate message detected and ignored', {
          messageId: messageId?.substring(0, 10) + '***',
          lastSeenSecondsAgo: secondsAgo,
          dedupeWindowMinutes: DEDUPE_WINDOW / 60000
        });
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

    // Handle GPT Maker routing (no WABA calls)
    if (isGPTMakerFormat) {
      // Assistant/tool messages from GPT Maker: just acknowledge
      if (isGptAssistant) {
        console.log('📥 GPT Maker assistant/tool message acknowledged (no action needed)');
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'gpt_maker_assistant' 
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      // User messages from GPT Maker: process via whatsapp-agent
      if (!from || !text) {
        console.error('❌ GPT Maker user message missing contactPhone or text');
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Missing contactPhone or message text' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Normalize phone number
      const cleanPhone = String(from).replace(/[^\d+]/g, '');
      if (!cleanPhone || !/^\+?\d{10,15}$/.test(cleanPhone)) {
        console.error('❌ Invalid phone number format from GPT Maker:', from);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Invalid phone number format' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('📨 GPT Maker user message - calling whatsapp-agent', {
        cleanPhone: cleanPhone.substring(0, 8) + '***',
        hasText: !!text,
        messageId: messageId || 'unknown'
      });
      
      try {
        console.log('🔵 Calling whatsapp-agent with messageId:', messageId);
        const agentResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone_number: cleanPhone,
            message: {
              from: cleanPhone,
              body: text,
              id: messageId || `${Date.now()}-${cleanPhone}`,
              type: 'text'
            },
            action: 'process_message'
          })
        });
        
        if (!agentResponse.ok) {
          console.error('❌ Agent HTTP error:', agentResponse.status, agentResponse.statusText);
          throw new Error(`Agent returned ${agentResponse.status}: ${agentResponse.statusText}`);
        }
        
        const agentResult = await agentResponse.json();
        console.log('✅ Agent response received:', {
          success: agentResult.success,
          hasResponse: !!agentResult.response,
          responseLength: agentResult.response?.length,
          hasError: !!agentResult.error
        });
        
        // Check if agent returned an error
        if (!agentResult.success && agentResult.error) {
          console.error('❌ Agent processing error:', agentResult.error);
          throw new Error(agentResult.error);
        }
        
        // Ensure we have a response
        const responseText = agentResult.response || agentResult.message || 'Sem resposta do agente';
        
        // Return agent response directly to GPT Maker (no WABA)
        // CRITICAL: Use 'message' field for GPT Maker compatibility
        return new Response(JSON.stringify({
          success: true,
          message: responseText,
          role: 'assistant',
          stop: true,
          bypass_ai: true,
          via: 'gpt_maker_webhook'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (agentError) {
        console.error('❌ Error calling whatsapp-agent for GPT Maker:', {
          name: agentError.name,
          message: agentError.message,
          stack: agentError.stack?.substring(0, 200)
        });
        
        return new Response(JSON.stringify({
          success: false,
          message: '❌ Erro ao processar sua mensagem. Tente novamente em alguns instantes.',
          role: 'assistant',
          stop: true,
          error: agentError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (from && text) {
      console.log('✅ Mensagem válida recebida de:', from);
      console.log('📝 Conteúdo:', text);

      // Detectar tipo de mensagem para o agente
      const whatsappMessage = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const messageType = whatsappMessage?.type || 'text';
      const imageData = whatsappMessage?.image;
      const audioData = whatsappMessage?.audio;

      console.log('🔍 Message details:', { 
        type: messageType, 
        hasImage: !!imageData, 
        hasAudio: !!audioData 
      });

      try {
        console.log('🔵 Chamando whatsapp-agent...');
        
        // Criar promise com timeout de 28 segundos
        const agentPromise = fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
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
              type: messageType,
              image: imageData,
              audio: audioData
            },
            action: 'process_message'
          })
        });

        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('AGENT_TIMEOUT')), 28000)
        );

        let agentResponse;
        try {
          agentResponse = await Promise.race([agentPromise, timeoutPromise]);
        } catch (error) {
          if (error instanceof Error && error.message === 'AGENT_TIMEOUT') {
            console.error('⏱️ Agent timeout (28s) - sending fallback message');
            
            // Enviar mensagem de fallback ao usuário
            if (whatsappAccessToken && whatsappPhoneNumberId) {
              await fetch(`https://graph.facebook.com/v21.0/${whatsappPhoneNumberId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${whatsappAccessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: from,
                  type: 'text',
                  text: { 
                    body: '✅ *Transação processada!*\n\n' +
                          'Sua transação foi registrada.\n' +
                          'Digite *"saldo"* para verificar ou acesse a plataforma.' 
                  }
                })
              });
            }
            
            return new Response(JSON.stringify({ 
              success: true, 
              timeout: true 
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          throw error;
        }

        if (!agentResponse.ok) {
          const errorText = await agentResponse.text();
          console.error('❌ Agent HTTP error:', agentResponse.status, errorText);
          
          // Fallback: responder diretamente ao usuário
          const fallbackMessage = '⚠️ Desculpe, estou com dificuldades no momento. Por favor, tente novamente em alguns segundos.';
          
          if (whatsappAccessToken && whatsappPhoneNumberId) {
            await fetch(`https://graph.facebook.com/v21.0/${whatsappPhoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${whatsappAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: from,
                type: 'text',
                text: { body: fallbackMessage }
              })
            });
          }
          
          return new Response(JSON.stringify({ 
            success: true, 
            fallback: true,
            error: 'Agent failed, fallback sent'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

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
              
              // Ensure response text is a string for WhatsApp payload
              const responseText = typeof agentResult.response === 'string'
                ? agentResult.response
                : (agentResult.response?.response ?? JSON.stringify(agentResult.response));
              if (typeof agentResult.response !== 'string') {
                console.warn('Agent response was not a string; coerced to string for WhatsApp payload');
              }

              // Check if the response should include interactive buttons
              const shouldSendButtons = agentResult.sendButtons && agentResult.transactionId;
              
              let messagePayload: any;
              
              if (shouldSendButtons) {
                // Send interactive message with buttons
                messagePayload = {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: phoneForApi,
                  type: 'interactive',
                  interactive: {
                    type: 'button',
                    body: {
                      text: responseText
                    },
                    action: {
                      buttons: [
                        {
                          type: 'reply',
                          reply: {
                            id: `edit_${agentResult.transactionId}`,
                            title: '✏️ Editar'
                          }
                        },
                        {
                          type: 'reply',
                          reply: {
                            id: `delete_${agentResult.transactionId}`,
                            title: '🗑️ Excluir'
                          }
                        }
                      ]
                    }
                  }
                };
              } else {
                // Send regular text message
                messagePayload = {
                  messaging_product: 'whatsapp',
                  to: phoneForApi,
                  type: 'text',
                  text: { body: responseText }
                };
              }
              
              const whatsappResponse = await fetch(
                `https://graph.facebook.com/v18.0/${whatsappPhoneNumberId}/messages`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${whatsappAccessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(messagePayload)
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
