import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getValidAccessToken(supabaseClient: any, userId: string): Promise<string> {
  console.log('[GOOGLE-CALENDAR-IMPORT] Getting valid access token for user:', userId);
  
  const { data: connection, error } = await supabaseClient
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !connection) {
    console.error('[GOOGLE-CALENDAR-IMPORT] No active calendar connection found');
    throw new Error('No active calendar connection found');
  }

  const expiresAt = new Date(connection.expires_at);
  const now = new Date();

  if (expiresAt > now) {
    console.log('[GOOGLE-CALENDAR-IMPORT] Using existing valid token');
    return connection.access_token;
  }

  console.log('[GOOGLE-CALENDAR-IMPORT] Token expired, renewing...');
  
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[GOOGLE-CALENDAR-IMPORT] Google API token renewal failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText.substring(0, 500)
      });
      
      // Parse error response
      let errorCode = 'unknown';
      try {
        const errorJson = JSON.parse(errorText);
        errorCode = errorJson.error || 'unknown';
      } catch (e) {
        // If not JSON, try to extract error from text
        if (errorText.includes('invalid_client')) errorCode = 'invalid_client';
        else if (errorText.includes('invalid_grant')) errorCode = 'invalid_grant';
        else if (errorText.includes('unauthorized_client')) errorCode = 'unauthorized_client';
      }
      
      // Mark connection as inactive for specific errors
      if (['invalid_client', 'invalid_grant', 'unauthorized_client'].includes(errorCode)) {
        console.error('[GOOGLE-CALENDAR-IMPORT] Marking connection as inactive due to:', errorCode);
        await supabaseClient
          .from('calendar_connections')
          .update({ is_active: false })
          .eq('id', connection.id);
      }
      
      const error = new Error('reconnect_required');
      (error as any).code = 'reconnect_required';
      (error as any).googleError = errorCode;
      throw error;
    }

    const tokenData = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await supabaseClient
      .from('calendar_connections')
      .update({
        access_token: tokenData.access_token,
        expires_at: newExpiresAt.toISOString(),
      })
      .eq('id', connection.id);

    console.log('[GOOGLE-CALENDAR-IMPORT] Token renewed successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('[GOOGLE-CALENDAR-IMPORT] Error during token renewal:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 [GOOGLE-CALENDAR-IMPORT] Starting import from Google Calendar');
    
    // Verificar se é chamada interna (com userId no body) ou externa (com Authorization header)
    let targetUserId: string;
    let supabaseClient: any;
    
    const requestBody = await req.text();
    const bodyData = requestBody ? JSON.parse(requestBody) : {};
    
    if (bodyData.userId) {
      // Chamada interna (de sync-all-google-calendars)
      console.log('📥 [GOOGLE-CALENDAR-IMPORT] Internal call for userId:', bodyData.userId);
      targetUserId = bodyData.userId;
      
      // Usar service role client para chamadas internas
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
    } else {
      // Chamada externa (do frontend)
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing authorization header');
      }

      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      // Obter usuário autenticado
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }
      
      targetUserId = user.id;
    }

    console.log('[GOOGLE-CALENDAR-IMPORT] Importing for user:', targetUserId);

    // Obter token de acesso válido
    const accessToken = await getValidAccessToken(supabaseClient, targetUserId);

    // Buscar eventos futuros do Google Calendar (próximos 90 dias)
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('[GOOGLE-CALENDAR-IMPORT] Failed to fetch events:', errorText);
      throw new Error('Failed to fetch Google Calendar events');
    }

    const { items: googleEvents } = await eventsResponse.json();
    console.log(`[GOOGLE-CALENDAR-IMPORT] Found ${googleEvents?.length || 0} events in Google Calendar`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const googleEvent of googleEvents || []) {
      try {
        const googleEventId = googleEvent.id;
        
        // Verificar se já existe no banco
        const { data: existing } = await supabaseClient
          .from('commitments')
          .select('id')
          .eq('google_event_id', googleEventId)
          .maybeSingle();

        // Calcular duração em minutos
        const startTime = new Date(googleEvent.start.dateTime || googleEvent.start.date);
        const endTime = new Date(googleEvent.end.dateTime || googleEvent.end.date);
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

        // Buscar reminder_settings do usuário ou usar padrão
        const { data: reminderSettings } = await supabaseClient
          .from('reminder_settings')
          .select('default_reminders')
          .eq('user_id', targetUserId)
          .maybeSingle();

        const defaultReminders = Array.isArray(reminderSettings?.default_reminders) 
          ? reminderSettings.default_reminders 
          : [
              { time: 1440, enabled: true }, // 24h antes
              { time: 120, enabled: true },  // 2h antes
              { time: 60, enabled: true }    // 1h antes
            ];

        const scheduledReminders = defaultReminders
          .filter((r: any) => r.enabled)
          .map((r: any) => ({
            minutes_before: r.time,
            sent: false
          }));

        const commitmentData = {
          user_id: targetUserId,
          title: googleEvent.summary || 'Sem título',
          description: googleEvent.description || null,
          scheduled_at: startTime.toISOString(),
          duration_minutes: durationMinutes,
          location: googleEvent.location || null,
          google_event_id: googleEventId,
          category: googleEvent.conferenceData ? 'meeting' : 'other',
          reminder_sent: false,
          scheduled_reminders: scheduledReminders,
        };

        if (existing) {
          // Atualizar evento existente
          const { error } = await supabaseClient
            .from('commitments')
            .update(commitmentData)
            .eq('id', existing.id);

          if (error) {
            console.error('[GOOGLE-CALENDAR-IMPORT] Error updating:', error);
          } else {
            updated++;
            console.log(`[GOOGLE-CALENDAR-IMPORT] Updated: ${googleEvent.summary}`);
          }
        } else {
          // Criar novo compromisso
          const { error } = await supabaseClient
            .from('commitments')
            .insert(commitmentData);

          if (error) {
            console.error('[GOOGLE-CALENDAR-IMPORT] Error inserting:', error);
          } else {
            imported++;
            console.log(`[GOOGLE-CALENDAR-IMPORT] Imported: ${googleEvent.summary}`);
          }
        }
      } catch (eventError) {
        console.error('[GOOGLE-CALENDAR-IMPORT] Error processing event:', eventError);
        skipped++;
      }
    }

    const summary = {
      total: googleEvents?.length || 0,
      imported,
      updated,
      skipped,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ [GOOGLE-CALENDAR-IMPORT] Import completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ [GOOGLE-CALENDAR-IMPORT] Import failed:', error);
    
    // Return 401 for reconnection required
    if (error.code === 'reconnect_required') {
      return new Response(
        JSON.stringify({ 
          code: 'reconnect_required',
          message: 'Conexão com o Google expirada/invalidada. Reconecte.',
          googleError: error.googleError 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error.message || 'Erro desconhecido ao importar do Google Calendar' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
