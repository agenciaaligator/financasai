import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function renewToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to renew access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function getValidAccessToken(supabaseClient: any, userId: string) {
  const { data: connection, error } = await supabaseClient
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_active', true)
    .single();

  if (error || !connection) {
    throw new Error('No active Google Calendar connection found');
  }

  // Verificar se token expirou
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();

  if (now >= expiresAt) {
    console.log('[GOOGLE-CALENDAR-SYNC] Token expired, renewing...');
    const newAccessToken = await renewToken(connection.refresh_token);
    
    const newExpiresAt = new Date(Date.now() + 3600 * 1000);
    await supabaseClient
      .from('calendar_connections')
      .update({
        access_token: newAccessToken,
        expires_at: newExpiresAt.toISOString(),
      })
      .eq('id', connection.id);

    return newAccessToken;
  }

  return connection.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { action, commitmentId, userId, googleEventId } = await req.json();

    // Determinar userId efetivo e cliente a usar
    let effectiveUserId: string;
    let effectiveClient = supabaseClient; // Cliente padrão (JWT)

    // Se userId foi passado no body (chamada via service role do whatsapp-agent)
    if (userId) {
      console.log('[GOOGLE-CALENDAR-SYNC] Using userId from request body:', userId);
      effectiveUserId = userId;
      
      // Criar cliente com SERVICE_ROLE_KEY para bypass RLS
      effectiveClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      console.log('[GOOGLE-CALENDAR-SYNC] Using SERVICE_ROLE_KEY client');
    } else {
      // Autenticação JWT normal (chamada do frontend)
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError) {
        console.error('[GOOGLE-CALENDAR-SYNC] getUser error:', userError);
      }
      const user = userData?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }
      effectiveUserId = user.id;
      console.log('[GOOGLE-CALENDAR-SYNC] Using JWT client');
    }

    if (!effectiveUserId) {
      throw new Error('User ID not found');
    }

    if (!action || !commitmentId) {
      throw new Error('Missing action or commitmentId');
    }

    // Buscar commitment usando effectiveClient
    console.log('[GOOGLE-CALENDAR-SYNC] Fetching commitment:', commitmentId);
    const { data: commitment, error: commitmentError } = await effectiveClient
      .from('commitments')
      .select('*')
      .eq('id', commitmentId)
      .single();

    if (commitmentError) {
      console.error('[GOOGLE-CALENDAR-SYNC] Error fetching commitment:', commitmentError);
      throw new Error(`Commitment not found: ${commitmentError.message}`);
    }
    
    if (!commitment) {
      throw new Error('Commitment not found');
    }
    
    console.log('[GOOGLE-CALENDAR-SYNC] Commitment found:', commitment.title);

    const accessToken = await getValidAccessToken(effectiveClient, effectiveUserId);

    if (action === 'create') {
      // Verificar idempotência: se já tem google_event_id, não criar duplicado
      if (commitment.google_event_id) {
        console.log('[GOOGLE-CALENDAR-SYNC] Event already exists for this commitment, skipping create');
        return new Response(
          JSON.stringify({ success: true, eventId: commitment.google_event_id, skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[GOOGLE-CALENDAR-SYNC] Creating new event for commitment:', commitmentId);
      
      // Criar evento no Google Calendar
      const event = {
        summary: commitment.title,
        description: commitment.description || '',
        location: commitment.location || '',
        start: {
          dateTime: new Date(commitment.scheduled_at).toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: new Date(
            new Date(commitment.scheduled_at).getTime() + 
            (commitment.duration_minutes || 60) * 60000
          ).toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[GOOGLE-CALENDAR-SYNC] Failed to create event:', response.status, errorBody);
        throw new Error(`Failed to create Google Calendar event: ${response.status}`);
      }

      const createdEvent = await response.json();

      // Salvar google_event_id usando effectiveClient
      await effectiveClient
        .from('commitments')
        .update({ google_event_id: createdEvent.id })
        .eq('id', commitmentId);

      console.log('[GOOGLE-CALENDAR-SYNC] Event created successfully:', createdEvent.id);
      
      return new Response(
        JSON.stringify({ success: true, eventId: createdEvent.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      const event = {
        summary: commitment.title,
        description: commitment.description || '',
        location: commitment.location || '',
        start: {
          dateTime: new Date(commitment.scheduled_at).toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: new Date(
            new Date(commitment.scheduled_at).getTime() + 
            (commitment.duration_minutes || 60) * 60000
          ).toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
      };

      // Se não tiver google_event_id, criar evento novo
      if (!commitment.google_event_id) {
        console.log('[GOOGLE-CALENDAR-SYNC] No event ID found, creating new event');
        
        const response = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('[GOOGLE-CALENDAR-SYNC] Failed to create event:', response.status, errorBody);
          throw new Error(`Failed to create Google Calendar event: ${response.status}`);
        }

        const createdEvent = await response.json();

        // Salvar google_event_id usando effectiveClient
        await effectiveClient
          .from('commitments')
          .update({ google_event_id: createdEvent.id })
          .eq('id', commitmentId);

        console.log('[GOOGLE-CALENDAR-SYNC] Event created (from update):', createdEvent.id);
        
        return new Response(
          JSON.stringify({ success: true, eventId: createdEvent.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Tentar atualizar evento existente
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${commitment.google_event_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      // Se evento não existe mais no Google (404), criar novo
      if (response.status === 404) {
        console.log('[GOOGLE-CALENDAR-SYNC] Event not found in Google, creating new one');
        
        const createResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (!createResponse.ok) {
          const errorBody = await createResponse.text();
          console.error('[GOOGLE-CALENDAR-SYNC] Failed to create event:', createResponse.status, errorBody);
          throw new Error(`Failed to create Google Calendar event: ${createResponse.status}`);
        }

        const createdEvent = await createResponse.json();

        // Atualizar google_event_id usando effectiveClient
        await effectiveClient
          .from('commitments')
          .update({ google_event_id: createdEvent.id })
          .eq('id', commitmentId);

        console.log('[GOOGLE-CALENDAR-SYNC] Event recreated:', createdEvent.id);
        
        return new Response(
          JSON.stringify({ success: true, eventId: createdEvent.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[GOOGLE-CALENDAR-SYNC] Failed to update event:', response.status, errorBody);
        throw new Error(`Failed to update Google Calendar event: ${response.status}`);
      }

      console.log('[GOOGLE-CALENDAR-SYNC] Event updated:', commitment.google_event_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      // Determinar qual google_event_id usar
      let eventIdToDelete = commitment?.google_event_id || googleEventId;
      
      console.log('[GOOGLE-CALENDAR-SYNC] Delete action:', {
        commitmentFound: !!commitment,
        commitmentGoogleEventId: commitment?.google_event_id,
        providedGoogleEventId: googleEventId,
        eventIdToDelete
      });

      if (!eventIdToDelete) {
        console.log('[GOOGLE-CALENDAR-SYNC] No Google event ID to delete (already deleted or never synced)');
        return new Response(
          JSON.stringify({ success: true, message: 'No Google event to delete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deletar do Google Calendar
      console.log('[GOOGLE-CALENDAR-SYNC] Deleting from Google Calendar:', eventIdToDelete);
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventIdToDelete}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (!response.ok && response.status !== 404) {
        const errorBody = await response.text();
        console.error('[GOOGLE-CALENDAR-SYNC] Failed to delete event:', response.status, errorBody);
        throw new Error(`Failed to delete Google Calendar event: ${response.status}`);
      }

      console.log('[GOOGLE-CALENDAR-SYNC] Event deleted from Google Calendar:', eventIdToDelete);

      // Limpar google_event_id do commitment (se ainda existir no banco)
      if (commitment) {
        console.log('[GOOGLE-CALENDAR-SYNC] Clearing google_event_id from commitment');
        await effectiveClient
          .from('commitments')
          .update({ google_event_id: null })
          .eq('id', commitmentId);
      } else {
        console.log('[GOOGLE-CALENDAR-SYNC] Commitment already deleted from DB, skipping update');
      }

      console.log('[GOOGLE-CALENDAR-SYNC] Event deleted:', commitment.google_event_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('[GOOGLE-CALENDAR-SYNC] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});