import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACTIVATE-TRIAL-COUPON] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { couponCode } = await req.json();
    if (!couponCode) throw new Error("couponCode is required");
    logStep("Received couponCode", { couponCode });

    // 1. Validar cupom
    const { data: coupon, error: couponError } = await supabaseClient
      .from('discount_coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (couponError) throw couponError;
    if (!coupon) throw new Error("Cupom inválido ou inativo");

    // Verificar expiração
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      throw new Error("Cupom expirado");
    }

    // Verificar limite de uso
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      throw new Error("Cupom atingiu limite de uso");
    }

    logStep("Coupon validated", { couponId: coupon.id, type: coupon.type });

    // 2. Buscar plano premium
    const { data: premiumPlan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('id')
      .eq('name', 'premium')
      .eq('is_active', true)
      .single();

    if (planError || !premiumPlan) throw new Error("Plano premium não encontrado");
    logStep("Premium plan found", { planId: premiumPlan.id });

    // 3. Calcular data de expiração (30 dias)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    // 4. Criar subscription
    const { error: subError } = await supabaseClient
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: premiumPlan.id,
        status: 'active',
        billing_cycle: 'trial',
        current_period_start: new Date().toISOString(),
        current_period_end: trialEnd.toISOString(),
        payment_gateway: 'coupon',
      });

    if (subError) {
      logStep("Error creating subscription", { error: subError });
      throw subError;
    }
    logStep("Subscription created");

    // 5. Atualizar role para trial
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .upsert({
        user_id: user.id,
        role: 'trial',
        expires_at: trialEnd.toISOString(),
      }, {
        onConflict: 'user_id,role'
      });

    if (roleError) {
      logStep("Error updating role", { error: roleError });
      throw roleError;
    }
    logStep("User role updated to trial");

    // 6. Registrar uso do cupom
    const { error: userCouponError } = await supabaseClient
      .from('user_coupons')
      .insert({
        user_id: user.id,
        coupon_id: coupon.id,
      });

    if (userCouponError) {
      logStep("Error recording coupon usage", { error: userCouponError });
    }

    // 7. Incrementar contador de uso
    const { error: updateCouponError } = await supabaseClient
      .from('discount_coupons')
      .update({ current_uses: (coupon.current_uses || 0) + 1 })
      .eq('id', coupon.id);

    if (updateCouponError) {
      logStep("Error incrementing coupon usage", { error: updateCouponError });
    }

    logStep("Trial activated successfully", { 
      userId: user.id, 
      couponCode,
      expiresAt: trialEnd.toISOString()
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: "Trial de 30 dias ativado com sucesso!",
      expires_at: trialEnd.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});