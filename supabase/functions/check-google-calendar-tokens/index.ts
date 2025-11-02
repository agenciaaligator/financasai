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
    console.log('🔄 [CHECK-TOKENS] Iniciando verificação proativa de tokens do Google Calendar');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar conexões ativas que vão expirar nas próximas 24h
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 24);

    const { data: connections, error: connectionsError } = await supabaseClient
      .from('calendar_connections')
      .select('user_id, calendar_email, expires_at')
      .eq('is_active', true)
      .lt('expires_at', expirationThreshold.toISOString());

    if (connectionsError) {
      console.error('[CHECK-TOKENS] Erro ao buscar conexões:', connectionsError);
      throw connectionsError;
    }

    console.log(`[CHECK-TOKENS] Encontradas ${connections?.length || 0} conexões que expiram em <24h`);

    let renewed = 0;
    let failed = 0;

    for (const connection of connections || []) {
      try {
        const hoursUntilExpiration = Math.round(
          (new Date(connection.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60)
        );
        
        console.log(
          `[CHECK-TOKENS] Renovando token para ${connection.calendar_email} ` +
          `(expira em ${hoursUntilExpiration}h)`
        );

        // Chamar google-calendar-import para renovar
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
          renewed++;
          console.log(`✅ [CHECK-TOKENS] Token renovado: ${connection.calendar_email}`);
        } else {
          const errorText = await response.text();
          failed++;
          
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.code === 'reconnect_required') {
              console.error(
                `🔑 [CHECK-TOKENS] ${connection.calendar_email} precisa reconectar manualmente ` +
                `(${errorJson.googleError || 'token revogado'})`
              );
            } else {
              console.error(`❌ [CHECK-TOKENS] Falha ao renovar ${connection.calendar_email}:`, errorText);
            }
          } catch {
            console.error(`❌ [CHECK-TOKENS] Falha ao renovar ${connection.calendar_email}:`, errorText);
          }
        }

        // Delay entre renovações
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (userError) {
        console.error(`[CHECK-TOKENS] Erro ao processar ${connection.calendar_email}:`, userError);
        failed++;
      }
    }

    const summary = {
      totalChecked: connections?.length || 0,
      renewed,
      failed,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ [CHECK-TOKENS] Verificação concluída:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [CHECK-TOKENS] Falha na verificação:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
