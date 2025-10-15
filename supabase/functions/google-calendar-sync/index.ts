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

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      console.error('[GOOGLE-CALENDAR-SYNC] getUser error:', userError);
    }
    const user = userData?.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { action, commitmentId } = await req.json();

    if (!action || !commitmentId) {
      throw new Error('Missing action or commitmentId');
    }

    // Buscar commitment
    const { data: commitment, error: commitmentError } = await supabaseClient
      .from('commitments')
      .select('*')
      .eq('id', commitmentId)
      .single();

    if (commitmentError || !commitment) {
      throw new Error('Commitment not found');
    }

    const accessToken = await getValidAccessToken(supabaseClient, user.id);

    if (action === 'create') {
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
        throw new Error('Failed to create Google Calendar event');
      }

      const createdEvent = await response.json();

      // Salvar google_event_id
      await supabaseClient
        .from('commitments')
        .update({ google_event_id: createdEvent.id })
        .eq('id', commitmentId);

      console.log('[GOOGLE-CALENDAR-SYNC] Event created:', createdEvent.id);
      
      return new Response(
        JSON.stringify({ success: true, eventId: createdEvent.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      if (!commitment.google_event_id) {
        throw new Error('No Google event ID found for this commitment');
      }

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

      if (!response.ok) {
        throw new Error('Failed to update Google Calendar event');
      }

      console.log('[GOOGLE-CALENDAR-SYNC] Event updated:', commitment.google_event_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (!commitment.google_event_id) {
        return new Response(
          JSON.stringify({ success: true, message: 'No Google event to delete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${commitment.google_event_id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (!response.ok && response.status !== 404) {
        throw new Error('Failed to delete Google Calendar event');
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