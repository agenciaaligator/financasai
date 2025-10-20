import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BACKFILL] Starting for organization: ${organization_id}`);

    // FASE 5: Atualizar transações sem organization_id para membros desta organização
    const { data: updated, error: updateError } = await supabase
      .rpc('backfill_transactions_org', { p_organization_id: organization_id });

    if (updateError) {
      console.error('[BACKFILL] Error:', updateError);
      throw updateError;
    }

    // Contar total de transações visíveis após backfill
    const { count: totalVisible, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id);

    if (countError) {
      console.error('[BACKFILL] Count error:', countError);
    }

    console.log(`[BACKFILL] Updated: ${updated}, Total visible: ${totalVisible}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        count: updated || 0,
        totalVisible: totalVisible || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[BACKFILL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
