import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Starting Stripe subscription sync");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Buscar todas as assinaturas do banco que precisam de sincronização
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .not('stripe_subscription_id', 'is', null);

    if (fetchError) {
      throw new Error(`Error fetching subscriptions: ${fetchError.message}`);
    }

    logStep("Found subscriptions to sync", { count: subscriptions?.length || 0 });

    const results = [];

    for (const sub of subscriptions || []) {
      try {
        // Buscar dados atualizados do Stripe com expand para itens e invoices
        const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
          expand: ['latest_invoice']
        }) as any;
        
        // Na versão basil do Stripe API, current_period pode estar em outro lugar
        // Tentar diferentes propriedades
        const periodStart = stripeSubscription.current_period_start 
          || stripeSubscription.billing_cycle_anchor 
          || stripeSubscription.created;
        
        // Para period_end, calcular baseado no intervalo se não disponível
        let periodEnd = stripeSubscription.current_period_end;
        
        if (!periodEnd && periodStart) {
          // Tentar obter da latest_invoice ou calcular
          const latestInvoice = stripeSubscription.latest_invoice;
          if (latestInvoice && latestInvoice.period_end) {
            periodEnd = latestInvoice.period_end;
          } else {
            // Calcular baseado no billing_cycle (adicionar 1 mês ou 1 ano)
            const interval = stripeSubscription.items?.data?.[0]?.price?.recurring?.interval;
            const startDate = new Date(periodStart * 1000);
            if (interval === 'year') {
              startDate.setFullYear(startDate.getFullYear() + 1);
            } else {
              startDate.setMonth(startDate.getMonth() + 1);
            }
            periodEnd = Math.floor(startDate.getTime() / 1000);
          }
        }
        
        logStep("Period dates extracted", {
          id: stripeSubscription.id,
          billing_cycle_anchor: stripeSubscription.billing_cycle_anchor,
          created: stripeSubscription.created,
          periodStart,
          periodEnd
        });
        
        const currentPeriodStartISO = periodStart && typeof periodStart === 'number'
          ? new Date(periodStart * 1000).toISOString()
          : null;
        
        const currentPeriodEndISO = periodEnd && typeof periodEnd === 'number'
          ? new Date(periodEnd * 1000).toISOString()
          : null;

        // Atualizar no banco
        const { error: updateError } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing' 
              ? 'active' 
              : stripeSubscription.status,
            current_period_start: currentPeriodStartISO,
            current_period_end: currentPeriodEndISO,
            cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          })
          .eq('id', sub.id);

        if (updateError) {
          logStep("Error updating subscription", { id: sub.id, error: updateError.message });
          results.push({ id: sub.id, success: false, error: updateError.message });
        } else {
          logStep("Subscription synced", { 
            id: sub.id, 
            stripeId: sub.stripe_subscription_id,
            periodStart: currentPeriodStartISO,
            periodEnd: currentPeriodEndISO
          });
          results.push({ 
            id: sub.id, 
            success: true, 
            periodStart: currentPeriodStartISO,
            periodEnd: currentPeriodEndISO
          });
        }
      } catch (stripeError: any) {
        logStep("Stripe error for subscription", { 
          id: sub.id, 
          stripeId: sub.stripe_subscription_id,
          error: stripeError.message 
        });
        results.push({ id: sub.id, success: false, error: stripeError.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      synced: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Fatal error", { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
