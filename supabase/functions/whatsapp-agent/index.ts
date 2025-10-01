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
  session_data: SessionData;
  last_activity: string;
  expires_at: string;
}

interface SessionData {
  authenticated?: boolean;
  last_command?: string | null;
  context?: any;
  conversation_state?: 'idle' | 'waiting_date' | 'waiting_confirmation';
  pending_transaction?: Partial<Transaction>;
  last_question?: string;
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
  requiresConfirmation?: boolean;
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
    // Merge session_data to preserve existing keys
    let finalUpdates = { ...updates };
    
    if (updates.session_data) {
      // Get current session
      const { data: currentSession } = await supabase
        .from('whatsapp_sessions')
        .select('session_data, user_id')
        .eq('id', sessionId)
        .single();
      
      if (currentSession) {
        // Merge new session_data with existing
        finalUpdates.session_data = {
          ...currentSession.session_data,
          ...updates.session_data,
          // Preserve authenticated flag if user_id exists
          authenticated: currentSession.user_id ? true : updates.session_data.authenticated
        };
      }
    }
    
    const { error } = await supabase
      .from('whatsapp_sessions')
      .update({
        ...finalUpdates,
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

class DateParser {
  static parseDate(text: string): string | null {
    const normalizedText = text.toLowerCase().trim();
    
    // CRITICAL FIX: Usar UTC para evitar problemas de timezone
    // Quando usuário diz "hoje", queremos a data LOCAL dele (Brasil)
    const now = new Date();
    const brazilOffset = -3 * 60; // UTC-3 (horário de Brasília)
    const localTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));
    
    // Hoje
    if (['hoje', 'hj'].includes(normalizedText)) {
      const year = localTime.getUTCFullYear();
      const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(localTime.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Ontem
    if (['ontem', 'yesterday'].includes(normalizedText)) {
      const yesterday = new Date(localTime.getTime() - (24 * 60 * 60 * 1000));
      const year = yesterday.getUTCFullYear();
      const month = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Formatos DD/MM ou DD/MM/AAAA
    const dateMatch = normalizedText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const year = dateMatch[3] ? parseInt(dateMatch[3]) : localTime.getUTCFullYear();
      
      // Ajustar ano se apenas 2 dígitos
      const fullYear = year < 100 ? 2000 + year : year;
      
      // Validar se a data é válida
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const testDate = new Date(Date.UTC(fullYear, month - 1, day));
        if (testDate.getUTCMonth() === month - 1 && testDate.getUTCDate() === day) {
          return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
    
    return null;
  }
}

class TransactionParser {
  static parseTransactionFromText(text: string): { transaction: Partial<Transaction>, detectedDate?: string } | null {
    // Security: Input validation
    if (!text || text.length > 500) {
      return null;
    }

    const normalizedText = text.toLowerCase().trim();
    
    // Primeiro, tentar detectar data no texto
    let detectedDate: string | null = null;
    let textWithoutDate = normalizedText;
    
    // Detectar "hoje", "ontem" no final ou no meio do texto
    const dateWords = ['hoje', 'hj', 'ontem'];
    for (const word of dateWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(normalizedText)) {
        detectedDate = DateParser.parseDate(word);
        textWithoutDate = normalizedText.replace(regex, '').trim();
        break;
      }
    }
    
    // Detectar formatos DD/MM ou DD/MM/AAAA
    const dateMatch = normalizedText.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    if (dateMatch && !detectedDate) {
      detectedDate = DateParser.parseDate(dateMatch[1]);
      textWithoutDate = normalizedText.replace(dateMatch[0], '').trim();
    }
    
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
      const match = textWithoutDate.match(pattern);
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

        const transaction = {
          amount,
          title: sanitizedTitle.charAt(0).toUpperCase() + sanitizedTitle.slice(1),
          type,
          date: detectedDate || new Date().toISOString().split('T')[0],
          source: 'whatsapp',
          requiresConfirmation
        };

        return { transaction, detectedDate: detectedDate || undefined };
      }
    }

    return null;
  }
}

class WhatsAppAgent {
  static async processMessage(session: Session, message: WhatsAppMessage): Promise<{ response: string, sessionData: SessionData }> {
    const messageText = message.body?.toLowerCase().trim() || '';
    const sessionData = session.session_data || {};
    
    console.log('Processing message with state:', {
      state: sessionData.conversation_state || 'idle',
      hasPendingTransaction: !!sessionData.pending_transaction
    });
    
    // Comandos que sempre funcionam (prioridade máxima)
    if (['ajuda', 'help', 'menu', 'comandos'].includes(messageText)) {
      return {
        response: this.getHelpMenu(),
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }

    if (['cancelar', 'cancel', 'sair'].includes(messageText)) {
      return {
        response: '❌ Operação cancelada.',
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }

    // Verificar se há conversa em andamento
    if (sessionData.conversation_state && sessionData.conversation_state !== 'idle') {
      return await this.handleConversationState(session, messageText, sessionData);
    }

    // Comandos de relatório
    if (['relatorio', 'relatório', 'resumo', 'extrato'].includes(messageText)) {
      return {
        response: await this.generateReport(session.user_id!),
        sessionData
      };
    }

    // Comandos de saldo
    if (['saldo', 'balance', 'total'].includes(messageText)) {
      return {
        response: await this.getBalance(session.user_id!),
        sessionData
      };
    }

    // Detectar cumprimentos
    const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'alo', 'alô'];
    if (greetings.some(greeting => messageText === greeting || messageText.startsWith(greeting + ' '))) {
      console.log('Greeting detected');
      
      // Buscar nome do usuário
      let userName = '';
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', session.user_id)
          .maybeSingle();
        
        if (profile?.full_name) {
          userName = profile.full_name.split(' ')[0]; // Primeiro nome
        }
      } catch (error) {
        console.log('Could not fetch user name:', error);
      }
      
      const greeting = userName 
        ? `Oi, ${userName}! 👋 Como posso ajudar?`
        : `Oi! 👋 Como posso ajudar?`;
      
      return {
        response: `${greeting}\n\nVocê pode:\n• Adicionar gastos: "gasto 50 mercado"\n• Adicionar receitas: "receita 1000 salario"\n• Ver saldo: "saldo"\n• Ver relatório: "relatorio"\n• Ver comandos: "ajuda"`,
        sessionData
      };
    }

    // Tentar processar como transação
    const parseResult = TransactionParser.parseTransactionFromText(messageText);
    if (parseResult && session.user_id) {
      const { transaction, detectedDate } = parseResult;
      
      // Se a data já foi detectada no texto, salvar direto
      if (detectedDate) {
        console.log('Transaction with date detected, saving directly:', { date: detectedDate, amount: transaction.amount });
        const saveResult = await this.saveTransaction(session.user_id, transaction);
        return {
          response: saveResult,
          sessionData
        };
      }
      
      // Verificar se requer confirmação de valor alto
      if (transaction.requiresConfirmation) {
        console.log('High-value transaction detected, requesting confirmation');
        return {
          response: `⚠️ *Confirmação Necessária*\n\n` +
                   `Transação de alto valor: R$ ${transaction.amount?.toFixed(2)}\n` +
                   `📝 ${transaction.title}\n` +
                   `${transaction.type === 'income' ? '💰 Receita' : '💸 Despesa'}\n\n` +
                   `Digite *"sim"* para confirmar ou *"não"* para cancelar.`,
          sessionData: {
            ...sessionData,
            conversation_state: 'waiting_confirmation',
            pending_transaction: transaction
          }
        };
      }
      
      // Perguntar data
      console.log('Transaction parsed, requesting date');
      return {
        response: `📅 *Para qual data é essa transação?*\n\n` +
                 `💵 R$ ${transaction.amount?.toFixed(2)} - ${transaction.title}\n\n` +
                 `Digite:\n` +
                 `• *"hoje"* para hoje\n` +
                 `• *"ontem"* para ontem\n` +
                 `• ou uma data (ex: 28/09)`,
        sessionData: {
          ...sessionData,
          conversation_state: 'waiting_date',
          pending_transaction: transaction
        }
      };
    }

    // Resposta padrão para mensagens não compreendidas
    return {
      response: `❓ *Não compreendi a mensagem.*\n\n` +
               `Você pode:\n` +
               `• Adicionar gastos: "gasto 50 mercado"\n` +
               `• Adicionar receitas: "receita 1000 salario"\n` +
               `• Ver saldo: "saldo"\n` +
               `• Ver relatório: "relatorio"\n` +
               `• Ver comandos: "ajuda"`,
      sessionData
    };
  }

  static async handleConversationState(
    session: Session, 
    messageText: string, 
    sessionData: SessionData
  ): Promise<{ response: string, sessionData: SessionData }> {
    console.log('Handling conversation state:', sessionData.conversation_state);

    // Estado: aguardando data
    if (sessionData.conversation_state === 'waiting_date' && sessionData.pending_transaction) {
      const date = DateParser.parseDate(messageText);
      
      if (!date) {
        return {
          response: `❌ Data inválida.\n\n` +
                   `Por favor, digite:\n` +
                   `• *"hoje"* ou *"ontem"*\n` +
                   `• ou uma data válida (ex: 28/09)`,
          sessionData
        };
      }
      
      // Atualizar transação com a data
      const transaction = {
        ...sessionData.pending_transaction,
        date
      };
      
      console.log('Date parsed, saving transaction:', { date, amount: transaction.amount });
      
      // Salvar a transação
      const saveResult = await this.saveTransaction(session.user_id!, transaction);
      
      return {
        response: saveResult,
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }

    // Estado: aguardando confirmação
    if (sessionData.conversation_state === 'waiting_confirmation' && sessionData.pending_transaction) {
      const affirmative = ['sim', 's', 'yes', 'y', 'confirmo', 'confirmar', 'ok'];
      const negative = ['não', 'nao', 'n', 'no', 'cancelar', 'cancel'];
      
      if (affirmative.includes(messageText)) {
        console.log('Transaction confirmed, requesting date');
        // Confirmado, agora pedir data
        return {
          response: `✅ *Confirmado!*\n\n` +
                   `📅 Para qual data é essa transação?\n\n` +
                   `Digite:\n` +
                   `• *"hoje"* para hoje\n` +
                   `• *"ontem"* para ontem\n` +
                   `• ou uma data (ex: 28/09)`,
          sessionData: {
            ...sessionData,
            conversation_state: 'waiting_date'
          }
        };
      } else if (negative.includes(messageText)) {
        console.log('Transaction cancelled by user');
        return {
          response: `❌ Transação cancelada.`,
          sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
        };
      } else {
        return {
          response: `Por favor, responda *"sim"* para confirmar ou *"não"* para cancelar.`,
          sessionData
        };
      }
    }

    // Estado desconhecido, resetar
    return {
      response: `❌ Conversa interrompida. Digite *"ajuda"* para ver os comandos.`,
      sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
    };
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

  static async saveTransaction(userId: string, transaction: Partial<Transaction>): Promise<string> {
    try {
      // Security: Validate user ID
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      console.log('Saving transaction to database:', {
        userId: userId.substring(0, 8) + '***',
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date
      });

      const transactionData = {
        user_id: userId,
        amount: transaction.amount,
        title: transaction.title,
        type: transaction.type,
        date: transaction.date,
        description: transaction.description,
        source: 'whatsapp'
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) {
        console.error('Transaction insert error:', error);
        console.error('Transaction data that failed:', transactionData);
        throw error;
      }

      const emoji = transaction.type === 'income' ? '💰' : '💸';
      const typeText = transaction.type === 'income' ? 'Receita' : 'Despesa';
      
      console.log(`Transaction created successfully:`, {
        id: data.id,
        amount: data.amount
      });
      
      const dateObj = new Date(transaction.date + 'T00:00:00');
      const dateStr = dateObj.toLocaleDateString('pt-BR');
      
      return `✅ *${typeText} registrada com sucesso!*\n\n` +
             `${emoji} R$ ${transaction.amount?.toFixed(2)}\n` +
             `📝 ${transaction.title}\n` +
             `📅 ${dateStr}`;
    } catch (error) {
      console.error('Error saving transaction:', error);
      return `❌ *Erro ao salvar transação.*\n\n` +
             `Detalhes: ${error.message}\n\n` +
             `Tente novamente em alguns instantes.`;
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

    // Security: Phone number validation - ignorar placeholders do GPT Maker
    const cleanPhone = phone_number.replace(/[\s\-()]/g, '');
    console.log('Phone validation:', { original: phone_number, cleaned: cleanPhone });
    
    // Detectar placeholders (ex: {contact.phone}) e ignorar silenciosamente
    if (cleanPhone.includes('{') || cleanPhone.includes('}') || !/^\+?\d{10,15}$/.test(cleanPhone)) {
      console.log('Ignoring request with placeholder/invalid phone (GPT Maker legacy):', phone_number);
      return new Response(JSON.stringify({
        success: true,
        response: '🔐 Configure o webhook do WhatsApp Business API para usar este assistente.',
        ignored: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PRIMEIRO: Limpar dados expirados
    await supabase.rpc('cleanup_expired_whatsapp_data');

    // SEGUNDO: Verificar se o usuário está cadastrado (tem perfil com este telefone)
    // CRITICAL: Esta verificação DEVE acontecer ANTES de qualquer processamento
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('phone_number', phone_number)
      .maybeSingle();

    // Se não há perfil cadastrado, retornar IMEDIATAMENTE
    if (!profile) {
      console.log(`User not registered: ${phone_number.substring(0, 5)}***`);
      return new Response(JSON.stringify({
        success: true,
        response: `👋 *Bem-vindo ao Aligator Financeiro!*\n\n` +
                 `📱 Este número ainda não está cadastrado.\n\n` +
                 `Para começar a usar o assistente financeiro, cadastre-se gratuitamente em:\n` +
                 `https://financasai.lovable.app\n\n` +
                 `Depois do cadastro, volte aqui e envie qualquer mensagem para começar! 🚀`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('WhatsApp Agent called:', { 
      phone_number: phone_number.substring(0, 5) + '***', // Log partial phone for privacy
      action, 
      hasMessage: !!message,
      user_id: profile.user_id
    });

    // TERCEIRO: Buscar sessão existente
    let session = await SessionManager.getSession(phone_number);

    // Se não há sessão ou não está autenticada
    if (!session || !session.user_id) {
      // Normalizar mensagem removendo acentos e convertendo para minúsculas
      const normalizedMessage = message?.body
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() || '';
      
      // 1. PRIMEIRO: Verificar se é código de confirmação (case-insensitive e sem acentos)
      const codeMatch = normalizedMessage.match(/codigo\s+(\d{6})/);
      if (codeMatch) {
        console.log(`Auth code VALIDATION attempt for ${phone_number.substring(0, 5)}***`);
        const userId = await AuthManager.validateAuthCode(phone_number, codeMatch[1]);
        
        if (userId) {
          // Atualizar sessão com user_id
          session = await SessionManager.createSession(phone_number, userId);
          console.log(`Auth code VALIDATED successfully for ${phone_number.substring(0, 5)}***`);
          
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
          console.log(`Auth code VALIDATION failed for ${phone_number.substring(0, 5)}***`);
          return new Response(JSON.stringify({
            success: true,
            response: `❌ *Código inválido ou expirado*\n\n` +
                     `Digite "codigo" para gerar um novo código.`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 2. SEGUNDO: Gerar novo código apenas se mensagem for exatamente "codigo" (sem números)
      if (action === 'auth' || normalizedMessage.trim() === 'codigo') {
        try {
          console.log(`Auth code GENERATION requested for ${phone_number.substring(0, 5)}***`);
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
            // Não deve acontecer pois já verificamos no início, mas mantemos por segurança
            return new Response(JSON.stringify({
              success: true,
              response: `❌ *Usuário não encontrado*\n\n` +
                       `Cadastre-se gratuitamente em:\n` +
                       `https://financasai.lovable.app`
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
    const result = await WhatsAppAgent.processMessage(session, message);

    // Atualizar sessão com novo estado
    await SessionManager.updateSession(session.id, {
      session_data: {
        ...result.sessionData,
        last_command: message?.body,
        last_processed: new Date().toISOString()
      }
    });

    return new Response(JSON.stringify({
      success: true,
      response: result.response
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