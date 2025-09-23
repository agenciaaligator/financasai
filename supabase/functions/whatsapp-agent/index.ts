import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppMessage {
  from: string;
  id?: string;
  body?: string;
  type?: string;
}

interface Session {
  id: string;
  phone_number: string;
  user_id?: string;
  session_data: any;
  last_activity: string;
  expires_at: string;
}

interface Transaction {
  id?: string;
  user_id: string;
  amount: number;
  title: string;
  type: 'income' | 'expense';
  date: string;
  description?: string;
  source: string;
}

// Inicializar Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Classes para gerenciamento de sessão e autenticação
class SessionManager {
  static async getSession(phoneNumber: string): Promise<Session | null> {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone_number', phoneNumber)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      console.log('No active session found for:', phoneNumber);
      return null;
    }

    return data;
  }

  static async createSession(phoneNumber: string, userId?: string): Promise<Session> {
    // Limpar sessões antigas primeiro
    await supabase
      .from('whatsapp_sessions')
      .delete()
      .eq('phone_number', phoneNumber);

    const sessionData = {
      phone_number: phoneNumber,
      user_id: userId,
      session_data: {
        authenticated: !!userId,
        last_command: null,
        context: {}
      },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
    };

    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_sessions')
      .update({
        ...updates,
        last_activity: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) throw error;
  }
}

class AuthManager {
  static async generateAuthCode(phoneNumber: string): Promise<string> {
    // Verificar se o usuário existe
    const { data: user } = await supabase
      .rpc('check_user_exists', { email_to_check: `${phoneNumber}@whatsapp.temp` });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Gerar código de 6 dígitos
    const code = Math.random().toString().slice(-6).padStart(6, '0');
    
    const { error } = await supabase
      .from('whatsapp_auth_codes')
      .insert({
        phone_number: phoneNumber,
        code: code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutos
      });

    if (error) throw error;
    return code;
  }

  static async validateAuthCode(phoneNumber: string, code: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('whatsapp_auth_codes')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    // Marcar código como usado
    await supabase
      .from('whatsapp_auth_codes')
      .update({ used: true })
      .eq('id', data.id);

    // Buscar usuário
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const user = authUsers.users.find(u => u.email === `${phoneNumber}@whatsapp.temp`);
    
    return user?.id || null;
  }
}

class TransactionParser {
  static parseTransactionFromText(text: string): Partial<Transaction> | null {
    const normalizedText = text.toLowerCase().trim();
    
    // Patterns para detectar transações
    const patterns = [
      // Padrão: "gasto 50 mercado" ou "receita 1000 salario"
      /^(gasto|receita|despesa|entrada)\s+(\d+(?:[\.,]\d{2})?)\s+(.+)$/,
      // Padrão: "+100 freelance" ou "-30 combustível" 
      /^([+-])(\d+(?:[\.,]\d{2})?)\s+(.+)$/,
      // Padrão: "50 mercado" (assume despesa)
      /^(\d+(?:[\.,]\d{2})?)\s+(.+)$/
    ];

    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        let type: 'income' | 'expense';
        let amount: number;
        let title: string;

        if (pattern === patterns[0]) {
          // Primeiro padrão
          type = ['receita', 'entrada'].includes(match[1]) ? 'income' : 'expense';
          amount = parseFloat(match[2].replace(',', '.'));
          title = match[3].trim();
        } else if (pattern === patterns[1]) {
          // Segundo padrão
          type = match[1] === '+' ? 'income' : 'expense';
          amount = parseFloat(match[2].replace(',', '.'));
          title = match[3].trim();
        } else {
          // Terceiro padrão (assume despesa)
          type = 'expense';
          amount = parseFloat(match[1].replace(',', '.'));
          title = match[2].trim();
        }

        if (amount > 0) {
          return {
            amount,
            title: title.charAt(0).toUpperCase() + title.slice(1),
            type,
            date: new Date().toISOString().split('T')[0],
            source: 'whatsapp'
          };
        }
      }
    }

    return null;
  }
}

class WhatsAppAgent {
  static async processMessage(session: Session, message: WhatsAppMessage): Promise<string> {
    const messageText = message.body?.toLowerCase().trim() || '';
    
    // Comandos de ajuda
    if (['ajuda', 'help', 'menu', 'comandos'].includes(messageText)) {
      return this.getHelpMenu();
    }

    // Comandos de relatório
    if (['relatorio', 'relatório', 'resumo', 'extrato'].includes(messageText)) {
      return await this.generateReport(session.user_id!);
    }

    // Comandos de saldo
    if (['saldo', 'balance', 'total'].includes(messageText)) {
      return await this.getBalance(session.user_id!);
    }

    // Tentar processar como transação
    const transaction = TransactionParser.parseTransactionFromText(messageText);
    if (transaction && session.user_id) {
      return await this.createTransaction(session.user_id, transaction);
    }

    // Resposta padrão para mensagens não compreendidas
    return `❓ *Não compreendi a mensagem.*\n\n` +
           `Você pode:\n` +
           `• Adicionar gastos: "gasto 50 mercado"\n` +
           `• Adicionar receitas: "receita 1000 salario"\n` +
           `• Ver saldo: "saldo"\n` +
           `• Ver relatório: "relatorio"\n` +
           `• Ver comandos: "ajuda"`;
  }

  static getHelpMenu(): string {
    return `🤖 *Assistente Financeiro WhatsApp*\n\n` +
           `*📝 Adicionar Transações:*\n` +
           `• gasto 50 mercado\n` +
           `• receita 1000 salario\n` +
           `• +100 freelance\n` +
           `• -30 combustível\n\n` +
           `*📊 Consultas:*\n` +
           `• *saldo* - Ver saldo atual\n` +
           `• *relatorio* - Resumo mensal\n` +
           `• *ajuda* - Este menu\n\n` +
           `💡 *Dica:* Use valores com pontos ou vírgulas (ex: 50.30 ou 50,30)`;
  }

  static async createTransaction(userId: string, transaction: Partial<Transaction>): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...transaction,
          user_id: userId
        })
        .select()
        .single();

      if (error) throw error;

      const emoji = transaction.type === 'income' ? '💰' : '💸';
      const typeText = transaction.type === 'income' ? 'Receita' : 'Despesa';
      
      return `✅ *${typeText} adicionada!*\n\n` +
             `${emoji} R$ ${transaction.amount?.toFixed(2)}\n` +
             `📝 ${transaction.title}\n` +
             `📅 ${new Date().toLocaleDateString('pt-BR')}`;
    } catch (error) {
      console.error('Error creating transaction:', error);
      return `❌ *Erro ao salvar transação.*\n\nTente novamente em alguns instantes.`;
    }
  }

  static async getBalance(userId: string): Promise<string> {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId);

      if (error) throw error;

      const income = transactions
        ?.filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const expenses = transactions
        ?.filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const balance = income - expenses;
      const balanceEmoji = balance >= 0 ? '💚' : '🔴';

      return `💰 *Seu Saldo Atual*\n\n` +
             `📈 Receitas: R$ ${income.toFixed(2)}\n` +
             `📉 Despesas: R$ ${expenses.toFixed(2)}\n` +
             `${balanceEmoji} *Saldo: R$ ${balance.toFixed(2)}*`;
    } catch (error) {
      console.error('Error getting balance:', error);
      return `❌ *Erro ao consultar saldo.*\n\nTente novamente em alguns instantes.`;
    }
  }

  static async generateReport(userId: string): Promise<string> {
    try {
      // Buscar transações do mês atual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startDate = startOfMonth.toISOString().split('T')[0];

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .order('date', { ascending: false });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        return `📊 *Relatório do Mês*\n\n❌ Nenhuma transação encontrada este mês.`;
      }

      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const balance = income - expenses;

      let report = `📊 *Relatório - ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}*\n\n`;
      report += `📈 Receitas: R$ ${income.toFixed(2)}\n`;
      report += `📉 Despesas: R$ ${expenses.toFixed(2)}\n`;
      report += `💰 Saldo: R$ ${balance.toFixed(2)}\n\n`;

      // Últimas 5 transações
      report += `*🕒 Últimas Transações:*\n`;
      const recent = transactions.slice(0, 5);
      recent.forEach(t => {
        const emoji = t.type === 'income' ? '💰' : '💸';
        const sign = t.type === 'income' ? '+' : '-';
        report += `${emoji} ${sign}R$ ${Number(t.amount).toFixed(2)} - ${t.title}\n`;
      });

      return report;
    } catch (error) {
      console.error('Error generating report:', error);
      return `❌ *Erro ao gerar relatório.*\n\nTente novamente em alguns instantes.`;
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, message, action } = await req.json();
    
    if (!phone_number) {
      throw new Error('Phone number is required');
    }

    console.log('WhatsApp Agent called:', { phone_number, action, message });

    // Limpar dados expirados
    await supabase.rpc('cleanup_expired_whatsapp_data');

    // Buscar sessão existente
    let session = await SessionManager.getSession(phone_number);

    // Se não há sessão ou não está autenticada
    if (!session || !session.user_id) {
      // Comandos de autenticação
      if (action === 'auth' || message?.body?.toLowerCase().includes('codigo')) {
        try {
          const code = await AuthManager.generateAuthCode(phone_number);
          
          // Criar sessão temporária
          if (!session) {
            session = await SessionManager.createSession(phone_number);
          }

          return new Response(JSON.stringify({
            success: true,
            response: `🔐 *Código de Autenticação*\n\n` +
                     `Seu código: *${code}*\n\n` +
                     `Digite: "codigo ${code}" para confirmar\n` +
                     `⏰ Válido por 10 minutos`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          if (error.message === 'USER_NOT_FOUND') {
            return new Response(JSON.stringify({
              success: true,
              response: `❌ *Usuário não encontrado*\n\n` +
                       `Este número não está registrado.\n` +
                       `Cadastre-se primeiro em: ${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '')}.vercel.app`
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          throw error;
        }
      }

      // Verificar se é código de confirmação
      const codeMatch = message?.body?.toLowerCase().match(/codigo\s+(\d{6})/);
      if (codeMatch) {
        const userId = await AuthManager.validateAuthCode(phone_number, codeMatch[1]);
        
        if (userId) {
          // Atualizar sessão com user_id
          session = await SessionManager.createSession(phone_number, userId);
          
          return new Response(JSON.stringify({
            success: true,
            response: `✅ *Autenticação realizada com sucesso!*\n\n` +
                     `Agora você pode:\n` +
                     `• Adicionar gastos e receitas\n` +
                     `• Consultar saldo e relatórios\n\n` +
                     `Digite "ajuda" para ver todos os comandos.`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: true,
            response: `❌ *Código inválido ou expirado*\n\n` +
                     `Digite "codigo" para gerar um novo código.`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Usuário não autenticado
      return new Response(JSON.stringify({
        success: true,
        response: `🔐 *Autenticação Necessária*\n\n` +
                 `Para usar o assistente, digite: *codigo*\n\n` +
                 `Ou se ainda não tem conta, cadastre-se em:\n` +
                 `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '')}.vercel.app`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Usuário autenticado - processar mensagem
    const response = await WhatsAppAgent.processMessage(session, message);

    // Atualizar sessão
    await SessionManager.updateSession(session.id, {
      session_data: {
        ...session.session_data,
        last_command: message?.body,
        last_processed: new Date().toISOString()
      }
    });

    return new Response(JSON.stringify({
      success: true,
      response
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in WhatsApp Agent:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      response: `❌ *Erro interno do sistema*\n\nTente novamente em alguns instantes.`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});