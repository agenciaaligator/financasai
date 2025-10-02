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
  conversation_state?: 'idle' | 'waiting_date' | 'waiting_confirmation' | 'awaiting_category';
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
  category_id?: string;
  requiresConfirmation?: boolean;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
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
    // Check both with and without + prefix
    const phoneVariants = phoneNumber.startsWith('+') 
      ? [phoneNumber, phoneNumber.substring(1)]
      : [phoneNumber, '+' + phoneNumber];
    
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .or(`phone_number.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.log('No active session found for:', phoneNumber);
      return null;
    }

    return data;
  }

  static async createSession(phoneNumber: string, userId?: string): Promise<Session> {
    // Limpar sessões antigas primeiro (considerando variações com e sem +)
    const phoneVariants = phoneNumber.startsWith('+')
      ? [phoneNumber, phoneNumber.substring(1)]
      : [phoneNumber, '+' + phoneNumber];

    await supabase
      .from('whatsapp_sessions')
      .delete()
      .or(`phone_number.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`);

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
    
    // If user_id is provided in updates, ensure authenticated true
    if ((finalUpdates as any).user_id) {
      (finalUpdates as any).session_data = {
        ...((finalUpdates as any).session_data || {}),
        authenticated: true
      } as any;
    }
    
    const { error } = await supabase
      .from('whatsapp_sessions')
      .update({
        ...finalUpdates,
        last_activity: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
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

    // Buscar usuário pelo phone_number na tabela profiles (check both formats)
    const phoneVariants = phoneNumber.startsWith('+') 
      ? [phoneNumber, phoneNumber.substring(1)]
      : [phoneNumber, '+' + phoneNumber];
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`phone_number.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`)
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

    // Buscar usuário pelo phone_number na tabela profiles (check both formats)
    const phoneVariants = phoneNumber.startsWith('+') 
      ? [phoneNumber, phoneNumber.substring(1)]
      : [phoneNumber, '+' + phoneNumber];
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`phone_number.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`)
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
    console.log('🔵 TransactionParser.parseTransactionFromText() called:', { originalText: text });
    
    // Security: Input validation
    if (!text || text.length > 500) {
      console.log('❌ Parser: Text validation failed (empty or too long)');
      return null;
    }

    const normalizedText = text.toLowerCase().trim();
    console.log('🔵 Parser: Normalized text:', normalizedText);
    
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
    
    // Patterns para detectar transações (MELHORADO: inclui "gastei", preposições, etc)
    const patterns = [
      // Pattern 1: "gasto 50 mercado" ou "receita 1000 salario" ou "recebi 1000 salario"
      // Agora com preposições opcionais: "gastei 50 na padaria"
      /^(gasto|gastei|receita|recebi|despesa|entrada)\s+(\d+(?:[\.,]\d{2})?)\s+(?:na|no|em|de|com|para)?\s*(.+)$/,
      // Pattern 2: "+100 freelance" ou "-30 combustível" 
      /^([+-])(\d+(?:[\.,]\d{2})?)\s+(.+)$/,
      // Pattern 3: "50 mercado" (assume despesa)
      /^(\d+(?:[\.,]\d{2})?)\s+(.+)$/,
      // Pattern 4: "gastei 64 na padaria" - formato mais natural
      /^gastei\s+(\d+(?:[\.,]\d{2})?)\s+(?:na|no|em|de)\s+(.+)$/
    ];

    console.log('🔵 Parser: Testing patterns against:', textWithoutDate);

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = textWithoutDate.match(pattern);
      console.log(`🔵 Parser: Pattern ${i + 1} match:`, match ? 'YES' : 'NO', match);
      
      if (match) {
        let type: 'income' | 'expense';
        let amount: number;
        let title: string;

        if (pattern === patterns[0]) {
          // Pattern 1: com suporte a preposições
          type = ['receita', 'recebi', 'entrada'].includes(match[1]) ? 'income' : 'expense';
          amount = parseFloat(match[2].replace(',', '.'));
          title = match[3].trim();
          console.log('🔵 Parser: Pattern 1 matched -', { type, amount, title });
        } else if (pattern === patterns[1]) {
          // Pattern 2: sinais + ou -
          type = match[1] === '+' ? 'income' : 'expense';
          amount = parseFloat(match[2].replace(',', '.'));
          title = match[3].trim();
          console.log('🔵 Parser: Pattern 2 matched -', { type, amount, title });
        } else if (pattern === patterns[2]) {
          // Pattern 3: apenas número e descrição (assume despesa)
          type = 'expense';
          amount = parseFloat(match[1].replace(',', '.'));
          title = match[2].trim();
          console.log('🔵 Parser: Pattern 3 matched -', { type, amount, title });
        } else if (pattern === patterns[3]) {
          // Pattern 4: "gastei X na/no Y"
          type = 'expense';
          amount = parseFloat(match[1].replace(',', '.'));
          title = match[2].trim();
          console.log('🔵 Parser: Pattern 4 matched (gastei X na/no Y) -', { type, amount, title });
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

        console.log('✅ Parser: Transaction successfully parsed:', {
          amount: transaction.amount,
          title: transaction.title,
          type: transaction.type,
          date: transaction.date,
          requiresConfirmation: transaction.requiresConfirmation
        });

        return { transaction, detectedDate: detectedDate || undefined };
      }
    }

    console.log('❌ Parser: No pattern matched - returning null');
    return null;
  }
}

class CategoryMatcher {
  /**
   * Busca a melhor categoria para uma transação baseada no título
   * Prioridade: 1) Match exato, 2) Similaridade, 3) "Outros"
   */
  static async findBestCategory(
    userId: string, 
    title: string, 
    type: 'income' | 'expense'
  ): Promise<{ category_id: string | null, category_name: string, suggested: boolean }> {
    try {
      // Buscar todas as categorias do usuário do tipo correto
      const { data: categories, error } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', userId)
        .eq('type', type);

      if (error || !categories || categories.length === 0) {
        console.log('No categories found for user');
        return { category_id: null, category_name: 'Outros', suggested: false };
      }

      const normalizedTitle = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // 1. Buscar match exato
      const exactMatch = categories.find(cat => 
        cat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedTitle
      );
      
      if (exactMatch) {
        console.log(`Exact category match found: ${exactMatch.name}`);
        return { category_id: exactMatch.id, category_name: exactMatch.name, suggested: false };
      }

      // 2. Buscar por similaridade (palavra contida no nome da categoria ou vice-versa)
      const similarMatches = categories.filter(cat => {
        const normalizedCatName = cat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Verifica se o título contém o nome da categoria ou se a categoria contém o título
        return normalizedTitle.includes(normalizedCatName) || normalizedCatName.includes(normalizedTitle);
      });

      if (similarMatches.length > 0) {
        // Pegar a categoria com nome mais longo (mais específica)
        const bestMatch = similarMatches.sort((a, b) => b.name.length - a.name.length)[0];
        console.log(`Similar category match found: ${bestMatch.name} for title: ${title}`);
        return { category_id: bestMatch.id, category_name: bestMatch.name, suggested: true };
      }

      // 3. Buscar categoria "Outros"
      const outrosMatch = categories.find(cat => 
        cat.name.toLowerCase() === 'outros'
      );

      if (outrosMatch) {
        console.log(`Using "Outros" category for: ${title}`);
        return { category_id: outrosMatch.id, category_name: 'Outros', suggested: false };
      }

      // 4. Se não encontrou "Outros", usar primeira categoria disponível
      console.log(`No suitable category found, using first available: ${categories[0].name}`);
      return { category_id: categories[0].id, category_name: categories[0].name, suggested: false };

    } catch (error) {
      console.error('Error finding category:', error);
      return { category_id: null, category_name: 'Sem categoria', suggested: false };
    }
  }
}

class WhatsAppAgent {
  static async processMessage(session: Session, message: WhatsAppMessage): Promise<{ response: string, sessionData: SessionData }> {
    const messageText = message.body?.toLowerCase().trim() || '';
    const sessionData = session.session_data || {};
    
    console.log('📨 Processing message:', { 
      messageText: messageText.substring(0, 30) + '...', 
      isAuthenticated: !!session.user_id 
    });
    console.log('Processing message with state:', {
      state: sessionData.conversation_state || 'idle',
      hasPendingTransaction: !!sessionData.pending_transaction
    });
    
    // PRIORIDADE 1: Se estamos aguardando categoria, processar resposta
    if (sessionData.conversation_state === 'awaiting_category' && sessionData.pending_transaction) {
      console.log('🔵 User is responding to category question');
      const category = messageText.trim();
      const transaction = sessionData.pending_transaction;
      
      // Salvar transação com a categoria informada (título será usado para match)
      const txToSave = {
        ...transaction,
        title: category, // Usar a categoria como título para o match automático
        date: transaction.date || new Date().toISOString().split('T')[0]
      };
      
      console.log('🚀 Saving transaction with user-provided category:', { 
        title: category, 
        amount: transaction.amount 
      });
      
      const saveResult = await this.saveTransaction(session.user_id!, txToSave);
      
      return {
        response: saveResult,
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }
    
    // PRIORIDADE 2: Comandos que sempre funcionam
    console.log('🔵 Checking if message is a command:', messageText);
    
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

    // Estados de conversa serão tratados mais adiante, após tentarmos detectar uma nova transação

    // Comandos de relatório com IA
    if (['hoje'].includes(messageText)) {
      console.log('COMMAND_DETECTED: hoje');
      return {
        response: await this.generateAIReport(session.user_id!, 'day'),
        sessionData
      };
    }

    if (['semana', 'resumo semana', 'semanal'].includes(messageText)) {
      console.log('COMMAND_DETECTED: semana');
      return {
        response: await this.generateAIReport(session.user_id!, 'week'),
        sessionData
      };
    }

    if (['relatorio', 'relatório', 'resumo', 'extrato', 'mes', 'mês'].includes(messageText)) {
      console.log('COMMAND_DETECTED: relatorio/mes');
      return {
        response: await this.generateAIReport(session.user_id!, 'month'),
        sessionData
      };
    }

    if (['ano', 'anual'].includes(messageText)) {
      console.log('COMMAND_DETECTED: ano');
      return {
        response: await this.generateAIReport(session.user_id!, 'year'),
        sessionData
      };
    }

    // Comandos de saldo (MELHORADO: processar antes do parsing)
    if (['saldo', 'balance', 'total'].includes(messageText)) {
      console.log('🔵 COMMAND DETECTED: saldo');
      return {
        response: await this.getBalance(session.user_id!),
        sessionData
      };
    }

    // Detectar perguntas sobre cadastro/confirmação
    const confirmationQuestions = [
      'cadastrou', 'cadastrado', 'registrou', 'registrado', 'salvou', 'salvado',
      'anotou', 'anotado', 'foi', 'confirmou', 'confirmado'
    ];
    if (confirmationQuestions.some(q => messageText.includes(q))) {
      // Buscar a última transação do usuário
      const { data: lastTransaction } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('user_id', session.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lastTransaction) {
        const emoji = lastTransaction.type === 'income' ? '💰' : '💸';
        const typeText = lastTransaction.type === 'income' ? 'Receita' : 'Despesa';
        const dateObj = new Date(lastTransaction.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        const categoryName = lastTransaction.categories?.name || 'Sem categoria';
        
        return {
          response: `✅ *SIM! Sua transação foi cadastrada com sucesso!*\n\n` +
                   `*Última transação registrada:*\n` +
                   `${emoji} ${typeText}: R$ ${Number(lastTransaction.amount).toFixed(2)}\n` +
                   `📝 ${lastTransaction.title}\n` +
                   `📅 ${dateStr}\n` +
                   `📁 ${categoryName}\n\n` +
                   `✨ *Tudo salvo no sistema!* Pode conferir no app.`,
          sessionData
        };
      } else {
        return {
          response: `📋 *Ainda não há transações cadastradas.*\n\n` +
                   `Para adicionar, digite:\n` +
                   `• "gasto 50 mercado"\n` +
                   `• "receita 1000 salario"`,
          sessionData
        };
      }
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

    // PRIORIDADE 3: Tentar processar como transação
    console.log('🔵 Attempting to parse transaction from message:', messageText);
    const parseResult = TransactionParser.parseTransactionFromText(messageText);
    console.log('🔵 Parse result:', parseResult ? 'SUCCESS' : 'FAILED', parseResult);
    
    // Se o parsing falhou mas detectamos um número, perguntar a categoria
    if (!parseResult && /\d+/.test(messageText)) {
      console.log('🔵 Parser failed but number detected, asking for category');
      
      // Extrair o número da mensagem
      const numberMatch = messageText.match(/(\d+(?:[\.,]\d{2})?)/);
      if (numberMatch) {
        const amount = parseFloat(numberMatch[1].replace(',', '.'));
        
        // Determinar tipo baseado em palavras-chave
        const isIncome = /recebi|receita|entrada|ganho|salario|salário/.test(messageText);
        const type = isIncome ? 'income' : 'expense';
        
        // Salvar transação pendente
        const pendingTransaction: Partial<Transaction> = {
          amount,
          title: 'Sem título', // Será substituído pela categoria
          type,
          date: new Date().toISOString().split('T')[0],
          source: 'whatsapp'
        };
        
        return {
          response: `💡 Detectei um valor de R$ ${amount.toFixed(2)}\n\n` +
                   `Para qual categoria essa ${type === 'income' ? 'receita' : 'despesa'}?\n\n` +
                   `Exemplos:\n` +
                   `• Alimentação\n` +
                   `• Transporte\n` +
                   `• Moradia\n` +
                   `• Salário`,
          sessionData: {
            ...sessionData,
            conversation_state: 'awaiting_category',
            pending_transaction: pendingTransaction
          }
        };
      }
    }
    
    if (parseResult && session.user_id) {
      const { transaction, detectedDate } = parseResult;
      console.log('🔵 Transaction parsed successfully, user_id:', session.user_id?.substring(0, 8) + '***');
      
      // Se valor muito alto, manter confirmação antes de salvar
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
            pending_transaction: { ...transaction, date: detectedDate || new Date().toISOString().split('T')[0] }
          }
        };
      }
      
      // Salvar imediatamente usando a data detectada ou HOJE por padrão
      const txToSave = { ...transaction, date: detectedDate || new Date().toISOString().split('T')[0] };
      console.log('🚀 CALLING saveTransaction() with:', {
        user_id: session.user_id?.substring(0, 8) + '***',
        amount: txToSave.amount,
        title: txToSave.title,
        type: txToSave.type,
        date: txToSave.date
      });
      
      const saveResult = await this.saveTransaction(session.user_id, txToSave);
      
      console.log('✅ saveTransaction() completed, response:', saveResult.substring(0, 50) + '...');
      
      return {
        response: saveResult,
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }

    // Se ainda há estado pendente, tratar agora
    if (sessionData.conversation_state && sessionData.conversation_state !== 'idle') {
      return await this.handleConversationState(session, messageText, sessionData);
    }

    // Resposta padrão para mensagens não compreendidas
    return {
      response: `❓ *Não compreendi a mensagem.*\n\n` +
               `*Comandos disponíveis:*\n` +
               `• Adicionar: "gasto 50 mercado"\n` +
               `• Ver saldo: "saldo"\n` +
               `• Ver relatório: "relatorio"\n` +
               `• Ver comandos: "ajuda"\n\n` +
               `💡 Digite *"ajuda"* para ver todos os comandos.`,
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
        console.log('Transaction confirmed, saving with default date if missing');
        const tx = {
          ...sessionData.pending_transaction,
          date: sessionData.pending_transaction?.date || new Date().toISOString().split('T')[0]
        };
        const saveResult = await this.saveTransaction(session.user_id!, tx);
        return {
          response: saveResult,
          sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
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
           `*📝 Como Adicionar Transações:*\n` +
           `• gasto 50 mercado\n` +
           `• receita 1000 salario\n` +
           `• +100 freelance\n` +
           `• -30 lanche hoje\n` +
           `• gasto 150 alimentação ontem\n\n` +
           `*📊 Consultas:*\n` +
           `• *saldo* - Ver saldo atual\n` +
           `• *hoje* - Resumo do dia\n` +
           `• *semana* - Resumo da semana\n` +
           `• *relatorio* ou *mês* - Resumo mensal\n` +
           `• *ano* - Resumo anual\n` +
           `• *ajuda* - Este menu\n\n` +
           `*📁 Categorias Automáticas:*\n` +
           `O sistema identifica automaticamente a categoria mais adequada!\n` +
           `Exemplo: "lanche" → categoria "Alimentação"\n\n` +
           `💡 *Dicas:*\n` +
           `• Use valores com pontos ou vírgulas (ex: 50.30 ou 50,30)\n` +
           `• Pode adicionar a data: "hoje", "ontem" ou "28/09"\n` +
           `• Seus gastos mantêm o nome original para relatórios precisos`;
  }

  static async saveTransaction(userId: string, transaction: Partial<Transaction>): Promise<string> {
    console.log('🔵 saveTransaction() STARTED');
    console.log('🔵 Input parameters:', {
      userId: userId?.substring(0, 8) + '***',
      transaction: {
        amount: transaction.amount,
        title: transaction.title,
        type: transaction.type,
        date: transaction.date,
        source: transaction.source
      }
    });
    
    try {
      // Security: Validate user ID
      if (!userId || typeof userId !== 'string') {
        console.error('❌ saveTransaction: Invalid user ID');
        throw new Error('Invalid user ID');
      }

      console.log('✅ saveTransaction: User ID validated');

      // Buscar melhor categoria automaticamente se não foi especificada
      let categoryInfo = { category_id: null, category_name: 'Sem categoria', suggested: false };
      
      if (!transaction.category_id && transaction.title && transaction.type) {
        categoryInfo = await CategoryMatcher.findBestCategory(
          userId, 
          transaction.title, 
          transaction.type
        );
        console.log('Category matched:', categoryInfo);
      }

      const transactionData = {
        user_id: userId,
        amount: transaction.amount,
        title: transaction.title, // Mantém o título original para relatórios fidedignos
        type: transaction.type,
        date: transaction.date,
        description: transaction.description,
        category_id: transaction.category_id || categoryInfo.category_id,
        source: 'whatsapp'
      };

      console.log('🔵 saveTransaction: Calling Supabase insert with:', transactionData);
      
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) {
        console.error('❌ saveTransaction: Database insert ERROR:', error);
        console.error('❌ saveTransaction: Failed transaction data:', transactionData);
        throw error;
      }
      
      console.log('✅ saveTransaction: Database insert SUCCESSFUL');

      const emoji = transaction.type === 'income' ? '💰' : '💸';
      const typeText = transaction.type === 'income' ? 'Receita' : 'Despesa';
      
      console.log('✅✅✅ TRANSACTION CREATED SUCCESSFULLY ✅✅✅');
      console.log('Transaction details:', {
        id: data.id,
        amount: data.amount,
        title: data.title,
        type: data.type,
        date: data.date,
        category: categoryInfo.category_name,
        user_id: userId.substring(0, 8) + '***'
      });
      
      // Mensagem simplificada e direta conforme treinamento
      const response = transaction.type === 'income'
        ? `💰 Receita de R$ ${transaction.amount?.toFixed(2)} registrada com sucesso!`
        : `💸 Despesa de R$ ${transaction.amount?.toFixed(2)} registrada com sucesso!`;
      
      console.log('🔵 saveTransaction: Returning response:', response);
      
      return response;
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

  static async generateAIReport(userId: string, period: 'day' | 'week' | 'month' | 'year'): Promise<string> {
    try {
      console.log('REPORT_TYPE:', period);
      
      // Chamar edge function ai-reports para gerar relatório com IA
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          period,
          user_id: userId
        })
      });

      if (!response.ok) {
        throw new Error(`AI Reports API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.report) {
        return result.report;
      } else {
        throw new Error('No report generated');
      }
    } catch (error) {
      console.error('Error generating AI report:', error);
      
      // Fallback: gerar relatório simples sem IA
      return await this.generateSimpleReport(userId, period);
    }
  }

  static async generateSimpleReport(userId: string, period: 'day' | 'week' | 'month' | 'year'): Promise<string> {
    try {
      // Calcular data de início baseada no período
      const now = new Date();
      let startDate: string;
      let periodLabel: string;
      
      switch (period) {
        case 'day':
          startDate = now.toISOString().split('T')[0];
          periodLabel = 'Hoje';
          break;
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - 7);
          startDate = weekStart.toISOString().split('T')[0];
          periodLabel = 'Últimos 7 dias';
          break;
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          startDate = yearStart.toISOString().split('T')[0];
          periodLabel = now.getFullYear().toString();
          break;
        case 'month':
        default:
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate = monthStart.toISOString().split('T')[0];
          periodLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      }

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .order('date', { ascending: false });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        return `📊 *Relatório - ${periodLabel}*\n\n❌ Nenhuma transação encontrada.`;
      }

      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const balance = income - expenses;

      let report = `📊 *Relatório - ${periodLabel}*\n\n`;
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
      console.error('Error generating simple report:', error);
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
    const body = await req.json();
    const { phone_number, message, action } = body;
    
    console.log('📥 Request body:', { 
      hasPhoneNumber: !!phone_number, 
      hasMessage: !!message,
      bodyKeys: Object.keys(body)
    });
    
    // Security: Input validation
    if (!phone_number || typeof phone_number !== 'string') {
      throw new Error('Phone number is required');
    }

    // Security: Phone number normalization - remove all except digits and +
    let cleanPhone = phone_number.replace(/[\s\-()]/g, '');
    // Ensure starts with + if it has country code
    if (/^\d{11,15}$/.test(cleanPhone)) {
      cleanPhone = '+' + cleanPhone; // Add + if missing
    }
    console.log('📞 Phone normalized:', { 
      original: phone_number.substring(0, 8) + '***', 
      cleaned: cleanPhone.substring(0, 8) + '***' 
    });
    
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
    // CRITICAL: Check both with and without + prefix to handle format variations
    const phoneVariants = cleanPhone.startsWith('+') 
      ? [cleanPhone, cleanPhone.substring(1)] // Try +5511... and 5511...
      : [cleanPhone, '+' + cleanPhone]; // Try 5511... and +5511...
    
    console.log('🔍 Looking for profile with phone variants:', phoneVariants.map(p => p.substring(0, 8) + '***'));
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, phone_number')
      .or(`phone_number.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`)
      .maybeSingle();

    // Se não há perfil cadastrado, retornar IMEDIATAMENTE
    if (!profile) {
      console.log('❌ User not registered - redirecting to signup');
      return new Response(JSON.stringify({
        success: true,
        response: `👋 *Bem-vindo ao Assistente Financeiro!*\n\n` +
                 `*Passo 1:* Cadastre-se gratuitamente\n` +
                 `🔗 https://financasai.lovable.app\n\n` +
                 `*Passo 2:* No cadastro, use este número do WhatsApp: ${cleanPhone}\n\n` +
                 `*Passo 3:* Depois de cadastrado, volte aqui e comece a usar!\n\n` +
                 `É rápido e fácil! 🚀`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✅ Profile found for phone:', cleanPhone.substring(0, 8) + '***');

    // SECURITY: Log without any phone number information
    console.log('WhatsApp Agent called:', { 
      action, 
      hasMessage: !!message,
      user_id: profile.user_id,
      timestamp: new Date().toISOString()
    });

    // TERCEIRO: Buscar sessão existente (usando cleanPhone)
    let session = await SessionManager.getSession(cleanPhone);

    // CRITICAL: Se profile existe mas não há sessão autenticada, criar automaticamente
    if (!session || !session.user_id) {
      console.log('⚡ Profile exists but no authenticated session - creating automatically');
      session = await SessionManager.createSession(cleanPhone, profile.user_id);
      console.log('✅ Session auto-created with user_id:', profile.user_id.substring(0, 8) + '***');
    }

    // Se ainda não há sessão ou não está autenticada (não deveria acontecer)
    if (!session || !session.user_id) {
      // Normalizar mensagem - suporta tanto string direta quanto objeto WhatsApp
      const messageText = typeof message === 'string' ? message : (message?.body || '');
      const normalizedMessage = messageText
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() || '';
      
      // 1. PRIMEIRO: Verificar se é código de confirmação (case-insensitive e sem acentos)
      const codeMatch = normalizedMessage.match(/codigo\s+(\d{6})/);
      if (codeMatch) {
        console.log(`Auth code VALIDATION attempt for ${cleanPhone.substring(0, 5)}***`);
        const userId = await AuthManager.validateAuthCode(cleanPhone, codeMatch[1]);
        
        if (userId) {
          // Atualizar sessão com user_id
          session = await SessionManager.createSession(cleanPhone, userId);
          console.log(`✅ Auth code VALIDATED successfully for ${cleanPhone.substring(0, 5)}***`);
          
          // Mensagem de boas-vindas completa com lista de comandos
          return new Response(JSON.stringify({
            success: true,
            response: `✅ *Autenticação realizada com sucesso!*\n\n` +
                     `🎉 Bem-vindo ao seu Assistente Financeiro!\n\n` +
                     `*📝 Como usar:*\n` +
                     `• gasto 50 mercado\n` +
                     `• receita 1000 salario\n` +
                     `• +100 freelance\n` +
                     `• -30 lanche hoje\n\n` +
                     `*📊 Consultas:*\n` +
                     `• *saldo* - Ver seu saldo\n` +
                     `• *relatorio* - Resumo do mês\n` +
                     `• *ajuda* - Ver todos os comandos\n\n` +
                     `*✨ Dica:* O sistema identifica categorias automaticamente!\n` +
                     `Exemplo: "lanche" vai para "Alimentação"`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.log(`❌ Auth code VALIDATION failed for ${cleanPhone.substring(0, 5)}***`);
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
          console.log(`📩 Auth code GENERATION requested for ${cleanPhone.substring(0, 5)}***`);
          const code = await AuthManager.generateAuthCode(cleanPhone);
          
          // Criar sessão temporária
          if (!session) {
            session = await SessionManager.createSession(cleanPhone);
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
    // Suportar tanto formato GPT Maker (string) quanto WhatsApp oficial (objeto)
    const messageText = typeof message === 'string' ? message : (message?.body || '');
    const whatsappMessage: WhatsAppMessage = {
      from: cleanPhone,
      body: messageText,
      type: message?.type || 'text',
      id: message?.id
    };
    
    console.log('📨 Processing message:', { 
      messageText: messageText.substring(0, 30) + '...', 
      isAuthenticated: !!session.user_id 
    });
    
    const result = await WhatsAppAgent.processMessage(session, whatsappMessage);

    // Atualizar sessão com novo estado
    await SessionManager.updateSession(session.id, {
      session_data: {
        ...result.sessionData,
        last_command: messageText,
        last_processed: new Date().toISOString()
      }
    });

    // Resposta formatada para GPT Maker
    const responseBody = {
      success: true,
      response: result.response,
      stop: true // CRÍTICO: Instrui GPT Maker a usar APENAS esta resposta
    };
    
    console.log('✅ Response:', { 
      length: result.response?.length,
      stop: true 
    });
    
    return new Response(JSON.stringify(responseBody), {
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