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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função helper para enviar mensagens via WhatsApp
async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  if (!whatsappAccessToken || !whatsappPhoneNumberId) {
    console.error('WhatsApp credentials not configured');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${whatsappPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error sending WhatsApp message:', error);
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

// Função para sintetizar áudio usando OpenAI TTS-1 (com fallback para ElevenLabs)
async function synthesizeSpeechOpenAI(text: string): Promise<Uint8Array> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurado');
  }

  console.log('🎙️ Sintetizando áudio com OpenAI TTS-1...');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: 'nova', // Melhor voz para português brasileiro
      speed: 1.0
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Erro OpenAI TTS:', error);
    throw new Error(`Erro ao sintetizar áudio: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

// Função para sintetizar áudio usando ElevenLabs (fallback)
async function synthesizeSpeechElevenLabs(text: string): Promise<Uint8Array> {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY não configurado');
  }

  console.log('🎙️ Sintetizando áudio com ElevenLabs...');

  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Erro ElevenLabs:', error);
    throw new Error(`Erro ao sintetizar áudio: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

// Função unificada com fallback automático
async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  try {
    // Tentar OpenAI primeiro (87% mais barato)
    return await synthesizeSpeechOpenAI(text);
  } catch (error) {
    console.warn('⚠️ Falha no OpenAI TTS, usando ElevenLabs como fallback:', error.message);
    // Fallback para ElevenLabs
    return await synthesizeSpeechElevenLabs(text);
  }
}

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

    // CRITICAL: Verificar assinatura do WhatsApp
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

    console.log('✅ WhatsApp webhook received (verified)');
    
    let from: string | undefined;
    let text: string | undefined;
    let messageId: string | undefined;
    let forceText = false; // ✅ CRITICAL FIX: Declarar forceText
    let whatsappMessage: any; // ✅ CRITICAL FIX: Declarar no escopo correto

    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      whatsappMessage = message; // ✅ Atribuir aqui
      from = message.from;
      messageId = message.id;
      
      // Detectar tipo de mensagem e processar áudio se necessário
      if (message.type === 'audio' && message.audio?.id) {
        console.log(`🎙️ [${messageId?.substring(0,10)}] Audio detected, checking session state...`);
        
        // BLOQUEIO: Verificar se está aguardando detalhes (texto obrigatório)
        try {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('session_data')
            .eq('phone_number', message.from)
            .single();
          
          if (session?.session_data?.conversation_state === 'awaiting_commitment_details') {
            console.log('🚫 Áudio bloqueado: aguardando texto para detalhes');
            await sendWhatsAppMessage(message.from, 
              '⚠️ Para endereços e nomes, preciso que você envie em *TEXTO*, não áudio.\n\nPor favor, digite a informação.'
            );
            return new Response(JSON.stringify({ success: true, blocked_audio: true }), { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
        } catch (sessionCheckError) {
          console.warn('⚠️ Erro ao verificar sessão para bloqueio de áudio:', sessionCheckError.message);
        }
        
        console.log(`🎙️ [${messageId?.substring(0,10)}] Proceeding with transcription...`);
        try {
          text = await transcribeAudio(message.audio.id, message.from);
          forceText = true;
          console.log(`✅ [${messageId?.substring(0,10)}] Transcription successful:`, {
            from: message.from.substring(0, 8) + '***',
            length: text.length,
            preview: text.substring(0, 50)
          });
        } catch (transcribeError) {
          console.error(`❌ [${messageId?.substring(0,10)}] Transcription failed:`, transcribeError.message);
          
          // ✅ CRITICAL FIX: Não retornar - seguir para o agente com fallback marker
          forceText = true;
          text = '__AUDIO_TRANSCRIPTION_FAILED__';
          console.log(`⚠️ [${messageId?.substring(0,10)}] Setting fallback marker for agent - will continue processing`);
          
          // ✅ NÃO RETORNAR MAIS - deixar processar normalmente para o agente orientar o usuário
        }
      } else if (message.type === 'text') {
        text = message.text?.body;
        
        // NORMALIZE: Remove TODOS os caracteres não alfanuméricos e múltiplos espaços
        if (text) {
          text = text
            .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Remove pontuação, emojis, etc (Unicode-aware)
            .replace(/\s+/g, ' ')                // Remove múltiplos espaços
            .trim();                             // Remove espaços nas pontas
          
          console.log('[WEBHOOK][TEXT_CLEAN]', { 
            original: message.text?.body?.substring(0, 50),
            cleaned: text 
          });
        }
      } else if (message.type === 'image' && message.image?.id) {
        console.log('📸 Image message detected - will process via agent');
        text = ''; // Vazio, imageData será usado no agent
      } else if (message.type === 'video' && message.video?.id) {
        // Processar vídeos/Live Photos como imagem
        console.log('📹 Vídeo/Live Photo recebido, tentando processar como imagem...');
        
        try {
          // Baixar o vídeo
          const mediaUrl = `https://graph.facebook.com/v17.0/${message.video.id}`;
          const mediaResponse = await fetch(mediaUrl, {
            headers: {
              'Authorization': `Bearer ${whatsappAccessToken}`,
            },
          });
          
          const mediaData = await mediaResponse.json();
          const videoUrl = mediaData.url;
          
          // Baixar o arquivo de vídeo
          const videoResponse = await fetch(videoUrl, {
            headers: {
              'Authorization': `Bearer ${whatsappAccessToken}`,
            },
          });
          
          const videoBlob = await videoResponse.arrayBuffer();
          
          // Converter para base64 em chunks (evita stack overflow em arquivos grandes)
          function arrayBufferToBase64(buffer: Uint8Array): string {
            let binary = '';
            const chunkSize = 8192; // 8KB chunks
            for (let i = 0; i < buffer.length; i += chunkSize) {
              const chunk = buffer.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            return btoa(binary);
          }
          const base64Video = arrayBufferToBase64(new Uint8Array(videoBlob));
          
          console.log('✅ Vídeo baixado, enviando para agente processar (size:', videoBlob.byteLength, 'bytes)');
          
          // Marcar como imagem para o agente processar
          text = '[VIDEO_AS_IMAGE]';
          
          // ✅ CRITICAL FIX: whatsappMessage.video pode não existir, criar estrutura completa
          message.video = message.video || {};
          message.video.base64 = base64Video;
          
        } catch (error) {
          console.error('❌ Erro ao processar vídeo/Live Photo:', error);
          
          await sendWhatsAppMessage(
            message.from,
            '❌ Não consegui processar este vídeo. Por favor, envie como *foto* (não Live Photo).\n\n' +
            '💡 *Dica iPhone:* Desative o Live Photo antes de tirar a foto, ou selecione uma foto da galeria.\n' +
            '💡 *Dica Android:* Envie como foto, não como vídeo.'
          );
          
          return new Response(JSON.stringify({ 
            success: true, 
            skipped: true,
            reason: 'video_processing_failed'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
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
        // Tipo de mensagem não suportado
        console.log(`⚠️ Tipo de mensagem não suportado: ${message.type}`);
        
        await sendWhatsAppMessage(
          message.from,
          `⚠️ Tipo de mensagem não suportado: *${message.type}*\n\n` +
          `Envie:\n` +
          `• 💬 *Texto* para comandos\n` +
          `• 📸 *Foto* para registrar despesas\n` +
          `• 🎤 *Áudio* para mensagens de voz`
        );
        
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: 'unsupported_message_type'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
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

    // Processar mensagem oficial do WhatsApp
    if (from && text !== undefined) {
      console.log('✅ Mensagem válida recebida de:', from);
      console.log('📝 Conteúdo:', text);

      // CRITICAL FIX: Verificar se o número tem sessão WhatsApp VALIDADA antes de processar
      // Isso evita criar sessões automáticas ou processar mensagens de números não validados
      const phoneVariationsCheck = from.startsWith('+') 
        ? [from, from.substring(1)] 
        : [from, '+' + from];
      
      // SESSÕES PERMANENTES: Não verificar expiração - apenas buscar sessão válida
      const { data: existingSession, error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .select('user_id, phone_number, expires_at')
        .or(`phone_number.in.(${phoneVariationsCheck.map(p => `"${p}"`).join(',')})`)
        .order('last_activity', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (sessionError) {
        console.error('❌ Erro ao verificar sessão WhatsApp:', sessionError.message);
      }
      
      if (!existingSession) {
        console.log('ℹ️ [INFO] Número sem sessão WhatsApp validada - enviando orientação:', {
          phone: from.substring(0, 8) + '***',
          reason: 'no_validated_session'
        });
        
        // Enviar mensagem de orientação para criar conta
        try {
          await sendWhatsAppMessage(
            from,
            `👋 Olá! Ainda não encontramos uma conta associada a este número.\n\n` +
            `Para usar a Dona Wilma, você precisa:\n` +
            `1️⃣ Acesse nosso site: donawilma.lovable.app\n` +
            `2️⃣ Escolha seu plano e complete o cadastro\n` +
            `3️⃣ Conecte seu WhatsApp no sistema\n\n` +
            `💡 Após conectar, você poderá registrar despesas, consultar saldos e muito mais - tudo pelo WhatsApp!`
          );
          console.log('✅ Orientação enviada com sucesso para número não cadastrado');
        } catch (sendError) {
          console.error('❌ Erro ao enviar orientação:', sendError);
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          orientation_sent: true,
          reason: 'no_validated_whatsapp_session'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('✅ Sessão WhatsApp validada encontrada:', {
        userId: existingSession.user_id,
        phone: existingSession.phone_number?.substring(0, 8) + '***',
        expiresAt: existingSession.expires_at
      });

      // SESSÕES PERMANENTES: Apenas atualizar last_activity (não expiram mais)
      const now = new Date();
      await supabase
        .from('whatsapp_sessions')
        .update({ last_activity: now.toISOString() })
        .eq('phone_number', existingSession.phone_number);

      // ✅ whatsappMessage já foi declarado anteriormente (linha 632)
      const messageType = whatsappMessage?.type || 'text';
      const imageData = whatsappMessage?.image;
      const audioData = whatsappMessage?.audio;
      
      // ✅ Determinar sendingType para o agente
      const sendingType = forceText ? 'text' : messageType;

      console.log('🔍 Message details:', { 
        type: messageType,
        sendingType,
        forceText,
        hasImage: !!imageData,
        imageId: imageData?.id,
        imageCaption: imageData?.caption,
        hasAudio: !!audioData,
        textPlaceholder: text
      });

      // PHASE 1: Validação de contexto para áudio em modo de edição
      if (messageType === 'audio' && text) {
        try {
          // Buscar sessão com variações do número de telefone
          const phoneVariations = from.startsWith('+') 
            ? [from, from.substring(1)] 
            : [from, '+' + from];
          
          const { data: sessionData } = await supabase
            .from('whatsapp_sessions')
            .select('session_data')
            .or(`phone_number.in.(${phoneVariations.map(p => `"${p}"`).join(',')})`)
            .gt('expires_at', new Date().toISOString())
            .order('last_activity', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (sessionData?.session_data) {
            const state = sessionData.session_data.conversation_state;
            const pendingEdit = sessionData.session_data.pending_commitment_edit;
            const normalizedText = text.toLowerCase().trim();
            
            // Se está em modo de edição e a transcrição é o comando inicial, marcar como inválida
            if (state === 'awaiting_commitment_edit_value' && 
                (normalizedText.includes('editar compromisso') || 
                 normalizedText.includes('editar evento') ||
                 normalizedText === 'editar')) {
              console.log('[AUDIO CONTEXT] ⚠️ Transcrição suspeita em modo de edição:', {
                state,
                field: pendingEdit?.field,
                transcription: normalizedText.substring(0, 50),
                phoneNumber: from.substring(0, 8) + '***'
              });
              
              // Marcar como contexto inválido para o agente processar apropriadamente
              text = '__invalid_audio_context__';
            }
          }
        } catch (error) {
          console.error('[AUDIO CONTEXT] Erro ao validar contexto:', error.message);
          // Continuar normalmente em caso de erro
        }
      }

      try {
        console.log('🔵 [BEFORE_AGENT_CALL] Calling whatsapp-agent...', {
          from: from?.substring(0, 8) + '***',
          sendingType,
          forceText,
          hasImage: !!imageData,
          hasAudio: !!audioData && !forceText,
          textLength: text?.length || 0
        });
        
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
              type: sendingType, // ✅ Usar sendingType calculado
              image: imageData,
              audio: forceText ? undefined : audioData
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
            console.error('⏱️ [AGENT_TIMEOUT] Agent timeout (28s) - sending fallback message');
            
            // ✅ Mensagem de fallback mais genérica (não assumir transação)
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
                    body: '⏱️ *Estamos processando sua solicitação...*\n\n' +
                          'Por favor, aguarde alguns instantes ou tente novamente.\n\n' +
                          'Digite *"ajuda"* para ver comandos disponíveis.' 
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
        console.log('✅ [AFTER_AGENT_CALL] Agent response received', {
          success: agentResult.success,
          hasResponse: !!agentResult.response,
          hasTransactionId: !!agentResult.transactionId
        });

        if (agentResult.success && agentResult.response) {
          if (whatsappAccessToken && whatsappPhoneNumberId) {
            try {
              const reqId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
              
              let phoneForApi = String(from).replace(/[^\d+]/g, '');
              console.log('Phone validated for API');
              
              if (phoneForApi.includes('{') || phoneForApi.includes('}') || 
                  !/^\+?\d{10,15}$/.test(phoneForApi)) {
                console.log('Ignoring webhook with placeholder/invalid phone');
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
              const shouldSendButtons = Boolean(agentResult.transactionId);
              
              let messagePayload: any;
              
              if (shouldSendButtons) {
                // ✅ CRITICAL FIX: Truncar responseText para ~900-1000 caracteres no botão
                const truncatedText = responseText.length > 900 
                  ? responseText.substring(0, 900) + '...'
                  : responseText;
                
                // Send interactive message with buttons
                messagePayload = {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: phoneForApi,
                  type: 'interactive',
                  interactive: {
                    type: 'button',
                    body: {
                      text: truncatedText
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
              
              console.log('[WEBHOOK] Sending to Graph API v21.0:', {
                type: messagePayload.type,
                hasButtons: shouldSendButtons,
                transactionId: agentResult.transactionId,
                sendButtonsOriginal: agentResult.sendButtons
              });

              const whatsappResponse = await fetch(
                `https://graph.facebook.com/v21.0/${whatsappPhoneNumberId}/messages`,
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

                // Fallback: if interactive failed, send plain text message
                if (shouldSendButtons) {
                  try {
                    const fallbackRes = await fetch(`https://graph.facebook.com/v21.0/${whatsappPhoneNumberId}/messages`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${whatsappAccessToken}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: phoneForApi,
                        type: 'text',
                        text: { body: responseText }
                      })
                    });
                    if (fallbackRes.ok) {
                      console.log('✅ Fallback text message sent after interactive failure');
                    } else {
                      console.error('❌ Fallback text message also failed', await fallbackRes.text());
                    }
                  } catch (fallbackError) {
                    console.error('❌ Error sending fallback text message:', fallbackError);
                  }
                }
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
