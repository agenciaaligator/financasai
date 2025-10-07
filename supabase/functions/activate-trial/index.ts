import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACTIVATE-TRIAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user has any existing subscription
    const { data: existingSubscriptions, error: subCheckError } = await supabaseClient
      .from("user_subscriptions")
      .select("id, status, plan_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (subCheckError && subCheckError.code !== "PGRST116") {
      throw new Error(`Error checking existing subscriptions: ${subCheckError.message}`);
    }

    // Check if user already has active subscription
    if (existingSubscriptions && existingSubscriptions.length > 0) {
      const lastSub = existingSubscriptions[0];
      
      if (lastSub.status === "active") {
        logStep("User already has active subscription", { subscription: lastSub });
        return new Response(
          JSON.stringify({ 
            error: "Plano ativo existente",
            message: "Você já possui um plano ativo" 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
    }

    // Get trial plan ID
    const { data: trialPlan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("id")
      .eq("name", "trial")
      .single();

    if (planError) throw new Error(`Error fetching trial plan: ${planError.message}`);
    logStep("Trial plan found", { planId: trialPlan.id });

    // Calculate trial end date (14 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    let subscription;

    // If user has inactive subscription, update it instead of creating new
    if (existingSubscriptions && existingSubscriptions.length > 0) {
      const lastSub = existingSubscriptions[0];
      logStep("Updating existing subscription to trial", { subscriptionId: lastSub.id });

      const { data: updatedSub, error: updateError } = await supabaseClient
        .from("user_subscriptions")
        .update({
          plan_id: trialPlan.id,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndDate.toISOString(),
          billing_cycle: "trial",
        })
        .eq("id", lastSub.id)
        .select()
        .single();

      if (updateError) throw new Error(`Error updating subscription: ${updateError.message}`);
      subscription = updatedSub;
      logStep("Subscription updated", { subscriptionId: subscription.id });
    } else {
      // Create new subscription record
      const { data: newSub, error: insertError } = await supabaseClient
        .from("user_subscriptions")
        .insert({
          user_id: user.id,
          plan_id: trialPlan.id,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndDate.toISOString(),
          billing_cycle: "trial",
        })
        .select()
        .single();

      if (insertError) throw new Error(`Error creating subscription: ${insertError.message}`);
      subscription = newSub;
      logStep("Subscription created", { subscriptionId: subscription.id });
    }

    // Update user role to trial
    const { error: roleError } = await supabaseClient
      .from("user_roles")
      .upsert({
        user_id: user.id,
        role: "trial",
        expires_at: trialEndDate.toISOString(),
      });

    if (roleError) throw new Error(`Error updating user role: ${roleError.message}`);
    logStep("User role updated to trial");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Trial ativado com sucesso!",
        trial_end: trialEndDate.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in activate-trial", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
