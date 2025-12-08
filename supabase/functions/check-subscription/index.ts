import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not configured");
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        subscribed: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("Authorization header found");

    const token = authHeader.replace(/Bearer\s+/i, "");
    if (!token || token.length < 20) {
      logStep("ERROR: Invalid token format", { tokenLength: token?.length });
      return new Response(JSON.stringify({ 
        error: "Invalid authentication token",
        subscribed: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("Authenticating user with token", { tokenPresent: Boolean(token), tokenLength: token?.length });

    // Use anon client with forwarded JWT to resolve the user
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError) {
      logStep("ERROR: Authentication failed", { error: userError.message });
      return new Response(JSON.stringify({ 
        error: `Authentication error: ${userError.message}`,
        subscribed: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const user = userData.user;
    if (!user?.email) {
      logStep("ERROR: User not authenticated or no email");
      return new Response(JSON.stringify({ 
        error: "User not authenticated or email not available",
        subscribed: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      
      // Update or create user subscription record
      const { error: upsertError } = await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: (await supabaseClient.from('subscription_plans').select('id').eq('name', 'free').single()).data?.id,
          status: 'inactive',
          stripe_customer_id: null,
          stripe_subscription_id: null,
        }, { onConflict: 'user_id' });
      
      if (upsertError) logStep("Error updating subscription", { error: upsertError });
      
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let subscriptionId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionId = subscription.id;
      
      // CRITICAL FIX: Validar datas antes de converter para evitar "Invalid time value"
      const periodEndTimestamp = subscription.current_period_end;
      const periodStartTimestamp = subscription.current_period_start;
      
      if (periodEndTimestamp && typeof periodEndTimestamp === 'number' && periodEndTimestamp > 0) {
        subscriptionEnd = new Date(periodEndTimestamp * 1000).toISOString();
      } else {
        logStep("WARNING: Invalid period_end timestamp", { periodEndTimestamp });
        subscriptionEnd = null;
      }
      
      let periodStart: string | null = null;
      if (periodStartTimestamp && typeof periodStartTimestamp === 'number' && periodStartTimestamp > 0) {
        periodStart = new Date(periodStartTimestamp * 1000).toISOString();
      }
      
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd, startDate: periodStart });
      productId = subscription.items.data[0].price.product;
      logStep("Determined subscription tier", { productId });

      // Get premium plan ID
      const { data: premiumPlan } = await supabaseClient
        .from('subscription_plans')
        .select('id')
        .eq('name', 'premium')
        .single();

      // Update user subscription with validated dates
      const { error: upsertError } = await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: premiumPlan?.id,
          status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_start: periodStart,
          current_period_end: subscriptionEnd,
        }, { onConflict: 'user_id' });

      if (upsertError) logStep("Error updating subscription", { error: upsertError });

      // Update user role to premium
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .upsert({
          user_id: user.id,
          role: 'premium',
        }, { onConflict: 'user_id,role' });

      if (roleError) logStep("Error updating role", { error: roleError });
    } else {
      logStep("No active subscription found");
      
      // Update to inactive/free
      const { data: freePlan } = await supabaseClient
        .from('subscription_plans')
        .select('id')
        .eq('name', 'free')
        .single();

      const { error: upsertError } = await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: freePlan?.id,
          status: 'inactive',
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
        }, { onConflict: 'user_id' });

      if (upsertError) logStep("Error updating subscription", { error: upsertError });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR in check-subscription", { 
      message: errorMessage, 
      stack: errorStack,
      type: error?.constructor?.name 
    });
    
    // Return 200 with error details instead of 500 to prevent client errors
    return new Response(JSON.stringify({ 
      error: errorMessage,
      subscribed: false,
      product_id: null,
      subscription_end: null 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
