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

    const { priceId, locale, userId: bodyUserId, email: bodyEmail } = await req.json();
    logStep("Received request", { priceId, locale, bodyUserId, bodyEmail });

    const getStripeLocale = (loc?: string): string | undefined => {
      if (!loc) return undefined;
      if (loc === 'pt-BR') return 'pt-BR';
      return loc.split('-')[0];
    };

    if (!priceId) throw new Error("priceId is required");

    let userEmail: string;
    let userId: string;

    // Try auth header first, fallback to body params
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: userData } = await supabaseClient.auth.getUser(token);
      if (userData?.user?.email) {
        userEmail = userData.user.email;
        userId = userData.user.id;
        logStep("User authenticated via token", { userId, email: userEmail });
      } else if (bodyUserId && bodyEmail) {
        userEmail = bodyEmail.toLowerCase().trim();
        userId = bodyUserId;
        logStep("Using body params (token invalid)", { userId, email: userEmail });
      } else {
        throw new Error("User not authenticated or email not available");
      }
    } else if (bodyUserId && bodyEmail) {
      userEmail = bodyEmail.toLowerCase().trim();
      userId = bodyUserId;
      logStep("Using body params (no auth token)", { userId, email: userEmail });
    } else {
      throw new Error("Authentication required: provide auth token or userId/email in body");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check if customer already exists in Stripe
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://donawilma.lovable.app";
    logStep("Creating checkout session", { origin, priceId });

    const checkoutConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      client_reference_id: userId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      locale: getStripeLocale(locale) as any,
    };

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
