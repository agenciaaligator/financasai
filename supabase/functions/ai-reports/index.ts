import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  period: 'day' | 'week' | 'month' | 'year';
  user_id: string;
  question?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { period, user_id, question }: ReportRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get date range based on period
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Fetch transactions for the period
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (name, type, color)
      `)
      .eq('user_id', user_id)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (transactionsError) {
      throw new Error(`Erro ao buscar transações: ${transactionsError.message}`);
    }

    // Calculate summary
    const income = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const expenses = transactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const profit = income - expenses;

    // Generate categories summary
    const categoriesMap = new Map();
    transactions?.forEach(t => {
      const categoryName = t.categories?.name || 'Outros';
      const key = `${categoryName}-${t.type}`;
      
      if (!categoriesMap.has(key)) {
        categoriesMap.set(key, {
          name: categoryName,
          type: t.type,
          total: 0,
          count: 0
        });
      }
      
      const category = categoriesMap.get(key);
      category.total += Number(t.amount);
      category.count += 1;
    });

    const categoriesSummary = Array.from(categoriesMap.values());

    // Format currency
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    // Get period label in Portuguese
    const periodLabels = {
      day: 'do dia',
      week: 'da semana',
      month: 'do mês',
      year: 'do ano'
    };

    // Generate AI-style report
    let report = `📊 **RELATÓRIO FINANCEIRO ${periodLabels[period].toUpperCase()}**\n\n`;
    
    report += `💰 **RESUMO GERAL:**\n`;
    report += `• Receitas: ${formatCurrency(income)}\n`;
    report += `• Despesas: ${formatCurrency(expenses)}\n`;
    report += `• ${profit >= 0 ? 'Lucro' : 'Prejuízo'}: ${formatCurrency(Math.abs(profit))}\n`;
    report += `• Total de transações: ${transactions?.length || 0}\n\n`;

    if (profit >= 0) {
      report += `✅ **SITUAÇÃO POSITIVA!** Você teve um lucro de ${formatCurrency(profit)} ${periodLabels[period]}.\n\n`;
    } else {
      report += `⚠️ **ATENÇÃO!** Você teve um prejuízo de ${formatCurrency(Math.abs(profit))} ${periodLabels[period]}.\n\n`;
    }

    // Top categories
    const topExpenses = categoriesSummary
      .filter(c => c.type === 'expense')
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    const topIncomes = categoriesSummary
      .filter(c => c.type === 'income')
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    if (topExpenses.length > 0) {
      report += `📉 **MAIORES DESPESAS:**\n`;
      topExpenses.forEach((cat, index) => {
        report += `${index + 1}. ${cat.name}: ${formatCurrency(cat.total)} (${cat.count} transações)\n`;
      });
      report += `\n`;
    }

    if (topIncomes.length > 0) {
      report += `📈 **MAIORES RECEITAS:**\n`;
      topIncomes.forEach((cat, index) => {
        report += `${index + 1}. ${cat.name}: ${formatCurrency(cat.total)} (${cat.count} transações)\n`;
      });
      report += `\n`;
    }

    // Insights and recommendations
    report += `💡 **INSIGHTS E RECOMENDAÇÕES:**\n`;
    
    if (profit < 0) {
      report += `• Suas despesas estão ${formatCurrency(Math.abs(profit))} acima das receitas\n`;
      report += `• Considere revisar os gastos nas categorias que mais consomem seu orçamento\n`;
      report += `• Procure oportunidades de aumentar sua renda\n`;
    } else {
      report += `• Parabéns! Você está no azul com ${formatCurrency(profit)} de sobra\n`;
      report += `• Considere investir esse valor ou criar uma reserva de emergência\n`;
      report += `• Continue mantendo o controle dos seus gastos\n`;
    }

    if (transactions?.length === 0) {
      report = `📊 **RELATÓRIO FINANCEIRO ${periodLabels[period].toUpperCase()}**\n\n`;
      report += `Não há transações registradas para este período.\n`;
      report += `Adicione algumas transações para visualizar relatórios detalhados.\n`;
    }

    // If there's a specific question, add a personalized response
    if (question) {
      report += `\n🤖 **RESPOSTA À SUA PERGUNTA:** "${question}"\n`;
      
      if (question.toLowerCase().includes('lucro') || question.toLowerCase().includes('prejuízo')) {
        report += `Com base nos dados ${periodLabels[period]}, você teve um ${profit >= 0 ? 'lucro' : 'prejuízo'} de ${formatCurrency(Math.abs(profit))}.\n`;
      }
      
      if (question.toLowerCase().includes('categoria') || question.toLowerCase().includes('gasto')) {
        if (topExpenses.length > 0) {
          report += `Sua maior categoria de gastos ${periodLabels[period]} foi "${topExpenses[0].name}" com ${formatCurrency(topExpenses[0].total)}.\n`;
        }
      }
      
      if (question.toLowerCase().includes('receita') || question.toLowerCase().includes('entrada')) {
        if (topIncomes.length > 0) {
          report += `Sua maior fonte de receita ${periodLabels[period]} foi "${topIncomes[0].name}" com ${formatCurrency(topIncomes[0].total)}.\n`;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        report,
        data: {
          summary: { income, expenses, profit },
          transactions: transactions?.length || 0,
          categories: categoriesSummary,
          period: periodLabels[period]
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in ai-reports function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});