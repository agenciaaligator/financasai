import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Caracteres sem ambíguos (sem 0/O/I/1)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateClaimCode(): string {
  let code = 'DW-';
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

async function getDonaWilmaNumber(): Promise<string> {
  // Tenta buscar via Graph API o display_phone_number do número configurado
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  
  if (!phoneNumberId || !accessToken) {
    return '5511932727575'; // Fallback hardcoded
  }
  
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!resp.ok) return '5511932727575';
    const data = await resp.json();
    // display_phone_number vem como "+55 11 93272-7575" → normalizar
    return (data.display_phone_number || '5511932727575').replace(/\D/g, '');
  } catch {
    return '5511932727575';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validar JWT do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[CLAIM-CODE] 👤 user=${user.id}`);

    // Verificar se já tem sessão WhatsApp ativa
    const { data: existingSession } = await supabase
      .from('whatsapp_sessions')
      .select('phone_number')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSession) {
      console.log(`[CLAIM-CODE] ✅ Já conectado: ${existingSession.phone_number}`);
      return new Response(JSON.stringify({
        already_connected: true,
        phone_number: existingSession.phone_number,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Reaproveitar código pendente válido se houver
    const { data: pending } = await supabase
      .from('whatsapp_validation_codes')
      .select('claim_code, expires_at')
      .eq('user_id', user.id)
      .eq('used', false)
      .not('claim_code', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let claimCode: string;
    let expiresAt: string;

    if (pending) {
      claimCode = pending.claim_code;
      expiresAt = pending.expires_at;
      console.log(`[CLAIM-CODE] ♻️ Reaproveitando código pendente: ${claimCode}`);
    } else {
      // Gerar novo código (com retry se colidir no índice unique)
      let attempts = 0;
      while (attempts < 5) {
        const candidate = generateClaimCode();
        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const { error: insErr } = await supabase
          .from('whatsapp_validation_codes')
          .insert({
            user_id: user.id,
            claim_code: candidate,
            code: candidate, // mantém compatibilidade com coluna NOT NULL
            expires_at: expires,
            used: false,
          });
        if (!insErr) {
          claimCode = candidate;
          expiresAt = expires;
          console.log(`[CLAIM-CODE] 🆕 Novo código: ${claimCode}`);
          break;
        }
        if (insErr.code !== '23505') {
          console.error('[CLAIM-CODE] ❌ Insert error:', insErr);
          throw insErr;
        }
        attempts++;
      }
      if (!claimCode!) {
        throw new Error('Falha ao gerar código único após 5 tentativas');
      }
    }

    const donaWilmaNumber = await getDonaWilmaNumber();

    return new Response(JSON.stringify({
      success: true,
      claim_code: claimCode,
      dona_wilma_number: donaWilmaNumber,
      expires_at: expiresAt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[CLAIM-CODE] ❌ Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
