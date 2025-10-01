import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting for authentication
const authRateLimit = new Map<string, { count: number; windowStart: number }>();
const AUTH_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_AUTH_ATTEMPTS_PER_HOUR = 3;

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
    // Security: Rate limiting for auth code generation
    const now = Date.now();
    const current = authRateLimit.get(phoneNumber);
    
    if (!current || now - current.windowStart > AUTH_RATE_LIMIT_WINDOW) {
      authRateLimit.set(phoneNumber, { count: 1, windowStart: now });
    } else if (current.count >= MAX_AUTH_ATTEMPTS_PER_HOUR) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    } else {
      current.count++;
    }

    // Buscar usuário pelo phone_number na tabela profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (!profile || profileError) {
      throw new Error('USER_NOT_FOUND');
    }

    // Security: Clean up old codes first
    await supabase
      .from('whatsapp_auth_codes')
      .delete()
      .eq('phone_number', phoneNumber);

    // Gerar código de 6 dígitos
    const code = Math.random().toString().slice(-6).padStart(6, '0');
    
    const { error } = await supabase
      .from('whatsapp_auth_codes')
      .insert({
        phone_number: phoneNumber,
        code: code,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // Security: Reduced to 5 minutes
      });

    if (error) throw error;
    
    console.log(`Auth code generated for ${phoneNumber}`);
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

    // Buscar usuário pelo phone_number na tabela profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    
    return profile?.user_id || null;
  }
}

class TransactionParser {
  static parseTransactionFromText(text: string): Partial<Transaction> | null {
    // Security: Input validation
    if (!text || text.length > 500) {
      return null;
    }

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

        // Security: Transaction limits and validation
        const MAX_TRANSACTION_AMOUNT = 50000; // R$ 50,000
        if (amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
          return null;
        }

        // Security: Sanitize title
        const sanitizedTitle = title.substring(0, 100).replace(/[<>]/g, '');

        // Security: Confirmation for high-value transactions
        const requiresConfirmation = amount > 1000;

        return {
          amount,
          title: sanitizedTitle.charAt(0).toUpperCase() + sanitizedTitle.slice(1),
          type,
          date: new Date().toISOString().split('T')[0],
          source: 'whatsapp',
          requiresConfirmation
        };
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
      // Security: Validate user ID
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      // Security: High-value transaction confirmation (you could implement this in session_data)
      if (transaction.requiresConfirmation) {
        return `⚠️ *Confirmação Necessária*\n\n` +
               `Transação de alto valor: R$ ${transaction.amount?.toFixed(2)}\n` +
               `📝 ${transaction.title}\n\n` +
               `Digite "confirmar" para prosseguir ou "cancelar" para cancelar.`;
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...transaction,
          user_id: userId
        })
        .select()
        .single();

      if (error) {
        console.error('Transaction insert error:', error);
        throw error;
      }

      const emoji = transaction.type === 'income' ? '💰' : '💸';
      const typeText = transaction.type === 'income' ? 'Receita' : 'Despesa';
      
      console.log(`Transaction created for user ${userId}: ${transaction.amount}`);
      
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
    
    // Security: Input validation
    if (!phone_number || typeof phone_number !== 'string') {
      throw new Error('Phone number is required');
    }

    // Security: Phone number validation - mais flexível para aceitar diferentes formatos
    const cleanPhone = phone_number.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
      throw new Error('Invalid phone number format');
    }

    console.log('WhatsApp Agent called:', { 
      phone_number: phone_number.substring(0, 5) + '***', // Log partial phone for privacy
      action, 
      hasMessage: !!message 
    });

    // Limpar dados expirados
    await supabase.rpc('cleanup_expired_whatsapp_data');

    // Buscar sessão existente
    let session = await SessionManager.getSession(phone_number);

    // Se não há sessão ou não está autenticada
    if (!session || !session.user_id) {
      // Normalizar mensagem removendo acentos e convertendo para minúsculas
      const normalizedMessage = message?.body
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() || '';
      
      // Comandos de autenticação (case-insensitive e sem acentos)
      if (action === 'auth' || normalizedMessage.includes('codigo')) {
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
          } else if (error.message === 'RATE_LIMIT_EXCEEDED') {
            return new Response(JSON.stringify({
              success: true,
              response: `⏰ *Muitas tentativas*\n\n` +
                       `Você excedeu o limite de códigos por hora.\n` +
                       `Tente novamente em 1 hora.`
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          throw error;
        }
      }

      // Verificar se é código de confirmação (case-insensitive e sem acentos)
      const codeMatch = normalizedMessage.match(/codigo\s+(\d{6})/);
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