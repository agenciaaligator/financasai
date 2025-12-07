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
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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
      logStep("Processing checkout session", { 
        sessionId: session.id, 
        customerEmail: session.customer_email,
        customerId: session.customer
      });

      const customerEmail = session.customer_email;
      if (!customerEmail) {
        throw new Error("No customer email in checkout session");
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
      const subscriptionId = session.subscription as string;
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
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          payment_gateway: 'stripe',
        }, {
          onConflict: 'user_id',
        });

      if (subError) {
        logStep("Error upserting subscription", { error: subError.message });
      } else {
        logStep("Subscription created/updated successfully");
      }

      // Atualizar role do usuário para premium
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'premium',
          expires_at: null,
        }, {
          onConflict: 'user_id',
        });

      if (roleError) {
        logStep("Error upserting role", { error: roleError.message });
      } else {
        logStep("User role updated to premium");
      }

      // Se for novo usuário, enviar email com link de configuração de senha
      if (isNewUser) {
        // Gerar link de reset de senha
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: customerEmail,
        });

        if (resetError) {
          logStep("Error generating password reset link", { error: resetError.message });
        } else {
          logStep("Password reset link generated", { link: resetData.properties?.action_link });
          
          // Enviar email via Resend (se configurado)
          const resendKey = Deno.env.get("RESEND_API_KEY");
          if (resendKey) {
            try {
              const resetLink = resetData.properties?.action_link;
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${resendKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "Dona Wilma <noreply@donawilma.com.br>",
                  to: [customerEmail],
                  subject: "🎉 Bem-vindo ao Dona Wilma! Configure sua senha",
                  html: `
                    <h1>Bem-vindo ao Dona Wilma!</h1>
                    <p>Sua assinatura foi ativada com sucesso!</p>
                    <p>Para acessar sua conta, clique no botão abaixo para definir sua senha:</p>
                    <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#10b981;color:white;text-decoration:none;border-radius:8px;margin:20px 0;">
                      Definir Minha Senha
                    </a>
                    <p>Após definir sua senha, você poderá acessar o sistema e conectar seu WhatsApp.</p>
                    <p>Qualquer dúvida, estamos à disposição!</p>
                  `,
                }),
              });
              logStep("Welcome email sent");
            } catch (emailError) {
              logStep("Error sending welcome email", { error: emailError.message });
            }
          }
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
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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
