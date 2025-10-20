import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 [BACKFILL] Starting WhatsApp transactions organization_id backfill');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // FASE 3: Buscar transações do WhatsApp sem organization_id
    const { data: whatsappTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, user_id')
      .eq('source', 'whatsapp')
      .is('organization_id', null);

    if (fetchError) {
      console.error('❌ Error fetching transactions:', fetchError);
      throw fetchError;
    }

    if (!whatsappTransactions || whatsappTransactions.length === 0) {
      console.log('✅ No WhatsApp transactions need backfilling');
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: 'No transactions to update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${whatsappTransactions.length} WhatsApp transactions without organization_id`);

    let updated = 0;
    let errors = 0;

    for (const transaction of whatsappTransactions) {
      // Buscar organization_id do usuário
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', transaction.user_id)
        .maybeSingle();

      if (orgMember?.organization_id) {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ organization_id: orgMember.organization_id })
          .eq('id', transaction.id);

        if (updateError) {
          console.error(`❌ Failed to update transaction ${transaction.id}:`, updateError);
          errors++;
        } else {
          console.log(`✅ Updated transaction ${transaction.id} with org ${orgMember.organization_id}`);
          updated++;
        }
      } else {
        console.log(`⚠️ User ${transaction.user_id} has no organization - skipping transaction ${transaction.id}`);
      }
    }

    console.log(`🎉 [BACKFILL] Completed: ${updated} updated, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated, 
        errors,
        total: whatsappTransactions.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Critical error in backfill:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
