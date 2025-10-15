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
    console.log('🔄 [SYNC-PENDING-COMMITMENTS] Starting background sync job');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Buscar compromissos futuros sem google_event_id
    const { data: pendingCommitments, error: fetchError } = await supabase
      .from('commitments')
      .select('id, user_id, title, scheduled_at')
      .is('google_event_id', null)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50);
    
    if (fetchError) {
      console.error('❌ [SYNC-PENDING-COMMITMENTS] Error fetching commitments:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending commitments', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📋 [SYNC-PENDING-COMMITMENTS] Found ${pendingCommitments?.length || 0} pending commitments`);
    
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const commitment of pendingCommitments || []) {
      try {
        console.log(`🔄 [SYNC-PENDING-COMMITMENTS] Attempting to sync commitment ${commitment.id} (${commitment.title})`);
        
        // Tentar sincronizar
        const syncResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-sync`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'create',
              commitmentId: commitment.id,
              userId: commitment.user_id,
            }),
            signal: AbortSignal.timeout(10000), // 10s timeout
          }
        );
        
        if (syncResponse.ok) {
          console.log(`✅ [SYNC-PENDING-COMMITMENTS] Synced commitment ${commitment.id}`);
          syncedCount++;
        } else {
          const errorText = await syncResponse.text();
          console.error(`⚠️ [SYNC-PENDING-COMMITMENTS] Failed to sync ${commitment.id}:`, errorText);
          failedCount++;
        }
      } catch (error) {
        console.error(`❌ [SYNC-PENDING-COMMITMENTS] Error syncing ${commitment.id}:`, error);
        failedCount++;
      }
      
      // Pequeno delay entre requests para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const summary = {
      total: pendingCommitments?.length || 0,
      synced: syncedCount,
      failed: failedCount,
      timestamp: new Date().toISOString(),
    };
    
    console.log('✅ [SYNC-PENDING-COMMITMENTS] Job completed:', summary);
    
    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [SYNC-PENDING-COMMITMENTS] Job failed:', error);
    return new Response(
      JSON.stringify({ error: 'Job failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
