import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-PIX-PAYMENT] ${step}${detailsStr}`);
};

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (upTo: number) => {
    let sum = 0;
    for (let i = 0; i < upTo; i++) sum += Number(digits[i]) * (upTo + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

// Mercado Pago rejects the trailing "Z" from toISOString(); it wants an explicit offset.
function mpDate(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` +
    `.${pad(d.getUTCMilliseconds(), 3)}+00:00`
  );
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
    logStep("Function started");

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set");

    const {
      cycle,
      cpf,
      payer_name,
      referral_code,
      userId: bodyUserId,
      email: bodyEmail,
    } = await req.json();
    logStep("Received request", { cycle, bodyUserId, referral_code });

    if (!cycle || !["monthly", "yearly"].includes(cycle)) {
      throw new Error("cycle must be 'monthly' or 'yearly'");
    }

    const cpfDigits = String(cpf ?? "").replace(/\D/g, "");
    if (!isValidCpf(cpfDigits)) {
      return new Response(JSON.stringify({ error: "INVALID_CPF" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth: same dual-path as create-pix-checkout ---
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

    // Same shape the mercadopago-webhook already parses.
    const externalRef = JSON.stringify({
      userId,
      email: userEmail,
      planId: plan.id,
      cycle,
      referralCode: referral_code || null,
    });

    const fullName = String(payer_name ?? "").trim();
    const firstName = fullName.split(/\s+/)[0] || "Cliente";
    const lastName = fullName.split(/\s+/).slice(1).join(" ") || "Dona Wilma";

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const payment = {
      transaction_amount: amount,
      description: `Dona Wilma Premium ${planLabel}`,
      payment_method_id: "pix",
      external_reference: externalRef,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      date_of_expiration: mpDate(expiresAt),
      payer: {
        email: userEmail,
        first_name: firstName,
        last_name: lastName,
        identification: { type: "CPF", number: cpfDigits },
      },
    };

    logStep("Creating MP payment", { amount, cycle });

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(payment),
    });

    const mpBody = await mpRes.json();

    if (!mpRes.ok) {
      logStep("Mercado Pago API error", { status: mpRes.status, body: mpBody });
      return new Response(
        JSON.stringify({ error: "MP_ERROR", message: mpBody?.message ?? "Erro no Mercado Pago" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const txData = mpBody?.point_of_interaction?.transaction_data;
    if (!txData?.qr_code) {
      logStep("Payment created but QR code missing", { id: mpBody?.id, status: mpBody?.status });
      throw new Error("Mercado Pago did not return a Pix QR code");
    }

    logStep("Pix payment created", { id: mpBody.id, status: mpBody.status });

    return new Response(
      JSON.stringify({
        paymentId: String(mpBody.id),
        qrCode: txData.qr_code,
        qrCodeBase64: txData.qr_code_base64 ?? null,
        ticketUrl: txData.ticket_url ?? null,
        expiresAt: expiresAt.toISOString(),
        amount,
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
