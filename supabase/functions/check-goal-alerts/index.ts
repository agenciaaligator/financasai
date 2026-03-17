import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

const THRESHOLDS = [70, 90, 100];

async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  if (!WHATSAPP_ACCESS_TOKEN) {
    console.error('❌ WhatsApp credentials not configured');
    return false;
  }

  const cleanTo = to.startsWith('+') ? to.substring(1) : to;

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'text',
        text: { body: message }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ WhatsApp API error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return false;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function getAlertMessage(threshold: number, categoryName: string, spent: number, goalAmount: number): string {
  const spentStr = formatCurrency(spent);
  const goalStr = formatCurrency(goalAmount);
  const percentage = Math.round((spent / goalAmount) * 100);

  if (threshold >= 100) {
    return `🚨 *Meta ultrapassada!*\n\nVocê gastou ${spentStr} de ${goalStr} em *${categoryName}* este mês (${percentage}%).\n\nConsidere revisar seus gastos nesta categoria.`;
  } else if (threshold >= 90) {
    return `⚠️ *Cuidado!* Você está em ${percentage}% da meta de *${categoryName}*\n\n${spentStr} de ${goalStr}\n\nVocê está quase no limite!`;
  } else {
    return `📊 *Atenção!* Você já usou ${percentage}% da meta de *${categoryName}*\n\n${spentStr} de ${goalStr}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept optional user_id to check only one user (called after transaction)
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id || null;
    } catch {
      // No body is fine — check all users
    }

    console.log(`🎯 [CHECK-GOAL-ALERTS] Starting check${targetUserId ? ` for user ${targetUserId.substring(0, 8)}...` : ' for all users'}`);

    // Get current month in YYYY-MM format (Brazil timezone)
    const now = new Date();
    const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentMonth = `${brTime.getFullYear()}-${String(brTime.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${currentMonth}-01`;
    const nextMonth = new Date(brTime.getFullYear(), brTime.getMonth() + 1, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    // Fetch goals
    let goalsQuery = supabase
      .from('monthly_goals')
      .select('id, user_id, category_id, amount, organization_id');

    if (targetUserId) {
      goalsQuery = goalsQuery.eq('user_id', targetUserId);
    }

    const { data: goals, error: goalsError } = await goalsQuery;
    if (goalsError) throw goalsError;
    if (!goals || goals.length === 0) {
      console.log('ℹ️ No goals found');
      return new Response(JSON.stringify({ checked: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Found ${goals.length} goals to check`);

    let alertsSent = 0;

    // Group goals by user for efficient querying
    const goalsByUser = new Map<string, typeof goals>();
    for (const goal of goals) {
      const existing = goalsByUser.get(goal.user_id) || [];
      existing.push(goal);
      goalsByUser.set(goal.user_id, existing);
    }

    for (const [userId, userGoals] of goalsByUser) {
      // Get user's expense transactions for current month
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('date', monthStart)
        .lt('date', monthEnd);

      if (!transactions) continue;

      // Get user's WhatsApp session
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (!session?.phone_number) {
        console.log(`⏭️ User ${userId.substring(0, 8)}... has no WhatsApp session, skipping`);
        continue;
      }

      // Get already sent alerts for this month
      const goalIds = userGoals.map(g => g.id);
      const { data: sentAlerts } = await supabase
        .from('goal_alerts_sent')
        .select('goal_id, threshold')
        .in('goal_id', goalIds)
        .eq('month', currentMonth);

      const sentSet = new Set((sentAlerts || []).map(a => `${a.goal_id}_${a.threshold}`));

      // Get category names
      const categoryIds = [...new Set(userGoals.map(g => g.category_id).filter(Boolean))];
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .in('id', categoryIds);

      const categoryMap = new Map((categories || []).map(c => [c.id, c.name]));

      for (const goal of userGoals) {
        if (!goal.category_id || !goal.amount) continue;

        const spent = transactions
          .filter(t => t.category_id === goal.category_id)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const percentage = (spent / Number(goal.amount)) * 100;

        // Check each threshold (highest first so we send the most relevant)
        for (const threshold of [...THRESHOLDS].reverse()) {
          if (percentage < threshold) continue;

          const key = `${goal.id}_${threshold}`;
          if (sentSet.has(key)) continue;

          // Send alert!
          const categoryName = categoryMap.get(goal.category_id) || 'Categoria';
          const message = getAlertMessage(threshold, categoryName, spent, Number(goal.amount));

          console.log(`📤 Sending ${threshold}% alert for goal ${goal.id} (${categoryName}: ${Math.round(percentage)}%)`);

          const sent = await sendWhatsAppMessage(session.phone_number, message);

          if (sent) {
            // Record the sent alert
            await supabase
              .from('goal_alerts_sent')
              .insert({
                user_id: userId,
                goal_id: goal.id,
                month: currentMonth,
                threshold
              });

            sentSet.add(key);
            alertsSent++;
          }

          // Only send the highest applicable threshold per goal
          break;
        }
      }
    }

    console.log(`✅ [CHECK-GOAL-ALERTS] Done. Checked ${goals.length} goals, sent ${alertsSent} alerts`);

    return new Response(JSON.stringify({ checked: goals.length, alertsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [CHECK-GOAL-ALERTS] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
