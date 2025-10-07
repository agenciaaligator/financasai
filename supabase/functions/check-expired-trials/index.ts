import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-EXPIRED-TRIALS] ${step}${detailsStr}`);
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

    // Get trial plan ID
    const { data: trialPlan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("id")
      .eq("name", "trial")
      .single();

    if (planError) throw new Error(`Error fetching trial plan: ${planError.message}`);
    logStep("Trial plan found", { planId: trialPlan.id });

    // Find all expired trials
    const { data: expiredTrials, error: trialsError } = await supabaseClient
      .from("user_subscriptions")
      .select("id, user_id, current_period_end")
      .eq("plan_id", trialPlan.id)
      .eq("status", "active")
      .lt("current_period_end", new Date().toISOString());

    if (trialsError) throw new Error(`Error fetching expired trials: ${trialsError.message}`);
    
    if (!expiredTrials || expiredTrials.length === 0) {
      logStep("No expired trials found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No expired trials to process",
          count: 0 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    logStep("Found expired trials", { count: expiredTrials.length });

    // Update subscriptions to expired
    const subscriptionIds = expiredTrials.map(t => t.id);
    const { error: updateSubError } = await supabaseClient
      .from("user_subscriptions")
      .update({ status: "expired" })
      .in("id", subscriptionIds);

    if (updateSubError) throw new Error(`Error updating subscriptions: ${updateSubError.message}`);
    logStep("Subscriptions updated to expired");

    // Revert user roles to free
    const userIds = expiredTrials.map(t => t.user_id);
    const { error: roleError } = await supabaseClient
      .from("user_roles")
      .upsert(
        userIds.map(userId => ({
          user_id: userId,
          role: "free",
          expires_at: null,
        }))
      );

    if (roleError) throw new Error(`Error updating user roles: ${roleError.message}`);
    logStep("User roles reverted to free", { count: userIds.length });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Expired trials processed successfully",
        count: expiredTrials.length,
        processed_users: userIds,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-expired-trials", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
