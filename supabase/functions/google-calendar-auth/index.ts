import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { appOrigin, userId: bodyUserId } = body;

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const redirectUri = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      throw new Error('Missing Google OAuth configuration');
    }

    // Validar formato do clientId
    const clientIdLooksValid = clientId.includes('.apps.googleusercontent.com');
    console.log('[GOOGLE-CALENDAR-AUTH] Client ID validation:', { 
      clientIdLooksValid, 
      clientIdPrefix: clientId.substring(0, 30) + '...' 
    });

    // Priorizar userId do body, fallback para Authorization header
    let userId = bodyUserId || null;
    
    if (!userId) {
      const authHeader = req.headers.get('authorization');
      
      if (authHeader) {
        try {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
          );
          
          const { data: { user } } = await supabaseClient.auth.getUser();
          userId = user?.id || null;
          console.log('[GOOGLE-CALENDAR-AUTH] User ID from auth header:', userId);
        } catch (e) {
          console.log('[GOOGLE-CALENDAR-AUTH] Could not extract user from auth header:', e.message);
        }
      }
    } else {
      console.log('[GOOGLE-CALENDAR-AUTH] User ID from body:', userId);
    }

    // Scopes necessários para acessar o Google Calendar
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ];

    // Criar payload do state com nonce, user_id, origin e timestamp
    const statePayload = {
      n: crypto.randomUUID(),
      uid: userId,
      ts: Date.now(),
      o: appOrigin || null
    };
    
    // Codificar state em base64url
    const stateJson = JSON.stringify(statePayload);
    const stateBase64 = btoa(stateJson)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Construir URL de autorização do Google
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent select_account');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', stateBase64);

    console.log('[GOOGLE-CALENDAR-AUTH] Authorization URL generated successfully');
    console.log('[GOOGLE-CALENDAR-AUTH] Redirect URI:', redirectUri);
    console.log('[GOOGLE-CALENDAR-AUTH] Client ID:', clientId.substring(0, 20) + '...');
    console.log('[GOOGLE-CALENDAR-AUTH] Scopes:', scopes.join(', '));
    console.log('[GOOGLE-CALENDAR-AUTH] Prompt:', 'consent select_account');
    console.log('[GOOGLE-CALENDAR-AUTH] Include granted scopes:', 'true');
    console.log('[GOOGLE-CALENDAR-AUTH] State payload:', { hasUserId: !!userId, hasOrigin: !!appOrigin, timestamp: statePayload.ts });
    console.log('[GOOGLE-CALENDAR-AUTH] Auth URL prefix:', authUrl.toString().substring(0, 80) + '...');

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[GOOGLE-CALENDAR-AUTH] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});