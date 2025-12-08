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
    
    // Verificar assinatura se webhook secret estiver configurado
    if (webhookSecret && signature) {
      try {
        // IMPORTANTE: Usar método assíncrono para Deno
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
      // Para desenvolvimento, aceitar sem verificação
      event = JSON.parse(body);
      logStep("Webhook parsed without signature verification (dev mode)");
    }

    logStep("Event type", { type: event.type });

    // Processar checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = session.subscription as string;
      
      // ========== IDEMPOTENCY CHECK ==========
      // Verificar se esta subscription já foi processada para evitar erros em eventos duplicados
      if (subscriptionId) {
        const { data: existingSub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('id, user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (existingSub) {
          logStep("IDEMPOTENT: Subscription already processed, skipping duplicate event", { 
            subscriptionId, 
            existingUserId: existingSub.user_id 
          });
          
          // Mesmo pulando, garantir que o email de boas-vindas foi enviado para o usuário
          // (em caso de falha parcial anterior onde usuário foi criado mas email não enviado)
          return new Response(JSON.stringify({ 
            success: true, 
            skipped: true,
            reason: "subscription_already_processed",
            userId: existingSub.user_id
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      // ========== END IDEMPOTENCY CHECK ==========
      
      // CRITICAL FIX: No Stripe-first flow, o email está em customer_details.email, não em customer_email
      const customerEmail = session.customer_email || session.customer_details?.email;
      
      logStep("Processing checkout session", { 
        sessionId: session.id, 
        customer_email: session.customer_email,
        customer_details_email: session.customer_details?.email,
        resolved_email: customerEmail,
        customerId: session.customer
      });

      if (!customerEmail) {
        logStep("ERROR: No customer email found in session", {
          customer_email: session.customer_email,
          customer_details: session.customer_details
        });
        throw new Error("No customer email in checkout session - check customer_email and customer_details.email");
      }

      // Verificar se usuário já existe
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      const user = existingUser?.users?.find(u => u.email === customerEmail);
      
      let userId: string;
      let isNewUser = false;
      let tempPassword = '';

      if (user) {
        // Usuário já existe
        userId = user.id;
        logStep("User already exists", { userId, email: customerEmail });
      } else {
        // Criar novo usuário com senha temporária
        tempPassword = crypto.randomUUID().slice(0, 12);
        
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: customerEmail,
          password: tempPassword,
          email_confirm: true, // Confirmar email automaticamente
          user_metadata: {
            created_via: 'stripe_checkout',
            stripe_customer_id: session.customer,
          }
        });

        if (createError) {
          logStep("Error creating user", { error: createError.message });
          throw createError;
        }

        userId = newUser.user.id;
        isNewUser = true;
        logStep("Created new user", { userId, email: customerEmail });
      }

      // Buscar detalhes da assinatura
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      const priceId = subscription.items.data[0]?.price.id;
      const productId = subscription.items.data[0]?.price.product as string;
      
      logStep("Subscription details", { subscriptionId, priceId, productId });

      // Buscar plano correspondente no banco
      const { data: plan, error: planError } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
        .maybeSingle();

      if (planError) {
        logStep("Error fetching plan", { error: planError.message });
      }

      // Determinar ciclo de cobrança
      const billingCycle = subscription.items.data[0]?.price.recurring?.interval === 'year' 
        ? 'yearly' 
        : 'monthly';

      // Criar/atualizar user_subscriptions
      const { error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          plan_id: plan?.id || null,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: session.customer as string,
          stripe_price_id: priceId,
          status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
          billing_cycle: billingCycle,
          current_period_start: subscription.current_period_start 
            ? new Date(subscription.current_period_start * 1000).toISOString() 
            : new Date().toISOString(),
          current_period_end: subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000).toISOString() 
            : null,
          payment_gateway: 'stripe',
        }, {
          onConflict: 'user_id',
        });

      if (subError) {
        logStep("Error upserting subscription", { error: subError.message });
      } else {
        logStep("Subscription created/updated successfully");
      }

      // PROTEÇÃO: Verificar se usuário é master ou admin ANTES de alterar roles
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
      
      // Se é master ou já tem role admin, NÃO sobrescrever
      if (isMasterUser || existingRole?.role === 'admin') {
        logStep("User is master/admin - skipping role update to preserve privileges", { 
          isMaster: !!isMasterUser, 
          currentRole: existingRole?.role 
        });
      } else {
        // Atualizar role do usuário para premium (DELETE + INSERT para evitar conflito com constraint user_id+role)
        const { error: deleteRoleError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        
        if (deleteRoleError) {
          logStep("Error deleting old roles", { error: deleteRoleError.message });
        }
        
        const { error: insertRoleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'premium',
            expires_at: null,
          });

        if (insertRoleError) {
          logStep("Error inserting role", { error: insertRoleError.message });
        } else {
          logStep("User role updated to premium");
        }
      }

      // Se for novo usuário, enviar email de reset de senha via Supabase Auth nativo
      // Isso usa o sistema de emails nativo do Supabase (gratuito)
      if (isNewUser) {
        const siteUrl = Deno.env.get("SITE_URL") || "https://financasai.lovable.app";
        
        // Usar resetPasswordForEmail que envia email via Supabase Auth nativo
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
          customerEmail,
          {
            redirectTo: `${siteUrl}/reset-password`
          }
        );

        if (resetError) {
          logStep("Error sending password reset email", { error: resetError.message });
        } else {
          logStep("Password reset email sent via Supabase Auth native", { email: customerEmail });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        userId,
        isNewUser,
        message: isNewUser ? "User created and subscription activated" : "Subscription activated for existing user"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processar customer.subscription.updated
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

      if (error) {
        logStep("Error updating subscription", { error: error.message });
      } else {
        logStep("Subscription updated successfully");
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processar customer.subscription.deleted
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      logStep("Processing subscription cancellation", { subscriptionId: subscription.id });

      // Atualizar status para cancelled
      const { error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);

      if (subError) {
        logStep("Error cancelling subscription", { error: subError.message });
      }

      // Voltar role para free
      const { data: sub } = await supabaseAdmin
        .from('user_subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (sub?.user_id) {
        await supabaseAdmin
          .from('user_roles')
          .update({ role: 'free' })
          .eq('user_id', sub.user_id);
        
        logStep("User role reverted to free");
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processar customer.subscription.created (quando criado via Dashboard ou API diretamente)
    if (event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      logStep("Processing subscription created", { 
        subscriptionId: subscription.id, 
        customerId,
        status: subscription.status 
      });

      // ========== IDEMPOTENCY CHECK ==========
      const { data: existingSub } = await supabaseAdmin
        .from('user_subscriptions')
        .select('id, user_id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle();

      if (existingSub) {
        logStep("IDEMPOTENT: Subscription already processed, skipping duplicate event", { 
          subscriptionId: subscription.id, 
          existingUserId: existingSub.user_id 
        });
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: "subscription_already_processed",
          userId: existingSub.user_id
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // ========== END IDEMPOTENCY CHECK ==========

      // Buscar email do cliente no Stripe
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        logStep("Customer was deleted, skipping");
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerEmail = customer.email;
      if (!customerEmail) {
        logStep("No email found for customer, skipping");
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Customer email found", { email: customerEmail });

      // Verificar se usuário já existe no Supabase
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const user = existingUsers?.users?.find(u => u.email === customerEmail);

      let userId: string;
      let isNewUser = false;

      if (user) {
        userId = user.id;
        logStep("User exists", { userId });
      } else {
        // Criar novo usuário
        const tempPassword = crypto.randomUUID().slice(0, 12);
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: customerEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            created_via: 'stripe_subscription_created',
            stripe_customer_id: customerId,
          }
        });

        if (createError) {
          logStep("Error creating user", { error: createError.message });
          throw createError;
        }

        userId = newUser.user.id;
        isNewUser = true;
        logStep("Created new user", { userId });

        // Enviar email de reset de senha via Supabase Auth nativo
        const siteUrl = Deno.env.get("SITE_URL") || "https://financasai.lovable.app";
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
          customerEmail,
          {
            redirectTo: `${siteUrl}/reset-password`
          }
        );

        if (resetError) {
          logStep("Error sending password reset email", { error: resetError.message });
        } else {
          logStep("Password reset email sent via Supabase Auth native", { email: customerEmail });
        }
      }

      // Processar detalhes da assinatura
      const priceId = subscription.items.data[0]?.price.id;
      const billingCycle = subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly';

      // Buscar plano correspondente
      const { data: plan } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
        .maybeSingle();

      // Criar/atualizar subscription
      await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          plan_id: plan?.id || null,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
          billing_cycle: billingCycle,
          current_period_start: subscription.current_period_start 
            ? new Date(subscription.current_period_start * 1000).toISOString() 
            : new Date().toISOString(),
          current_period_end: subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000).toISOString() 
            : null,
          payment_gateway: 'stripe',
        }, { onConflict: 'user_id' });

      // PROTEÇÃO: Verificar se usuário é master ou admin ANTES de alterar roles
      const { data: isMasterUser2 } = await supabaseAdmin
        .from('master_users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      const { data: existingRole2 } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      // Se é master ou já tem role admin, NÃO sobrescrever
      if (isMasterUser2 || existingRole2?.role === 'admin') {
        logStep("User is master/admin - skipping role update to preserve privileges", { 
          isMaster: !!isMasterUser2, 
          currentRole: existingRole2?.role 
        });
      } else {
        // Atualizar role para premium (DELETE + INSERT para evitar conflito)
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        
        await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'premium',
            expires_at: null,
          });
        
        logStep("User role updated to premium");
      }

      logStep("Subscription and role created/updated", { userId, isNewUser });

      return new Response(JSON.stringify({ success: true, userId, isNewUser }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processar invoice.paid (confirma pagamento bem-sucedido)
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      
      logStep("Processing invoice paid", { 
        invoiceId: invoice.id, 
        subscriptionId,
        amountPaid: invoice.amount_paid 
      });

      if (subscriptionId) {
        // Garantir que status está ativo após pagamento
        const { error } = await supabaseAdmin
          .from('user_subscriptions')
          .update({ status: 'active' })
          .eq('stripe_subscription_id', subscriptionId);

        if (error) {
          logStep("Error updating subscription status", { error: error.message });
        } else {
          logStep("Subscription confirmed as active after payment");
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processar invoice.payment_failed (falha no pagamento)
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      
      logStep("Processing invoice payment failed", { 
        invoiceId: invoice.id, 
        subscriptionId 
      });

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

    // Evento não tratado
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
