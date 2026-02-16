import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

async function handleCheckoutCompleted(
  supabaseAdmin: any,
  stripe: any,
  session: any
) {
  const subscriptionId = session.subscription as string;
  const customerEmail = (session.customer_email || session.customer_details?.email || '').toLowerCase().trim();
  const clientReferenceId = session.client_reference_id;
  const stripeCustomerId = session.customer as string;

  logStep("Processing checkout session", { 
    sessionId: session.id, 
    email: customerEmail,
    clientReferenceId,
    customerId: stripeCustomerId
  });

  if (!subscriptionId) {
    logStep("No subscription ID - one-time payment?");
    return { success: true, message: "No subscription to process" };
  }

  // ========== IDEMPOTENCY CHECK ==========
  const { data: existingSub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (existingSub) {
    logStep("IDEMPOTENT: Subscription already processed", { subscriptionId, userId: existingSub.user_id });
    return { success: true, skipped: true, userId: existingSub.user_id };
  }

  // ========== FIND USER ==========
  let userId: string | null = null;

  // Priority 1: client_reference_id (set by our create-checkout)
  if (clientReferenceId) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(clientReferenceId);
    if (userData?.user) {
      userId = userData.user.id;
      logStep("User found via client_reference_id", { userId });
    }
  }

  // Priority 2: email lookup
  if (!userId && customerEmail) {
    const { data: existingUserData } = await supabaseAdmin.auth.admin.getUserByEmail(customerEmail);
    if (existingUserData?.user) {
      userId = existingUserData.user.id;
      logStep("User found via email", { userId, email: customerEmail });
    }
  }

  if (!userId) {
    logStep("ERROR: No user found for checkout", { email: customerEmail, clientReferenceId });
    throw new Error(`No user found for checkout. Email: ${customerEmail}, clientReferenceId: ${clientReferenceId}`);
  }

  // ========== CHECK EXISTING SUBSCRIPTION ==========
  const { data: userSub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('id, status, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (userSub?.status === 'active') {
    logStep("User already has active subscription - updating stripe_customer_id only", { userId });
    if (userSub.stripe_customer_id !== stripeCustomerId) {
      await supabaseAdmin
        .from('user_subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userSub.id);
    }
    return { success: true, userId, alreadyActive: true };
  }

  // ========== SUBSCRIPTION SETUP ==========
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['latest_invoice']
  }) as any;

  const priceId = subscription.items.data[0]?.price.id;
  const billingCycle = subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly';

  const periodStart = subscription.current_period_start || subscription.billing_cycle_anchor || subscription.created;
  let periodEnd = subscription.current_period_end;
  
  if (!periodEnd && periodStart) {
    const latestInvoice = subscription.latest_invoice;
    if (latestInvoice && latestInvoice.period_end) {
      periodEnd = latestInvoice.period_end;
    } else {
      const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
      const startDate = new Date(periodStart * 1000);
      if (interval === 'year') {
        startDate.setFullYear(startDate.getFullYear() + 1);
      } else {
        startDate.setMonth(startDate.getMonth() + 1);
      }
      periodEnd = Math.floor(startDate.getTime() / 1000);
    }
  }

  const currentPeriodStartISO = periodStart && typeof periodStart === 'number'
    ? new Date(periodStart * 1000).toISOString()
    : new Date().toISOString();
  const currentPeriodEndISO = periodEnd && typeof periodEnd === 'number'
    ? new Date(periodEnd * 1000).toISOString()
    : null;

  // Find matching plan
  let planId: string | null = null;
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .maybeSingle();

  if (plan) {
    planId = plan.id;
  } else {
    logStep("WARNING: No matching plan for priceId, using fallback");
    const { data: fallbackPlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('role', 'premium')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    planId = fallbackPlan?.id;
  }

  logStep("Subscription details", { subscriptionId, priceId, billingCycle, planFound: !!planId });

  if (planId) {
    const { error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: stripeCustomerId,
        stripe_price_id: priceId,
        status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
        billing_cycle: billingCycle,
        current_period_start: currentPeriodStartISO,
        current_period_end: currentPeriodEndISO,
        payment_gateway: 'stripe',
        cancelled_at: null,
      }, { onConflict: 'user_id' });

    if (subError) {
      logStep("Error upserting subscription", { error: subError.message });
    } else {
      logStep("Subscription created/updated successfully");
    }
  }

  // ========== ROLE UPDATE (with master/admin protection) ==========
  const { data: isMasterUser } = await supabaseAdmin
    .from('master_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: existingRole } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (isMasterUser || existingRole?.role === 'admin') {
    logStep("User is master/admin - preserving privileges");
  } else {
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_roles').insert({ user_id: userId, role: 'premium', expires_at: null });
    logStep("User role updated to premium");
  }

  return { success: true, userId, alreadyActive: false };
}

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
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    let event: Stripe.Event;
    
    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        logStep("Webhook signature verification failed", { error: err.message });
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      event = JSON.parse(body);
      logStep("Webhook parsed without signature verification (dev mode)");
    }

    logStep("Event type", { type: event.type });

    // ========== checkout.session.completed ==========
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handleCheckoutCompleted(supabaseAdmin, stripe, session);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== customer.subscription.updated ==========
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      logStep("Processing subscription update", { subscriptionId: subscription.id, status: subscription.status });

      const { error } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
          current_period_start: subscription.current_period_start 
            ? new Date(subscription.current_period_start * 1000).toISOString() 
            : new Date().toISOString(),
          current_period_end: subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000).toISOString() 
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) logStep("Error updating subscription", { error: error.message });
      else logStep("Subscription updated successfully");

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== customer.subscription.deleted ==========
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      logStep("Processing subscription cancellation", { subscriptionId: subscription.id });

      await supabaseAdmin
        .from('user_subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscription.id);

      const { data: sub } = await supabaseAdmin
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (sub?.user_id) {
        const { data: isMaster } = await supabaseAdmin
          .from('master_users')
          .select('user_id')
          .eq('user_id', sub.user_id)
          .maybeSingle();
        
        const { data: currentRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', sub.user_id)
          .maybeSingle();

        if (!isMaster && currentRole?.role !== 'admin') {
          await supabaseAdmin
            .from('user_roles')
            .update({ role: 'free' })
            .eq('user_id', sub.user_id);
          logStep("User role reverted to free");
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== invoice.paid ==========
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      
      logStep("Processing invoice paid", { invoiceId: invoice.id, subscriptionId });

      if (subscriptionId) {
        const { data: sub, error } = await supabaseAdmin
          .from('user_subscriptions')
          .update({ status: 'active' })
          .eq('stripe_subscription_id', subscriptionId)
          .select('user_id')
          .maybeSingle();

        if (!error && sub?.user_id) {
          const { data: isMaster } = await supabaseAdmin
            .from('master_users')
            .select('user_id')
            .eq('user_id', sub.user_id)
            .maybeSingle();

          const { data: currentRole } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', sub.user_id)
            .maybeSingle();

          if (!isMaster && currentRole?.role !== 'admin') {
            await supabaseAdmin.from('user_roles').delete().eq('user_id', sub.user_id);
            await supabaseAdmin.from('user_roles').insert({ user_id: sub.user_id, role: 'premium', expires_at: null });
            logStep("User role restored to premium after payment");
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== invoice.payment_failed ==========
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      
      logStep("Processing invoice payment failed", { invoiceId: invoice.id, subscriptionId });

      if (subscriptionId) {
        await supabaseAdmin
          .from('user_subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId);
        logStep("Subscription marked as past_due");
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unhandled event
    logStep("Unhandled event type", { type: event.type });
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
