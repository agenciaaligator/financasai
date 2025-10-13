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

    // Buscar conexão
    const { data: connection } = await supabaseClient
      .from('calendar_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    // Revogar token no Google (opcional, mas boa prática)
    if (connection?.access_token) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${connection.access_token}`,
          { method: 'POST' }
        );
        console.log('[GOOGLE-CALENDAR-DISCONNECT] Token revoked at Google');
      } catch (error) {
        console.warn('[GOOGLE-CALENDAR-DISCONNECT] Failed to revoke token:', error);
      }
    }

    // Deletar conexão do banco
    const { error: deleteError } = await supabaseClient
      .from('calendar_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google');

    if (deleteError) {
      throw deleteError;
    }

    // Limpar google_event_id de todos os compromissos do usuário
    await supabaseClient
      .from('commitments')
      .update({ google_event_id: null })
      .eq('user_id', user.id)
      .not('google_event_id', 'is', null);

    console.log('[GOOGLE-CALENDAR-DISCONNECT] Disconnected successfully for user:', user.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GOOGLE-CALENDAR-DISCONNECT] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});