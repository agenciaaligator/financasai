import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 [SYNC-ALL-GOOGLE] Starting automatic Google Calendar sync for all users');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar todos os usuários com calendário ativo e não expirado
    const { data: connections, error: connectionsError } = await supabaseClient
      .from('calendar_connections')
      .select('user_id, calendar_email')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString());

    if (connectionsError) {
      console.error('[SYNC-ALL-GOOGLE] Error fetching connections:', connectionsError);
      throw connectionsError;
    }

    console.log(`[SYNC-ALL-GOOGLE] Found ${connections?.length || 0} active calendar connections`);

    let synced = 0;
    let errors = 0;

    for (const connection of connections || []) {
      try {
        console.log(`[SYNC-ALL-GOOGLE] Syncing for user ${connection.user_id} (${connection.calendar_email})`);

        // Chamar google-calendar-import para este usuário
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-import`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ userId: connection.user_id }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          synced++;
          console.log(`✅ [SYNC-ALL-GOOGLE] Synced user ${connection.user_id}:`, result);
        } else {
          const errorText = await response.text();
          errors++;
          console.error(`❌ [SYNC-ALL-GOOGLE] Failed to sync user ${connection.user_id}:`, errorText);
        }

        // Delay entre chamadas para respeitar rate limits do Google
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (userError) {
        console.error(`[SYNC-ALL-GOOGLE] Error syncing user ${connection.user_id}:`, userError);
        errors++;
      }
    }

    const summary = {
      totalConnections: connections?.length || 0,
      synced,
      errors,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ [SYNC-ALL-GOOGLE] Sync completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [SYNC-ALL-GOOGLE] Sync failed:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
