import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Extrair dados do body
    const { priceId, cycle, email: providedEmail, couponCode } = await req.json();
    logStep("Received request", { priceId, cycle, providedEmail: !!providedEmail, couponCode });

    // Tentar obter usuário autenticado (opcional agora)
    let userEmail = providedEmail;
    let userId: string | undefined;
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      if (userData?.user?.email) {
        userEmail = userData.user.email;
        userId = userData.user.id;
        logStep("User authenticated", { userId, email: userEmail });
      }
    }

    // Buscar priceId do banco se não fornecido diretamente
    let finalPriceId = priceId;
    if (!finalPriceId && cycle) {
      const { data: plan } = await supabaseClient
        .from('subscription_plans')
        .select('stripe_price_id_monthly, stripe_price_id_yearly')
        .eq('name', 'premium')
        .single();
      
      if (plan) {
        finalPriceId = cycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
        logStep("Price ID fetched from database", { finalPriceId, cycle });
      }
    }

    if (!finalPriceId) throw new Error("priceId is required");
    logStep("Final price ID", { finalPriceId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Verificar se cliente já existe no Stripe
    let customerId: string | undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { customerId });
      }
    }

    const origin = req.headers.get("origin") || "https://financasai.lovable.app";
    logStep("Creating checkout session", { origin });

    // Configurar opções do checkout
    const checkoutConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-cancelled`,
      allow_promotion_codes: true, // Permitir códigos promocionais do Stripe
      billing_address_collection: 'required',
      customer_creation: customerId ? undefined : 'always',
    };

    // Aplicar cupom se fornecido
    if (couponCode) {
      try {
        // Verificar cupom no banco local primeiro
        const { data: localCoupon } = await supabaseClient
          .from('discount_coupons')
          .select('*')
          .eq('code', couponCode.toUpperCase())
          .eq('is_active', true)
          .maybeSingle();

        if (localCoupon) {
          logStep("Local coupon found", { type: localCoupon.type, value: localCoupon.value });
          
          if (localCoupon.type === 'trial' || localCoupon.type === 'full_access') {
            // Cupom de trial - adicionar período de teste
            const trialDays = localCoupon.value || 30;
            checkoutConfig.subscription_data = {
              trial_period_days: trialDays,
              metadata: {
                coupon_code: couponCode.toUpperCase(),
                coupon_type: 'trial',
              }
            };
            logStep("Trial period added", { trialDays });
          } else if (localCoupon.type === 'percentage') {
            // Tentar encontrar ou criar cupom no Stripe
            try {
              const stripeCoupon = await stripe.coupons.create({
                percent_off: localCoupon.value,
                duration: 'once',
                name: `${couponCode.toUpperCase()} - ${localCoupon.value}% off`,
              });
              checkoutConfig.discounts = [{ coupon: stripeCoupon.id }];
              logStep("Stripe percentage coupon created", { couponId: stripeCoupon.id });
            } catch (e) {
              logStep("Could not create Stripe coupon, using promotion codes", { error: e.message });
            }
          }
        }
      } catch (couponError) {
        logStep("Error processing coupon, continuing without discount", { error: couponError.message });
      }
    }

    const session = await stripe.checkout.sessions.create(checkoutConfig);

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
