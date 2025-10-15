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

    console.log('[GOOGLE-CALENDAR-CALLBACK] Callback received');
    console.log('[GOOGLE-CALENDAR-CALLBACK] Has code:', !!code);
    console.log('[GOOGLE-CALENDAR-CALLBACK] Has state:', !!state);
    console.log('[GOOGLE-CALENDAR-CALLBACK] Has error:', !!error);

    // Decodificar state para extrair user_id e origin
    let userId = null;
    let appOrigin = 'https://bc45aac3-c622-434f-ad58-afc37c18c6c2.lovableproject.com';
    
    if (state) {
      try {
        const stateBase64 = state
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        const stateJson = atob(stateBase64);
        const statePayload = JSON.parse(stateJson);
        userId = statePayload.uid;
        appOrigin = statePayload.o || appOrigin;
        console.log('[GOOGLE-CALENDAR-CALLBACK] State decoded:', { userId, origin: appOrigin });
      } catch (e) {
        console.error('[GOOGLE-CALENDAR-CALLBACK] Failed to decode state:', e);
      }
    }

    if (error) {
      console.error('[GOOGLE-CALENDAR-CALLBACK] OAuth error from Google:', error);
      const description = url.searchParams.get('error_description');
      console.error('[GOOGLE-CALENDAR-CALLBACK] Error description:', description);
      
      return Response.redirect(
        `${appOrigin}/gc-done.html?google=error&reason=${encodeURIComponent(error)}`,
        302
      );
    }

    if (!code) {
      return Response.redirect(
        `${appOrigin}/gc-done.html?google=error&reason=no_code`,
        302
      );
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
      const errorData = await tokenResponse.text();
      console.error('[GOOGLE-CALENDAR-CALLBACK] Token exchange failed:', errorData);
      
      let reason = 'token_exchange';
      if (errorData.includes('invalid_client') || errorData.includes('unauthorized')) {
        reason = 'invalid_client';
      }
      
      return Response.redirect(
        `${appOrigin}/gc-done.html?google=error&reason=${reason}`,
        302
      );
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

    if (!calendarResponse.ok) {
      throw new Error('Failed to fetch calendar info');
    }

    const calendarInfo = await calendarResponse.json();

    // Usar SERVICE_ROLE_KEY para salvar independente de autenticação
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Se não temos userId do state, tentar do header de autorização como fallback
    if (!userId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        try {
          const authClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
          );
          const { data: { user } } = await authClient.auth.getUser();
          userId = user?.id;
          console.log('[GOOGLE-CALENDAR-CALLBACK] User ID from auth header:', userId);
        } catch (e) {
          console.error('[GOOGLE-CALENDAR-CALLBACK] Failed to get user from auth:', e);
        }
      }
    }
    
    if (!userId) {
      console.error('[GOOGLE-CALENDAR-CALLBACK] No user ID available');
      return Response.redirect(
        `${appOrigin}/gc-done.html?google=error&reason=no_user`,
        302
      );
    }

    // Calcular data de expiração
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Salvar conexão no banco
    const { error: dbError } = await supabaseClient
      .from('calendar_connections')
      .upsert({
        user_id: userId,
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
      return Response.redirect(
        `${appOrigin}/gc-done.html?google=error&reason=db_error`,
        302
      );
    }

    console.log('[GOOGLE-CALENDAR-CALLBACK] Connection saved successfully for user:', userId);

    return Response.redirect(`${appOrigin}/gc-done.html?google=success`, 302);
  } catch (error) {
    console.error('[GOOGLE-CALENDAR-CALLBACK] Error:', error);
    return Response.redirect(
      `${appOrigin}/gc-done.html?google=error&reason=unknown`,
      302
    );
  }
});