import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MERCADOPAGO-WEBHOOK] ${step}${detailsStr}`);
};

async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) return false;
  const cleanTo = to.startsWith("+") ? to.substring(1) : to;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanTo,
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) {
      logStep("WhatsApp API error", { status: res.status, body: await res.text() });
      return false;
    }
    return true;
  } catch (e) {
    logStep("WhatsApp send error", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

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
    const body = await req.json();
    logStep("Webhook received", { type: body.type, action: body.action });

    // Mercado Pago sends different notification formats.
    // Checkout Pro / IPN: { type: "payment", data: { id: "123" } }
    // Webhooks v2: { action: "payment.created", data: { id: "123" } }
    let paymentId: string | null = null;

    if (body.data?.id) {
      paymentId = String(body.data.id);
    } else if (body.id && body.topic === "payment") {
      paymentId = String(body.id);
    }

    if (!paymentId) {
      logStep("Not a payment notification, ignoring");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Fetch payment details from Mercado Pago ---
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not set");

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });

    if (!paymentRes.ok) {
      logStep("Failed to fetch payment", { status: paymentRes.status });
      return new Response(JSON.stringify({ error: "Failed to fetch payment" }), {
        status: 200, // Return 200 so MP doesn't retry endlessly
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await paymentRes.json();
    logStep("Payment fetched", { id: payment.id, status: payment.status, external_reference: payment.external_reference });

    if (payment.status !== "approved") {
      logStep("Payment not approved, skipping", { status: payment.status });
      return new Response(JSON.stringify({ ok: true, status: payment.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Parse external_reference ---
    let refData: { userId: string; email: string; planId: string; cycle: string; referralCode: string | null };
    try {
      refData = JSON.parse(payment.external_reference);
    } catch {
      logStep("Could not parse external_reference", { raw: payment.external_reference });
      return new Response(JSON.stringify({ error: "Invalid external_reference" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, planId, cycle, referralCode } = refData;
    logStep("Parsed reference", { userId, planId, cycle, referralCode });

    // --- Idempotency: check if already processed ---
    const { data: existingSub } = await supabase
      .from("user_subscriptions")
      .select("id, mercadopago_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingSub?.mercadopago_subscription_id === String(paymentId)) {
      logStep("Payment already processed, skipping");
      return new Response(JSON.stringify({ ok: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Calculate subscription period ---
    const now = new Date();
    const periodEnd = new Date(now);
    if (cycle === "yearly") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // --- Activate subscription ---
    const { error: subError } = await supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_id: planId,
          status: "active",
          billing_cycle: cycle,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          payment_gateway: "mercadopago",
          mercadopago_subscription_id: String(paymentId),
          stripe_subscription_id: null,
          stripe_customer_id: null,
          stripe_price_id: null,
          cancelled_at: null,
        },
        { onConflict: "user_id" }
      );

    if (subError) {
      logStep("Error upserting subscription", { error: subError.message });
      throw subError;
    }
    logStep("Subscription activated via Pix");

    // --- Update user role to premium ---
    const { data: isMasterUser } = await supabase
      .from("master_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (isMasterUser || existingRole?.role === "admin") {
      logStep("User is master/admin - preserving privileges");
    } else {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: "premium", expires_at: null });
      logStep("User role updated to premium");
    }

    // --- Affiliate commission (same logic as stripe-webhook) ---
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code, email, phone_number")
        .eq("user_id", userId)
        .maybeSingle();

      const finalReferralCode = profile?.referral_code || referralCode;

      if (finalReferralCode) {
        const { data: affiliate } = await supabase
          .from("affiliates")
          .select("*")
          .eq("referral_code", finalReferralCode)
          .eq("active", true)
          .maybeSingle();

        if (affiliate) {
          const amountPaid = payment.transaction_amount ?? 0;
          const commissionValue = cycle === "yearly"
            ? affiliate.commission_value_yearly
            : affiliate.commission_value_monthly;
          const commissionAmount = affiliate.commission_type === "percent"
            ? Math.round(amountPaid * (Number(commissionValue) / 100) * 100) / 100
            : Number(commissionValue);

          const { data: plan } = await supabase
            .from("subscription_plans")
            .select("name")
            .eq("id", planId)
            .maybeSingle();

          const { error: refError } = await supabase
            .from("affiliate_referrals")
            .insert({
              affiliate_id: affiliate.id,
              referred_user_id: userId,
              referred_email: profile?.email || refData.email,
              plan_name: plan?.name ?? null,
              amount_paid: amountPaid,
              commission_amount: commissionAmount,
            });

          if (refError) {
            logStep("Affiliate referral insert skipped/failed", { error: refError.message });
          } else {
            logStep("Affiliate commission recorded", { affiliateId: affiliate.id, commissionAmount });
            if (affiliate.phone_number) {
              const planLabel = cycle === "yearly" ? "anual" : "mensal";
              await sendWhatsAppMessage(
                affiliate.phone_number,
                `🎉 Boa, ${affiliate.name}! Seu link de indicação (${affiliate.referral_code}) gerou uma nova venda ` +
                `(plano ${planLabel}, via Pix). Sua comissão de R$ ${commissionAmount.toFixed(2)} já está registrada. Continue divulgando! 💙`
              );
            }
          }
        }
      }
    } catch (e) {
      logStep("Affiliate commission error (non-blocking)", { error: e instanceof Error ? e.message : String(e) });
    }

    return new Response(JSON.stringify({ ok: true, userId, status: "activated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 200, // Always 200 to avoid Mercado Pago retries on our errors
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
