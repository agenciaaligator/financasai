import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('[GOOGLE-CALENDAR-CALLBACK] OAuth error:', error);
      return Response.redirect('https://financasai.lovable.app/settings?google=error', 302);
    }

    if (!code) {
      throw new Error('Authorization code not provided');
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI');

    // Trocar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Buscar informações do calendário principal
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary',
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const calendarInfo = await calendarResponse.json();

    // Extrair user_id do state (podemos passar no state em versão futura)
    // Por ora, vamos usar o header de autorização se disponível
    const authHeader = req.headers.get('authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Calcular data de expiração
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Salvar conexão no banco
    const { error: dbError } = await supabaseClient
      .from('calendar_connections')
      .upsert({
        user_id: user.id,
        access_token,
        refresh_token,
        expires_at: expiresAt.toISOString(),
        calendar_id: calendarInfo.id,
        calendar_email: calendarInfo.id,
        calendar_name: calendarInfo.summary || 'Google Calendar',
        provider: 'google',
        is_active: true,
      }, {
        onConflict: 'user_id,provider'
      });

    if (dbError) {
      console.error('[GOOGLE-CALENDAR-CALLBACK] Database error:', dbError);
      throw dbError;
    }

    console.log('[GOOGLE-CALENDAR-CALLBACK] Connection saved successfully for user:', user.id);

    return Response.redirect('https://financasai.lovable.app/settings?google=success', 302);
  } catch (error) {
    console.error('[GOOGLE-CALENDAR-CALLBACK] Error:', error);
    return Response.redirect('https://financasai.lovable.app/settings?google=error', 302);
  }
});