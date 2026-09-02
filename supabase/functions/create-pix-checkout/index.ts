import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-PIX-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

    const { cycle, referral_code, userId: bodyUserId, email: bodyEmail } = await req.json();
    logStep("Received request", { cycle, bodyUserId, referral_code });

    if (!cycle || !["monthly", "yearly"].includes(cycle)) {
      throw new Error("cycle must be 'monthly' or 'yearly'");
    }

    // --- Auth: same dual-path as create-checkout ---
    let userId: string;
    let userEmail: string;
    let authenticatedViaToken = false;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.email) {
        userEmail = userData.user.email;
        userId = userData.user.id;
        authenticatedViaToken = true;
        logStep("User authenticated via token", { userId });
      }
    }

    if (!authenticatedViaToken) {
      if (!bodyUserId || !bodyEmail) {
        throw new Error("Authentication required: provide auth token or userId/email in body");
      }
      const { data: userLookup, error: lookupErr } = await supabase.auth.admin.getUserById(bodyUserId);
      if (lookupErr || !userLookup?.user) throw new Error("Invalid user credentials");
      const realEmail = (userLookup.user.email || "").toLowerCase().trim();
      if (realEmail !== String(bodyEmail).toLowerCase().trim()) throw new Error("Invalid user credentials");
      userEmail = realEmail;
      userId = userLookup.user.id;
      logStep("User validated via body params", { userId });
    }

    // --- Get plan price (always BRL for Pix) ---
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("id, price_monthly, price_yearly, name")
      .eq("role", "premium")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!plan) throw new Error("No active premium plan found");

    const amount = cycle === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
    if (!amount || amount <= 0) throw new Error("Invalid plan price");

    const planLabel = cycle === "yearly" ? "Anual" : "Mensal";
    const origin = Deno.env.get("SITE_URL") || "https://donawilma.com.br";

    // external_reference carries all data for the webhook
    const externalRef = JSON.stringify({
      userId,
      email: userEmail,
      planId: plan.id,
      cycle,
      referralCode: referral_code || null,
    });

    // --- Create Mercado Pago Checkout Pro preference (Pix only) ---
    const preference = {
      items: [
        {
          id: `donawilma-premium-${cycle}`,
          title: `Dona Wilma Premium ${planLabel}`,
          description: `Assinatura ${planLabel} - Dona Wilma`,
          quantity: 1,
          unit_price: amount,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: userEmail,
      },
      payment_methods: {
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "ticket" },
          { id: "atm" },
          { id: "prepaid_card" },
        ],
        installments: 1,
      },
      back_urls: {
        success: `${origin}/payment-success?gateway=mercadopago`,
        failure: `${origin}/payment-cancelled`,
        pending: `${origin}/payment-success?gateway=mercadopago`,
      },
      auto_return: "approved",
      external_reference: externalRef,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "DONAWILMA",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    };

    logStep("Creating MP preference", { amount, cycle });

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    if (!mpRes.ok) {
      const errBody = await mpRes.text();
      logStep("Mercado Pago API error", { status: mpRes.status, body: errBody });
      throw new Error(`Mercado Pago error: ${mpRes.status}`);
    }

    const mpData = await mpRes.json();
    logStep("Preference created", { id: mpData.id, init_point: mpData.init_point });

    return new Response(
      JSON.stringify({ url: mpData.init_point, preference_id: mpData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
