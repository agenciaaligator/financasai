import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-PIX-PAYMENT] ${step}${detailsStr}`);
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
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

    const { paymentId, userId: bodyUserId, email: bodyEmail } = await req.json();
    if (!paymentId) throw new Error("paymentId is required");

    // --- Auth: same dual-path as create-pix-payment ---
    let userId: string;
    let authenticatedViaToken = false;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id) {
        userId = userData.user.id;
        authenticatedViaToken = true;
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
      userId = userLookup.user.id;
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });

    if (!paymentRes.ok) {
      logStep("Failed to fetch payment", { status: paymentRes.status });
      throw new Error("Could not fetch payment from Mercado Pago");
    }

    const payment = await paymentRes.json();

    // The caller may only inspect their own payment.
    let refUserId: string | null = null;
    try {
      refUserId = JSON.parse(payment.external_reference)?.userId ?? null;
    } catch {
      refUserId = null;
    }
    if (refUserId !== userId) {
      logStep("Payment does not belong to caller", { paymentId });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Payment status", { paymentId, status: payment.status });

    // Self-healing: if Mercado Pago approved the payment but its webhook never
    // reached us, replay the notification through the canonical activation path.
    if (payment.status === "approved") {
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("status, mercadopago_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();

      const alreadyActive =
        sub?.status === "active" && sub?.mercadopago_subscription_id === String(paymentId);

      if (!alreadyActive) {
        logStep("Subscription not active yet, replaying webhook");
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "payment", data: { id: String(paymentId) } }),
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: payment.status,
        statusDetail: payment.status_detail ?? null,
      }),
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
