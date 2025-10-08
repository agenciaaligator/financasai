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
  image?: {
    id: string;
    mime_type: string;
  };
  audio?: {
    id: string;
    mime_type: string;
  };
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
  conversation_state?: 'idle' | 'waiting_date' | 'waiting_confirmation' | 'awaiting_category' | 'confirming_ocr' | 'awaiting_delete_confirmation' | 'awaiting_edit_field' | 'awaiting_edit_value';
  pending_transaction?: Partial<Transaction>;
  pending_ocr_data?: {
    amount: number;
    merchant: string;
    category: string;
    date?: string;
    imageUrl?: string;
  };
  pending_delete?: {
    transaction_id: string;
    transaction_title: string;
    transaction_amount: number;
  };
  pending_edit?: {
    transaction_id: string;
    field?: 'amount' | 'category' | 'title' | 'date';
    original_transaction?: any;
  };
  last_question?: string;
  full_name?: string;
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

// Função auxiliar para obter a data/hora local do Brasil (UTC-3)
function getBrazilTime(): Date {
  const now = new Date();
  const brazilOffset = -3 * 60; // UTC-3 (horário de Brasília)
  return new Date(now.getTime() + (brazilOffset * 60 * 1000));
}

// Função auxiliar para formatar período
function formatPeriod(period: 'day' | 'week' | 'month' | 'year' = 'month'): string {
  const localTime = getBrazilTime();
  
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  const year = localTime.getUTCFullYear();
  const month = localTime.getUTCMonth();
  const day = localTime.getUTCDate();
  
  switch(period) {
    case 'day':
      return `Hoje (${day}/${month + 1}/${year})`;
    case 'week':
      return `Esta Semana`;
    case 'month':
      return `${months[month]}/${year}`;
    case 'year':
      return `Ano ${year}`;
    default:
      return `${months[month]}/${year}`;
  }
}

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

// Função para parsear números no formato brasileiro
function parseBrazilianNumber(value: string): number {
  // Remove todos os pontos (separador de milhares)
  // Substitui vírgula por ponto (separador decimal)
  // Exemplos:
  // "1.000" → 1000
  // "1.000,00" → 1000.00
  // "50,50" → 50.50
  // "1000" → 1000
  const normalized = value
    .replace(/\./g, '')  // Remove pontos (milhares)
    .replace(',', '.');  // Substitui vírgula por ponto (decimal)
  
  const result = parseFloat(normalized);
  console.log(`🔵 parseBrazilianNumber: "${value}" → ${result}`);
  return result;
}

class DateParser {
  static parseDate(text: string): string | null {
    const normalizedText = text.toLowerCase().trim();
    
    // Usar horário local do Brasil (UTC-3)
    const localTime = getBrazilTime();
    
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
  // Função auxiliar para limpar o título
  private static cleanTitle(title: string): string {
    return title
      .replace(/^(na|no|em|de|para|com|a|o|as|os)\s+/i, '') // Remove preposições iniciais
      .replace(/[.,!?]+$/, '') // Remove pontuação final
      .trim();
  }

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
    
    // SANITIZAÇÃO PRÉ-PROCESSAMENTO para tolerância total
    let workingText = textWithoutDate
      .replace(/\br\$\s*/gi, '') // Remove "R$"
      .replace(/\breais?\b/gi, '') // Remove "reais" ou "real"
      .trim();
    
    console.log('🔵 Parser: Working text after sanitization:', { 
      original: text, 
      normalized: normalizedText,
      working: workingText 
    });
    
    // Patterns ATUALIZADOS para máxima tolerância com números brasileiros
    const patterns = [
      // Pattern 1: "gasto/despesa/receita X Y" - super flexível
      /^(gasto|gastei|receita|recebi|despesa|entrada|saida|paguei)\s+(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:na|no|em|de|com|para|a|o)?\s*(.+)?$/i,
      // Pattern 2: "+100 freelance" ou "-30 combustível" 
      /^([+-])\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s+(.+)$/i,
      // Pattern 3: "50 mercado" (assume despesa)
      /^(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s+(.+)$/i,
      // Pattern 4: "gastei X na/em Y"
      /^gastei\s+(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s+(?:na|no|em|de|com|para|a|o)?\s*(.+)$/i
    ];

    console.log('🔵 Parser: Testing patterns against:', workingText);

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = workingText.match(pattern);
      console.log(`🔵 Parser: Pattern ${i + 1} match:`, match ? 'YES' : 'NO', match);
      
      if (match) {
        let type: 'income' | 'expense';
        let amount: number;
        let title: string;

        if (pattern === patterns[0]) {
          // Pattern 1: com suporte a preposições e números brasileiros
          type = ['receita', 'recebi', 'entrada'].includes(match[1].toLowerCase()) ? 'income' : 'expense';
          amount = parseBrazilianNumber(match[2]);
          const rawTitle = match[3] || '';
          title = this.cleanTitle(rawTitle);
          console.log('✅ Parser: Pattern 1 matched -', { 
            type, 
            rawAmount: match[2], 
            parsedAmount: amount, 
            rawTitle, 
            cleanTitle: title 
          });
        } else if (pattern === patterns[1]) {
          // Pattern 2: sinais + ou -
          type = match[1] === '+' ? 'income' : 'expense';
          amount = parseBrazilianNumber(match[2]);
          const rawTitle = match[3];
          title = this.cleanTitle(rawTitle);
          console.log('✅ Parser: Pattern 2 matched -', { 
            type, 
            rawAmount: match[2], 
            parsedAmount: amount, 
            rawTitle, 
            cleanTitle: title 
          });
        } else if (pattern === patterns[2]) {
          // Pattern 3: apenas número e descrição → SEMPRE DESPESA IMPLÍCITA
          type = 'expense'; // ⬅️ SEMPRE DESPESA
          amount = parseBrazilianNumber(match[1]);
          const rawTitle = match[2];
          title = this.cleanTitle(rawTitle);
          console.log('✅ Parser: Pattern 3 matched (implicit expense) -', { 
            type: 'expense (implicit)', 
            rawAmount: match[1], 
            parsedAmount: amount, 
            rawTitle, 
            cleanTitle: title 
          });
        } else if (pattern === patterns[3]) {
          // Pattern 4: "gastei X na/no Y"
          type = 'expense';
          amount = parseBrazilianNumber(match[1]);
          const rawTitle = match[2] || '';
          title = this.cleanTitle(rawTitle);
          console.log('✅ Parser: Pattern 4 matched (gastei X na/no Y) -', { 
            type, 
            rawAmount: match[1], 
            parsedAmount: amount, 
            rawTitle, 
            cleanTitle: title 
          });
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

        // Usar data local do Brasil se não foi especificada
        const localTime = getBrazilTime();
        const defaultDate = `${localTime.getUTCFullYear()}-${String(localTime.getUTCMonth() + 1).padStart(2, '0')}-${String(localTime.getUTCDate()).padStart(2, '0')}`;
        
        const transaction = {
          amount,
          title: sanitizedTitle.charAt(0).toUpperCase() + sanitizedTitle.slice(1),
          type,
          date: detectedDate || defaultDate,
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

// 🤖 Classe para Processamento de Linguagem Natural
class NaturalLanguageProcessor {
  /**
   * Processa mensagens em linguagem natural e extrai intenção + entidades
   */
  static async processNaturalLanguage(
    messageText: string,
    userId: string
  ): Promise<{
    intent: 'add_transaction' | 'query_balance' | 'query_expenses' | 'list_transactions' | 'other';
    entities: {
      amount?: number;
      title?: string;
      type?: 'income' | 'expense';
      category?: string;
      date?: string;
      period?: 'day' | 'week' | 'month' | 'year';
    };
    confidence: number;
  } | null> {
    try {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        console.error('LOVABLE_API_KEY not configured');
        return null;
      }

      console.log('🤖 Processing natural language:', messageText);

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'system',
            content: `Você é um assistente financeiro que analisa mensagens em linguagem natural e extrai informações estruturadas.

INTENÇÕES POSSÍVEIS:
- "add_transaction": usuário quer registrar uma receita ou despesa
- "query_balance": usuário quer saber o saldo
- "query_expenses": usuário quer saber gastos/receitas de uma categoria ou período
- "list_transactions": usuário quer ver lista de transações
- "other": qualquer outra coisa

ENTIDADES PARA EXTRAIR:
- amount: valor numérico (ex: 150, 50.5)
- title: descrição da transação (ex: "mercado", "uber", "salário")
- type: "income" (receita) ou "expense" (despesa)
- category: categoria mencionada (ex: "alimentação", "transporte")
- date: data mencionada em formato YYYY-MM-DD
- period: "day", "week", "month" ou "year"

EXEMPLOS:
"gastei 150 no mercado ontem" → intent: add_transaction, amount: 150, title: mercado, type: expense, date: ontem
"quanto gastei esse mês com comida?" → intent: query_expenses, category: alimentação, period: month
"qual meu saldo?" → intent: query_balance
"recebi 5000 de salário" → intent: add_transaction, amount: 5000, title: salário, type: income

IMPORTANTE:
- Números em português (ex: "mil", "cento e cinquenta") devem ser convertidos
- Valores com vírgula como decimal (ex: "50,5") devem virar 50.5
- Datas relativas (hoje, ontem, semana passada) devem ser convertidas
- Se não tiver certeza de algo, coloque null
- confidence deve ser 0-1

Retorne APENAS um JSON válido no formato:
{"intent": "add_transaction", "entities": {"amount": 150, "title": "mercado", "type": "expense"}, "confidence": 0.95}`
          }, {
            role: 'user',
            content: messageText
          }],
          temperature: 0.3,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        console.error('AI API error:', response.status, await response.text());
        return null;
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;
      
      console.log('🤖 NLP Response:', content);

      // Parse JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to parse NLP response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Converter datas relativas
      if (parsed.entities?.date) {
        const parsedDate = DateParser.parseDate(parsed.entities.date);
        if (parsedDate) {
          parsed.entities.date = parsedDate;
        }
      }

      return parsed;

    } catch (error) {
      console.error('NLP processing error:', error);
      return null;
    }
  }
}

class AICategorizer {
  /**
   * Usa IA para determinar a melhor categoria baseada no contexto da mensagem
   */
  static async suggestCategoryWithAI(
    userId: string,
    messageText: string,
    transactionType: 'income' | 'expense'
  ): Promise<{ category_id: string | null, category_name: string, confidence: number }> {
    try {
      console.log('🤖 AI Categorization started:', { messageText, transactionType });
      
      // Buscar categorias disponíveis do usuário
      const { data: userCategories, error: catError } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', userId)
        .eq('type', transactionType);

      if (catError || !userCategories || userCategories.length === 0) {
        console.log('No categories found, returning null');
        return { category_id: null, category_name: 'Sem categoria', confidence: 0 };
      }

      // Preparar lista de categorias para a IA
      const categoriesText = userCategories.map(cat => cat.name).join(', ');
      
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        console.error('LOVABLE_API_KEY not configured');
        return { category_id: null, category_name: 'Sem categoria', confidence: 0 };
      }

      // Chamar a IA para análise semântica
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `Você é um assistente que categoriza transações financeiras. 
              
Seu trabalho é analisar a mensagem do usuário e escolher a categoria MAIS ADEQUADA da lista fornecida.

IMPORTANTE:
- Analise o CONTEXTO e SIGNIFICADO das palavras, não apenas correspondência exata
- Palavras como "mercado", "supermercado", "feira" devem ir para "Alimentação"
- "padaria", "lanche", "restaurante" devem ir para "Alimentação"
- "uber", "ônibus", "gasolina" devem ir para "Transporte"
- "conta de luz", "água", "aluguel" devem ir para "Moradia"
- Se nenhuma categoria se adequar bem, retorne "Outros" se existir, ou null

Responda APENAS com um JSON válido no formato:
{"category": "Nome da Categoria", "confidence": 0.95}

Onde confidence é um número entre 0 e 1 indicando sua confiança na escolha.`
            },
            {
              role: 'user',
              content: `Mensagem do usuário: "${messageText}"
              
Categorias disponíveis: ${categoriesText}

Tipo da transação: ${transactionType === 'income' ? 'receita' : 'despesa'}

Qual a melhor categoria?`
            }
          ],
          temperature: 0.3,
          max_tokens: 100
        }),
      });

      if (!aiResponse.ok) {
        console.error('AI API error:', aiResponse.status, await aiResponse.text());
        return { category_id: null, category_name: 'Sem categoria', confidence: 0 };
      }

      const aiResult = await aiResponse.json();
      const aiContent = aiResult.choices[0]?.message?.content;
      
      console.log('🤖 AI Response:', aiContent);

      // Parse da resposta da IA
      const jsonMatch = aiContent.match(/\{[^}]+\}/);
      if (!jsonMatch) {
        console.error('Failed to parse AI response');
        return { category_id: null, category_name: 'Sem categoria', confidence: 0 };
      }

      const aiSuggestion = JSON.parse(jsonMatch[0]);
      const suggestedCategory = aiSuggestion.category;
      const confidence = aiSuggestion.confidence || 0;

      // Buscar o ID da categoria sugerida
      const matchedCategory = userCategories.find(cat => 
        cat.name.toLowerCase() === suggestedCategory.toLowerCase()
      );

      if (matchedCategory && confidence > 0.5) {
        console.log(`🎯 AI matched category: ${matchedCategory.name} (confidence: ${confidence})`);
        return {
          category_id: matchedCategory.id,
          category_name: matchedCategory.name,
          confidence: confidence
        };
      }

      // Fallback para "Outros"
      const outrosCategory = userCategories.find(cat => cat.name.toLowerCase() === 'outros');
      if (outrosCategory) {
        return { category_id: outrosCategory.id, category_name: 'Outros', confidence: 0.3 };
      }

      return { category_id: null, category_name: 'Sem categoria', confidence: 0 };

    } catch (error) {
      console.error('AI Categorization error:', error);
      return { category_id: null, category_name: 'Sem categoria', confidence: 0 };
    }
  }
}

// 📸 Classe para OCR de Notas Fiscais com Gemini Vision
class ReceiptOCR {
  /**
   * Baixa mídia do WhatsApp
   */
  static async downloadWhatsAppMedia(mediaId: string): Promise<Uint8Array> {
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    if (!WHATSAPP_ACCESS_TOKEN) {
      throw new Error('WHATSAPP_ACCESS_TOKEN não configurado');
    }

    // 1. Obter URL da mídia
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/v17.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );

    if (!mediaInfoResponse.ok) {
      throw new Error(`Erro ao obter URL da mídia: ${mediaInfoResponse.status}`);
    }

    const mediaInfo = await mediaInfoResponse.json();
    const mediaUrl = mediaInfo.url;

    // 2. Baixar a mídia
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`
      }
    });

    if (!mediaResponse.ok) {
      throw new Error(`Erro ao baixar mídia: ${mediaResponse.status}`);
    }

    return new Uint8Array(await mediaResponse.arrayBuffer());
  }

  /**
   * Analisa nota fiscal usando Gemini Vision
   */
  static async analyzeReceipt(imageBase64: string): Promise<{
    amount: number;
    merchant: string;
    category: string;
    date?: string;
  }> {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurado');
    }

    console.log('🤖 Analisando nota fiscal com Gemini Vision...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analise esta nota fiscal brasileira e extraia as seguintes informações:

1. Valor total (apenas número, ex: 87.50)
2. Nome do estabelecimento
3. Categoria provável (escolha UMA das opções: Alimentação, Transporte, Moradia, Saúde, Entretenimento, Educação, Vestuário, Outros)
4. Data (formato DD/MM/AAAA, se visível)

IMPORTANTE:
- Para "valor", retorne APENAS o número decimal (use ponto como separador)
- Para "merchant", retorne o nome do estabelecimento
- Para "category", escolha UMA categoria da lista acima
- Para "date", use formato DD/MM/AAAA ou deixe vazio se não encontrar

Retorne APENAS um JSON válido no formato:
{"amount": 87.50, "merchant": "Nome do Local", "category": "Alimentação", "date": "07/10/2025"}`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }],
        temperature: 0.2,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API Gemini:', response.status, errorText);
      throw new Error(`Erro na API Gemini: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    console.log('🤖 Resposta Gemini Vision:', content);

    // Parse do JSON
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      throw new Error('Não consegui extrair dados da nota fiscal');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    
    return {
      amount: parseFloat(extractedData.amount) || 0,
      merchant: extractedData.merchant || 'Desconhecido',
      category: extractedData.category || 'Outros',
      date: extractedData.date || undefined
    };
  }
}

// 🎭 Classe para Respostas Personalizadas
class PersonalizedResponses {
  static categoryEmojis: Record<string, string> = {
    'Alimentação': '🍽️',
    'Transporte': '🚗',
    'Moradia': '🏠',
    'Saúde': '💊',
    'Entretenimento': '🎬',
    'Lazer e Entretenimento': '🎉',
    'Educação': '📚',
    'Vestuário': '👔',
    'Salário': '💼',
    'Freelance': '💻',
    'Investimentos': '📈',
    'Outros': '📌'
  };

  /**
   * Gera resposta personalizada para transação salva
   */
  static async generateSaveResponse(
    userName: string | undefined,
    transaction: {
      type: 'income' | 'expense';
      amount: number;
      title: string;
      category_name?: string;
    },
    balance: { income: number; expense: number; total: number }
  ): Promise<string> {
    const greeting = userName ? userName.split(' ')[0] : 'você';
    const emoji = this.categoryEmojis[transaction.category_name || 'Outros'] || '📌';
    const typeEmoji = transaction.type === 'income' ? '💰' : '💸';
    const typeText = transaction.type === 'income' ? 'Receita' : 'Despesa';

    // Templates SUPER CONVERSACIONAIS (inspirado no MeuAssessor)
    const templates = [
      `${typeEmoji} Anotado! Gastou R$ ${transaction.amount.toFixed(2)} com ${transaction.title.toLowerCase()} ${emoji}\n\n💰 Seu saldo agora: R$ ${balance.total.toFixed(2)}`,
      
      `Pronto, ${greeting}! ${typeEmoji} Registrei R$ ${transaction.amount.toFixed(2)} em ${transaction.category_name || transaction.title} ${emoji}\n\n📊 Resumo do mês:\n💚 Receitas: R$ ${balance.income.toFixed(2)}\n💸 Despesas: R$ ${balance.expense.toFixed(2)}\n💰 Saldo: R$ ${balance.total.toFixed(2)}`,
      
      `Feito! ${typeEmoji} ${typeText} de R$ ${transaction.amount.toFixed(2)} → ${transaction.category_name || transaction.title} ${emoji}\n\nSaldo atual: R$ ${balance.total.toFixed(2)}`,
      
      `✅ Salvei! R$ ${transaction.amount.toFixed(2)} em ${transaction.title.toLowerCase()} já está no sistema ${emoji}\n\n💰 Saldo: R$ ${balance.total.toFixed(2)}`
    ];

    // Template especial para despesas altas
    if (transaction.type === 'expense' && transaction.amount > 200) {
      templates.push(
        `Opa! ${typeEmoji} Despesa grande aqui: R$ ${transaction.amount.toFixed(2)} em ${transaction.title.toLowerCase()} ${emoji}\n\n📊 Esse mês:\n💸 Despesas: R$ ${balance.expense.toFixed(2)}\n💰 Saldo: R$ ${balance.total.toFixed(2)}\n\n💡 Quer ver onde mais você gastou? Pergunte "quanto gastei com ${transaction.category_name?.toLowerCase() || 'outros'}?"`
      );
    }

    // Template especial para receitas
    if (transaction.type === 'income') {
      templates.push(
        `Uhul! 🎉 Receita de R$ ${transaction.amount.toFixed(2)} registrada! ${emoji}\n\n💚 Total de receitas: R$ ${balance.income.toFixed(2)}\n💰 Saldo atual: R$ ${balance.total.toFixed(2)}\n\nBom ver o dinheiro entrando! 💪`
      );
    }

    // Template especial para pequenos gastos (< R$ 30)
    if (transaction.type === 'expense' && transaction.amount < 30) {
      templates.push(
        `${typeEmoji} Beleza! Anotei R$ ${transaction.amount.toFixed(2)} em ${transaction.title.toLowerCase()} ${emoji}\n\nOs pequenos gastos também contam! 😉\nSaldo: R$ ${balance.total.toFixed(2)}`
      );
    }

    // Escolher template aleatório
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  }

  /**
   * Gera saudação personalizada
   */
  static getGreeting(userName: string | undefined): string {
    const name = userName ? userName.split(' ')[0] : 'você';
    const hour = new Date().getHours();
    
    if (hour < 12) {
      return `Bom dia, ${name}! ☀️`;
    } else if (hour < 18) {
      return `Boa tarde, ${name}! 🌤️`;
    } else {
      return `Boa noite, ${name}! 🌙`;
    }
  }
}

class CategoryMatcher {
  /**
   * Busca a melhor categoria para uma transação baseada no título
   * Prioridade: 1) Match exato, 2) Similaridade, 3) AI, 4) "Outros"
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

      // 3. Heurística específica para "água"
      if (normalizedTitle.includes('agua') || normalizedTitle.includes('água')) {
        if (normalizedTitle.includes('conta') || normalizedTitle.includes('servico') || normalizedTitle.includes('serviço')) {
          // "conta de água" vai para Moradia
          const moradiaMatch = categories.find(cat => 
            cat.name.toLowerCase() === 'moradia'
          );
          if (moradiaMatch) {
            console.log(`💧 "conta de água" -> Moradia`);
            return { category_id: moradiaMatch.id, category_name: moradiaMatch.name, suggested: false };
          }
        }
        // "água" simples vai para Outros
        const outrosMatch = categories.find(cat => 
          cat.name.toLowerCase() === 'outros'
        );
        if (outrosMatch) {
          console.log(`💧 "água" simples -> Outros`);
          return { category_id: outrosMatch.id, category_name: 'Outros', suggested: false };
        }
      }

      // 4. 🤖 NOVO: Usar IA para sugestão inteligente baseada no contexto
      console.log('🤖 No exact/similar match, trying AI categorization...');
      const aiResult = await AICategorizer.suggestCategoryWithAI(userId, title, type);
      
      if (aiResult.category_id && aiResult.confidence > 0.7) {
        console.log(`🎯 AI suggested category with high confidence: ${aiResult.category_name}`);
        return { category_id: aiResult.category_id, category_name: aiResult.category_name, suggested: true };
      }

      // 5. Buscar categoria "Outros"
      const outrosMatch = categories.find(cat => 
        cat.name.toLowerCase() === 'outros'
      );

      if (outrosMatch) {
        console.log(`Using "Outros" category for: ${title}`);
        return { category_id: outrosMatch.id, category_name: 'Outros', suggested: false };
      }

      // 5. Se não encontrou "Outros", usar primeira categoria disponível
      console.log(`No suitable category found, using first available: ${categories[0].name}`);
      return { category_id: categories[0].id, category_name: categories[0].name, suggested: false };

    } catch (error) {
      console.error('Error finding category:', error);
      return { category_id: null, category_name: 'Sem categoria', suggested: false };
    }
  }
}

class WhatsAppAgent {
  /**
   * Normaliza comandos removendo acentos, pontuação e espaços extras
   */
  static normalizeCommand(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[?!.,;:]/g, '') // Remove pontuação
      .trim()
      .replace(/\s+/g, ' '); // Remove espaços extras
  }

  static async processMessage(session: Session, message: WhatsAppMessage): Promise<{ response: string, sessionData: SessionData }> {
    const messageText = message.body?.toLowerCase().trim() || '';
    const normalizedText = this.normalizeCommand(messageText);
    const sessionData = session.session_data || {};
    
    // 🎙️ FALLBACK ESPECIAL: Áudio não transcrito (sem usar IA)
    if (messageText === '__audio_transcription_failed__') {
      console.log('⚠️ Audio transcription failed - sending guided fallback');
      return {
        response: '🎙️ *Não consegui ouvir seu áudio*\n\n' +
                 'Por favor, tente:\n' +
                 '• Enviar texto: "gasto 50 mercado"\n' +
                 '• Ou gravar o áudio novamente\n\n' +
                 'Comandos disponíveis: digite "ajuda"',
        sessionData
      };
    }
    
    // 🔍 DEBUG: Log detalhado de TODA mensagem recebida
    console.log('📨 === DEBUG: MENSAGEM RECEBIDA ===');
    console.log('De:', message.from);
    console.log('Tipo:', message.type);
    console.log('Tem imagem?:', !!message.image, message.image);
    console.log('Tem áudio?:', !!message.audio, message.audio);
    console.log('Texto original:', message.body);
    console.log('Texto normalizado:', normalizedText);
    console.log('Estado da sessão:', sessionData.conversation_state || 'idle');
    console.log('Autenticado:', !!session.user_id);
    console.log('=====================================');
    
    // 📸 PRIORIDADE 0: Processar imagens (OCR de notas fiscais)
    if (message.image) {
      console.log('📸 IMAGEM DETECTADA! Processando OCR...', message.image);
      return await this.handleImageMessage(session, message);
    }

    // 🎤 ÁUDIO: Deve vir já transcrito do webhook
    // Se message.type === 'audio' ainda, significa que o webhook não transcreveu
    if (message.type === 'audio' && message.audio) {
      console.error('❌ CRÍTICO: Áudio recebido sem transcrição do webhook');
      return {
        response: `❌ *Erro ao processar áudio*\n\nO áudio deve ser transcrito antes de chegar aqui.\n\nTente enviar novamente ou digite texto.`,
        sessionData
      };
    }
    
    console.log('📨 Processing message:', { 
      original: messageText.substring(0, 30) + '...', 
      normalized: normalizedText.substring(0, 30) + '...',
      isAuthenticated: !!session.user_id 
    });
    console.log('Processing message with state:', {
      state: sessionData.conversation_state || 'idle',
      hasPendingTransaction: !!sessionData.pending_transaction
    });
    
    // PRIORIDADE 0.8: Confirmação de OCR
    if (sessionData.conversation_state === 'confirming_ocr' && sessionData.pending_ocr_data) {
      return await this.handleOCRConfirmation(session, messageText);
    }

    // PRIORIDADE 0.9: Confirmação de exclusão
    if (sessionData.conversation_state === 'awaiting_delete_confirmation' && sessionData.pending_delete) {
      return await this.handleDeleteConfirmation(session, messageText);
    }

    // PRIORIDADE 0.95: Edição de transação
    if (sessionData.conversation_state === 'awaiting_edit_field' && sessionData.pending_edit) {
      return await this.handleEditFieldSelection(session, messageText);
    }

    if (sessionData.conversation_state === 'awaiting_edit_value' && sessionData.pending_edit) {
      return await this.handleEditValueInput(session, messageText);
    }

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
      
      // 🔧 LIMPAR ESTADO após salvar para evitar processar próxima mensagem como comando
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_transaction: undefined
        }
      });
      
      return {
        response: saveResult,
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }
    
    // PRIORIDADE 2: Comandos que sempre funcionam
    console.log('🔵 Checking normalized command:', normalizedText);
    
    if (['ajuda', 'help', 'menu', 'comandos'].includes(normalizedText)) {
      return {
        response: this.getHelpMenu(),
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }

    if (['cancelar', 'cancel', 'sair'].includes(normalizedText)) {
      return {
        response: '❌ Operação cancelada.',
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }

    // PRIORIDADE 2.5: Comandos de EDITAR e EXCLUIR
    const editRegex = /\b(editar|alterar|corrigir|modificar)\s*(ultima|last|anterior)?\b/i;
    const deleteRegex = /\b(excluir|deletar|apagar|remover)\s*(ultima|last|anterior)?\b/i;

    if (editRegex.test(normalizedText)) {
      console.log('🔵 COMMAND DETECTED: editar última');
      return await this.handleEditCommand(session);
    }

    if (deleteRegex.test(normalizedText)) {
      console.log('🔵 COMMAND DETECTED: excluir última');
      return await this.handleDeleteCommand(session);
    }

    // PRIORIDADE 3: Comandos de SALDO (verificar ANTES de relatórios)
    // REGEX SUPER TOLERANTE: aceita variações como "saldo", "saúdo", "meu saldo", etc.
    const saldoRegex = /\b(saldo|balance|total|conta)\b/i;
    if (saldoRegex.test(normalizedText)) {
      console.log('🔵 COMMAND DETECTED: saldo (variant:', messageText, ')');
      console.log('🔵 Session data for balance:', {
        hasUserId: !!session.user_id,
        userIdPrefix: session.user_id?.substring(0, 8) + '***',
        sessionId: session.id?.substring(0, 8) + '***'
      });
      
      if (!session.user_id) {
        console.error('❌ CRITICAL: session.user_id is missing for saldo command');
        return {
          response: `❌ Erro de autenticação.\n\nDigite "codigo" para autenticar novamente.`,
          sessionData
        };
      }
      
      try {
        console.log('🔵 Calling getBalance() with userId:', session.user_id.substring(0, 8) + '***');
        const balanceResponse = await this.getBalance(session.user_id);
        console.log('🔵 Balance response received, length:', balanceResponse.length);
        return {
          response: balanceResponse,
          sessionData
        };
      } catch (error) {
        console.error('❌ getBalance() threw error:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 300)
        });
        
        // Retornar mensagem de erro mais específica baseada no tipo de erro
        let errorMessage = `❌ Não consegui consultar o saldo.`;
        
        if (error.message?.includes('TIMEOUT')) {
          errorMessage += `\n\n⏱️ A consulta demorou muito. Tente novamente.`;
        } else if (error.message?.includes('DB_ERROR')) {
          errorMessage += `\n\n🔧 Erro no banco de dados. Tente: "relatorio dia"`;
        } else if (error.message?.includes('USER_ID_MISSING')) {
          errorMessage += `\n\n🔐 Erro de autenticação. Digite "codigo"`;
        } else {
          errorMessage += `\n\n💡 Tente: "relatorio dia" para ver transações.`;
        }
        
        return {
          response: errorMessage,
          sessionData
        };
      }
    }

    // PRIORIDADE 4: Comandos de RELATÓRIO com TOLERÂNCIA TOTAL
    // Normalizar e remover acentos para aceitar "relatorio" e "relatório"
    const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedNoAccents = removeAccents(normalizedText);
    
    // "hoje" ou "relatorio dia" -> relatório do dia
    if (normalizedText === 'hoje' || normalizedNoAccents.includes('relatorio dia') || normalizedNoAccents.includes('extrato dia')) {
      console.log('🔵 COMMAND DETECTED: relatorio dia');
      console.log('REPORT_TYPE: day');
      return {
        response: await this.generateAIReport(session.user_id!, 'day'),
        sessionData
      };
    }

    // "semana" ou "relatorio semana" -> relatório da semana
    if (normalizedText.includes('semana') || normalizedNoAccents.includes('semanal') || 
        normalizedNoAccents.includes('relatorio semana') || normalizedNoAccents.includes('extrato semana')) {
      console.log('🔵 COMMAND DETECTED: relatorio semana');
      console.log('REPORT_TYPE: week');
      return {
        response: await this.generateAIReport(session.user_id!, 'week'),
        sessionData
      };
    }

    // "mes", "mês", "relatorio mes", "extrato" -> relatório mensal
    // IMPORTANTE: "saldo" NÃO deve cair aqui!
    if (removeAccents(normalizedText).includes('mes') || normalizedText.includes('mensal') || 
        normalizedNoAccents.includes('relatorio mes') || normalizedNoAccents.includes('extrato mes') ||
        normalizedNoAccents === 'relatorio' || normalizedNoAccents === 'extrato') {
      console.log('🔵 COMMAND DETECTED: relatorio mensal (variant:', messageText, ')');
      console.log('REPORT_TYPE: month');
      return {
        response: await this.generateAIReport(session.user_id!, 'month'),
        sessionData
      };
    }

    // "ano" ou "relatorio ano" -> relatório anual
    if (normalizedText.includes('ano') || normalizedText.includes('anual') || 
        normalizedNoAccents.includes('relatorio ano') || normalizedNoAccents.includes('extrato ano')) {
      console.log('🔵 COMMAND DETECTED: relatorio anual');
      console.log('REPORT_TYPE: year');
      return {
        response: await this.generateAIReport(session.user_id!, 'year'),
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
    const greetings = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'alo'];
    if (greetings.some(greeting => normalizedText === greeting || normalizedText.startsWith(greeting + ' '))) {
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

    // 🤖 PRIORIDADE 2.8: Processar com IA para linguagem natural
    console.log('🤖 Attempting NLP processing for message:', messageText);
    const nlpResult = await NaturalLanguageProcessor.processNaturalLanguage(messageText, session.user_id!);
    
    if (nlpResult && nlpResult.confidence > 0.7) {
      console.log('🤖 NLP Success:', nlpResult);
      
      // Processar baseado na intenção
      switch (nlpResult.intent) {
        case 'add_transaction':
          if (nlpResult.entities.amount && nlpResult.entities.type) {
            console.log('🤖 Adding transaction via NLP');
            const transaction: Partial<Transaction> = {
              amount: nlpResult.entities.amount,
              title: nlpResult.entities.title || (nlpResult.entities.category || 'Sem título'),
              type: nlpResult.entities.type,
              date: nlpResult.entities.date || new Date().toISOString().split('T')[0],
              source: 'whatsapp'
            };
            
            const saveResult = await this.saveTransaction(session.user_id!, transaction);
            
            // ✅ CRITICAL FIX: Expor transactionId e sendButtons no topo do retorno
            const saveResponse = typeof saveResult === 'string' ? saveResult : saveResult.response;
            const transactionId = typeof saveResult === 'object' ? saveResult.transactionId : undefined;
            const sendButtons = typeof saveResult === 'object' ? saveResult.sendButtons : false;
            
            return {
              response: saveResponse,
              transactionId,
              sendButtons,
              sessionData: { ...sessionData, conversation_state: 'idle' }
            };
          }
          break;
          
        case 'query_balance':
          console.log('🤖 Querying balance via NLP');
          try {
            const balanceResponse = await this.getBalance(session.user_id!);
            return { response: balanceResponse, sessionData };
          } catch (error) {
            console.error('Balance query error:', error);
            return {
              response: '❌ Erro ao consultar saldo. Tente novamente.',
              sessionData
            };
          }
          
        case 'query_expenses':
          console.log('🤖 Querying expenses/income via NLP');
          const period = nlpResult.entities.period || 'month';
          return {
            response: await this.generateAIReport(session.user_id!, period),
            sessionData
          };
          
        case 'list_transactions':
          console.log('🤖 Listing transactions via NLP');
          return {
            response: await this.generateAIReport(session.user_id!, 'month'),
            sessionData
          };
          
        case 'other':
          console.log('🤖 Handling social/other message via NLP');
          // Detectar mensagens de agradecimento
          if (/obrigad[oa]?|valeu|thanks|muito bom|legal/i.test(messageText)) {
            return {
              response: '😊 Por nada! Estou aqui sempre que precisar. É só me chamar! 💙',
              sessionData: { ...sessionData, conversation_state: 'idle' }
            };
          }
          // Detectar saudações
          if (/oi|ol[aá]|bom dia|boa tarde|boa noite|hey|e a[íi]/i.test(messageText)) {
            return {
              response: await PersonalizedResponses.getGreeting(session.user_id!),
              sessionData: { ...sessionData, conversation_state: 'idle' }
            };
          }
          // Outros casos sociais - resposta genérica amigável
          return {
            response: '😊 Entendi! Se precisar registrar uma transação ou consultar seu saldo, é só me avisar!',
            sessionData: { ...sessionData, conversation_state: 'idle' }
          };
      }
    }

    // PRIORIDADE 3: Tentar processar como transação (fallback tradicional)
    console.log('🔵 Attempting to parse transaction from message:', messageText);
    const parseResult = TransactionParser.parseTransactionFromText(messageText);
    console.log('🔵 Parse result:', parseResult ? 'SUCCESS' : 'FAILED', parseResult);
    
    // Se o parsing falhou mas detectamos um número, perguntar a categoria
    if (!parseResult && /\d+/.test(messageText)) {
      console.log('🔵 Parser failed but number detected, asking for category');
      
      // Extrair o número da mensagem (formato brasileiro: 1.000,00 ou 1000)
      const numberMatch = messageText.match(/(\d+(?:[.,]\d+)*(?:[.,]\d{2})?)/);
      if (numberMatch) {
        const amount = parseBrazilianNumber(numberMatch[1]);
        console.log(`🔵 Extracted amount: raw="${numberMatch[1]}" parsed=${amount}`);
        
        // Determinar tipo baseado em palavras-chave
        const isIncome = /recebi|receita|entrada|ganho|salario|salário/.test(messageText);
        const type = isIncome ? 'income' : 'expense';
        
        // Buscar categorias do tipo correto para sugerir
        let categoryExamples = '• Alimentação\n• Transporte\n• Moradia';
        try {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          
          const { data: categories } = await supabase
            .from('categories')
            .select('name')
            .eq('user_id', session.user_id)
            .eq('type', type)
            .limit(4);
          
          if (categories && categories.length > 0) {
            categoryExamples = categories.map(c => `• ${c.name}`).join('\n');
          } else {
            // Exemplos padrão baseados no tipo
            categoryExamples = type === 'income' 
              ? '• Salário\n• Freelance\n• Projetos\n• Investimentos'
              : '• Alimentação\n• Transporte\n• Moradia\n• Saúde';
          }
        } catch (error) {
          console.log('Error fetching categories for examples:', error);
        }
        
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
                   `Exemplos de categorias de ${type === 'income' ? 'receita' : 'despesa'}:\n` +
                   categoryExamples,
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
      
        // Salvar imediatamente usando a data detectada ou HOJE (horário local Brasil) por padrão
      const today = (() => {
        const now = new Date();
        const brazilOffset = -3 * 60; // UTC-3
        const localTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));
        const year = localTime.getUTCFullYear();
        const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(localTime.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      })();
      
      const txToSave = { ...transaction, date: detectedDate || today };
      console.log('🚀 CALLING saveTransaction() with:', {
        user_id: session.user_id?.substring(0, 8) + '***',
        amount: txToSave.amount,
        title: txToSave.title,
        type: txToSave.type,
        date: txToSave.date
      });
      
      const saveResult = await this.saveTransaction(session.user_id, txToSave);
      
      const saveResponse = typeof saveResult === 'string' ? saveResult : saveResult.response;
      const transactionId = typeof saveResult === 'object' ? saveResult.transactionId : undefined;
      const sendButtons = typeof saveResult === 'object' ? saveResult.sendButtons : false;
      
      console.log('✅ saveTransaction() completed, response:', saveResponse.substring(0, 50) + '...');
      
      // 🔧 LIMPAR ESTADO após salvar para evitar processar próxima mensagem como comando
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_transaction: undefined
        }
      });
      
      return {
        response: saveResponse,
        transactionId,
        sendButtons,
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

      // Derive a string response and optional metadata
      const saveResponse = typeof saveResult === 'string' ? saveResult : saveResult.response;
      const transactionId = typeof saveResult === 'object' ? saveResult.transactionId : undefined;
      const sendButtons = typeof saveResult === 'object' ? saveResult.sendButtons : false;
      
      // 🔧 LIMPAR ESTADO após salvar
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_transaction: undefined
        }
      });
      
      return {
        response: saveResponse,
        transactionId,
        sendButtons,
        sessionData: { ...sessionData, conversation_state: 'idle', pending_transaction: undefined }
      };
    }

    // Estado: aguardando confirmação
    if (sessionData.conversation_state === 'waiting_confirmation' && sessionData.pending_transaction) {
      const affirmative = ['sim', 's', 'yes', 'y', 'confirmo', 'confirmar', 'ok'];
      const negative = ['não', 'nao', 'n', 'no', 'cancelar', 'cancel'];
      
      if (affirmative.includes(messageText)) {
        console.log('✅ CONFIRMATION: User confirmed transaction');
        console.log('🔵 Transaction data:', JSON.stringify(sessionData.pending_transaction, null, 2));
        
        // Usar data local do Brasil se não especificada
        const localTime = getBrazilTime();
        const defaultDate = `${localTime.getUTCFullYear()}-${String(localTime.getUTCMonth() + 1).padStart(2, '0')}-${String(localTime.getUTCDate()).padStart(2, '0')}`;
        
        const tx = {
          ...sessionData.pending_transaction,
          date: sessionData.pending_transaction?.date || defaultDate
        };
        
        console.log('🚀 Calling saveTransaction...');
        const startTime = Date.now();
        const saveResult = await this.saveTransaction(session.user_id!, tx);
        console.log(`✅ saveTransaction completed in ${Date.now() - startTime}ms`);

        // Coerce response to string and extract metadata if present
        const saveResponse = typeof saveResult === 'string' ? saveResult : saveResult.response;
        const transactionId = typeof saveResult === 'object' ? saveResult.transactionId : undefined;
        const sendButtons = typeof saveResult === 'object' ? saveResult.sendButtons : false;
        console.log('📤 Response to send:', typeof saveResponse === 'string' ? saveResponse.substring(0, 100) + '...' : 'object');
        
        // 🔧 LIMPAR ESTADO após salvar
        await SessionManager.updateSession(session.id, {
          session_data: {
            ...sessionData,
            conversation_state: 'idle',
            pending_transaction: undefined
          }
        });
        
        console.log('✅ Session cleared, returning response to webhook');
        
        return {
          response: saveResponse,
          transactionId,
          sendButtons,
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
           `*✨ FALE NATURALMENTE! Eu entendo você:*\n` +
           `• "gastei 150 no mercado ontem"\n` +
           `• "quanto gastei esse mês com comida?"\n` +
           `• "recebi 5000 de salário"\n` +
           `• "paguei 80 de uber hoje"\n` +
           `• "qual meu saldo?"\n\n` +
           
           `*📝 Outras formas de adicionar:*\n` +
           `• gasto 50 mercado\n` +
           `• receita 1000 salario\n` +
           `• +100 freelance\n` +
           `• -30 lanche hoje\n\n` +
           
           `*📸 Enviar Nota Fiscal:*\n` +
           `• Tire uma foto da nota fiscal\n` +
           `• Envie a imagem aqui\n` +
           `• Eu extraio os dados automaticamente!\n\n` +
           
           `*💳 Consultas (fale como quiser):*\n` +
           `• "qual meu saldo?"\n` +
           `• "quanto gastei com alimentação?"\n` +
           `• "quanto recebi esse mês?"\n` +
           `• "me mostra o extrato"\n\n` +
           
           `*📊 Relatórios:*\n` +
           `• *hoje* - movimentações de hoje\n` +
           `• *semana* - últimos 7 dias\n` +
           `• *relatorio* ou *mes* - mensal\n` +
           `• *ano* - relatório anual\n\n` +
           
           `*✏️ Editar/Excluir:*\n` +
           `• *editar última*\n` +
           `• *excluir última*\n\n` +
           
           `*🤖 Inteligência Artificial:*\n` +
           `Uso IA para entender o que você escreve!\n` +
           `Não precisa decorar comandos - só fale naturalmente! 😊\n\n` +
           
           `💡 *Exemplos práticos:*\n` +
           `• "paguei 200 de conta de luz"\n` +
           `• "recebi 300 de freelance"\n` +
           `• "gastei 45 na farmácia ontem"`;
  }

  // 📸 Método para processar imagens (OCR)
  static async handleImageMessage(session: Session, message: WhatsAppMessage): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    
    if (!session.user_id) {
      return {
        response: '❌ Você precisa estar autenticado para enviar notas fiscais.\n\nDigite "codigo" para autenticar.',
        sessionData
      };
    }

    try {
      console.log('📸 Baixando imagem...');
      const imageData = await ReceiptOCR.downloadWhatsAppMedia(message.image!.id);
      
      // Converter para base64
      const base64Image = btoa(String.fromCharCode(...imageData));
      
      console.log('🤖 Analisando nota fiscal com Gemini Vision...');
      const ocrData = await ReceiptOCR.analyzeReceipt(base64Image);
      
      console.log('✅ OCR concluído:', ocrData);

      // Salvar dados OCR pendentes
      const updatedSessionData = {
        ...sessionData,
        conversation_state: 'confirming_ocr' as const,
        pending_ocr_data: ocrData
      };

      await SessionManager.updateSession(session.id, {
        session_data: updatedSessionData
      });

      const response = `📸 *Nota Fiscal Analisada!*\n\n` +
                      `💰 Valor: R$ ${ocrData.amount.toFixed(2)}\n` +
                      `🏪 Local: ${ocrData.merchant}\n` +
                      `📂 Categoria: ${ocrData.category}\n` +
                      `${ocrData.date ? `📅 Data: ${ocrData.date}\n` : ''}\n` +
                      `Salvar essa despesa? *(sim/não)*`;

      return {
        response,
        sessionData: updatedSessionData
      };

    } catch (error) {
      console.error('❌ Erro ao processar imagem:', error);
      return {
        response: `❌ Não consegui processar a nota fiscal.\n\n` +
                 `Tente:\n` +
                 `• Foto mais nítida\n` +
                 `• Boa iluminação\n` +
                 `• Nota fiscal completa na imagem\n\n` +
                 `Ou adicione manualmente: "gasto 50 mercado"`,
        sessionData
      };
    }
  }

  // ✅ Confirmar OCR
  static async handleOCRConfirmation(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const ocrData = sessionData.pending_ocr_data!;

    const affirmative = ['sim', 's', 'yes', 'y', 'confirmo', 'ok', 'salvar'];
    const negative = ['não', 'nao', 'n', 'no', 'cancelar'];

    if (affirmative.includes(messageText.toLowerCase().trim())) {
      // Parsear data se existir
      let parsedDate = ocrData.date ? DateParser.parseDate(ocrData.date) : null;
      
      // Usar data de hoje se não encontrou
      if (!parsedDate) {
        const localTime = getBrazilTime();
        parsedDate = `${localTime.getUTCFullYear()}-${String(localTime.getUTCMonth() + 1).padStart(2, '0')}-${String(localTime.getUTCDate()).padStart(2, '0')}`;
      }

      // Criar transação
      const transaction: Partial<Transaction> = {
        amount: ocrData.amount,
        title: ocrData.merchant,
        type: 'expense',
        date: parsedDate,
        source: 'whatsapp'
      };

      // Buscar nome do usuário para resposta personalizada
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', session.user_id!)
        .maybeSingle();

      const saveResult = await this.saveTransaction(session.user_id!, transaction);
      
      const saveResponse = typeof saveResult === 'string' ? saveResult : saveResult.response;
      const transactionId = typeof saveResult === 'object' ? saveResult.transactionId : undefined;
      const sendButtons = typeof saveResult === 'object' ? saveResult.sendButtons : false;

      // Limpar estado
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_ocr_data: undefined
        }
      });

      return {
        response: saveResponse,
        transactionId,
        sendButtons,
        sessionData: { ...sessionData, conversation_state: 'idle', pending_ocr_data: undefined }
      };

    } else if (negative.includes(messageText.toLowerCase().trim())) {
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_ocr_data: undefined
        }
      });

      return {
        response: '❌ Operação cancelada.',
        sessionData: { ...sessionData, conversation_state: 'idle', pending_ocr_data: undefined }
      };
    } else {
      return {
        response: 'Por favor, responda *"sim"* para confirmar ou *"não"* para cancelar.',
        sessionData
      };
    }
  }

  // ✏️ Métodos para editar transações
  static async handleEditCommand(session: Session): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};

    if (!session.user_id) {
      return {
        response: '❌ Você precisa estar autenticado.\n\nDigite "codigo" para autenticar.',
        sessionData
      };
    }

    // Buscar última transação
    const { data: lastTransaction } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastTransaction) {
      return {
        response: '❌ Nenhuma transação encontrada para editar.',
        sessionData
      };
    }

    const emoji = lastTransaction.type === 'income' ? '💰' : '💸';
    const typeText = lastTransaction.type === 'income' ? 'Receita' : 'Despesa';
    const categoryName = lastTransaction.categories?.name || 'Sem categoria';

    const updatedSessionData = {
      ...sessionData,
      conversation_state: 'awaiting_edit_field' as const,
      pending_edit: {
        transaction_id: lastTransaction.id,
        original_transaction: lastTransaction
      }
    };

    await SessionManager.updateSession(session.id, {
      session_data: updatedSessionData
    });

    const response = `✏️ *Editar Transação*\n\n` +
                    `${emoji} *${typeText}*\n` +
                    `💰 Valor: R$ ${lastTransaction.amount}\n` +
                    `📝 Título: ${lastTransaction.title}\n` +
                    `📂 Categoria: ${categoryName}\n` +
                    `📅 Data: ${new Date(lastTransaction.date + 'T00:00:00').toLocaleDateString('pt-BR')}\n\n` +
                    `O que deseja editar?\n` +
                    `1️⃣ Valor\n` +
                    `2️⃣ Categoria\n` +
                    `3️⃣ Título\n` +
                    `4️⃣ Data\n` +
                    `5️⃣ Cancelar\n\n` +
                    `Digite o número:`;

    return {
      response,
      sessionData: updatedSessionData
    };
  }

  static async handleEditFieldSelection(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const pendingEdit = sessionData.pending_edit!;

    if (messageText.toLowerCase() === 'cancelar') {
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_edit: undefined
        }
      });

      return {
        response: '❌ Edição cancelada.',
        sessionData: { ...sessionData, conversation_state: 'idle', pending_edit: undefined }
      };
    }

    const fieldMap: Record<string, 'amount' | 'category' | 'title' | 'date' | 'cancel'> = {
      '1': 'amount',
      '2': 'category',
      '3': 'title',
      '4': 'date',
      '5': 'cancel'
    };

    const field = fieldMap[messageText.trim()];

    if (!field) {
      return {
        response: '❌ Opção inválida.\n\nDigite 1, 2, 3, 4 ou 5',
        sessionData
      };
    }

    // Se escolheu cancelar (5)
    if (field === 'cancel') {
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_edit: undefined
        }
      });

      return {
        response: '❌ Edição cancelada.',
        sessionData: { ...sessionData, conversation_state: 'idle', pending_edit: undefined }
      };
    }

    const updatedSessionData = {
      ...sessionData,
      conversation_state: 'awaiting_edit_value' as const,
      pending_edit: {
        ...pendingEdit,
        field
      }
    };

    await SessionManager.updateSession(session.id, {
      session_data: updatedSessionData
    });

    const promptMap = {
      amount: '💰 Digite o novo valor:\nEx: 150 ou 150.50',
      category: '📂 Digite a nova categoria:\nEx: Alimentação, Transporte, etc.',
      title: '📝 Digite o novo título:\nEx: Supermercado, Uber, etc.',
      date: '📅 Digite a nova data:\nEx: hoje, ontem, 28/09'
    };

    return {
      response: promptMap[field],
      sessionData: updatedSessionData
    };
  }

  static async handleEditValueInput(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const pendingEdit = sessionData.pending_edit!;
    const field = pendingEdit.field!;

    let updateData: any = {};

    try {
      switch (field) {
        case 'amount':
          const amount = parseBrazilianNumber(messageText);
          if (amount <= 0 || isNaN(amount)) {
            return {
              response: '❌ Valor inválido. Digite um número positivo.',
              sessionData
            };
          }
          updateData.amount = amount;
          break;

        case 'category':
          // Buscar categoria pelo nome
          const { data: category } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', session.user_id!)
            .ilike('name', messageText.trim())
            .maybeSingle();

          if (!category) {
            return {
              response: '❌ Categoria não encontrada.\n\nDigite o nome exato de uma categoria existente.',
              sessionData
            };
          }
          updateData.category_id = category.id;
          break;

        case 'title':
          if (messageText.trim().length < 2) {
            return {
              response: '❌ Título muito curto. Digite pelo menos 2 caracteres.',
              sessionData
            };
          }
          updateData.title = messageText.trim();
          break;

        case 'date':
          const parsedDate = DateParser.parseDate(messageText);
          if (!parsedDate) {
            return {
              response: '❌ Data inválida.\n\nUse: hoje, ontem, ou DD/MM',
              sessionData
            };
          }
          updateData.date = parsedDate;
          break;
      }

      // Atualizar transação
      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', pendingEdit.transaction_id)
        .eq('user_id', session.user_id!);

      if (error) throw error;

      // Limpar estado
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_edit: undefined
        }
      });

      const fieldNameMap = {
        amount: 'Valor',
        category: 'Categoria',
        title: 'Título',
        date: 'Data'
      };

      return {
        response: `✅ ${fieldNameMap[field]} atualizado com sucesso!\n\n📊 Para visualizar mais detalhes e relatórios, acesse a plataforma:\n🔗 https://bc45aac3-c622-434f-ad58-afc37c18c6c2.lovableproject.com`,
        sessionData: { ...sessionData, conversation_state: 'idle', pending_edit: undefined }
      };

    } catch (error) {
      console.error('Erro ao editar transação:', error);
      return {
        response: '❌ Erro ao editar transação. Tente novamente.',
        sessionData
      };
    }
  }

  // 🗑️ Métodos para excluir transações
  static async handleDeleteCommand(session: Session): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};

    if (!session.user_id) {
      return {
        response: '❌ Você precisa estar autenticado.\n\nDigite "codigo" para autenticar.',
        sessionData
      };
    }

    // Buscar última transação
    const { data: lastTransaction } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastTransaction) {
      return {
        response: '❌ Nenhuma transação encontrada para excluir.',
        sessionData
      };
    }

    const emoji = lastTransaction.type === 'income' ? '💰' : '💸';
    const typeText = lastTransaction.type === 'income' ? 'Receita' : 'Despesa';

    const updatedSessionData = {
      ...sessionData,
      conversation_state: 'awaiting_delete_confirmation' as const,
      pending_delete: {
        transaction_id: lastTransaction.id,
        transaction_title: lastTransaction.title,
        transaction_amount: lastTransaction.amount
      }
    };

    await SessionManager.updateSession(session.id, {
      session_data: updatedSessionData
    });

    const response = `🗑️ *Confirmar Exclusão*\n\n` +
                    `${emoji} ${typeText}: R$ ${lastTransaction.amount}\n` +
                    `📝 ${lastTransaction.title}\n\n` +
                    `Tem certeza que deseja excluir? *(sim/não)*`;

    return {
      response,
      sessionData: updatedSessionData
    };
  }

  static async handleDeleteConfirmation(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const pendingDelete = sessionData.pending_delete!;

    const affirmative = ['sim', 's', 'yes', 'y', 'confirmo', 'ok', 'excluir', 'deletar'];
    const negative = ['não', 'nao', 'n', 'no', 'cancelar'];

    if (affirmative.includes(messageText.toLowerCase().trim())) {
      // Excluir transação
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', pendingDelete.transaction_id)
        .eq('user_id', session.user_id!);

      if (error) {
        console.error('Erro ao excluir transação:', error);
        return {
          response: '❌ Erro ao excluir transação. Tente novamente.',
          sessionData
        };
      }

      // Limpar estado
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_delete: undefined
        }
      });

      return {
        response: `✅ Transação excluída com sucesso!\n\n🗑️ ${pendingDelete.transaction_title} - R$ ${pendingDelete.transaction_amount}\n\n📊 Para visualizar mais detalhes e relatórios, acesse a plataforma:\n🔗 https://bc45aac3-c622-434f-ad58-afc37c18c6c2.lovableproject.com`,
        sessionData: { ...sessionData, conversation_state: 'idle', pending_delete: undefined }
      };

    } else if (negative.includes(messageText.toLowerCase().trim())) {
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_delete: undefined
        }
      });

      return {
        response: '❌ Exclusão cancelada.',
        sessionData: { ...sessionData, conversation_state: 'idle', pending_delete: undefined }
      };
    } else {
      return {
        response: 'Por favor, responda *"sim"* para confirmar ou *"não"* para cancelar.',
        sessionData
      };
    }
  }

  static async saveTransaction(userId: string, transaction: Partial<Transaction>): Promise<{ response: string, transactionId?: string, sendButtons?: boolean }> {
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
      
      // 🎭 Buscar nome do usuário para resposta personalizada
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .maybeSingle();

      // Buscar saldo atual
      const { data: allTransactions } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId);

      const income = allTransactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const expense = allTransactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // 🎭 Gerar resposta personalizada
      const personalized = await PersonalizedResponses.generateSaveResponse(
        profile?.full_name,
        {
          type: transaction.type!,
          amount: transaction.amount!,
          title: transaction.title!,
          category_name: categoryInfo.category_name
        },
        {
          income,
          expense,
          total: income - expense
        }
      );
      
      console.log('🔵 saveTransaction: Formatting structured response');
      
      // Formatar resposta estruturada como "Meu Assessor" com botões interativos
      const emoji = transaction.type === 'expense' ? '💸' : '💰';
      const categoryEmoji = PersonalizedResponses.categoryEmojis[categoryInfo.category_name] || '📦';
      const currentBalance = income - expense;
      const typeText = transaction.type === 'income' ? 'Receita' : 'Despesa';
      
      const structuredResponse = `✅ *Transação registrada com sucesso!*\n\n` +
        `📝 *Título:* ${transaction.title}\n` +
        `${emoji} *Valor:* R$ ${transaction.amount!.toFixed(2)}\n` +
        `🏷️ *Tipo:* ${typeText}\n` +
        `${categoryEmoji} *Categoria:* ${categoryInfo.category_name}\n` +
        `📅 *Data:* ${new Date(transaction.date!).toLocaleDateString('pt-BR')}\n\n` +
        `💰 *Saldo atual:* R$ ${currentBalance.toFixed(2)}\n\n` +
        `📊 Para visualizar mais detalhes e relatórios, acesse a plataforma:\n` +
        `🔗 https://bc45aac3-c622-434f-ad58-afc37c18c6c2.lovableproject.com`;
      
      return {
        response: structuredResponse,
        transactionId: data.id,
        sendButtons: true
      };
    } catch (error) {
      console.error('Error saving transaction:', error);
      return {
        response: `❌ *Erro ao salvar transação.*\n\n` +
                  `Detalhes: ${error.message}\n\n` +
                  `Tente novamente em alguns instantes.`,
        sendButtons: false
      };
    }
  }

  static async getBalance(userId: string): Promise<string> {
    console.log('🔵 getBalance() STARTED for user:', userId?.substring(0, 8) + '***');
    console.log('🔵 userId validation:', { 
      type: typeof userId, 
      isNull: userId === null, 
      isUndefined: userId === undefined,
      value: userId?.substring(0, 10) + '***'
    });
    
    if (!userId) {
      console.error('❌ getBalance() FATAL: userId is null or undefined');
      throw new Error('USER_ID_MISSING');
    }
    
    try {
      console.log('🔵 Starting Supabase query...');
      
      // Query com timeout de 10 segundos (aumentado de 5)
      const queryPromise = supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT: Query exceeded 10 seconds')), 10000)
      );

      const { data: transactions, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any;

      console.log('🔵 Query completed:', { 
        transactionCount: transactions?.length || 0,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message
      });

      if (error) {
        console.error('❌ Database error:', JSON.stringify(error, null, 2));
        throw new Error(`DB_ERROR: ${error.message || error.code || 'Unknown'}`);
      }

      if (!transactions) {
        console.error('❌ Transactions is null/undefined after query');
        throw new Error('NO_DATA_RETURNED');
      }

      // Calcular saldo
      console.log('🔵 Calculating balance from', transactions.length, 'transactions');
      
      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const balance = income - expenses;
      const balanceEmoji = balance >= 0 ? '💚' : '🔴';

      const response = `💰 *Saldo Atual (${formatPeriod('month')})*\n\n` +
             `📈 Receitas: R$ ${income.toFixed(2)}\n` +
             `📉 Despesas: R$ ${expenses.toFixed(2)}\n` +
             `${balanceEmoji} Saldo: R$ ${balance.toFixed(2)}\n\n` +
             `📊 Total de ${transactions.length} transações este mês`;

      console.log('✅ getBalance() SUCCESS:', { 
        responseLength: response.length,
        balance: balance.toFixed(2),
        income: income.toFixed(2),
        expenses: expenses.toFixed(2),
        transactionCount: transactions.length
      });

      return response;
    } catch (error) {
      console.error('❌ getBalance() CRITICAL ERROR:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200),
        userId: userId?.substring(0, 8) + '***'
      });
      
      // Re-throw para que o caller possa capturar e logar
      throw error;
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
      // Usar horário de Brasília (UTC-3) para cálculo de datas
      const now = new Date();
      const brazilOffset = -3 * 60; // UTC-3
      const localTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));
      
      let startDate: string;
      let periodLabel: string;
      
      const year = localTime.getUTCFullYear();
      const month = localTime.getUTCMonth();
      const day = localTime.getUTCDate();
      
      switch (period) {
        case 'day':
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          periodLabel = 'Hoje';
          break;
        case 'week':
          const weekStart = new Date(localTime.getTime() - (7 * 24 * 60 * 60 * 1000));
          const wYear = weekStart.getUTCFullYear();
          const wMonth = weekStart.getUTCMonth();
          const wDay = weekStart.getUTCDate();
          startDate = `${wYear}-${String(wMonth + 1).padStart(2, '0')}-${String(wDay).padStart(2, '0')}`;
          periodLabel = 'Últimos 7 dias';
          break;
        case 'year':
          startDate = `${year}-01-01`;
          periodLabel = year.toString();
          break;
        case 'month':
        default:
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
          const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                         'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
          periodLabel = `${months[month]} de ${year}`;
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

      // Usar a função formatPeriod() para formatar o período
      const formattedPeriod = formatPeriod(period);
      
      let report = `📊 *RELATÓRIO FINANCEIRO (${formattedPeriod})*\n\n`;
      report += `💰 *RESUMO GERAL:*\n`;
      report += `• Receitas: R$ ${income.toFixed(2)}\n`;
      report += `• Despesas: R$ ${expenses.toFixed(2)}\n`;
      report += `• Lucro: R$ ${balance.toFixed(2)}\n\n`;

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
      id: message?.id,
      image: message?.image,
      audio: message?.audio
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
      transactionId: result.transactionId,
      sendButtons: result.sendButtons,
      stop: true, // CRÍTICO: Instrui GPT Maker a usar APENAS esta resposta
      force_response: true, // Força GPT Maker a usar esta resposta
      bypass_ai: true // Não processar com IA
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