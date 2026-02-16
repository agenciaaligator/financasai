import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function para enviar mensagens via WhatsApp API
async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  const whatsappAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const whatsappPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  
  if (!whatsappAccessToken || !whatsappPhoneNumberId) {
    console.error('❌ [WHATSAPP-AGENT] WhatsApp credentials not configured');
    return;
  }

  try {
    // Garantir que número começa sem +
    const cleanTo = to.startsWith('+') ? to.substring(1) : to;
    
    const response = await fetch(`https://graph.facebook.com/v21.0/${whatsappPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappAccessToken}`,
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
      console.error('❌ [WHATSAPP-AGENT] WhatsApp API error:', error);
    } else {
      console.log('✅ [WHATSAPP-AGENT] Message sent to:', cleanTo.substring(0, 5) + '***');
    }
  } catch (error) {
    console.error('❌ [WHATSAPP-AGENT] Error sending WhatsApp message:', error);
  }
}


// Rate limiting for authentication
const authRateLimit = new Map<string, { count: number; windowStart: number }>();
const AUTH_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_AUTH_ATTEMPTS_PER_HOUR = 3;

// Message deduplication at agent level (defense in depth)
const processedMessages = new Map<string, number>();
const AGENT_DEDUPE_WINDOW = 10 * 60 * 1000; // 10 minutes

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
  conversation_state?: 'idle' | 'waiting_date' | 'waiting_confirmation' | 'awaiting_category' | 'confirming_ocr' | 'awaiting_delete_confirmation' | 'awaiting_edit_field' | 'awaiting_edit_value' | 'awaiting_commitment_resolution' | 'awaiting_commitment_edit_field' | 'awaiting_commitment_edit_value' | 'awaiting_commitment_cancel_selection' | 'awaiting_commitment_time' | 'awaiting_commitment_details' | 'awaiting_commitment_confirmation' | 'awaiting_work_hour_override' | 'awaiting_recurring_confirmation';
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
  pending_commitment?: {
    title: string;
    category: string;
    scheduledISO?: string;
    targetDate?: string;
    suggestions?: string[];
    suggested_slots?: string[];
    commitment_id?: string;
    detail_type?: 'participants' | 'location';
    // ✨ Novos campos para coleta de informações contextuais
    location?: string;
    specialty?: string;
    company?: string;
    contactName?: string;
    contactPhone?: string;
    participants?: string;
    detailsStep?: 'location' | 'specialty' | 'company' | 'contact' | 'participants' | 'completed';
  };
  pending_commitment_edit?: {
    commitment_id?: string;
    field?: 'title' | 'date' | 'time' | 'category';
    original_commitment?: any;
    available_commitments?: any[];
    available_commitments_page?: number;
  };
  last_question?: string;
  full_name?: string;
  pending_recurring_suggestion?: {
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category_id?: string;
  };
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
    // SESSÕES PERMANENTES: Não verificar expiração
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .or(`phone_number.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`)
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
      expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString() // 10 ANOS - sessão permanente
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
    
    // SESSÕES PERMANENTES: Apenas atualizar last_activity (não expira)
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

// Utilitário para extrair filtros de comandos de compromisso
interface CommandFilters {
  dateFilter?: { startISO: string; endISO: string };
  titleQuery?: string;
  selectionIndex?: number;
}

function parseCommandFilters(text: string): CommandFilters {
  const filters: CommandFilters = {};
  
  // Normalizar removendo acentos para análise
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  console.log('[PARSE_FILTERS] Input:', text);
  console.log('[PARSE_FILTERS] Normalized:', normalized);
  
  // 1. Extrair índice de seleção direta (ex: "editar compromisso 3")
  const indexMatch = normalized.match(/\b(\d{1,2})$/);
  if (indexMatch) {
    const num = parseInt(indexMatch[1]);
    if (num >= 1 && num <= 20) {
      filters.selectionIndex = num;
      console.log('[PARSE_FILTERS] Selection index:', num);
    }
  }
  
  // 2. Extrair filtro de data (DD/MM ou DD/MM/AAAA)
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);
    const localTime = getBrazilTime();
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : localTime.getUTCFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    
    // Validar data
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      try {
        // Criar janela do dia completo em horário de Brasília (UTC-3)
        const startDate = new Date(Date.UTC(fullYear, month - 1, day, 3, 0, 0)); // 00:00 BRT = 03:00 UTC
        const endDate = new Date(Date.UTC(fullYear, month - 1, day + 1, 2, 59, 59)); // 23:59 BRT = 02:59+1d UTC
        
        filters.dateFilter = {
          startISO: startDate.toISOString(),
          endISO: endDate.toISOString()
        };
        console.log('[PARSE_FILTERS] Date filter:', { 
          date: `${day}/${month}/${fullYear}`,
          start: filters.dateFilter.startISO,
          end: filters.dateFilter.endISO
        });
      } catch (e) {
        console.error('[PARSE_FILTERS] Invalid date:', e);
      }
    }
  }
  
  // 3. Extrair query de título (palavras após "compromisso"/"evento"/"reuniao" que não sejam data/número)
  const titleMatch = normalized.match(/(?:compromisso|evento|reuniao)\s+(?:dia\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+)?(.+?)(?:\s+\d{1,2})?$/);
  if (titleMatch && titleMatch[1]) {
    let titleQuery = titleMatch[1]
      .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, '') // Remove datas
      .replace(/\b(dia|das|as|de|em|para|com|a|o)\b/g, '') // Remove preposições
      .trim();
    
    if (titleQuery.length >= 3) {
      filters.titleQuery = titleQuery;
      console.log('[PARSE_FILTERS] Title query:', titleQuery);
    }
  }
  
  console.log('[PARSE_FILTERS] Final filters:', JSON.stringify(filters));
  return filters;
}

function extractSpecialtyFromTitle(title: string): string | null {
  const normalizedTitle = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Mapa de palavras-chave -> especialidades
  const specialtyKeywords: Record<string, string> = {
    'dentist': 'Dentista',
    'dermat': 'Dermatologista',
    'oftalm': 'Oftalmologista',
    'cardio': 'Cardiologista',
    'ortoped': 'Ortopedista',
    'pediatr': 'Pediatra',
    'ginecolog': 'Ginecologista',
    'urologis': 'Urologista',
    'psicolog': 'Psicólogo',
    'psiquiatr': 'Psiquiatra',
    'neurolog': 'Neurologista',
    'endocrin': 'Endocrinologista',
    'nutricio': 'Nutricionista',
    'fisioter': 'Fisioterapeuta',
    'fonoaudi': 'Fonoaudiólogo',
    'otorrino': 'Otorrinolaringologista',
  };
  
  // Procurar por palavra-chave no título
  for (const [keyword, specialty] of Object.entries(specialtyKeywords)) {
    if (normalizedTitle.includes(keyword)) {
      console.log(`[SPECIALTY-DETECTION] Found "${specialty}" in title: "${title}"`);
      return specialty;
    }
  }
  
  console.log(`[SPECIALTY-DETECTION] No specialty found in title: "${title}"`);
  return null;
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
    
    // Amanhã
    if (['amanha', 'amanhã', 'tomorrow'].includes(normalizedText)) {
      const tomorrow = new Date(localTime.getTime() + (24 * 60 * 60 * 1000));
      const year = tomorrow.getUTCFullYear();
      const month = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // PHASE 2: Aceitar apenas número como dia do mês atual
    if (/^\d{1,2}$/.test(normalizedText)) {
      const day = parseInt(normalizedText, 10);
      if (day >= 1 && day <= 31) {
        const year = localTime.getUTCFullYear();
        const month = localTime.getUTCMonth();
        const date = new Date(Date.UTC(year, month, day));
        const resultDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        console.log('[DateParser] Parsed day number:', { input: normalizedText, result: resultDate });
        return resultDate;
      }
    }
    
    // PHASE 2: Aceitar "dia X", "no dia X", "para dia X", "para o dia X"
    const dayMatch = normalizedText.match(/(?:no\s+dia|para\s+o?\s+dia|dia)\s+(\d{1,2})/i);
    if (dayMatch) {
      const day = parseInt(dayMatch[1], 10);
      if (day >= 1 && day <= 31) {
        const year = localTime.getUTCFullYear();
        const month = localTime.getUTCMonth();
        const date = new Date(Date.UTC(year, month, day));
        const resultDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        console.log('[DateParser] Parsed "dia X":', { input: normalizedText, result: resultDate });
        return resultDate;
      }
    }
    
    // PHASE 2: "próxima segunda", "próxima terça", etc
    const weekdayMatch = normalizedText.match(/pr[oó]xim[ao]\s+(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)/i);
    if (weekdayMatch) {
      const weekdays: Record<string, number> = {
        'segunda': 1, 'terca': 2, 'terça': 2,
        'quarta': 3, 'quinta': 4, 'sexta': 5,
        'sabado': 6, 'sábado': 6, 'domingo': 0
      };
      const targetDay = weekdays[weekdayMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
      const currentDay = localTime.getUTCDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // Próxima semana
      
      const targetDate = new Date(localTime.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
      const resultDate = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}-${String(targetDate.getUTCDate()).padStart(2, '0')}`;
      console.log('[DateParser] Parsed "próxima X":', { input: normalizedText, result: resultDate });
      return resultDate;
    }
    
    // PHASE 2: "semana que vem" - adicionar 7 dias
    if (normalizedText.match(/semana\s+que\s+vem/i)) {
      const nextWeek = new Date(localTime.getTime() + (7 * 24 * 60 * 60 * 1000));
      const resultDate = `${nextWeek.getUTCFullYear()}-${String(nextWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(nextWeek.getUTCDate()).padStart(2, '0')}`;
      console.log('[DateParser] Parsed "semana que vem":', { result: resultDate });
      return resultDate;
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

  /**
   * Gera mensagem personalizada para compromisso agendado
   */
  static generateCommitmentSuccessMessage(
    userName: string | undefined,
    pending: {
      title: string;
      category: string;
      scheduledISO: string;
      location?: string;
      specialty?: string;
      company?: string;
      contactName?: string;
      contactPhone?: string;
      participants?: string;
    }
  ): string {
    const firstName = userName ? userName.split(' ')[0] : 'você';
    
    const scheduledDate = new Date(pending.scheduledISO);
    const formattedDate = scheduledDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Sao_Paulo'
    });
    const formattedTime = scheduledDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
    
    let templates: string[] = [];
    
    // Helper para exibir local apenas se válido
    const locationLine = (loc: string | undefined) => {
      return loc && loc !== 'undefined' && loc.trim() && loc !== 'pular' 
        ? `📍 ${loc}\n` 
        : '';
    };
    
    // Selecionar templates baseado na categoria
    switch (pending.category) {
      case 'appointment':
        templates = [
          `✅ Pronto, ${firstName}! Sua consulta no *${pending.title}* está agendada para ${formattedDate} às ${formattedTime}! 🩺\n\n${pending.specialty ? `📋 Especialidade: ${pending.specialty}\n` : ''}${locationLine(pending.location)}💚 Cuidar da saúde é sempre importante! Vou te lembrar com antecedência. 😉`,
          
          `🩺 Agendado com sucesso, ${firstName}!\n\n📌 ${pending.title}\n🗓️ ${formattedDate} às ${formattedTime}\n${pending.specialty ? `🏥 ${pending.specialty}\n` : ''}${locationLine(pending.location)}💡 *Dica:* Chegue 10 minutos antes para evitar atrasos! ⏰`,
          
          `Feito! ✅ ${firstName}, seu *${pending.title}* está marcado!\n\n📅 ${formattedDate}\n⏰ ${formattedTime}\n${locationLine(pending.location)}💪 Saúde em primeiro lugar! Você vai receber um lembrete antes da consulta.`
        ];
        break;
        
      case 'meeting':
        templates = [
          `🤝 Reunião agendada, ${firstName}!\n\n📌 ${pending.title}\n${pending.company ? `🏢 ${pending.company}\n` : ''}🗓️ ${formattedDate} às ${formattedTime}\n${locationLine(pending.location)}${pending.contactName ? `👤 Contato: ${pending.contactName}${pending.contactPhone ? ` - ${pending.contactPhone}` : ''}\n` : ''}💼 Sucesso na reunião! Vai dar tudo certo! 🚀`,
          
          `✅ Pronto, ${firstName}! Reunião confirmada${pending.company ? ` com ${pending.company}` : ''}!\n\n📅 ${formattedDate}\n⏰ ${formattedTime}\n${locationLine(pending.location)}${pending.contactName ? `👤 ${pending.contactName}${pending.contactPhone ? ` - ${pending.contactPhone}` : ''}\n` : ''}💡 Chegue preparado e pontual! 😉`,
          
          `🎯 Tudo certo! Sua reunião está agendada, ${firstName}!\n\n${pending.company ? `🏢 ${pending.company}\n` : ''}🗓️ ${formattedDate} às ${formattedTime}\n${locationLine(pending.location)}🚀 Bora fechar esse negócio! Boa sorte! 💪`
        ];
        break;
        
      case 'payment':
        templates = [
          `💳 Lembrete de pagamento agendado, ${firstName}!\n\n📌 ${pending.title}\n🗓️ ${formattedDate} às ${formattedTime}\n\n⚠️ Não esquece de pagar em dia para evitar juros! 💰`,
          
          `✅ Ok! Vou te lembrar de pagar *${pending.title}* no dia ${formattedDate}! 💳\n\n${locationLine(pending.location || 'Pagar online ou no local')}💡 Organize-se com antecedência! 😉`,
          
          `💰 Compromisso financeiro anotado, ${firstName}!\n\n📌 ${pending.title}\n🗓️ ${formattedDate}\n\n🔔 Você vai receber um lembrete antes do vencimento! Fique tranquilo. ✅`
        ];
        break;
        
      case 'other':
      default:
        // Detectar esportes/eventos pelo título
        const isSport = /futeb|basquet|voley|nata[çc][aã]o|corrida|academia|treino|esporte/i.test(pending.title);
        
        if (isSport) {
          templates = [
            `⚽ Show! ${firstName}, ${pending.title} agendado!\n\n🗓️ ${formattedDate} às ${formattedTime}\n${locationLine(pending.location)}${pending.participants ? `👥 Com: ${pending.participants}\n` : ''}🔥 Vai ser massa! Até lá! 🎉`,
            
            `🎉 Beleza! ${pending.title} marcado, ${firstName}!\n\n📅 ${formattedDate}\n⏰ ${formattedTime}\n${locationLine(pending.location)}${pending.participants ? `👥 Galera confirmada: ${pending.participants}\n` : ''}💪 Aproveita! Diversão é importante também! 😎`,
            
            `✅ Tá marcado! ${firstName}, não esquece:\n\n📌 ${pending.title}\n🗓️ ${formattedDate} às ${formattedTime}\n${locationLine(pending.location)}${pending.participants ? `👥 ${pending.participants}\n` : ''}🚀 Vai ser dahora! Te vejo lá! 🤙`
          ];
        } else {
          templates = [
            `✅ Agendado, ${firstName}!\n\n📌 ${pending.title}\n🗓️ ${formattedDate} às ${formattedTime}\n${locationLine(pending.location)}🔔 Vou te lembrar antes! 😉`,
            
            `Pronto! ${firstName}, *${pending.title}* está no seu calendário! 🗓️\n\n📅 ${formattedDate}\n⏰ ${formattedTime}\n${locationLine(pending.location)}✅ Tudo certo!`
          ];
        }
        break;
    }
    
    // Escolher template aleatório
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
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
   * Usa Unicode para garantir que TODOS os caracteres não alfanuméricos sejam removidos
   */
  static normalizeCommand(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Remove TODOS os caracteres não alfanuméricos (Unicode-aware)
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
    
    console.log('📸 Image check:', {
      hasImageProp: !!message.image,
      imageId: message.image?.id,
      messageType: message.type,
      bodyText: message.body
    });

    // 📸 PRIORIDADE 0: Processar imagens (OCR de notas fiscais)
    // 🔐 VALIDAÇÃO DE SEGREDOS ANTES DE PROCESSAR IMAGEM
    if (message.image || message.type === 'image') {
      const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (!WHATSAPP_ACCESS_TOKEN) {
        console.error('❌ WHATSAPP_ACCESS_TOKEN não configurado');
        return {
          response: '⚙️ Configuração do WhatsApp indisponível. Entre em contato com o suporte.',
          sessionData: session.session_data || {}
        };
      }
      
      if (!LOVABLE_API_KEY) {
        console.error('❌ LOVABLE_API_KEY não configurado');
        return {
          response: '🤖 Serviço de OCR temporariamente indisponível. Tente adicionar manualmente: "gastei 50 mercado"',
          sessionData: session.session_data || {}
        };
      }
    }
    
    if (message.image && message.image.id) {
      console.log('📸 IMAGEM DETECTADA! Processando OCR...', message.image);
      return await this.handleImageMessage(session, message);
    } else if (message.type === 'image' || message.body === '[IMAGE]') {
      // Fallback: se type é image mas não tem dados
      console.error('❌ Image message detected but no image data provided!');
      return {
        response: '❌ Erro ao receber a imagem. Tente enviar novamente.\n\n💡 Certifique-se de que a imagem não seja muito grande (máx 5MB).',
        sessionData: session.session_data || {}
      };
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

    // ✅ FASE 4: Detectar mensagens de fim de conversa
    const isPoliteClosing = /^(obrigad[oa]|valeu|legal|ok|tudo certo|entendi|beleza|blz|show|👍|✅)$/i.test(messageText.trim());

    if (isPoliteClosing && sessionData.conversation_state === 'idle') {
      console.log('[Agenda Debug][WhatsApp] Polite closing detected, responding naturally');
      
      const closingResponses = [
        '😊 Disponha! Estou aqui sempre que precisar.',
        '✨ Por nada! Qualquer coisa é só chamar.',
        '👍 Tmj! Me chama quando precisar agendar algo.',
        '🙌 Sempre à disposição!',
        '😄 Fechou! Até a próxima.'
      ];
      
      const randomResponse = closingResponses[Math.floor(Math.random() * closingResponses.length)];
      
      return {
        response: randomResponse,
        sessionData: {
          ...sessionData,
          last_interaction: new Date().toISOString()
        }
      };
    }

    // Detectar também após cancelamento/finalização
    if (isPoliteClosing && ['awaiting_commitment_confirmation', 'awaiting_work_hour_override'].includes(sessionData.conversation_state || '')) {
      console.log('[Agenda Debug][WhatsApp] Post-action polite closing, ending conversation');
      
      return {
        response: '😊 De nada! Me chama se precisar agendar outra coisa.',
        sessionData: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment: undefined
        }
      };
    }

    // PRIORIDADE 0.91: Detectar comandos de cancelamento/ajuda/transações ANTES de processar horário
    if (sessionData.conversation_state === 'awaiting_commitment_time' && sessionData.pending_commitment) {
      const normalizedInput = messageText.trim().toLowerCase();
      
      console.log('[Agenda Debug][WhatsApp] awaiting_time state, analyzing input:', { 
        input: messageText, 
        normalized: normalizedInput 
      });
      
      // 1️⃣ Detectar comandos explícitos de cancelamento/ajuda
      if (/^(cancelar|ajuda|help|menu)$/i.test(normalizedInput)) {
        console.log('[Agenda Debug][WhatsApp] Detected cancel/help during time input, resetting state');
        sessionData.conversation_state = 'idle';
        sessionData.pending_commitment = undefined;
        // Continuar para processar o comando normalmente abaixo
      } 
      // 2️⃣ Validar se é um horário estrito (APENAS números + opcional h/: )
      else {
        const strictTimeRegex = /^\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|horas?)?\s*$/i;
        const isStrictTime = strictTimeRegex.test(normalizedInput);
        
        console.log('[Agenda Debug][WhatsApp] Strict time check:', { 
          isStrictTime, 
          input: normalizedInput 
        });
        
        if (isStrictTime) {
          // É um horário válido, processar normalmente
          return await this.handleCommitmentTimeInput(session, messageText);
        }
        
        // 3️⃣ NÃO é horário estrito - verificar se é transação
        const parsedTransaction = TransactionParser.parseTransactionFromText(messageText);
        
        console.log('[Agenda Debug][WhatsApp] Transaction parse result:', { 
          isTransaction: !!parsedTransaction,
          input: messageText
        });
        
        if (parsedTransaction) {
          console.log('[Agenda Debug][WhatsApp] Breakout to transaction flow from awaiting_time');
          
          // Resetar estado de agendamento e processar como transação
          sessionData.conversation_state = 'idle';
          sessionData.pending_commitment = undefined;
          
          await SessionManager.updateSession(session.id, {
            session_data: sessionData
          });
          
          // Continuar abaixo para processar a transação
          // NÃO retornar aqui - deixar o fluxo seguir para a seção de transações
        } else {
          // 4️⃣ Não é horário nem transação - pedir formato correto
          console.log('[Agenda Debug][WhatsApp] Input is neither time nor transaction');
          return {
            response: '⏰ Por favor, digite apenas o horário.\n\nExemplos:\n• 11h\n• 14:30\n• 9h\n\n_Ou digite "cancelar" para desistir._',
            sessionData
          };
        }
      }
    }

    // PRIORIDADE 0.92: Input de detalhes adicionais (FASE 2)
    if (sessionData.conversation_state === 'awaiting_commitment_details' && sessionData.pending_commitment) {
      return await this.handleCommitmentDetailsInput(session, messageText);
    }

    // PRIORIDADE 0.923: Override de work hours
    if (sessionData.conversation_state === 'awaiting_work_hour_override' && sessionData.pending_commitment) {
      return await this.handleWorkHourOverride(session, messageText);
    }

    // PRIORIDADE 0.925: Confirmação final (FASE 3)
    if (sessionData.conversation_state === 'awaiting_commitment_confirmation' && sessionData.pending_commitment) {
      return await this.handleCommitmentConfirmation(session, messageText);
    }

    // PRIORIDADE 0.93: Resolução de conflito de agenda
    if (sessionData.conversation_state === 'awaiting_commitment_resolution' && sessionData.pending_commitment) {
      return await this.handleCommitmentResolution(session, messageText);
    }

    // PRIORIDADE 0.94: Edição de compromisso
    if (sessionData.conversation_state === 'awaiting_commitment_edit_field' && sessionData.pending_commitment_edit) {
      return await this.handleCommitmentEditFieldSelection(session, messageText);
    }

    // PHASE 1: CRITICAL - Check if we're already in field input mode BEFORE checking for field selection
    if (sessionData.conversation_state === 'awaiting_commitment_edit_value' && sessionData.pending_commitment_edit?.field) {
      console.log('[EDIT VALUE INPUT] Processing value for field:', sessionData.pending_commitment_edit.field);
      return await this.handleCommitmentEditValueInput(session, messageText);
    }

    if (sessionData.conversation_state === 'awaiting_commitment_edit_value' && sessionData.pending_commitment_edit) {
      const field = messageText.trim();
      console.log('[EDIT FIELD SELECT] User selecting field to edit:', field);
      
      // Opção 5: Cancelar o compromisso (não a edição)
      if (field === '5') {
        const pendingEdit = sessionData.pending_commitment_edit;
        
        if (!pendingEdit?.commitment_id) {
          return {
            response: '❌ Erro ao processar cancelamento.',
            sessionData: { ...sessionData, conversation_state: 'idle', pending_commitment_edit: undefined }
          };
        }
        
        try {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          
          const { error: deleteError } = await supabase
            .from('commitments')
            .delete()
            .eq('id', pendingEdit.commitment_id)
            .eq('user_id', session.user_id);
          
          if (deleteError) throw deleteError;
          
          const title = pendingEdit.original_commitment?.title || 'Compromisso';
          
          await SessionManager.updateSession(session.id, {
            session_data: { ...sessionData, conversation_state: 'idle', pending_commitment_edit: undefined }
          });
          
          return {
            response: `✅ *Compromisso cancelado com sucesso!*\n\n🗑️ "${title}" foi removido da sua agenda.`,
            sessionData: { ...sessionData, conversation_state: 'idle', pending_commitment_edit: undefined }
          };
        } catch (error) {
          console.error('Error deleting commitment:', error);
          return {
            response: '❌ Erro ao cancelar compromisso. Tente novamente.',
            sessionData: { ...sessionData, conversation_state: 'idle', pending_commitment_edit: undefined }
          };
        }
      }
      
      const fieldMap: Record<string, string> = {
        '1': 'title',
        '2': 'date',
        '3': 'time',
        '4': 'category'
      };
      
      const selectedField = fieldMap[field];
      if (!selectedField) {
        console.log('[EDIT FIELD SELECT] Invalid option:', field);
        return {
          response: '❌ Opção inválida. Digite um número de 1 a 5.',
          sessionData
        };
      }

      // PHASE 1: Helper para exemplos de formatação
      const getFieldExample = (field: string): string => {
        const examples: Record<string, string> = {
          'date': '📅 Informe a nova data:\n\nExemplos:\n• 13/10/2025\n• 13/10\n• hoje\n• amanhã\n• dia 15\n• próxima segunda\n• semana que vem',
          'time': '🕐 Informe a nova hora:\n\nExemplos:\n• 14:30\n• 9\n• 15:00\n• 8h30',
          'title': '✏️ Informe o novo título:',
          'category': '🏷️ Informe a nova categoria:\n\nOpções:\n• consulta\n• pagamento\n• reunião\n• lembrete\n• outro'
        };
        return examples[field] || '';
      };

      const prompt = getFieldExample(selectedField);

      const updatedSessionData = {
        ...sessionData,
        pending_commitment_edit: {
          ...sessionData.pending_commitment_edit,
          field: selectedField
        }
      };

      console.log('[EDIT FIELD SELECT] Selected field:', selectedField, 'Prompt preview:', prompt.substring(0, 50));

      await SessionManager.updateSession(session.id, {
        session_data: updatedSessionData
      });

      return {
        response: prompt,
        sessionData: updatedSessionData
      };
    }

    // PRIORIDADE 0.96: Cancelamento de compromisso
    if (sessionData.conversation_state === 'awaiting_commitment_cancel_selection' && sessionData.pending_commitment_edit) {
      return await this.handleCommitmentCancelSelection(session, messageText);
    }

    // PRIORIDADE 0.94: Sugestão de conta fixa recorrente
    if (sessionData.conversation_state === 'awaiting_recurring_confirmation' && sessionData.pending_recurring_suggestion) {
      const affirmative = ['sim', 's', 'yes', 'y', 'ok', 'confirmo'];
      const normalized = messageText.toLowerCase().trim();
      
      if (affirmative.includes(normalized)) {
        console.log('✅ User confirmed recurring transaction suggestion');
        const rec = sessionData.pending_recurring_suggestion;
        
        // Buscar organization_id
        const { data: whatsappSession } = await supabase
          .from('whatsapp_sessions')
          .select('organization_id')
          .eq('user_id', session.user_id)
          .order('last_activity', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const localTime = getBrazilTime();
        const dayOfMonth = localTime.getUTCDate();
        
        const { error } = await supabase
          .from('recurring_transactions')
          .insert({
            user_id: session.user_id,
            title: rec.title,
            amount: rec.amount,
            type: rec.type,
            frequency: 'monthly',
            day_of_month: dayOfMonth,
            start_date: new Date().toISOString().split('T')[0],
            category_id: rec.category_id || null,
            is_active: true,
            organization_id: whatsappSession?.organization_id || null
          });
        
        await SessionManager.updateSession(session.id, {
          session_data: {
            ...sessionData,
            conversation_state: 'idle',
            pending_recurring_suggestion: undefined
          }
        });
        
        if (error) {
          console.error('❌ Error creating recurring transaction:', error);
          return {
            response: `❌ Erro ao criar conta fixa. Tente novamente pelo painel.`,
            sessionData: { ...sessionData, conversation_state: 'idle', pending_recurring_suggestion: undefined }
          };
        }
        
        return {
          response: `✅ *Conta fixa cadastrada!*\n\n📝 *${rec.title}* — R$ ${rec.amount.toFixed(2)}\n🔄 Todo dia ${dayOfMonth} de cada mês\n\nVocê pode gerenciar suas contas fixas no painel web.`,
          sessionData: { ...sessionData, conversation_state: 'idle', pending_recurring_suggestion: undefined }
        };
      } else {
        // User declined or sent other message - clear state
        await SessionManager.updateSession(session.id, {
          session_data: {
            ...sessionData,
            conversation_state: 'idle',
            pending_recurring_suggestion: undefined
          }
        });
        
        // Don't return - let the message be processed normally below
        sessionData.conversation_state = 'idle';
        sessionData.pending_recurring_suggestion = undefined;
      }
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
    
    // PRIORIDADE 2A: Comandos específicos de EDIÇÃO/CANCELAMENTO (antes de agenda genérica)
    // Regex tolerante: aceita artigos opcionais e variações
    const editCommitmentRegex = /\b(editar|alterar|remarcar)\b\s*(?:o\s+|um\s+|uma\s+)?\b(compromisso|evento|reuniao)\b/;
    const cancelCommitmentRegex = /\b(cancelar|excluir|apagar)\b\s*(?:o\s+|um\s+|uma\s+)?\b(compromisso|evento|reuniao)\b/;
    
    if (editCommitmentRegex.test(normalizedText)) {
      console.log('📝 COMANDO: editar/remarcar compromisso');
      const filters = parseCommandFilters(messageText);
      return await this.handleEditCommitmentCommand(session, filters);
    }

    if (cancelCommitmentRegex.test(normalizedText)) {
      console.log('🗑️ COMANDO: cancelar compromisso');
      const filters = parseCommandFilters(messageText);
      return await this.handleCancelCommitmentCommand(session, filters);
    }
    
    // PRIORIDADE 2A: Estado aguardando horário do compromisso
    if (sessionData.conversation_state === 'awaiting_commitment_time') {
      console.log('⏰ Estado: aguardando horário do compromisso');
      return await this.handleCommitmentTimeInput(session, messageText);
    }
    
    // PRIORIDADE 2: Comandos de AGENDA (ANTES de outros comandos genéricos)
    // ✨ VERIFICAÇÃO EXPLÍCITA ENDURECIDA para "meus compromissos"
    if (normalizedText.includes('compromiss') && 
        (normalizedText.includes('meu') || normalizedText.includes('meus') || 
         normalizedText.includes('ver') || normalizedText.includes('mostrar') || 
         normalizedText.includes('quais') || normalizedText.includes('hoje') || 
         normalizedText.includes('amanha') || normalizedText.includes('semana') ||
         normalizedText.includes('listar') || normalizedText.includes('proximos'))) {
      console.log('[Agenda Debug][WhatsApp] 🎯 HARD MATCH: "meus compromissos" detected via explicit check');
      console.log('🗓️ Listando compromissos');
      return await this.listCommitments(session.user_id!);
    }
    
    // Aceita singular/plural e variações sem acento usando normalizedText
    if (/(\b(agendar|agenda|marc)\w*\b|\bcompromiss\w*\b|\breunia\w*\b|\bconsult\w*\b|\bevento\w*\b)/.test(normalizedText)) {
      console.log('[Agenda Debug][WhatsApp] Agenda regex match:', {
        messageText,
        normalizedText,
        matched: /(\b(agendar|agenda|marc)\w*\b|\bcompromiss\w*\b|\breunia\w*\b|\bconsult\w*\b|\bevento\w*\b)/.test(normalizedText)
      });

      // Listar compromissos - variações naturais
      const isList = /\b(meus?|ver|mostrar?|listar?|quais|tenho|tem|hoje|amanhã|amanha|próximos?|proximos?|semana)\b/i.test(normalizedText);
      console.log('[Agenda Debug] isList:', isList, 'normalizedText:', normalizedText);

      if (!isList) {
        console.log('[AGENDA FIX] Criando compromisso por padrão:', normalizedText);
        return await this.addCommitment(session.user_id!, messageText);
      }

      console.log('🗓️ Listando compromissos (match por isList)');
      return await this.listCommitments(session.user_id!);

    }
    
    // PRIORIDADE 2.3: Comandos de CONTAS FIXAS / RECORRENTES
    const contaFixaRegex = /\b(conta\s*fixa|assinatura|recorrente|fixo|fixa)\s+(\d+(?:[.,]\d+)?)\s+(.+?)(?:\s+dia\s+(\d{1,2}))?$/i;
    const minhasContasRegex = /\b(minhas?\s*contas|contas?\s*fixas?|proximos?\s*vencimentos?|vencimentos?|contas?\s*a\s*pagar)\b/i;
    const pagarContaRegex = /\b(paguei|pagar|quitar|baixa|dar\s*baixa)\s+(?:a?\s*)?(?:conta\s+)?(.+)/i;
    const adiarContaRegex = /\b(adiar|postergar|prorrogar)\s+(?:conta\s+)?(.+?)\s+(?:para\s+)?(?:dia\s+)?(\d{1,2})/i;
    
    // Criar conta fixa: "conta fixa 150 internet dia 10" ou "assinatura 50 netflix"
    const contaFixaMatch = normalizedText.match(contaFixaRegex);
    if (contaFixaMatch) {
      console.log('🔄 COMMAND DETECTED: criar conta fixa');
      const amount = parseBrazilianNumber(contaFixaMatch[2]);
      const title = contaFixaMatch[3].trim();
      const dayOfMonth = contaFixaMatch[4] ? parseInt(contaFixaMatch[4]) : null;
      
      return await this.createRecurringTransaction(session.user_id!, {
        amount,
        title,
        dayOfMonth,
        type: 'expense', // Contas fixas geralmente são despesas
        frequency: 'monthly'
      });
    }
    
    // Listar contas fixas: "minhas contas" ou "contas fixas"
    if (minhasContasRegex.test(normalizedText)) {
      console.log('🔄 COMMAND DETECTED: listar contas fixas');
      return await this.listRecurringTransactions(session.user_id!);
    }
    
    // Pagar/dar baixa: "paguei internet" ou "pagar conta de luz"
    const pagarContaMatch = normalizedText.match(pagarContaRegex);
    if (pagarContaMatch && !pagarContaMatch[2].match(/^\d/)) { // Não é "paguei 50 mercado"
      console.log('🔄 COMMAND DETECTED: dar baixa em conta fixa');
      const searchTerm = pagarContaMatch[2].trim();
      return await this.markRecurringInstanceAsPaid(session.user_id!, searchTerm);
    }
    
    // Adiar conta: "adiar internet para dia 20"
    const adiarContaMatch = normalizedText.match(adiarContaRegex);
    if (adiarContaMatch) {
      console.log('🔄 COMMAND DETECTED: adiar conta fixa');
      const searchTerm = adiarContaMatch[2].trim();
      const newDay = parseInt(adiarContaMatch[3]);
      return await this.postponeRecurringInstance(session.user_id!, searchTerm, newDay);
    }
    
    // PRIORIDADE 3: Comandos gerais (ajuda, cancelar, etc)
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
    // ⚠️ CRITICAL: NÃO processar com NLP se contém termos de agenda
    const hasAgendaTerms = normalizedText.includes('compromiss') || 
                           normalizedText.includes('agenda') || 
                           normalizedText.includes('reunia') || 
                           normalizedText.includes('evento');
    
    if (hasAgendaTerms) {
      console.log('⏭️ Skipping NLP - agenda terms detected in message');
    } else {
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
      const pendingRecurring = typeof saveResult === 'object' ? saveResult.pendingRecurring : undefined;
      
      console.log('✅ saveTransaction() completed, response:', saveResponse.substring(0, 50) + '...');
      
      // 🔧 LIMPAR ESTADO após salvar (ou definir awaiting_recurring_confirmation)
      const newState = pendingRecurring ? 'awaiting_recurring_confirmation' : 'idle';
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: newState,
          pending_transaction: undefined,
          pending_recurring_suggestion: pendingRecurring || undefined
        }
      });
      
      return {
        response: saveResponse,
        transactionId,
        sendButtons,
        sessionData: { ...sessionData, conversation_state: newState, pending_transaction: undefined, pending_recurring_suggestion: pendingRecurring || undefined }
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
           
           `*🔄 Contas Fixas/Recorrentes:*\n` +
           `• "conta fixa 150 internet dia 10"\n` +
           `• "assinatura 50 netflix"\n` +
           `• "minhas contas" ou "contas fixas"\n` +
           `• "paguei internet" - dar baixa\n` +
           `• "adiar conta luz para dia 20"\n\n` +
           
           `*📅 Agenda - Comandos Inteligentes:*\n` +
           `• "agendar dentista amanhã 14h"\n` +
           `• "compromisso reunião sexta 10h"\n` +
           `• "meus compromissos" - listar todos\n\n` +
           
           `*✏️ Editar Compromissos:*\n` +
           `• "editar compromisso" - lista todos\n` +
           `• "editar compromisso 3" - edita o nº 3\n` +
           `• "editar compromisso dia 25/10"\n` +
           `• "editar compromisso dentista"\n` +
           `• "remarcar compromisso" (igual editar)\n\n` +
           
           `*🗑️ Cancelar Compromissos:*\n` +
           `• "cancelar compromisso" - lista todos\n` +
           `• "cancelar compromisso 2" - cancela o nº 2\n` +
           `• "cancelar compromisso dia 15/10"\n` +
           `• "apagar evento reunião"\n\n` +
           
           `*✏️ Editar/Excluir Transações:*\n` +
           `• *editar última*\n` +
           `• *excluir última*\n\n` +
           
           `*🤖 Inteligência Artificial:*\n` +
           `Uso IA para entender o que você escreve!\n` +
           `Não precisa decorar comandos - só fale naturalmente! 😊\n\n` +
           
           `💡 *Exemplos práticos:*\n` +
           `• "paguei 200 de conta de luz"\n` +
           `• "recebi 300 de freelance"\n` +
           `• "gastei 45 na farmácia ontem"\n` +
           `• "conta fixa 100 internet dia 5"`;
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
      console.log('📸 Baixando imagem...', {
        mediaId: message.image!.id,
        mimeType: message.image!.mime_type
      });
      
      const imageData = await ReceiptOCR.downloadWhatsAppMedia(message.image!.id);
      
      // 🔍 Validar tamanho do buffer
      const imageSizeBytes = imageData.length;
      const imageSizeMB = imageSizeBytes / (1024 * 1024);
      
      console.log('📊 Imagem baixada:', {
        sizeBytes: imageSizeBytes,
        sizeMB: imageSizeMB.toFixed(2)
      });
      
      if (imageSizeMB > 5) {
        console.warn('⚠️ Imagem muito grande:', imageSizeMB.toFixed(2), 'MB');
        return {
          response: '📸 Imagem muito grande!\n\n' +
                   `Tamanho: ${imageSizeMB.toFixed(1)}MB (máx 5MB)\n\n` +
                   'Tente comprimir ou enviar outra foto.',
          sessionData
        };
      }
      
      // Converter para base64 em chunks (evita stack overflow em imagens grandes)
      function arrayBufferToBase64(buffer: Uint8Array): string {
        let binary = '';
        const chunkSize = 8192; // 8KB chunks
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        return btoa(binary);
      }
      const base64Image = arrayBufferToBase64(imageData);
      console.log('🔄 Base64 gerado:', {
        base64Length: base64Image.length,
        estimatedKB: (base64Image.length / 1024).toFixed(2)
      });
      
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
      console.error('❌ Erro ao processar imagem:', {
        errorMessage: error.message,
        errorStack: error.stack,
        imageId: message.image?.id,
        hasUserId: !!session.user_id
      });
      
      let errorMsg = '❌ Não consegui processar a nota fiscal.\n\n';
      
      if (error.message?.includes('404')) {
        errorMsg += '⚠️ Imagem não encontrada no WhatsApp. Tente enviar novamente.\n\n';
      } else if (error.message?.includes('timeout')) {
        errorMsg += '⏱️ O processamento demorou muito. Tente com uma imagem menor.\n\n';
      } else if (error.message?.includes('API')) {
        errorMsg += '🤖 Serviço de OCR temporariamente indisponível.\n\n';
      } else {
        errorMsg += `Tente:\n` +
                   `• Foto mais nítida\n` +
                   `• Boa iluminação\n` +
                   `• Nota fiscal completa na imagem\n` +
                   `• Imagem menor que 5MB\n\n`;
      }
      
      errorMsg += `Ou adicione manualmente: "gastei 50 mercado"`;
      
      return {
        response: errorMsg,
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
        original_transaction: lastTransaction,
        transaction_type: lastTransaction.type
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

  static async handleCommitmentResolution(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const pending = sessionData.pending_commitment!;
    const normalized = messageText.trim().toLowerCase();

    console.log('🔧 Resolvendo conflito de compromisso:', { input: messageText, normalized, pending });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // 🚫 Se o usuário digitar "cancelar", encerrar fluxo E deletar compromisso se já foi criado
    if (/^cancel(ar)?$/i.test(normalized)) {
      console.log('[COMMITMENT-FLOW] User cancelled resolution, checking for orphan commitment');
      
      // ✅ SE JÁ CRIOU COMPROMISSO NO BANCO, DELETAR
      if (pending.commitment_id) {
        console.log('[COMMITMENT-FLOW] Deleting orphan commitment:', pending.commitment_id);
        await supabase
          .from('commitments')
          .delete()
          .eq('id', pending.commitment_id)
          .eq('user_id', session.user_id!);
      }
      
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment: undefined
        }
      });
      
      return {
        response: '❌ Agendamento cancelado.',
        sessionData: { ...sessionData, conversation_state: 'idle', pending_commitment: undefined }
      };
    }
    
    // 🔄 FASE 1: Detectar se o usuário está iniciando um NOVO agendamento (regex CORRIGIDA)
    const startsNewScheduling = /\b(agendar|marcar|cadastrar)\s+\w+/i.test(normalized);
    if (startsNewScheduling) {
      console.log('🔄 Novo comando de agendamento detectado durante resolução de conflito. Reiniciando fluxo.');
      return await this.addCommitment(session.user_id!, messageText);
    }

    const numSuggestions = pending.suggestions?.length || 0;
    
    // SE digitar "forçar", permitir duplo-agendamento
    if (/^(forçar|forcar|força|forca|sim)$/i.test(normalized)) {
      console.log('⚠️ Forçando agendamento com conflito. Iniciando coleta de detalhes...');
      
      // ✨ FASE 2: Em vez de inserir direto, iniciar coleta de detalhes
      pending.detailsStep = 'location';
      pending.forcedBooking = true; // Flag para indicar que foi forçado
      
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'awaiting_commitment_details',
          pending_commitment: pending
        }
      });

      return {
        response: '⚠️ Ok, vou agendar mesmo com conflito.\n\n📍 Qual o endereço ou local do compromisso?',
        sessionData: {
          ...sessionData,
          conversation_state: 'awaiting_commitment_details',
          pending_commitment: pending
        }
      };
    }

    // SE escolher número
    if (/^[1-9]$/.test(messageText.trim())) {
      const choice = parseInt(messageText.trim());
      
      // Escolheu um slot sugerido (1, 2 ou 3)
      if (choice >= 1 && choice <= numSuggestions) {
        const newScheduledISO = pending.suggestions![choice - 1];
        
        // ✨ FASE 2: Em vez de inserir direto, iniciar coleta de detalhes
        pending.scheduledISO = newScheduledISO;
        pending.detailsStep = 'location';
        
        await SessionManager.updateSession(session.id, {
          session_data: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_details',
            pending_commitment: pending
          }
        });

        return {
          response: '📍 Qual o endereço ou local do compromisso?',
          sessionData: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_details',
            pending_commitment: pending
          }
        };
      }
      
      // "Digitar outro horário"
      else if (choice === numSuggestions + 1) {
        await SessionManager.updateSession(session.id, {
          session_data: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_time',
            pending_commitment: {
              title: pending.title,
              category: pending.category,
              targetDate: pending.scheduledISO // Manter data original
            }
          }
        });
        
        return {
          response: '⏰ Digite o horário desejado (ex: 14h, 15:30):',
          sessionData: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_time',
            pending_commitment: {
              title: pending.title,
              category: pending.category,
              targetDate: pending.scheduledISO
            }
          }
        };
      }
      
      // "Cancelar"
      else if (choice === numSuggestions + 2) {
        console.log('[COMMITMENT-FLOW] User cancelled via option, checking for orphan commitment');
        
        // ✅ SE JÁ CRIOU COMPROMISSO NO BANCO, DELETAR
        if (pending.commitment_id) {
          console.log('[COMMITMENT-FLOW] Deleting orphan commitment:', pending.commitment_id);
          await supabase
            .from('commitments')
            .delete()
            .eq('id', pending.commitment_id)
            .eq('user_id', session.user_id!);
        }
        
        await SessionManager.updateSession(session.id, {
          session_data: {
            ...sessionData,
            conversation_state: 'idle',
            pending_commitment: undefined
          }
        });

        return {
          response: '❌ Agendamento cancelado.',
          sessionData: { ...sessionData, conversation_state: 'idle', pending_commitment: undefined }
        };
      }
      }

      // 🔍 DEBUG: Inspecionar pending_commitment
      console.log('🔍 handleCommitmentResolution DEBUG:', {
        hasPending: !!pending,
        hasTargetDate: !!pending?.targetDate,
        hasScheduledISO: !!pending?.scheduledISO,
        targetDate: pending?.targetDate,
        scheduledISO: pending?.scheduledISO
      });

      // Antes de retornar "opção inválida", tentar extrair horário do texto
      const normalizedNoAccents = messageText
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    // Usar MESMO regex do QuickParse
    const timeMatch = normalizedNoAccents.match(/\b(?:as|a)?\s*(\d{1,2})(?:(?::|h)(\d{2})\b|\s*(?:h|horas?))\b/);

    if (timeMatch) {
      const hour = Math.min(23, parseInt(timeMatch[1]));
      const minute = Math.min(59, parseInt(timeMatch[2] || '0'));
      
      console.log(`🔄 Usuário redigitou horário: ${hour}:${minute}`);
      
      // ✅ Validação: usar scheduledISO como fallback se targetDate estiver undefined
      const targetDateISO = pending.targetDate || pending.scheduledISO;

      if (!targetDateISO) {
        console.error('❌ CRITICAL: Nenhuma data disponível em pending_commitment');
        return {
          response: '❌ Erro ao processar reagendamento. Digite "agendar [título] [data] [hora]" novamente.',
          sessionData: { ...sessionData, conversation_state: 'idle', pending_commitment: undefined }
        };
      }
      
      // Reconstruir scheduledISO com novo horário mas mesma data
      const originalDate = new Date(targetDateISO);
      const y = originalDate.getUTCFullYear();
      const m = originalDate.getUTCMonth();
      const d = originalDate.getUTCDate();
      const newScheduledISO = new Date(Date.UTC(y, m, d, hour + 3, minute)).toISOString();
      
      // Verificar conflito novamente
      const { data: newConflicts } = await supabase
        .from('commitments')
        .select('id, title, scheduled_at, duration_minutes')
        .eq('user_id', session.user_id!)
        .gte('scheduled_at', new Date(Date.UTC(y, m, d, 0, 0)).toISOString())
        .lte('scheduled_at', new Date(Date.UTC(y, m, d, 23, 59)).toISOString())
        .order('scheduled_at');
      
      const hasNewConflict = newConflicts?.some(c => {
        const cStart = new Date(c.scheduled_at);
        const cEnd = new Date(cStart.getTime() + ((c.duration_minutes || 60) * 60000));
        const newStart = new Date(newScheduledISO);
        const newEnd = new Date(newStart.getTime() + 60 * 60000);
        return (newStart < cEnd && newEnd > cStart);
      });
      
      if (!hasNewConflict) {
        // ✨ FASE 2: SEM CONFLITO! Em vez de inserir direto, iniciar coleta de detalhes
        pending.scheduledISO = newScheduledISO;
        pending.detailsStep = 'location';
        
        await SessionManager.updateSession(session.id, {
          session_data: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_details',
            pending_commitment: pending
          }
        });
        
        return {
          response: '📍 Qual o endereço ou local do compromisso?',
          sessionData: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_details',
            pending_commitment: pending
          }
        };
      } else {
        // AINDA TEM CONFLITO - Mostrar novamente
        const conflictList = newConflicts!
          .filter(c => {
            const cStart = new Date(c.scheduled_at);
            const cEnd = new Date(cStart.getTime() + ((c.duration_minutes || 60) * 60000));
            const newStart = new Date(newScheduledISO);
            const newEnd = new Date(newStart.getTime() + 60 * 60000);
            return (newStart < cEnd && newEnd > cStart);
          })
          .map(c => {
            const time = new Date(c.scheduled_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
            });
            return `• ${c.title} às ${time}`;
          })
          .join('\n');
        
        // Sugerir slots novos
        const targetDate = new Date(newScheduledISO);
        const availableSlots = await WhatsAppAgent.suggestAvailableSlots(session.user_id!, targetDate, hour);
        
        let response = `❌ *Ainda há conflito às ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}*\n\n📅 Você já tem:\n${conflictList}`;
        
        if (availableSlots.length > 0) {
          response += `\n\n⏰ *Horários disponíveis próximos:*`;
          availableSlots.slice(0, 3).forEach((slot, idx) => {
            response += `\n${idx + 1}️⃣ ${slot}`;
          });
          response += `\n\n${availableSlots.length + 1}️⃣ Digitar outro horário`;
          response += `\n${availableSlots.length + 2}️⃣ Cancelar`;
        } else {
          response += `\n\n1️⃣ Digitar outro horário`;
          response += `\n2️⃣ Cancelar`;
        }
        
        response += `\n\n_Responda "forçar" se realmente deseja agendar no mesmo horário._`;
        
        return {
          response,
          sessionData: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_resolution',
            pending_commitment: {
              ...pending,
              scheduledISO: newScheduledISO,
              suggestions: availableSlots.slice(0, 3)
            }
          }
        };
      }
    }
    
    // Se chegou aqui, não é número, não é "forçar", e não tem horário válido
    const maxOption = numSuggestions + 2;
    return {
      response: `❌ *Não entendi sua resposta.*\n\n*Você pode:*\n• Digitar um número (1 a ${maxOption})\n• Digitar "forçar" para duplo-agendamento\n• Digitar um horário (ex: 14h, 15:30)\n• Digitar "cancelar" para desistir`,
      sessionData
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
          const newTitle = messageText.trim();
          updateData.title = newTitle;
          
          // Re-categorizar automaticamente com o novo título
          console.log('🔄 Re-categorizando transação após mudança de título...');
          const recategorized = await CategoryMatcher.findBestCategory(
            session.user_id!,
            newTitle,
            pendingEdit.transaction_type
          );
          
          if (recategorized.category_id) {
            updateData.category_id = recategorized.category_id;
            console.log(`✨ Categoria atualizada automaticamente: ${recategorized.category_name}`);
          }
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

      // PRIORIZAR organization_id da sessão WhatsApp vinculada
      let organization_id: string | null = null;
      let organizationSource: 'session' | 'fallback-owner' | 'fallback-member' | 'none' = 'none';
      
      // 1. Buscar organization_id da sessão ativa do WhatsApp
      // SESSÕES PERMANENTES: Não verificar expiração
      const { data: whatsappSession } = await supabase
        .from('whatsapp_sessions')
        .select('organization_id')
        .eq('user_id', userId)
        .order('last_activity', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (whatsappSession?.organization_id) {
        organization_id = whatsappSession.organization_id;
        organizationSource = 'session';
        console.log('✅ [saveTransaction] Using organization_id from WhatsApp session:', organization_id);
      } else {
        // 2. Fallback: Buscar todas memberships e priorizar onde é owner
        console.log('⚠️ [saveTransaction] No organization_id in WhatsApp session, using fallback');
        const { data: memberships } = await supabase
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        const ownerMembership = memberships?.find(m => m.role === 'owner');
        const fallbackMembership = memberships?.[0];
        const selectedMembership = ownerMembership ?? fallbackMembership;
        
        if (selectedMembership?.organization_id) {
          organization_id = selectedMembership.organization_id;
          organizationSource = selectedMembership.role === 'owner' ? 'fallback-owner' : 'fallback-member';
          console.log('✅ [saveTransaction] Organization ID from membership:', organization_id, '(role:', selectedMembership.role, ')');
        } else {
          // 3. Último fallback: buscar se é owner direto
          const { data: ownedOrg } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_id', userId)
            .maybeSingle();
          
          if (ownedOrg?.id) {
            organization_id = ownedOrg.id;
            organizationSource = 'fallback-owner';
            console.log('✅ [saveTransaction] Organization ID via direct ownership:', organization_id);
          } else {
            console.log('⚠️ [saveTransaction] User has no organization_id');
          }
        }
      }
      
      console.log(`🏢 [saveTransaction] Selected organization_id: ${organization_id} (source: ${organizationSource})`);

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

      // HEURÍSTICA DE DATA: Se data do recibo for muito antiga (>35 dias), usar data atual
      let finalDate = transaction.date;
      let dateNote = '';
      
      if (transaction.date) {
        const receiptDate = new Date(transaction.date);
        const today = new Date();
        const daysDiff = Math.floor((today.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 35) {
          finalDate = today.toISOString().split('T')[0];
          dateNote = `Data do recibo: ${receiptDate.toLocaleDateString('pt-BR')}`;
          console.log(`📅 [saveTransaction] Receipt date is ${daysDiff} days old, using today's date instead`);
          console.log(`📅 [saveTransaction] Original: ${transaction.date}, New: ${finalDate}`);
        }
      }
      
      const transactionData = {
        user_id: userId,
        amount: transaction.amount,
        title: transaction.title,
        type: transaction.type,
        date: finalDate || transaction.date,
        description: dateNote ? `${dateNote}${transaction.description ? '\n' + transaction.description : ''}` : transaction.description,
        category_id: transaction.category_id || categoryInfo.category_id,
        source: 'whatsapp',
        organization_id: organization_id
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

      // 💡 Detectar se a transação parece recorrente
      const recurringKeywords = ['luz', 'agua', 'água', 'aluguel', 'internet', 'netflix', 'spotify', 'assinatura', 'condominio', 'condomínio', 'seguro', 'plano', 'telefone', 'celular', 'academia', 'escola', 'faculdade', 'mensalidade', 'iptu', 'ipva'];
      const titleLower = (transaction.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isRecurring = recurringKeywords.some(kw => {
        const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return titleLower.includes(kwNorm);
      });

      let finalResponse = structuredResponse;
      let pendingRecurring: any = undefined;

      if (isRecurring && transaction.type === 'expense') {
        finalResponse += `\n\n💡 *Essa conta parece se repetir todo mês.* Quer salvar como conta fixa?\nResponda *SIM* para cadastrar automaticamente.`;
        pendingRecurring = {
          title: transaction.title,
          amount: transaction.amount,
          type: transaction.type,
          category_id: transactionData.category_id
        };
      }

      return {
        response: finalResponse,
        transactionId: data.id,
        sendButtons: !isRecurring, // Don't send buttons if we're asking about recurring
        pendingRecurring
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

  static async addCommitment(userId: string, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    try {
      console.log('🗓️ === INICIANDO ADDCOMMITMENT ===');
      console.log('🗓️ User ID:', userId);
      console.log('🗓️ Mensagem:', messageText);
      console.log('🗓️ Extraindo dados do compromisso...');
      
      // 1) Tentativa rápida com parser local (pt-BR) antes de chamar IA
      const normalized = messageText
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
      console.log('🗓️ QuickParse - normalized:', normalized);

      const dayNames: Record<string, number> = {
        domingo: 0, segunda: 1, terca: 2, tercafeira: 2, 'terça': 2, 'terça-feira': 2,
        quarta: 3, quintafeira: 4, quinta: 4, sexta: 5, sabado: 6, 'sábado': 6
      } as any;

      // Extrair hora - EXIGE sufixo válido para não capturar "11" de "11/10"
      // Aceita: "14h30", "14:30", "às 14h", "14 horas"
      const timeMatch = normalized.match(/\b(?:as|a)?\s*(\d{1,2})(?:(?::|h)(\d{2})\b|\s*(?:h|horas?))\b/);
      let hour: number | null = null;
      let minute: number | null = null;
      if (timeMatch) {
        hour = Math.min(23, parseInt(timeMatch[1]));
        minute = Math.min(59, parseInt(timeMatch[2] || '0'));
      }

      // Extrair data
      const nowBr = getBrazilTime();
      let target = new Date(nowBr);

      if (/\bamanha\b/.test(normalized)) {
        target = new Date(nowBr.getTime() + 24 * 60 * 60 * 1000);
      } else if (/\bhoje\b/.test(normalized)) {
        target = new Date(nowBr);
      } else {
        // Padrão "dia DD" (ex: "dia 15", "dia 3")
        const dayOnly = normalized.match(/\bdia\s+(\d{1,2})\b/);
        if (dayOnly) {
          const d = parseInt(dayOnly[1]);
          const currentMonth = nowBr.getUTCMonth();
          const currentDay = nowBr.getUTCDate();
          let targetMonth = currentMonth;
          let targetYear = nowBr.getUTCFullYear();
          
          // Se o dia já passou no mês atual, usar mês seguinte
          if (d < currentDay) {
            targetMonth = (currentMonth + 1) % 12;
            if (targetMonth === 0) targetYear++; // virou o ano
          }
          
          target = new Date(Date.UTC(targetYear, targetMonth, d));
        } else {
          // dd/mm(/aaaa)
          const dm = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
          if (dm) {
            const d = parseInt(dm[1]);
            const m = parseInt(dm[2]);
            const y = dm[3] ? (dm[3].length === 2 ? 2000 + parseInt(dm[3]) : parseInt(dm[3])) : nowBr.getUTCFullYear();
            target = new Date(Date.UTC(y, m - 1, d));
          } else {
            // Próximo dia da semana citado
            for (const key of Object.keys(dayNames)) {
              if (new RegExp(`\\b${key}\\b`).test(normalized)) {
                const todayDow = nowBr.getUTCDay();
                const desired = dayNames[key as keyof typeof dayNames];
                let add = (desired - todayDow + 7) % 7;
                if (add === 0) add = 7; // próximo
                target = new Date(nowBr.getTime() + add * 24 * 60 * 60 * 1000);
                break;
              }
            }
          }
        }
      }

      // 1️⃣ PRIMEIRO: Detectar categoria no texto normalizado completo
      let category: 'payment' | 'meeting' | 'appointment' | 'other' = 'other';
      if (/dentista|ortopedista|pediatra|ginecologista|cardiologista|oftalmologista|dermato|medico|doutor|clinica|hospital|exame|consulta|veterinario/i.test(normalized)) {
        category = 'appointment';
      } else if (/(reuniao|reuni[aã]o|meeting|encontro|call|videochamada|apresentacao|workshop|entrevista)/i.test(normalized)) {
        category = 'meeting';
      } else if (/pagamento|pagar|conta|boleto|fatura|vencimento|mensalidade|prestacao/i.test(normalized)) {
        category = 'payment';
      }

      // 2️⃣ DEPOIS: Extrair título limpo (não remover "11/10" acidentalmente)
      // Primeiro remover palavras de comando
      let title = normalized.replace(/^(agendar|marcar|cadastrar|compromisso)\s+/, '');
      
      // Remover referências temporais E tudo que vem DEPOIS (data/hora)
      title = title
        .replace(/\s+(para|pra|em|no|na)\s+.*/,'') // Remove "para amanhã 14h"
        .replace(/\b(amanha|hoje)\b.*/,'') // Remove "amanhã 14h" ou "hoje 10h"
        .replace(/\bdia\s+\d{1,2}\b.*/,'') // Remove "dia 15 às 10h"
        .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b.*/,'') // Remove "10/11 às 14h"
        .replace(/\b(?:as|a|às)\s+\d{1,2}(?:(?::\d{2})|h\d{2}|\s*(?:h|horas?)).*/,'') // Remove "às 14h"
        .replace(/\b(domingo|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado)\b.*/,'') // Remove "sexta 10h"
        .trim();

      if (title) {
        // SE HORÁRIO NÃO FOI ESPECIFICADO: perguntar ao usuário
        if (hour === null) {
          console.log('⏰ Horário não especificado, perguntando ao usuário');
          
          return {
            response: `📅 *Agendando: ${title.charAt(0).toUpperCase() + title.slice(1)}*\n\n⏰ Qual horário você prefere?\n\nExemplos:\n• 14h\n• 14:30\n• 9h\n• 16h45`,
            sessionData: {
              conversation_state: 'awaiting_commitment_time',
              pending_commitment: {
                title: title.charAt(0).toUpperCase() + title.slice(1),
                category,
                targetDate: target.toISOString()
              }
            }
          };
        }
        
        // Montar ISO no UTC a partir do horário de Brasília (UTC-3)
        const y = target.getUTCFullYear();
        const m = target.getUTCMonth();
        const d = target.getUTCDate();
        const scheduledISO = new Date(Date.UTC(y, m, d, hour + 3, minute)).toISOString();
        console.log('🗓️ [COMMITMENT-FLOW] QuickParse SUCCESS:', {
          originalMessage: messageText,
          normalizedMessage: normalized,
          title,
          category,
          targetDate: target.toISOString(),
          hour,
          minute,
          scheduledISO
        });
        
        // ✅ VALIDAR HORÁRIO PASSADO (BRT) usando date-fns-tz
        const { toZonedTime } = await import('https://esm.sh/date-fns-tz@3.2.0');
        const nowSP = toZonedTime(new Date(), 'America/Sao_Paulo');
        const scheduledSP = toZonedTime(new Date(scheduledISO), 'America/Sao_Paulo');
        
        console.log('[Agenda Debug][WhatsApp] Timezone validation:', { 
          nowSP: nowSP.toISOString(),
          scheduledSP: scheduledSP.toISOString(),
          isPast: scheduledSP <= nowSP
        });
        
        if (scheduledSP <= nowSP) {
          console.log('⏰ [COMMITMENT-FLOW] Rejected past time:', { scheduledBRT, nowBRT });
          
          // Buscar horários disponíveis
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const suggestions = await this.suggestAvailableSlots(userId, target, hour);
          
          // Formatar sugestões com emojis
          const formattedSuggestions = suggestions.length > 0 
            ? suggestions.map((time, idx) => `${idx + 1}️⃣ ${time}`).join('\n')
            : '';
          
          const suggestionText = formattedSuggestions 
            ? `💡 *Horários disponíveis hoje:*\n${formattedSuggestions}\n\n${suggestions.length + 1}️⃣ Digitar outro horário\n${suggestions.length + 2}️⃣ Cancelar`
            : `Por favor, informe um horário futuro.\n\nExemplo: *agendar ${title} amanhã 14h*`;
          
          return {
            response: `⏰ *Esse horário já passou!*\n\n${suggestionText}`,
            sessionData: {
              conversation_state: 'awaiting_commitment_time',
              pending_commitment: {
                title: title.charAt(0).toUpperCase() + title.slice(1),
                category,
                targetDate: target.toISOString()
              }
            }
          };
        }

        // ⚠️ VERIFICAR CONFLITOS antes de inserir
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        // Query conflitos em janela de +/- 1 hora
        const start = new Date(Date.parse(scheduledISO) - 60*60*1000).toISOString();
        const end   = new Date(Date.parse(scheduledISO) + 60*60*1000).toISOString();
        const { data: conflicts } = await supabase
          .from('commitments')
          .select('id,title,scheduled_at')
          .eq('user_id', userId)
          .gte('scheduled_at', start)
          .lte('scheduled_at', end)
          .order('scheduled_at');

        if (conflicts && conflicts.length > 0) {
          console.log('⚠️ CONFLITO DETECTADO:', {
            requestedTitle: title,
            requestedTime: scheduledISO,
            existingConflicts: conflicts.map(c => ({ title: c.title, time: c.scheduled_at }))
          });
          
          // Usar suggestAvailableSlots para sugerir horários realmente livres
          const targetDate = new Date(scheduledISO);
          const requestedHour = targetDate.getHours();
          const availableSlots = await WhatsAppAgent.suggestAvailableSlots(userId, targetDate, requestedHour);
          
          const suggestions: string[] = [];
          const suggestionTimes: string[] = [];
          
          // Pegar até 3 slots disponíveis próximos ao horário solicitado
          for (const slot of availableSlots.slice(0, 3)) {
            const [slotHour, slotMinute] = slot.split(':').map(Number);
            const y = targetDate.getUTCFullYear();
            const m = targetDate.getUTCMonth();
            const d = targetDate.getUTCDate();
            // Ajustar para UTC (São Paulo = UTC-3)
            const slotISO = new Date(Date.UTC(y, m, d, slotHour + 3, slotMinute)).toISOString();
            
            suggestions.push(slot);
            suggestionTimes.push(slotISO);
          }
          
          console.log('💡 Sugestões de horários disponíveis:', suggestions);
          
          // Montar lista de conflitos
          const conflictList = conflicts.map(c => {
            const time = new Date(c.scheduled_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
            });
            return `• ${c.title} às ${time}`;
          }).join('\n');
          
          // Formatar horário solicitado
          const requestedTime = new Date(scheduledISO).toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
          });
          
          // Montar mensagem com foco em horários disponíveis
          let optionsText = `❌ *Não posso agendar "${title}" às ${requestedTime}*\n\n📅 Você já tem:\n${conflictList}`;
          
          if (suggestions.length > 0) {
            optionsText += `\n\n⏰ *Horários disponíveis próximos:*`;
            suggestions.forEach((sug, idx) => {
              optionsText += `\n${idx + 1}️⃣ ${sug}`;
            });
            optionsText += `\n\n${suggestions.length + 1}️⃣ Digitar outro horário`;
            optionsText += `\n${suggestions.length + 2}️⃣ Cancelar`;
            optionsText += `\n\n_Responda "forçar" se realmente deseja agendar no mesmo horário._`;
          } else {
            optionsText += `\n\n1️⃣ Digitar outro horário`;
            optionsText += `\n2️⃣ Cancelar`;
            optionsText += `\n\n_Responda "forçar" se realmente deseja agendar no mesmo horário._`;
          }
          
          // Guardar estado na sessão
          return {
            response: optionsText,
            sessionData: {
              conversation_state: 'awaiting_commitment_resolution',
              pending_commitment: {
                title: title.charAt(0).toUpperCase() + title.slice(1),
                category,
                scheduledISO,
                targetDate: scheduledISO, // ✅ ADICIONAR: salvar targetDate para reagendamentos
                suggestions: suggestionTimes
              }
            }
          };
        }
        
        // ✨ FASE 2: SEM CONFLITO! Validar data passada e work_hours ANTES de pedir detalhes
        console.log('✅ [COMMITMENT] No conflicts, validating date and work hours...');
        
        const scheduledDate = new Date(scheduledISO);
        const now = new Date();

        // ✅ FASE 2A: VALIDAR SE DATA JÁ PASSOU
        console.log('[Agenda Debug][WhatsApp] Checking if date is in past:', { 
          scheduledDate: scheduledDate.toISOString(), 
          now: now.toISOString(),
          isPast: scheduledDate < now
        });

        if (scheduledDate < now) {
          console.log('[Agenda Debug][WhatsApp] Date is in the past, generating suggestions');
          
          // Sugerir próximos 3 horários disponíveis hoje
          const today = new Date();
          const suggestions: string[] = [];
          const suggestionTimes: string[] = [];
          
          for (let i = 1; i <= 3; i++) {
            const suggestedHour = today.getHours() + i;
            if (suggestedHour < 22) { // Até 22h
              const suggestedDate = new Date(today);
              suggestedDate.setHours(suggestedHour, 0, 0, 0);
              
              suggestions.push(`${suggestedHour}:00`);
              suggestionTimes.push(suggestedDate.toISOString());
            }
          }
          
          let responseMsg = `⚠️ Esse horário já passou (${format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}).\n\n`;
          
          if (suggestions.length > 0) {
            responseMsg += `💡 *Horários disponíveis hoje:*\n`;
            suggestions.forEach((time, idx) => {
              responseMsg += `${idx + 1}️⃣ ${time}\n`;
            });
            responseMsg += `\n${suggestions.length + 1}️⃣ Digitar outro horário\n`;
            responseMsg += `${suggestions.length + 2}️⃣ Cancelar`;
          } else {
            responseMsg += `Por favor, informe uma data futura.\n\nExemplo: *agendar ${title} amanhã 14h*`;
          }
          
          return {
            response: responseMsg,
            sessionData: {
              conversation_state: 'awaiting_commitment_resolution',
              pending_commitment: {
                title,
                category,
                scheduledISO: scheduledISO,
                suggestions: suggestionTimes
              }
            }
          };
        }

        // ✅ FASE 2B: VALIDAR WORK_HOURS
        const dayOfWeek = scheduledDate.getUTCDay() === 0 ? 7 : scheduledDate.getUTCDay();

        console.log('[Agenda Debug][WhatsApp] Pre-validating work hours:', { dayOfWeek });

        const { data: workHours } = await supabase
          .from('work_hours')
          .select('*')
          .eq('user_id', userId)
          .eq('day_of_week', dayOfWeek)
          .maybeSingle();

        // Se dia inativo
        if (workHours && !workHours.is_active) {
          console.log('[Agenda Debug][WhatsApp] Day is inactive (pre-check)');
          
          const dayName = scheduledDate.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            timeZone: 'America/Sao_Paulo' 
          });
          
          return {
            response: `⚠️ *Atenção:* ${dayName} está marcado como dia inativo.\n\n*Deseja agendar mesmo assim?*\n\n✅ Digite *SIM* para continuar\n❌ Digite *NÃO* para escolher outro dia`,
            sessionData: {
              conversation_state: 'awaiting_work_hour_override',
              pending_commitment: {
                title,
                category,
                scheduledISO,
                needsWorkHourConfirmation: 'inactive_day'
              }
            }
          };
        }

        // Se fora do expediente
        if (workHours && workHours.is_active) {
          const timeScheduled = scheduledDate.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
            hour12: false
          });
          const startTime = workHours.start_time.substring(0, 5);
          const endTime = workHours.end_time.substring(0, 5);
          
          if (timeScheduled < startTime || timeScheduled > endTime) {
            console.log('[Agenda Debug][WhatsApp] Time outside work hours (pre-check):', { 
              timeScheduled, startTime, endTime 
            });
            
            return {
              response: `⏰ *Atenção:* ${timeScheduled} está fora do expediente (${startTime} - ${endTime}).\n\n*Deseja agendar mesmo assim?*\n\n✅ Digite *SIM* para continuar\n❌ Digite *NÃO* para escolher outro horário`,
              sessionData: {
                conversation_state: 'awaiting_work_hour_override',
                pending_commitment: {
                  title,
                  category,
                  scheduledISO,
                  needsWorkHourConfirmation: 'outside_hours'
                }
              }
            };
          }
        }

        console.log('[Agenda Debug][WhatsApp] Work hours validation passed (pre-check)');

        // Prosseguir para coleta de detalhes
        const formattedDate = scheduledDate.toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });
        
        const pending = {
          title: title.charAt(0).toUpperCase() + title.slice(1),
          category: category,
          scheduledISO: scheduledISO,
          targetDate: scheduledISO,
          detailsStep: 'location' as const
        };
        
        return {
          response: `✅ *Vou agendar:*\n\n` +
                   `📌 ${pending.title}\n` +
                   `🗓️ ${formattedDate}\n\n` +
                   `📍 Qual o endereço ou local?\n` +
                   `_Digite "pular" para prosseguir sem detalhes._`,
          sessionData: {
            conversation_state: 'awaiting_commitment_details' as const,
            pending_commitment: pending
          }
        };
      }

      // 2) Fallback: usar IA para extrair título e data da mensagem
      const openAIKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIKey) {
        return {
          response: '❌ Serviço de agenda temporariamente indisponível.',
          sessionData: {}
        };
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [{
            role: 'system',
            content: `Extraia dados de compromisso desta mensagem e retorne APENAS JSON válido:
{
  "title": "título do compromisso",
  "description": "descrição opcional",
  "scheduled_at": "timestamp ISO 8601",
  "category": "meeting|appointment|payment|other"
}

Hoje é ${new Date().toLocaleDateString('pt-BR')}. Converta datas relativas (hoje, amanhã, sexta) para timestamps reais no fuso horário America/Sao_Paulo.
Se não especificar hora, retorne scheduled_at: null.`
          }, {
            role: 'user',
            content: messageText
          }],
          max_completion_tokens: 200
        })
      });

      if (!response.ok) {
        console.error('OpenAI API error:', await response.text());
        throw new Error('Erro na API de IA');
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        return {
          response: '❌ Não consegui entender o compromisso. Use o formato:\n\n📅 "agendar [título] para [data/hora]"\n\nExemplo:\n• agendar dentista amanhã 14h\n• compromisso reunião sexta 10h',
          sessionData: {}
        };
      }

      const commitmentData = JSON.parse(jsonMatch[0]);
      
      if (!commitmentData.title || !commitmentData.scheduled_at) {
        return {
          response: '❌ Preciso de um título e data. Exemplo:\n"agendar dentista amanhã 14h"',
          sessionData: {}
        };
      }

      // Converter scheduled_at para UTC se necessário
      let scheduledUTC: string;
      const rawScheduled = commitmentData.scheduled_at;
      
      // Se tem offset/Z, já é timestamp completo
      if (/[Z+-]\d{2}:?\d{2}$/.test(rawScheduled)) {
        scheduledUTC = new Date(rawScheduled).toISOString();
      } else {
        // "Ingênuo" (sem Z/offset) - assumir America/Sao_Paulo
        // Se não tem hora, adicionar 09:00
        let brasiliaDateStr = rawScheduled;
        if (!/\d{2}:\d{2}/.test(brasiliaDateStr)) {
          brasiliaDateStr += 'T09:00:00';
        } else if (!/T/.test(brasiliaDateStr)) {
          brasiliaDateStr = brasiliaDateStr.replace(' ', 'T');
        }
        
        // Converter de Brasília (-3h) para UTC
        const brasiliaDate = new Date(brasiliaDateStr + '-03:00');
        scheduledUTC = brasiliaDate.toISOString();
      }

      // Salvar no banco e retornar o ID
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: inserted, error } = await supabase
        .from('commitments')
        .insert({
          user_id: userId,
          title: commitmentData.title,
          description: commitmentData.description || null,
          scheduled_at: scheduledUTC,
          category: commitmentData.category || 'other'
        })
        .select('id')
        .single();

      if (error) throw error;
      
      console.log('📅 [COMMITMENT-AI] Created with ID:', inserted.id);
      
      // Sincronizar com Google Calendar
      await syncWithGoogleCalendar('create', inserted.id, userId);

      const scheduledDate = new Date(commitmentData.scheduled_at);
      const formattedDate = scheduledDate.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });

      return {
        response: `✅ *Compromisso agendado!*\n\n` +
                 `📌 ${commitmentData.title}\n` +
                 `🗓️ ${formattedDate}\n\n` +
                 `Você receberá um lembrete antes do horário.`,
        sessionData: {}
      };
    } catch (error) {
      console.error('Error adding commitment:', error);
      return {
        response: '❌ Erro ao agendar compromisso. Tente novamente.',
        sessionData: {}
      };
    }
  }

  static async listCommitments(userId: string): Promise<{ response: string, sessionData: SessionData }> {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const now = new Date().toISOString();
      const { data: commitments, error } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(5);

      if (error) throw error;

      if (!commitments || commitments.length === 0) {
        return {
          response: '📭 *Você não tem compromissos agendados.*\n\n' +
                   'Para agendar, digite:\n' +
                   '• "agendar dentista amanhã 14h"\n' +
                   '• "compromisso reunião sexta 10h"',
          sessionData: {}
        };
      }

      const categoryIcons = {
        payment: '💳',
        meeting: '👥',
        appointment: '🏥',
        other: '📌'
      };

      let response = `📅 *Seus próximos ${commitments.length} compromissos:*\n\n`;
      
      commitments.forEach((c, i) => {
        const date = new Date(c.scheduled_at);
        const formattedDate = date.toLocaleDateString('pt-BR', { 
          weekday: 'short', 
          day: '2-digit', 
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });
        
        const icon = categoryIcons[c.category as keyof typeof categoryIcons] || '📌';
        response += `${i + 1}. ${icon} *${c.title}*\n   🗓️ ${formattedDate}\n`;
        if (c.description) {
          response += `   📝 ${c.description}\n`;
        }
        response += `\n`;
      });

      return {
        response,
        sessionData: {}
      };
    } catch (error) {
      console.error('Error listing commitments:', error);
      return {
        response: '❌ Erro ao buscar compromissos. Tente novamente.',
        sessionData: {}
      };
    }
  }

  static async handleEditCommitmentCommand(session: Session, filters: CommandFilters = {}): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};

    if (!session.user_id) {
      return {
        response: '❌ Você precisa estar autenticado.\n\nDigite "codigo" para autenticar.',
        sessionData
      };
    }

    try {
      console.log('[EDIT CMD] Filters:', JSON.stringify(filters));
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Se tiver seleção direta e já houver lista, pular busca
      if (filters.selectionIndex && sessionData.pending_commitment_edit?.available_commitments) {
        const commitments = sessionData.pending_commitment_edit.available_commitments;
        const selected = commitments[filters.selectionIndex - 1];
        
        if (selected) {
          console.log('[EDIT PICK] Direct selection:', selected.id);
          
          const updatedSessionData = {
            ...sessionData,
            conversation_state: 'awaiting_commitment_edit_field' as const,
            pending_commitment_edit: {
              commitment_id: selected.id,
              original_commitment: selected
            }
          };
          
          await SessionManager.updateSession(session.id, {
            session_data: updatedSessionData
          });
          
          return {
            response: `📝 *Editando: ${selected.title}*\n\n` +
                     `Selecione o que deseja alterar:\n\n` +
                     `1️⃣ Título\n` +
                     `2️⃣ Data\n` +
                     `3️⃣ Hora\n` +
                     `4️⃣ Categoria\n` +
                     `5️⃣ Cancelar compromisso`,
            sessionData: updatedSessionData
          };
        }
      }

      // Construir query com filtros
      let query = supabase
        .from('commitments')
        .select('*')
        .eq('user_id', session.user_id);
      
      // Aplicar filtro de data se presente
      if (filters.dateFilter) {
        query = query
          .gte('scheduled_at', filters.dateFilter.startISO)
          .lte('scheduled_at', filters.dateFilter.endISO);
        console.log('[EDIT CMD] Applied date filter:', filters.dateFilter);
      } else {
        // Janela padrão: últimos 30 dias + próximos 90 dias
        const now = new Date();
        const pastLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const futureLimit = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('scheduled_at', pastLimit).lte('scheduled_at', futureLimit);
      }
      
      // Aplicar filtro de título se presente
      if (filters.titleQuery) {
        query = query.ilike('title', `%${filters.titleQuery}%`);
        console.log('[EDIT CMD] Applied title filter:', filters.titleQuery);
      }
      
      const { data: commitments, error } = await query
        .order('scheduled_at', { ascending: true })
        .limit(20);

      if (error) throw error;

      if (!commitments || commitments.length === 0) {
        let msg = '📭 *Nenhum compromisso encontrado';
        if (filters.dateFilter) msg += ' nesta data';
        if (filters.titleQuery) msg += ` com "${filters.titleQuery}"`;
        msg += '.*';
        
        return { response: msg, sessionData };
      }
      
      console.log('[EDIT LIST] Found:', commitments.length, 'commitments');

      // Agrupar por período
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const next7days = new Date(today);
      next7days.setDate(next7days.getDate() + 7);
      const next30days = new Date(today);
      next30days.setDate(next30days.getDate() + 30);

      const grouped = {
        past: [] as any[],
        today: [] as any[],
        next7: [] as any[],
        next30: [] as any[],
        future: [] as any[]
      };

      commitments.forEach(c => {
        const date = new Date(c.scheduled_at);
        if (date < today) {
          grouped.past.push(c);
        } else if (date >= today && date < tomorrow) {
          grouped.today.push(c);
        } else if (date >= tomorrow && date < next7days) {
          grouped.next7.push(c);
        } else if (date >= next7days && date < next30days) {
          grouped.next30.push(c);
        } else {
          grouped.future.push(c);
        }
      });

      const categoryIcons = {
        payment: '💳',
        meeting: '👥',
        appointment: '🏥',
        other: '📌'
      };

      let response = `📝 *Selecione o compromisso para editar:*\n\n`;
      let index = 1;

      // Renderizar cada grupo
      const renderGroup = (title: string, items: any[]) => {
        if (items.length === 0) return;
        response += `*${title}*\n`;
        items.forEach(c => {
          const date = new Date(c.scheduled_at);
          const formattedDate = date.toLocaleDateString('pt-BR', { 
            weekday: 'short', 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
          });
          const icon = categoryIcons[c.category as keyof typeof categoryIcons] || '📌';
          response += `*${index}.* ${icon} ${c.title}\n   🗓️ ${formattedDate}\n\n`;
          index++;
        });
      };

      renderGroup('📌 Passados (últimos 30 dias)', grouped.past);
      renderGroup('📅 Hoje', grouped.today);
      renderGroup('🔜 Próximos 7 dias', grouped.next7);
      renderGroup('📆 Próximos 30 dias', grouped.next30);
      renderGroup('🔮 Futuro distante', grouped.future);

      response += `Digite o número do compromisso (1-${commitments.length}):`;

      console.log('[EDIT CMD] Resetting edit state, listing commitments');

      const updatedSessionData = {
        ...sessionData,
        conversation_state: 'awaiting_commitment_edit_field' as const,
        pending_commitment_edit: {
          available_commitments: commitments
          // Explicitamente SEM field, commitment_id ou original_commitment
        }
      };

      await SessionManager.updateSession(session.id, {
        session_data: updatedSessionData
      });

      return {
        response,
        sessionData: updatedSessionData
      };
    } catch (error) {
      console.error('Error in handleEditCommitmentCommand:', error);
      return {
        response: '❌ Erro ao buscar compromissos.',
        sessionData
      };
    }
  }

  static async handleCancelCommitmentCommand(session: Session, filters: CommandFilters = {}): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};

    if (!session.user_id) {
      return {
        response: '❌ Você precisa estar autenticado.\n\nDigite "codigo" para autenticar.',
        sessionData
      };
    }

    try {
      console.log('[CANCEL CMD] Filters:', JSON.stringify(filters));
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Se tiver seleção direta e já houver lista, executar cancelamento
      if (filters.selectionIndex && sessionData.pending_commitment_edit?.available_commitments) {
        const commitments = sessionData.pending_commitment_edit.available_commitments;
        const selected = commitments[filters.selectionIndex - 1];
        
        if (selected) {
          console.log('[CANCEL PICK] Direct selection:', selected.id);
          
          const { error: deleteError } = await supabase
            .from('commitments')
            .delete()
            .eq('id', selected.id)
            .eq('user_id', session.user_id);
          
          if (deleteError) throw deleteError;
          
          await SessionManager.updateSession(session.id, {
            session_data: {
              ...sessionData,
              conversation_state: 'idle',
              pending_commitment_edit: undefined
            }
          });
          
          return {
            response: `✅ *Compromisso cancelado com sucesso!*\n\n` +
                     `🗑️ "${selected.title}" foi removido da sua agenda.`,
            sessionData: { ...sessionData, conversation_state: 'idle', pending_commitment_edit: undefined }
          };
        }
      }

      // Construir query com filtros - APENAS FUTUROS
      const now = new Date().toISOString();
      
      let query = supabase
        .from('commitments')
        .select('*')
        .eq('user_id', session.user_id)
        .gte('scheduled_at', now); // ✅ Apenas compromissos futuros ou de hoje
      
      // Aplicar filtro de data se presente
      if (filters.dateFilter) {
        query = query
          .gte('scheduled_at', filters.dateFilter.startISO)
          .lte('scheduled_at', filters.dateFilter.endISO);
        console.log('[CANCEL CMD] Applied date filter:', filters.dateFilter);
      }
      
      // Aplicar filtro de título se presente
      if (filters.titleQuery) {
        query = query.ilike('title', `%${filters.titleQuery}%`);
        console.log('[CANCEL CMD] Applied title filter:', filters.titleQuery);
      }
      
      const { data: commitments, error } = await query
        .order('scheduled_at', { ascending: true })
        .limit(10); // ✅ Limitar a 10 compromissos mais próximos

      if (error) throw error;

      if (!commitments || commitments.length === 0) {
        let msg = '📭 *Nenhum compromisso encontrado';
        if (filters.dateFilter) msg += ' nesta data';
        if (filters.titleQuery) msg += ` com "${filters.titleQuery}"`;
        msg += '.*';
        
        return { response: msg, sessionData };
      }
      
      console.log('[CANCEL LIST] Found:', commitments.length, 'commitments');

      // Agrupar por período (apenas futuros)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const next7days = new Date(today);
      next7days.setDate(next7days.getDate() + 7);

      const grouped = {
        today: [] as any[],
        next7: [] as any[],
        future: [] as any[]
      };

      commitments.forEach(c => {
        const date = new Date(c.scheduled_at);
        if (date >= today && date < tomorrow) {
          grouped.today.push(c);
        } else if (date >= tomorrow && date < next7days) {
          grouped.next7.push(c);
        } else {
          grouped.future.push(c);
        }
      });

      const categoryIcons = {
        payment: '💳',
        meeting: '👥',
        appointment: '🏥',
        other: '📌'
      };

      let response = `🗑️ *Compromissos futuros:*\n\n`;
      let index = 1;

      // Renderizar cada grupo
      const renderGroup = (title: string, items: any[]) => {
        if (items.length === 0) return;
        response += `*${title}*\n`;
        items.forEach(c => {
          const date = new Date(c.scheduled_at);
          const formattedDate = date.toLocaleDateString('pt-BR', { 
            weekday: 'short', 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
          });
          const icon = categoryIcons[c.category as keyof typeof categoryIcons] || '📌';
          response += `*${index}.* ${icon} ${c.title}\n   🗓️ ${formattedDate}\n\n`;
          index++;
        });
      };

      renderGroup('📅 Hoje', grouped.today);
      renderGroup('🔜 Próximos 7 dias', grouped.next7);
      renderGroup('📆 Mais tarde', grouped.future);

      response += `\n💡 *Para cancelar:*\n`;
      response += `• Um compromisso: digite o número\n`;
      response += `• Múltiplos: use vírgulas (ex: 1,3,5)\n`;
      response += `• Intervalo: use hífen (ex: 2-4)`;

      console.log('[CANCEL CMD] Resetting state, listing commitments');

      const updatedSessionData = {
        ...sessionData,
        conversation_state: 'awaiting_commitment_cancel_selection' as const,
        pending_commitment_edit: {
          available_commitments: commitments
          // Explicitamente SEM field ou commitment_id
        }
      };

      await SessionManager.updateSession(session.id, {
        session_data: updatedSessionData
      });

      return {
        response,
        sessionData: updatedSessionData
      };
    } catch (error) {
      console.error('Error in handleCancelCommitmentCommand:', error);
      return {
        response: '❌ Erro ao buscar compromissos.',
        sessionData
      };
    }
  }

  // ✨ FASE 2C: Handler para override de work hours
  static async handleWorkHourOverride(
    session: Session,
    messageText: string
  ): Promise<{ response: string, sessionData: SessionData }> {
    const normalized = messageText.trim().toLowerCase();
    const sessionData = session.session_data || {};
    const pending = sessionData.pending_commitment!;
    
    console.log('[Agenda Debug][WhatsApp] Work hour override response:', { input: messageText, normalized });
    
    // Usuário confirmou agendar mesmo com alerta
    if (/^(sim|s|yes|confirmar)$/i.test(normalized)) {
      console.log('[Agenda Debug][WhatsApp] User confirmed override, proceeding to details');
      
      // Prosseguir para coleta de detalhes
      pending.detailsStep = 'location';
      
      const scheduledDate = new Date(pending.scheduledISO);
      const formattedDate = scheduledDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
      
      return {
        response: `✅ Ok! Vou agendar mesmo assim.\n\n` +
                 `📌 ${pending.title}\n` +
                 `🗓️ ${formattedDate}\n\n` +
                 `📍 Qual o endereço ou local?\n` +
                 `_Digite "pular" para prosseguir sem detalhes._`,
        sessionData: {
          ...sessionData,
          conversation_state: 'awaiting_commitment_details',
          pending_commitment: pending
        }
      };
    }
    
    // Usuário cancelou
    if (/^(n(ao|ão)?|não|no|cancelar)$/i.test(normalized)) {
      console.log('[Agenda Debug][WhatsApp] User rejected override, canceling');
      
      return {
        response: '❌ Agendamento cancelado.\n\nDigite *agendar [título] [data] [hora]* para tentar novamente.',
        sessionData: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment: undefined
        }
      };
    }
    
    // Resposta inválida
    return {
      response: '❓ *Não entendi sua resposta.*\n\n✅ Digite *SIM* para agendar mesmo assim\n❌ Digite *NÃO* para cancelar',
      sessionData
    };
  }

  // ✨ FASE 2: Coletar informações contextuais (local, especialidade, empresa, contato, participantes)
  static async handleCommitmentDetailsInput(
    session: Session, 
    messageText: string
  ): Promise<{ response: string, sessionData: SessionData }> {
    
    const sessionData = session.session_data || {};
    const pending = sessionData.pending_commitment!;
    const currentStep = pending.detailsStep;
    
    console.log('📝 Coletando detalhe:', { step: currentStep, input: messageText });
    
    const normalized = messageText.trim().toLowerCase();
    
    // ✅ Permitir pular em qualquer etapa
    if (normalized === 'pular') {
      console.log('⏭️ Usuário pulou a etapa:', currentStep);
      pending.detailsStep = 'completed';
      return await this.showCommitmentConfirmation(session, pending);
    }
    
    // Atualizar campo correspondente ao step atual
    switch(currentStep) {
      case 'location':
        // ✅ Permitir pular qualquer etapa
        if (normalized === 'pular') {
          console.log('[COMMITMENT-FLOW] User skipped location step');
          pending.detailsStep = 'completed';
          return await this.showCommitmentConfirmation(session, pending);
        }
        
        pending.location = messageText.trim();
        
        // Decidir próximo passo baseado na categoria
        if (pending.category === 'appointment') {
          // ✨ INTELIGÊNCIA CONTEXTUAL: verificar se título já contém especialidade
          const detectedSpecialty = extractSpecialtyFromTitle(pending.title);
          
          if (detectedSpecialty) {
            // Usar a especialidade detectada e pular a pergunta
            console.log('[COMMITMENT-FLOW] Auto-detected specialty:', detectedSpecialty);
            pending.specialty = detectedSpecialty;
            pending.detailsStep = 'completed';
            return await this.showCommitmentConfirmation(session, pending);
          } else {
            // Perguntar apenas se NÃO detectou
            pending.detailsStep = 'specialty';
            await SessionManager.updateSession(session.id, {
              session_data: { ...sessionData, pending_commitment: pending }
            });
            return {
              response: '🩺 Qual a especialidade médica?\n\n_Você pode digitar "pular" se não quiser especificar._',
              sessionData: { ...sessionData, pending_commitment: pending }
            };
          }
        } else if (pending.category === 'meeting') {
          pending.detailsStep = 'company';
          await SessionManager.updateSession(session.id, {
            session_data: { ...sessionData, pending_commitment: pending }
          });
          return {
            response: '🏢 Qual o nome da empresa da reunião?\n_Digite "pular" para continuar._',
            sessionData: { ...sessionData, pending_commitment: pending }
          };
        } else if (pending.category === 'other' && /futeb|basquet|voley|esport|treino/i.test(pending.title)) {
          pending.detailsStep = 'participants';
          await SessionManager.updateSession(session.id, {
            session_data: { ...sessionData, pending_commitment: pending }
          });
          return {
            response: '👥 Quem vai participar?\n_Digite "pular" para continuar._',
            sessionData: { ...sessionData, pending_commitment: pending }
          };
        }
        // Se não se encaixa em nenhum, ir direto para confirmação
        pending.detailsStep = 'completed';
        return await this.showCommitmentConfirmation(session, pending);
        
      case 'specialty':
        if (normalized === 'pular') {
          pending.detailsStep = 'completed';
          return await this.showCommitmentConfirmation(session, pending);
        }
        pending.specialty = messageText.trim();
        pending.detailsStep = 'completed';
        return await this.showCommitmentConfirmation(session, pending);
        
      case 'company':
        if (normalized === 'pular') {
          pending.detailsStep = 'completed';
          return await this.showCommitmentConfirmation(session, pending);
        }
        pending.company = messageText.trim();
        
        // ✅ Se for reunião, coletar email para Google Meet
        if (pending.category === 'meeting') {
          pending.detailsStep = 'email';
          await SessionManager.updateSession(session.id, {
            session_data: { ...sessionData, pending_commitment: pending }
          });
          return {
            response: '📧 Qual o email do participante?\n(Ex: joao@lavinia.com.br)\n\n_Digite "pular" se não souber._',
            sessionData: { ...sessionData, pending_commitment: pending }
          };
        }
        
        // Se não for reunião, ir direto para contato
        pending.detailsStep = 'contact';
        await SessionManager.updateSession(session.id, {
          session_data: { ...sessionData, pending_commitment: pending }
        });
        return {
          response: '👤 Qual o nome e telefone do contato?\n(Ex: João Silva - 11 98765-4321)\n\n_Digite "pular" para finalizar._',
          sessionData: { ...sessionData, pending_commitment: pending }
        };
        
      case 'email':
        if (normalized !== 'pular') {
          const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
          if (emailRegex.test(messageText.trim())) {
            pending.email = messageText.trim();
          }
        }
        pending.detailsStep = 'contact';
        await SessionManager.updateSession(session.id, {
          session_data: { ...sessionData, pending_commitment: pending }
        });
        return {
          response: '👤 Qual o nome e telefone do contato?\n(Ex: João Silva - 11 98765-4321)\n\n_Digite "pular" para finalizar._',
          sessionData: { ...sessionData, pending_commitment: pending }
        };
        
      case 'contact':
        if (normalized !== 'pular') {
          // Parse "Nome - Telefone"
          const contactMatch = messageText.match(/(.+?)\s*-\s*(.+)/);
          if (contactMatch) {
            pending.contactName = contactMatch[1].trim();
            pending.contactPhone = contactMatch[2].trim();
          } else {
            pending.contactName = messageText.trim();
          }
        }
        pending.detailsStep = 'completed';
        return await this.showCommitmentConfirmation(session, pending);
        
      case 'participants':
        pending.participants = messageText.trim();
        pending.detailsStep = 'completed';
        return await this.showCommitmentConfirmation(session, pending);
    }
    
    // Fallback (não deveria chegar aqui)
    return await this.showCommitmentConfirmation(session, pending);
  }

  // ✨ FASE 3: Mostrar confirmação antes de salvar
  static async showCommitmentConfirmation(
    session: Session,
    pending: any
  ): Promise<{ response: string, sessionData: SessionData }> {
    
    const sessionData = session.session_data || {};
    
    // ✅ VALIDAR WORK_HOURS ANTES DE MOSTRAR CONFIRMAÇÃO
    const scheduledDate = new Date(pending.scheduledISO);
    const dayOfWeek = scheduledDate.getUTCDay() === 0 ? 7 : scheduledDate.getUTCDay(); // Domingo = 7
    
    console.log('[Agenda Debug][WhatsApp] Validating work hours for day:', dayOfWeek);
    
    const { data: workHours } = await supabase
      .from('work_hours')
      .select('*')
      .eq('user_id', session.user_id)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();
    
    // Se dia está marcado como inativo
    if (workHours && !workHours.is_active) {
      console.log('[Agenda Debug][WhatsApp] Day is inactive, asking user confirmation');
      
      pending.needsWorkHourConfirmation = 'inactive_day';
      
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'awaiting_commitment_confirmation',
          pending_commitment: pending
        }
      });
      
      const dayName = scheduledDate.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' });
      
      return {
        response: `⚠️ *Atenção:* ${dayName} (${scheduledDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}) está marcado como *dia inativo* na sua agenda.\n\n*Deseja agendar mesmo assim?*\n\n✅ Digite *SIM* para confirmar\n❌ Digite *NÃO* para escolher outro horário`,
        sessionData: {
          ...sessionData,
          conversation_state: 'awaiting_commitment_confirmation',
          pending_commitment: pending
        }
      };
    }
    
    // Se horário está fora do expediente
    if (workHours && workHours.is_active) {
      const timeScheduled = scheduledDate.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
        hour12: false
      });
      const startTime = workHours.start_time.substring(0, 5);
      const endTime = workHours.end_time.substring(0, 5);
      
      if (timeScheduled < startTime || timeScheduled > endTime) {
        console.log('[Agenda Debug][WhatsApp] Time outside work hours:', { timeScheduled, startTime, endTime });
        
        pending.needsWorkHourConfirmation = 'outside_hours';
        
        await SessionManager.updateSession(session.id, {
          session_data: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_confirmation',
            pending_commitment: pending
          }
        });
        
        return {
          response: `⏰ *Atenção:* O horário ${timeScheduled} está *fora do seu expediente* (${startTime} - ${endTime}).\n\n*Deseja agendar mesmo assim?*\n\n✅ Digite *SIM* para confirmar\n❌ Digite *NÃO* para escolher outro horário`,
          sessionData: {
            ...sessionData,
            conversation_state: 'awaiting_commitment_confirmation',
            pending_commitment: pending
          }
        };
      }
    }
    
    console.log('[Agenda Debug][WhatsApp] Work hours validation passed');
    
    // Formatar data/hora em português
    const formattedDateTime = scheduledDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
    
    // ✅ FASE 3: Montar mensagem de confirmação SIMPLIFICADA
    let confirmMsg = `✅ *Pronto para agendar!*\n\n`;
    confirmMsg += `📌 ${pending.title}\n`;
    confirmMsg += `📅 ${formattedDateTime}\n`;

    // Detalhes essenciais (se informados)
    const hasDetails = pending.location || pending.specialty || pending.company || pending.email;

    if (hasDetails) {
      confirmMsg += `\n📋 *Detalhes:*\n`;
      
      if (pending.location && pending.location !== 'undefined' && pending.location.trim() && pending.location !== 'pular') {
        confirmMsg += `📍 ${pending.location}\n`;
        console.log('[Agenda Debug][WhatsApp] Location field:', { location: pending.location, willShow: true });
      } else {
        console.log('[Agenda Debug][WhatsApp] Location field skipped:', { location: pending.location, willShow: false });
      }
      
      if (pending.specialty) {
        confirmMsg += `🩺 ${pending.specialty}\n`;
      }
      
      if (pending.company) {
        confirmMsg += `🏢 ${pending.company}\n`;
      }
      
      if (pending.email) {
        confirmMsg += `📧 ${pending.email}\n`;
      }
      
      if (pending.contactName) {
        confirmMsg += `👤 ${pending.contactName}`;
        if (pending.contactPhone) confirmMsg += ` - ${pending.contactPhone}`;
        confirmMsg += '\n';
      }
    }

    // Lembretes (versão compacta)
    confirmMsg += `\n🔔 Você receberá lembretes automáticos`;

    // Google Meet (apenas se for reunião)
    if (pending.category === 'meeting') {
      confirmMsg += `\n📧 Link do Google Meet será criado`;
    }

    confirmMsg += `\n\n✅ *CONFIRMAR* para agendar`;
    confirmMsg += `\n❌ *CANCELAR* para desistir`;

    console.log('[Agenda Debug][WhatsApp] Confirmation message length:', confirmMsg.length);
    
    // Atualizar estado para aguardar confirmação
    await SessionManager.updateSession(session.id, {
      session_data: {
        ...sessionData,
        conversation_state: 'awaiting_commitment_confirmation',
        pending_commitment: pending
      }
    });
    
    return {
      response: confirmMsg,
      sessionData: {
        ...sessionData,
        conversation_state: 'awaiting_commitment_confirmation',
        pending_commitment: pending
      }
    };
  }

  // ✨ FASE 3: Processar confirmação (confirmar ou cancelar)
  static async handleCommitmentConfirmation(
    session: Session,
    messageText: string
  ): Promise<{ response: string, sessionData: SessionData }> {
    
    const normalized = messageText.trim().toLowerCase();
    const sessionData = session.session_data || {};
    const pending = sessionData.pending_commitment!;
    
    console.log('✅ Processando confirmação:', { input: messageText, normalized });
    
    // ✅ Aceitar variações de "não"
    if (/^(n(ao|ão)?|não|no|cancelar)$/i.test(normalized)) {
      console.log('[Agenda Debug][WhatsApp] User rejected commitment');
      console.log('[COMMITMENT-FLOW] User cancelled confirmation, checking for orphan');
      
      // ✅ SE JÁ CRIOU COMPROMISSO NO BANCO, DELETAR
      if (pending.commitment_id) {
        console.log('[COMMITMENT-FLOW] Deleting orphan commitment:', pending.commitment_id);
        await supabase
          .from('commitments')
          .delete()
          .eq('id', pending.commitment_id)
          .eq('user_id', session.user_id!);
      }
      
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment: undefined
        }
      });
      
      return {
        response: '❌ Agendamento cancelado.\n\nDigite *agendar [título] [data] [hora]* para tentar novamente.',
        sessionData: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment: undefined
        }
      };
    }
    
    // ✅ Aceitar variações de "sim"
    if (/^(sim|s|yes|confirmar|confirmo)$/i.test(normalized)) {
      console.log('[Agenda Debug][WhatsApp] User confirmed commitment');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      // Buscar nome do usuário para personalização
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', session.user_id)
        .maybeSingle();

      const userName = profile?.full_name || undefined;
      
      // Montar description com todos os detalhes
      // ✅ Montar título personalizado
      let finalTitle = pending.title;
      
      if (pending.category === 'meeting' && pending.company) {
        finalTitle = `Reunião - ${pending.company}`;
      } else if (pending.category === 'appointment' && pending.specialty) {
        finalTitle = `Consulta - ${pending.specialty}`;
      } else if (pending.participants && /futeb|basquet|esport/i.test(pending.title)) {
        finalTitle = `${pending.title} - ${pending.participants}`;
      }
      
      // ✅ Montar description
      let description = '';
      if (pending.location) description += `Local: ${pending.location}\n`;
      if (pending.specialty) description += `Especialidade: ${pending.specialty}\n`;
      if (pending.company) description += `Empresa: ${pending.company}\n`;
      if (pending.email) description += `Email: ${pending.email}\n`;
      if (pending.contactName) description += `Contato: ${pending.contactName}\n`;
      if (pending.contactPhone) description += `Telefone: ${pending.contactPhone}\n`;
      if (pending.participants) description += `Participantes: ${pending.participants}\n`;
      
      // ✅ Inserir no banco (ÚNICO PONTO DE INSERÇÃO)
      console.log('[COMMITMENT-FLOW] Saving after user confirmation');
      const { data: commitment, error: insertErr } = await supabase
        .from('commitments')
        .insert({
          user_id: session.user_id,
          title: finalTitle,
          description: description.trim() || null,
          scheduled_at: pending.scheduledISO,
          category: pending.category,
          location: pending.location || null,
          participants: pending.participants || null,
          notes: pending.specialty || pending.company ? `${pending.specialty || ''}${pending.company || ''}`.trim() : null
        })
        .select()
        .single();
      
      if (insertErr) {
        console.error('❌ [COMMITMENT-FLOW] Error inserting commitment:', insertErr);
        return {
          response: '❌ Erro ao salvar compromisso. Tente novamente.',
          sessionData: {
            ...sessionData,
            conversation_state: 'idle',
            pending_commitment: undefined
          }
        };
      }
      
      console.log('✅ [COMMITMENT-FLOW] Commitment saved:', commitment.id);
      
      // ✅ Sincronizar com Google Calendar APÓS confirmação
      console.log('[WHATSAPP-AGENT] Triggering Google Calendar sync: create');
      const syncResult = await syncWithGoogleCalendar('create', commitment.id, session.user_id!);
      
      // Gerar mensagem personalizada ✨
      let successMsg = PersonalizedResponses.generateCommitmentSuccessMessage(
        userName,
        pending
      );
      
      // ✅ Adicionar link do Google Maps se houver localização (sem undefined)
      if (pending.location && pending.location !== 'pular' && pending.location !== 'undefined' && pending.location.trim() !== '') {
        const encodedAddress = encodeURIComponent(pending.location);
        successMsg += `\n\n📍 Ver no mapa: https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      }
      
      // ✅ Se for reunião, informar sobre Google Meet
      if (pending.category === 'meeting') {
        successMsg += `\n\n🎥 *Google Meet criado!*`;
        successMsg += `\n• Link disponível no Google Calendar`;
        if (pending.email) {
          successMsg += `\n• Convite enviado para ${pending.email}`;
        }
        successMsg += `\n• Você receberá notificação do Google`;
      }
      
      // ✅ Adicionar informações sobre lembretes
      successMsg += `\n\n⏰ *Lembretes configurados:*`;
      successMsg += `\n• 📱 WhatsApp: 24h, 2h e 1h antes`;
      successMsg += `\n• 📅 Google Calendar: 24h, 2h, 1h e 30min antes`;
      
      // ✅ Notificar se sincronização falhou
      if (!syncResult.success) {
        successMsg += `\n\n⚠️ *Atenção:* O compromisso foi salvo no sistema, mas a sincronização com o Google Calendar falhou. Tente reconectar sua conta do Google.`;
      }
      
      // Limpar estado
      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment: undefined
        }
      });
      
      return {
        response: successMsg,
        sessionData: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment: undefined
        }
      };
    }
    
    // ✅ Se não for sim nem não
    return {
      response: '❓ *Não entendi sua resposta.*\n\n✅ Digite *SIM* para confirmar o agendamento\n❌ Digite *NÃO* para cancelar',
      sessionData
    };
    
    // Se não for nem confirmar nem cancelar, pedir novamente (não deveria chegar aqui)
    return {
      response: '❓ Não entendi. Digite *confirmar* para agendar ou *cancelar* para desistir.',
      sessionData
    };
  }

  static async handleCommitmentTimeInput(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const pending = sessionData.pending_commitment;
    
    if (!pending?.title || !pending?.targetDate) {
      return {
        response: '❌ Erro ao processar horário.',
        sessionData: { ...sessionData, conversation_state: 'idle', pending_commitment: undefined }
      };
    }
    
    console.log('[COMMITMENT-FLOW] Step: awaiting_commitment_time, input:', messageText);
    
    // Extrair horário da resposta
    const normalized = messageText.toLowerCase().trim();
    
    // 🔄 FASE 1: Detectar se o usuário está iniciando um NOVO agendamento (regex CORRIGIDA)
    const startsNewScheduling = /\b(agendar|marcar|cadastrar)\b/i.test(normalized);
    if (startsNewScheduling) {
      console.log('[COMMITMENT-FLOW] Novo comando de agendamento detectado. Reiniciando fluxo.');
      return await this.addCommitment(session.user_id!, messageText);
    }
    
    // ✅ VALIDAÇÃO: Se não for um horário válido, retornar erro claro
    // Regex ANCORADA para aceitar APENAS horários puros
    const timeMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:h|horas?)?$/i);
    
    if (!timeMatch) {
      console.log('[COMMITMENT-FLOW] Invalid time format, rejecting input');
      return {
        response: '⏰ Por favor, digite apenas o horário.\n\nExemplos:\n• 11h\n• 14:30\n• 9h',
        sessionData
      };
    }
    
    if (!timeMatch) {
      return {
        response: '❌ Não entendi o horário. Digite no formato:\n\n• 14h\n• 14:30\n• 9h',
        sessionData
      };
    }
    
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
    // Validar horário (0-23h)
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return {
        response: '❌ Horário inválido. Use entre 00h e 23h59.',
        sessionData
      };
    }
    
    // Montar ISO com a data guardada + horário informado
    const target = new Date(pending.targetDate);
    const y = target.getUTCFullYear();
    const m = target.getUTCMonth();
    const d = target.getUTCDate();
    const scheduledISO = new Date(Date.UTC(y, m, d, hour + 3, minute)).toISOString();
    
    console.log('🗓️ Horário validado:', { hour, minute, scheduledISO });
    
    // ✅ Validar se horário já passou (BRT) usando date-fns-tz
    const { toZonedTime } = await import('https://esm.sh/date-fns-tz@3.2.0');
    const nowSP = toZonedTime(new Date(), 'America/Sao_Paulo');
    const scheduledSP = toZonedTime(new Date(scheduledISO), 'America/Sao_Paulo');

    console.log('[Agenda Debug][WhatsApp] Timezone validation in handleCommitmentTimeInput:', { 
      nowSP: nowSP.toISOString(),
      scheduledSP: scheduledSP.toISOString(),
      isPast: scheduledSP <= nowSP
    });

    if (scheduledSP <= nowSP) {
      console.log('⏰ [COMMITMENT-FLOW] Rejected past time at time input:', { scheduledSP, nowSP });
      const suggestions = await this.suggestAvailableSlots(session.user_id!, new Date(pending.targetDate), hour);
      
      // Formatar sugestões com emojis numerados
      const formattedSuggestions = suggestions.length > 0 
        ? suggestions.map((time, idx) => `${idx + 1}️⃣ ${time}`).join('\n')
        : '';

      const suggestionText = formattedSuggestions 
        ? `💡 *Horários disponíveis hoje:*\n${formattedSuggestions}\n\n${suggestions.length + 1}️⃣ Digitar outro horário\n${suggestions.length + 2}️⃣ Cancelar`
        : `Por favor, informe um horário futuro.\n\nExemplo: *14h* ou *14:30*`;

      console.log('[Agenda Debug][WhatsApp] Formatted suggestions:', { 
        count: suggestions.length, 
        formatted: formattedSuggestions 
      });

      return {
        response: `⏰ *Esse horário já passou!*\n\n${suggestionText}`,
        sessionData: {
          ...sessionData,
          conversation_state: 'awaiting_commitment_time',
          pending_commitment: { title: pending.title, category: pending.category, targetDate: pending.targetDate }
        }
      };
    }
    
    // AGORA SIM: Verificar conflitos
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Query conflitos em janela de +/- 1 hora
    const start = new Date(Date.parse(scheduledISO) - 60*60*1000).toISOString();
    const end   = new Date(Date.parse(scheduledISO) + 60*60*1000).toISOString();
    const { data: conflicts } = await supabase
      .from('commitments')
      .select('id,title,scheduled_at')
      .eq('user_id', session.user_id)
      .gte('scheduled_at', start)
      .lte('scheduled_at', end)
      .order('scheduled_at');

    if (conflicts && conflicts.length > 0) {
      console.log('⚠️ CONFLITO DETECTADO:', conflicts);
      
      // Sugerir alternativas (+15min e +60min)
      const suggestions: string[] = [];
      const suggestionTimes: string[] = [];
      
      for (const offset of [15, 60]) {
        const altTime = new Date(Date.parse(scheduledISO) + offset * 60 * 1000);
        const altISO = altTime.toISOString();
        
        // Verificar se essa alternativa está livre
        const { data: altConflicts } = await supabase
          .from('commitments')
          .select('id')
          .eq('user_id', session.user_id)
          .gte('scheduled_at', new Date(Date.parse(altISO) - 60*60*1000).toISOString())
          .lte('scheduled_at', new Date(Date.parse(altISO) + 60*60*1000).toISOString());
        
        if (!altConflicts || altConflicts.length === 0) {
          const formatted = altTime.toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
          });
          suggestions.push(formatted);
          suggestionTimes.push(altISO);
        }
      }
      
      // Montar lista de conflitos
      const conflictList = conflicts.map(c => {
        const time = new Date(c.scheduled_at).toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
        });
        return `• ${c.title} às ${time}`;
      }).join('\n');
      
      // Montar opções
      let optionsText = `⚠️ *Conflito de horário*\n\n📅 Já existe(m):\n${conflictList}\n\n*O que deseja fazer?*\n\n1️⃣ Manter este também (duplo-agendamento)`;
      
      if (suggestions.length > 0) {
        suggestions.forEach((sug, idx) => {
          optionsText += `\n${idx + 2}️⃣ Remarcar para ${sug}`;
        });
      }
      
      optionsText += `\n${suggestions.length + 2}️⃣ Cancelar`;
      
      return {
        response: optionsText,
        sessionData: {
          conversation_state: 'awaiting_commitment_resolution',
          pending_commitment: {
            title: pending.title,
            category: pending.category,
            scheduledISO,
            suggestions: suggestionTimes
          }
        }
      };
    }
    
    // ✅ SEM CONFLITO: Preparar para coleta de detalhes
    console.log('✅ [COMMITMENT-FLOW] No conflicts, preparing detail collection');
    
    const formattedDate = new Date(scheduledISO).toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    });
    
    return {
      response: `✅ *Vou agendar:*\n\n` +
               `📌 ${pending.title}\n` +
               `🗓️ ${formattedDate}\n\n` +
               `📍 Qual o endereço ou local do compromisso?\n` +
               `_Digite "pular" para prosseguir sem detalhes._`,
      sessionData: {
        conversation_state: 'awaiting_commitment_details' as const,
        pending_commitment: {
          title: pending.title,
          category: pending.category,
          scheduledISO: scheduledISO,
          targetDate: scheduledISO,
          detailsStep: 'location' as const
        }
      }
    };
  }


  static async suggestAvailableSlots(
    userId: string,
    targetDate: Date,
    requestedHour?: number
  ): Promise<string[]> {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const dayOfWeek = targetDate.getUTCDay();
    
    // Buscar horário de trabalho do dia
    const { data: workHour } = await supabase
      .from('work_hours')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single();
    
    // Padrão: 8h-19h se não configurado
    const startTime = workHour?.start_time || '08:00';
    const endTime = workHour?.end_time || '19:00';
    
    // Buscar compromissos do dia
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    
    const { data: commitments } = await supabase
      .from('commitments')
      .select('scheduled_at, duration_minutes')
      .eq('user_id', userId)
      .gte('scheduled_at', startOfDay.toISOString())
      .lte('scheduled_at', endOfDay.toISOString())
      .order('scheduled_at');
    
    // Calcular slots livres (intervalos de 1h)
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const slots: string[] = [];
    let currentHour = startH;
    
    while (currentHour < endH) {
      const slotStart = new Date(targetDate);
      slotStart.setUTCHours(currentHour + 3, 0, 0, 0); // +3 BRT→UTC
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(slotEnd.getHours() + 1);
      
      // Verificar conflito
      const hasConflict = commitments?.some(c => {
        const cStart = new Date(c.scheduled_at);
        const cEnd = new Date(cStart.getTime() + (c.duration_minutes || 60) * 60000);
        return (slotStart < cEnd && slotEnd > cStart);
      });
      
      // ✅ Filtrar horários passados
      const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const slotBRT = new Date(slotStart.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      
      if (!hasConflict && slotBRT > nowBRT) {
        slots.push(`${currentHour.toString().padStart(2, '0')}:00`);
      }
      
      currentHour++;
    }
    
    // Ordenar por proximidade ao horário solicitado
    if (requestedHour !== undefined) {
      slots.sort((a, b) => {
        const hourA = parseInt(a.split(':')[0]);
        const hourB = parseInt(b.split(':')[0]);
        const distA = Math.abs(hourA - requestedHour);
        const distB = Math.abs(hourB - requestedHour);
        return distA - distB;
      });
    }
    
    return slots.slice(0, 5); // Máximo 5 sugestões (os mais próximos)
  }

  static async handleCommitmentEditFieldSelection(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const pendingEdit = sessionData.pending_commitment_edit;

    if (!pendingEdit?.available_commitments) {
      return {
        response: '❌ Erro ao processar seleção.',
        sessionData: { ...sessionData, conversation_state: 'idle' }
      };
    }

    const selection = parseInt(messageText.trim());
    const commitments = pendingEdit.available_commitments;

    if (isNaN(selection) || selection < 1 || selection > commitments.length) {
      return {
        response: `❌ Número inválido. Digite um número entre 1 e ${commitments.length}.`,
        sessionData
      };
    }

    const selectedCommitment = commitments[selection - 1];
    const date = new Date(selectedCommitment.scheduled_at);
    const formattedDate = date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });

    const categoryIcons = {
      payment: '💳',
      meeting: '👥',
      appointment: '🏥',
      other: '📌'
    };
    const icon = categoryIcons[selectedCommitment.category as keyof typeof categoryIcons] || '📌';

    const response = `✏️ *Editar Compromisso*\n\n` +
                    `${icon} *${selectedCommitment.title}*\n` +
                    `🗓️ ${formattedDate}\n\n` +
                    `O que deseja editar?\n\n` +
                    `1️⃣ Título\n` +
                    `2️⃣ Data\n` +
                    `3️⃣ Hora\n` +
                    `4️⃣ Categoria\n` +
                    `5️⃣ Cancelar\n\n` +
                    `Digite o número:`;

    const updatedSessionData = {
      ...sessionData,
      conversation_state: 'awaiting_commitment_edit_value' as const,
      pending_commitment_edit: {
        commitment_id: selectedCommitment.id,
        original_commitment: selectedCommitment
      }
    };

    await SessionManager.updateSession(session.id, {
      session_data: updatedSessionData
    });

    return {
      response,
      sessionData: updatedSessionData
    };
  }

  static async handleCommitmentEditValueInput(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const pendingEdit = sessionData.pending_commitment_edit;

    // PHASE 1: Logs detalhados de estado
    console.log('[EDIT VALUE] Session state:', {
      conversation_state: sessionData.conversation_state,
      field: pendingEdit?.field,
      commitment_id: pendingEdit?.commitment_id,
      has_original: !!pendingEdit?.original_commitment,
      messageText: messageText.substring(0, 50)
    });

    // PHASE 3: Detectar contexto inválido de áudio
    if (messageText === '__invalid_audio_context__') {
      const fieldNames: Record<string, string> = {
        'date': 'data',
        'time': 'hora',
        'title': 'título',
        'category': 'categoria'
      };
      const fieldName = fieldNames[pendingEdit?.field as keyof typeof fieldNames] || 'valor';
      
      console.log('[EDIT VALUE] Invalid audio context detected, requesting retry');
      
      // Helper para exemplos de formatação
      const getFieldExample = (field: string): string => {
        const examples: Record<string, string> = {
          'date': 'Exemplos: 13/10/2025, 13/10, hoje, amanhã, dia 15, próxima segunda',
          'time': 'Exemplos: 14:30, 9, 15:00',
          'category': 'Opções: consulta, pagamento, reunião, lembrete, outro'
        };
        return examples[field] || '';
      };
      
      return {
        response: `🎙️ Desculpe, não consegui entender o áudio. Por favor, envie novamente a ${fieldName} que deseja.\n\n${getFieldExample(pendingEdit?.field)}`,
        sessionData
      };
    }

    if (!pendingEdit?.commitment_id || !pendingEdit.field) {
      console.log('[EDIT VALUE INPUT] Missing commitment_id or field');
      return {
        response: '❌ Erro ao processar edição.',
        sessionData: { ...sessionData, conversation_state: 'idle' }
      };
    }

    // PHASE 2: Guard contra usuário enviar comando ao invés de valor + Override para reiniciar fluxos
    const normalized = messageText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Regex tolerantes para comandos durante a edição
    const editCommitmentRegex = /\b(editar|alterar|remarcar)\b\s*(?:o\s+|um\s+|uma\s+)?\b(compromisso|evento|reuniao)\b/;
    const cancelCommitmentRegex = /\b(cancelar|excluir|apagar)\b\s*(?:o\s+|um\s+|uma\s+)?\b(compromisso|evento|reuniao)\b/;

    // Overrides: se o usuário enviar um comando de editar/cancelar enquanto aguardamos o VALOR, reiniciamos o fluxo correto
    if (pendingEdit.field) {
      if (editCommitmentRegex.test(normalized)) {
        console.log('[EDIT VALUE] Override: received edit command while in value input - restarting list');
        const filters = parseCommandFilters(messageText);
        return await this.handleEditCommitmentCommand(session, filters);
      }
      if (cancelCommitmentRegex.test(normalized)) {
        console.log('[EDIT VALUE] Override: received cancel command while in value input - restarting cancel flow');
        const filters = parseCommandFilters(messageText);
        return await this.handleCancelCommitmentCommand(session, filters);
      }
    }

    // Fallback de guard: comandos genéricos que não batem nos regex acima
    const isCommandText = normalized.includes('editar compromisso') || 
                          normalized.includes('editar evento') ||
                          normalized === 'editar';
    
    if (isCommandText && pendingEdit.field) {
      console.log('[EDIT VALUE] User sent command instead of value, prompting for correct input');
      
      const fieldPrompts: Record<string, string> = {
        'date': 'a data',
        'time': 'a hora',
        'title': 'o título',
        'category': 'a categoria'
      };
      const fieldName = fieldPrompts[pendingEdit.field] || 'o valor';
      
      const getFieldExample = (field: string): string => {
        const examples: Record<string, string> = {
          'date': 'Exemplos:\n• 13/10/2025\n• 13/10\n• hoje\n• amanhã\n• dia 15\n• próxima segunda\n• semana que vem',
          'time': 'Exemplos:\n• 14:30\n• 9h\n• 15:00',
          'title': 'Digite o novo título do compromisso',
          'category': 'Opções:\n• consulta\n• pagamento\n• reunião\n• lembrete\n• outro'
        };
        return examples[field] || '';
      };
      
      return {
        response: `Você já escolheu editar ${fieldName}. Por favor, informe ${fieldName} que deseja:\n\n${getFieldExample(pendingEdit.field)}`,
        sessionData
      };
    }

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      let updateData: any = {};
      const field = pendingEdit.field;
      const newValue = messageText.trim();

      if (field === 'title') {
        console.log('[EDIT VALUE] Updating title to:', newValue);
        updateData.title = newValue;
      } else if (field === 'date') {
        console.log('[EDIT VALUE] Parsing date:', newValue);
        const parsedDate = DateParser.parseDate(newValue);
        console.log('[EDIT VALUE] Date parsing result:', { input: newValue, output: parsedDate });
        
        if (!parsedDate) {
          return {
            response: '❌ Data inválida.\n\nExemplos:\n• 13/10/2025\n• 13/10\n• hoje\n• amanhã\n• dia 15\n• próxima segunda\n• semana que vem',
            sessionData
          };
        }
        // Manter a hora existente
        const oldDate = new Date(pendingEdit.original_commitment.scheduled_at);
        const [year, month, day] = parsedDate.split('-').map(Number);
        const newScheduled = new Date(Date.UTC(
          year,
          month - 1,
          day,
          oldDate.getUTCHours(),
          oldDate.getUTCMinutes()
        ));
        updateData.scheduled_at = newScheduled.toISOString();
        console.log('[EDIT VALUE] New scheduled_at (date update):', updateData.scheduled_at);
      } else if (field === 'time') {
        console.log('[EDIT VALUE] Parsing time:', newValue);
        const timeMatch = newValue.match(/(\d{1,2}):?(\d{2})?/);
        
        if (!timeMatch) {
          return {
            response: '❌ Hora inválida.\n\nExemplos:\n• 14:30\n• 9\n• 15:00\n• 8h30',
            sessionData
          };
        }
        const hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2] || '0');
        console.log('[EDIT VALUE] Time parsing result:', { input: newValue, hours: hour, minutes: minute });
        
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          return {
            response: '❌ Hora inválida (0-23h e 0-59min).\n\nExemplos:\n• 14:30\n• 9\n• 15:00',
            sessionData
          };
        }
        
        // Manter a data existente
        const oldDate = new Date(pendingEdit.original_commitment.scheduled_at);
        const newScheduled = new Date(Date.UTC(
          oldDate.getUTCFullYear(),
          oldDate.getUTCMonth(),
          oldDate.getUTCDate(),
          hour + 3, // Converter de Brasília para UTC
          minute
        ));
        updateData.scheduled_at = newScheduled.toISOString();
        console.log('[EDIT VALUE] New scheduled_at (time update):', updateData.scheduled_at);
      } else if (field === 'category') {
        console.log('[EDIT VALUE] Parsing category:', newValue);
        const normalized = newValue.toLowerCase();
        // PHASE 2: expandido com mapeamentos diretos inglês-inglês
        const categoryMap: Record<string, string> = {
          'pagamento': 'payment',
          'payment': 'payment',
          'reuniao': 'meeting',
          'reunião': 'meeting',
          'meeting': 'meeting',
          'consulta': 'appointment',
          'appointment': 'appointment',
          'lembrete': 'reminder',
          'reminder': 'reminder',
          'outro': 'other',
          'outros': 'other',
          'other': 'other'
        };
        updateData.category = categoryMap[normalized] || 'other';
        console.log('[EDIT VALUE] Category parsing result:', { input: newValue, output: updateData.category });
      }

      console.log('[EDIT VALUE] Updating commitment with data:', updateData);
      const { error } = await supabase
        .from('commitments')
        .update(updateData)
        .eq('id', pendingEdit.commitment_id)
        .eq('user_id', session.user_id);

      if (error) {
        console.error('[EDIT VALUE] Update error:', error);
        throw error;
      }

      console.log('[EDIT VALUE] ✅ Commitment updated successfully');

      // 🆕 Sincronizar com Google Calendar
      const commitmentIdToSync = pendingEdit.commitment_id;
      if (commitmentIdToSync) {
        await syncWithGoogleCalendar('update', commitmentIdToSync, session.user_id!);
      }

      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment_edit: undefined
        }
      });

      return {
        response: `✅ *Compromisso atualizado com sucesso!*`,
        sessionData: { ...sessionData, conversation_state: 'idle' }
      };
    } catch (error) {
      console.error('[EDIT VALUE] Error updating commitment:', error);
      return {
        response: '❌ Erro ao atualizar compromisso.',
        sessionData: { ...sessionData, conversation_state: 'idle' }
      };
    }
  }

  static async handleCommitmentCancelSelection(session: Session, messageText: string): Promise<{ response: string, sessionData: SessionData }> {
    const sessionData = session.session_data || {};
    const pendingEdit = sessionData.pending_commitment_edit;

    if (!pendingEdit?.available_commitments) {
      return {
        response: '❌ Erro ao processar seleção.',
        sessionData: { ...sessionData, conversation_state: 'idle' }
      };
    }

    const commitments = pendingEdit.available_commitments;
    const input = messageText.trim();
    
    // ✨ Parseamento de seleção múltipla
    const parseSelection = (text: string): number[] => {
      const indices: number[] = [];
      
      // Suporta: "1,3,5" ou "2-4" ou combinados "1,3-5,7"
      const parts = text.split(',').map(p => p.trim());
      
      for (const part of parts) {
        if (part.includes('-')) {
          // Intervalo: "2-4" = [2,3,4]
          const [start, end] = part.split('-').map(n => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end) && start <= end) {
            for (let i = start; i <= end; i++) {
              if (!indices.includes(i)) indices.push(i);
            }
          }
        } else {
          // Número único: "3"
          const num = parseInt(part);
          if (!isNaN(num) && !indices.includes(num)) {
            indices.push(num);
          }
        }
      }
      
      return indices.sort((a, b) => a - b);
    };
    
    const selectedIndices = parseSelection(input);
    
    if (selectedIndices.length === 0) {
      return {
        response: `❌ Seleção inválida.\n\n💡 Exemplos válidos:\n• 1\n• 1,3,5\n• 2-4\n• 1,3-5,7`,
        sessionData
      };
    }
    
    // Validar que todos os índices são válidos
    const invalid = selectedIndices.filter(i => i < 1 || i > commitments.length);
    if (invalid.length > 0) {
      return {
        response: `❌ Números inválidos: ${invalid.join(', ')}\n\nDigite entre 1 e ${commitments.length}.`,
        sessionData
      };
    }

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      // Selecionar compromissos
      const selectedCommitments = selectedIndices.map(i => commitments[i - 1]);
      console.log(`🗑️ Cancelando ${selectedCommitments.length} compromisso(s):`, selectedCommitments.map(c => c.title));
      
      // 🆕 CORREÇÃO CRÍTICA: Sincronizar exclusão ANTES de deletar do banco
      console.log(`[WHATSAPP-AGENT] 📅 Iniciando sync de exclusão com Google Calendar`);
      for (const commitment of selectedCommitments) {
        console.log(`[WHATSAPP-AGENT] 📅 Syncing delete for: ${commitment.title} (ID: ${commitment.id}, google_event_id: ${commitment.google_event_id || 'none'})`);
        await syncWithGoogleCalendar('delete', commitment.id, session.user_id!, commitment.google_event_id || undefined);
      }
      console.log(`[WHATSAPP-AGENT] ✅ Sync de exclusão concluído`);
      
      // Agora deletar do banco
      const ids = selectedCommitments.map(c => c.id);
      const { error } = await supabase
        .from('commitments')
        .delete()
        .in('id', ids)
        .eq('user_id', session.user_id);

      if (error) throw error;

      console.log(`[WHATSAPP-AGENT] ✅ ${ids.length} compromisso(s) excluído(s) do banco`);

      await SessionManager.updateSession(session.id, {
        session_data: {
          ...sessionData,
          conversation_state: 'idle',
          pending_commitment_edit: undefined
        }
      });

      // Mensagem de sucesso
      const titles = selectedCommitments.map(c => `• ${c.title}`).join('\n');
      const count = selectedCommitments.length;
      
      return {
        response: `✅ *${count} compromisso${count > 1 ? 's' : ''} cancelado${count > 1 ? 's' : ''} com sucesso!*\n\n${titles}`,
        sessionData: { ...sessionData, conversation_state: 'idle' }
      };
    } catch (error) {
      console.error('Error canceling commitments:', error);
      return {
        response: '❌ Erro ao cancelar compromisso(s).',
        sessionData: { ...sessionData, conversation_state: 'idle' }
      };
    }
  }

  // =====================================================
  // 🔄 CONTAS FIXAS / RECORRENTES
  // =====================================================

  /**
   * Cria uma transação recorrente (conta fixa)
   */
  static async createRecurringTransaction(
    userId: string,
    data: {
      amount: number;
      title: string;
      dayOfMonth: number | null;
      type: 'income' | 'expense';
      frequency: string;
    }
  ): Promise<{ response: string; sessionData: SessionData }> {
    try {
      console.log('🔄 [RECURRING] Creating recurring transaction:', data);
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Buscar organization_id do usuário
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .maybeSingle();

      // Calcular próximo vencimento
      const today = getBrazilTime();
      const currentDay = today.getUTCDate();
      const dayOfMonth = data.dayOfMonth || currentDay;
      
      let startDate = new Date(today);
      startDate.setUTCDate(dayOfMonth);
      
      // Se o dia já passou este mês, começar no próximo
      if (dayOfMonth <= currentDay) {
        startDate.setUTCMonth(startDate.getUTCMonth() + 1);
      }
      
      const startDateStr = startDate.toISOString().split('T')[0];

      // Criar transação recorrente
      const { data: recurring, error } = await supabase
        .from('recurring_transactions')
        .insert({
          user_id: userId,
          organization_id: orgMember?.organization_id || null,
          title: data.title,
          amount: data.amount,
          type: data.type,
          frequency: 'monthly',
          day_of_month: dayOfMonth,
          start_date: startDateStr,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Criar primeira instância para o próximo vencimento
      const { error: instanceError } = await supabase
        .from('recurring_instances')
        .insert({
          recurring_transaction_id: recurring.id,
          due_date: startDateStr,
          amount: data.amount,
          status: 'scheduled'
        });

      if (instanceError) {
        console.warn('⚠️ Failed to create first instance:', instanceError);
      }

      const formattedDate = startDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long'
      });

      return {
        response: `✅ *Conta fixa cadastrada com sucesso!*\n\n` +
                 `📌 ${data.title}\n` +
                 `💵 R$ ${data.amount.toFixed(2)}\n` +
                 `📅 Todo dia ${dayOfMonth}\n` +
                 `⏰ Próximo vencimento: ${formattedDate}\n\n` +
                 `💡 Você será lembrado antes do vencimento!\n\n` +
                 `_Digite "minhas contas" para ver todas._`,
        sessionData: { conversation_state: 'idle' }
      };

    } catch (error) {
      console.error('❌ [RECURRING] Error creating recurring transaction:', error);
      return {
        response: `❌ Erro ao cadastrar conta fixa.\n\nTente novamente ou digite "ajuda".`,
        sessionData: { conversation_state: 'idle' }
      };
    }
  }

  /**
   * Lista transações recorrentes e próximos vencimentos
   */
  static async listRecurringTransactions(userId: string): Promise<{ response: string; sessionData: SessionData }> {
    try {
      console.log('🔄 [RECURRING] Listing recurring transactions for user:', userId);
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Buscar transações recorrentes ativas
      const { data: recurring, error } = await supabase
        .from('recurring_transactions')
        .select('*, recurring_instances(*)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('title');

      if (error) throw error;

      if (!recurring || recurring.length === 0) {
        return {
          response: `📋 *Você não tem contas fixas cadastradas.*\n\n` +
                   `Para adicionar, digite:\n` +
                   `• "conta fixa 150 internet dia 10"\n` +
                   `• "assinatura 50 netflix"`,
          sessionData: { conversation_state: 'idle' }
        };
      }

      // Buscar instâncias pendentes
      const today = getBrazilTime();
      const todayStr = today.toISOString().split('T')[0];
      
      const { data: pendingInstances } = await supabase
        .from('recurring_instances')
        .select('*, recurring_transactions(title, amount, type)')
        .in('recurring_transaction_id', recurring.map(r => r.id))
        .in('status', ['scheduled', 'postponed'])
        .gte('due_date', todayStr)
        .order('due_date')
        .limit(10);

      let response = `📋 *Suas Contas Fixas*\n\n`;
      
      // Resumo das contas
      let totalMonthly = 0;
      recurring.forEach((r, index) => {
        const emoji = r.type === 'income' ? '💰' : '💸';
        const dayText = r.day_of_month ? `dia ${r.day_of_month}` : 'mensal';
        totalMonthly += Number(r.amount);
        response += `${index + 1}. ${emoji} *${r.title}*\n   R$ ${Number(r.amount).toFixed(2)} (${dayText})\n\n`;
      });
      
      response += `━━━━━━━━━━━━━━━━━━\n`;
      response += `💵 *Total mensal:* R$ ${totalMonthly.toFixed(2)}\n\n`;

      // Próximos vencimentos
      if (pendingInstances && pendingInstances.length > 0) {
        response += `⏰ *Próximos vencimentos:*\n`;
        
        pendingInstances.slice(0, 5).forEach(inst => {
          const dueDate = new Date(inst.due_date + 'T12:00:00');
          const formatted = dueDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short'
          });
          const title = inst.recurring_transactions?.title || 'Conta';
          const status = inst.status === 'postponed' ? ' _(adiado)_' : '';
          response += `• ${formatted}: ${title} - R$ ${Number(inst.amount).toFixed(2)}${status}\n`;
        });
      }
      
      response += `\n💡 *Comandos:*\n`;
      response += `• "paguei [nome]" - dar baixa\n`;
      response += `• "adiar [nome] para dia X"`;

      return {
        response,
        sessionData: { conversation_state: 'idle' }
      };

    } catch (error) {
      console.error('❌ [RECURRING] Error listing recurring transactions:', error);
      return {
        response: `❌ Erro ao listar contas fixas.`,
        sessionData: { conversation_state: 'idle' }
      };
    }
  }

  /**
   * Marca uma instância de conta recorrente como paga
   */
  static async markRecurringInstanceAsPaid(userId: string, searchTerm: string): Promise<{ response: string; sessionData: SessionData }> {
    try {
      console.log('🔄 [RECURRING] Marking as paid:', searchTerm);
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Buscar instância pendente que corresponda ao termo de busca
      const { data: instances, error } = await supabase
        .from('recurring_instances')
        .select('*, recurring_transactions!inner(id, title, amount, type, category_id, user_id, organization_id)')
        .eq('recurring_transactions.user_id', userId)
        .in('status', ['scheduled', 'postponed'])
        .ilike('recurring_transactions.title', `%${searchTerm}%`)
        .order('due_date')
        .limit(1);

      if (error) throw error;

      if (!instances || instances.length === 0) {
        return {
          response: `❌ Não encontrei conta pendente com "${searchTerm}".\n\n` +
                   `Digite "minhas contas" para ver as contas fixas.`,
          sessionData: { conversation_state: 'idle' }
        };
      }

      const instance = instances[0];
      const recurring = instance.recurring_transactions;

      // Criar transação efetiva
      const today = getBrazilTime();
      const todayStr = today.toISOString().split('T')[0];

      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          organization_id: recurring.organization_id,
          title: recurring.title,
          amount: instance.amount,
          type: recurring.type,
          category_id: recurring.category_id,
          date: todayStr,
          source: 'whatsapp',
          description: `Conta fixa - ${recurring.title}`
        })
        .select()
        .single();

      if (txError) throw txError;

      // Atualizar instância como paga
      const { error: updateError } = await supabase
        .from('recurring_instances')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          transaction_id: transaction.id
        })
        .eq('id', instance.id);

      if (updateError) throw updateError;

      // Criar próxima instância
      const nextDueDate = new Date(instance.due_date);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      
      await supabase
        .from('recurring_instances')
        .insert({
          recurring_transaction_id: recurring.id,
          due_date: nextDueDate.toISOString().split('T')[0],
          amount: recurring.amount,
          status: 'scheduled'
        });

      const emoji = recurring.type === 'income' ? '💰' : '💸';
      const typeText = recurring.type === 'income' ? 'Receita' : 'Despesa';

      return {
        response: `✅ *${recurring.title} - Baixa realizada!*\n\n` +
                 `${emoji} ${typeText} registrada: R$ ${Number(instance.amount).toFixed(2)}\n` +
                 `📅 Data: Hoje\n\n` +
                 `🔄 Próximo vencimento: ${nextDueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`,
        sessionData: { conversation_state: 'idle' }
      };

    } catch (error) {
      console.error('❌ [RECURRING] Error marking as paid:', error);
      return {
        response: `❌ Erro ao dar baixa na conta.\n\nTente novamente.`,
        sessionData: { conversation_state: 'idle' }
      };
    }
  }

  /**
   * Adia uma instância de conta recorrente para outro dia
   */
  static async postponeRecurringInstance(userId: string, searchTerm: string, newDay: number): Promise<{ response: string; sessionData: SessionData }> {
    try {
      console.log('🔄 [RECURRING] Postponing:', searchTerm, 'to day', newDay);
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Buscar instância pendente
      const { data: instances, error } = await supabase
        .from('recurring_instances')
        .select('*, recurring_transactions!inner(id, title, user_id)')
        .eq('recurring_transactions.user_id', userId)
        .in('status', ['scheduled', 'postponed'])
        .ilike('recurring_transactions.title', `%${searchTerm}%`)
        .order('due_date')
        .limit(1);

      if (error) throw error;

      if (!instances || instances.length === 0) {
        return {
          response: `❌ Não encontrei conta pendente com "${searchTerm}".\n\n` +
                   `Digite "minhas contas" para ver as contas fixas.`,
          sessionData: { conversation_state: 'idle' }
        };
      }

      const instance = instances[0];
      const recurring = instance.recurring_transactions;

      // Calcular nova data
      const currentDue = new Date(instance.due_date);
      let newDueDate = new Date(currentDue);
      newDueDate.setDate(newDay);
      
      // Se o novo dia já passou neste mês, vai para o próximo
      const today = getBrazilTime();
      if (newDueDate < today) {
        newDueDate.setMonth(newDueDate.getMonth() + 1);
      }

      const newDueDateStr = newDueDate.toISOString().split('T')[0];

      // Atualizar instância
      const { error: updateError } = await supabase
        .from('recurring_instances')
        .update({
          due_date: newDueDateStr,
          status: 'postponed',
          notes: `Adiado de ${instance.due_date} para ${newDueDateStr}`
        })
        .eq('id', instance.id);

      if (updateError) throw updateError;

      const formattedDate = newDueDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long'
      });

      return {
        response: `✅ *${recurring.title} - Adiado!*\n\n` +
                 `📅 Novo vencimento: ${formattedDate}\n\n` +
                 `💡 Você será lembrado antes da nova data.`,
        sessionData: { conversation_state: 'idle' }
      };

    } catch (error) {
      console.error('❌ [RECURRING] Error postponing:', error);
      return {
        response: `❌ Erro ao adiar conta.\n\nTente novamente.`,
        sessionData: { conversation_state: 'idle' }
      };
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🔍 [AGENT] ENV check:", {
    SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    WHATSAPP_ACCESS_TOKEN: !!Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
    WHATSAPP_PHONE_NUMBER_ID: !!Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"),
  });

  try {
    const body = await req.json();
    const { phone_number, message, action } = body;
    
    // Idempotency check: skip if this message_id was already processed
    const msgId = message?.id;
    if (msgId && msgId !== 'unknown') {
      const now = Date.now();
      const lastSeen = processedMessages.get(msgId);
      if (lastSeen && (now - lastSeen < AGENT_DEDUPE_WINDOW)) {
        console.log(`🚫 [AGENT] Duplicate message_id ignored: ${msgId.substring(0, 10)}***`);
        return new Response(JSON.stringify({ success: true, response: 'duplicate_ignored' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      processedMessages.set(msgId, now);
      // Cleanup old entries
      for (const [id, ts] of processedMessages.entries()) {
        if (now - ts > AGENT_DEDUPE_WINDOW) processedMessages.delete(id);
      }
    }

    // ✨ FASE 5: Handle send-validation-code action
    if (action === 'send-validation-code') {
      const debug = body.debug || false; // ✅ Captura flag de debug
      
      console.log('[SEND-VALIDATION-CODE] 📱 Processing validation code request');
      console.log('[SEND-VALIDATION-CODE] 🐛 Debug mode:', debug);
      
      if (!phone_number || typeof phone_number !== 'string') {
        throw new Error('Phone number is required');
      }

      // Normalizar telefone para formato E.164
      let cleanPhone = phone_number.replace(/[\s\-()]/g, '');
      
      // 🔥 CORREÇÃO: Detectar padrão brasileiro com +1 (erro comum de seleção de país)
      // Se +1 seguido de 11 dígitos começando com DDDs brasileiros (11-99)
      if (/^\+1(\d{11})$/.test(cleanPhone)) {
        const digits = cleanPhone.substring(2); // Remove +1
        // DDDs brasileiros: 11-19, 21-28, 31-35, 41-49, 51-55, 61-69, 71-79, 81-89, 91-99
        if (/^(1[1-9]|2[1-8]|3[1-5]|4[1-9]|5[1-5]|6[1-9]|7[1-9]|8[1-9]|9[1-9])/.test(digits)) {
          cleanPhone = '+55' + digits;
          console.log('[SEND-VALIDATION-CODE] 🔄 Detected Brazilian number with +1, converted to:', cleanPhone);
        }
      }
      
      // Se tem 11 dígitos (DDD + 9 dígitos Brasil), adicionar +55
      if (/^\d{11}$/.test(cleanPhone)) {
        cleanPhone = '+55' + cleanPhone;
      }
      // Se tem 13 dígitos começando com 55, adicionar +
      else if (/^\d{13}$/.test(cleanPhone) && cleanPhone.startsWith('55')) {
        cleanPhone = '+' + cleanPhone;
      }
      // Se já tem + no começo, manter
      else if (cleanPhone.startsWith('+')) {
        // OK
      }
      // Outros formatos internacionais
      else if (/^\d{10,15}$/.test(cleanPhone)) {
        cleanPhone = '+' + cleanPhone;
      }

      console.log('[SEND-VALIDATION-CODE] 📞 Clean phone:', cleanPhone);

      // Gerar código de 6 dígitos
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('[SEND-VALIDATION-CODE] 🔐 Generated code:', code);
      
      // Enviar via WhatsApp Business API
      const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`;
      const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

      console.log('[SEND-VALIDATION-CODE] 📤 Calling WhatsApp API...');
      const response = await fetch(WHATSAPP_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: {
            body: `🔐 *Código de Verificação Aligator*\n\nSeu código: *${code}*\n\nVálido por 30 minutos.\n\n_Não compartilhe este código._`
          }
        })
      });

      console.log('[SEND-VALIDATION-CODE] 📥 WhatsApp API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SEND-VALIDATION-CODE] ❌ WhatsApp API error:', errorText);
        throw new Error(`WhatsApp API error: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('[SEND-VALIDATION-CODE] ✅ WhatsApp API response:', responseData);

      // Salvar no banco de dados
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
      console.log('[SEND-VALIDATION-CODE] 💾 Salvando no banco de dados...');
      const { error: dbError } = await supabase
        .from('whatsapp_validation_codes')
        .insert({
          phone_number: cleanPhone,
          code,
          expires_at: expiresAt.toISOString(),
          used: false
        });

      if (dbError) {
        console.error('[SEND-VALIDATION-CODE] ❌ DB Error:', dbError);
        throw dbError;
      }

      console.log('[SEND-VALIDATION-CODE] ✅ Code sent and saved successfully');
      
      // Se debug mode, retorna o código na resposta
      return new Response(JSON.stringify({ 
        success: true, 
        code_sent: true,
        debug_mode: debug,
        code: debug ? code : undefined // Só retorna código em debug mode
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✨ Handle validate-code action
    if (action === 'validate-code') {
      console.log('[VALIDATE-CODE] 📱 Processing code validation request');
      
      if (!phone_number || typeof phone_number !== 'string') {
        throw new Error('Phone number is required');
      }
      
      if (!body.code || typeof body.code !== 'string') {
        throw new Error('Code is required');
      }

      // Normalizar telefone para formato E.164 (mesmo formato usado no save)
      let cleanPhone = phone_number.replace(/[\s\-()]/g, '');
      
      // 🔥 CORREÇÃO: Detectar padrão brasileiro com +1 (erro comum de seleção de país)
      // Se +1 seguido de 11 dígitos começando com DDDs brasileiros (11-99)
      if (/^\+1(\d{11})$/.test(cleanPhone)) {
        const digits = cleanPhone.substring(2); // Remove +1
        // DDDs brasileiros: 11-19, 21-28, 31-35, 41-49, 51-55, 61-69, 71-79, 81-89, 91-99
        if (/^(1[1-9]|2[1-8]|3[1-5]|4[1-9]|5[1-5]|6[1-9]|7[1-9]|8[1-9]|9[1-9])/.test(digits)) {
          cleanPhone = '+55' + digits;
          console.log('[VALIDATE-CODE] 🔄 Detected Brazilian number with +1, converted to:', cleanPhone);
        }
      }
      
      // Se tem 11 dígitos (DDD + 9 dígitos Brasil), adicionar +55
      if (/^\d{11}$/.test(cleanPhone)) {
        cleanPhone = '+55' + cleanPhone;
      }
      // Se tem 13 dígitos começando com 55, adicionar +
      else if (/^\d{13}$/.test(cleanPhone) && cleanPhone.startsWith('55')) {
        cleanPhone = '+' + cleanPhone;
      }
      // Se já tem + no começo, manter
      else if (cleanPhone.startsWith('+')) {
        // OK
      }
      // Outros formatos internacionais
      else if (/^\d{10,15}$/.test(cleanPhone)) {
        cleanPhone = '+' + cleanPhone;
      }

      console.log('[VALIDATE-CODE] 📞 Clean phone:', cleanPhone);
      console.log('[VALIDATE-CODE] 🔐 Code to validate:', body.code);

      // Validar código usando service_role (ignora RLS)
      const { data: codeValidation, error: validationError } = await supabase
        .from('whatsapp_validation_codes')
        .select('*')
        .eq('phone_number', cleanPhone)
        .eq('code', body.code)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (validationError) {
        console.error('[VALIDATE-CODE] ❌ Validation error:', validationError);
        throw validationError;
      }

      if (!codeValidation) {
        console.log('[VALIDATE-CODE] ❌ Code invalid or expired');
        return new Response(JSON.stringify({
          valid: false,
          message: 'Código inválido ou expirado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[VALIDATE-CODE] ✅ Code is valid');

      // 🔥 CRIAR SESSÃO WHATSAPP AUTOMATICAMENTE (se tiver user_id no código)
      if (codeValidation.user_id) {
        console.log('[VALIDATE-CODE] 🔐 Creating WhatsApp session for user:', codeValidation.user_id);
        
        // Limpar sessões antigas para este número (evitar duplicatas)
        const phoneVariants = cleanPhone.startsWith('+')
          ? [cleanPhone, cleanPhone.substring(1)]
          : [cleanPhone, '+' + cleanPhone];

        await supabase
          .from('whatsapp_sessions')
          .delete()
          .or(`phone_number.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`);

        // Criar nova sessão
        const { error: sessionError } = await supabase
          .from('whatsapp_sessions')
          .insert({
            user_id: codeValidation.user_id,
            phone_number: cleanPhone,
            expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 10 ANOS - sessão permanente
          });

        if (sessionError) {
          console.error('[VALIDATE-CODE] ⚠️ Failed to create WhatsApp session:', sessionError);
        } else {
          console.log('[VALIDATE-CODE] ✅ WhatsApp session created successfully');
        }
      }

      return new Response(JSON.stringify({
        valid: true,
        code_id: codeValidation.id,
        message: 'Código válido'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
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
      console.log('Ignoring request with placeholder/invalid phone:', phone_number);
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
        response: `👋 *Bem-vinda à Dona Wilma!*\n\n` +
                 `Para usar este WhatsApp, você precisa:\n\n` +
                 `*1.* Criar sua conta (se ainda não tem):\n` +
                 `🔗 https://donawilma.lovable.app\n\n` +
                 `*2.* Vincular seu WhatsApp:\n` +
                 `• Acesse *Perfil* na plataforma\n` +
                 `• Preencha o campo *WhatsApp* com: ${cleanPhone}\n` +
                 `• Salve as alterações\n\n` +
                 `Depois é só voltar aqui e começar a usar! 🚀`
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

    // CRITICAL: Se profile existe mas não há sessão validada, NÃO criar automaticamente
    // Usuário DEVE validar pelo site /boas-vindas com código numérico
    if (!session || !session.user_id) {
      console.log('⚠️ Profile exists but no validated session - user must validate via /boas-vindas');
      
      // Enviar mensagem orientando o usuário a validar pelo site
      const welcomeMessage = `👋 Olá! Seu número está cadastrado mas ainda não foi validado.\n\n` +
        `Para começar a usar o sistema:\n` +
        `1️⃣ Acesse: https://donawilma.lovable.app/boas-vindas\n` +
        `2️⃣ Digite seu número e clique em "Enviar código"\n` +
        `3️⃣ Digite aqui o código de 6 dígitos que você vai receber\n\n` +
        `Após validar, você poderá usar todos os comandos! 🎉`;
      
      await sendWhatsAppMessage(cleanPhone, welcomeMessage);
      
      return new Response(JSON.stringify({
        success: true,
        response: welcomeMessage,
        requiresValidation: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
          
          // Mensagem de boas-vindas completa e amigável
          return new Response(JSON.stringify({
            success: true,
            response: `🎉 *Bem-vinda à Dona Wilma!*\n\n` +
                     `✅ WhatsApp conectado com sucesso!\n\n` +
                     `📋 *COMO USAR:*\n` +
                     `💸 *Finanças:* "gastei 50" ou "recebi 2000"\n` +
                     `📅 *Agenda:* "marcar dentista amanhã 14h"\n` +
                     `📊 *Relatórios:* "meus gastos este mês"\n\n` +
                     `💡 *Dica:* Digite *"ajuda"* para ver todos os comandos!\n\n` +
                     `Estou aqui para facilitar sua vida financeira 🚀`
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
                       `https://donawilma.lovable.app`
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

    // Resposta formatada para Meta WhatsApp Business API
    const responseBody = {
      success: true,
      response: result.response,
      transactionId: result.transactionId,
      buttons: result.buttons
    };
    
    console.log('✅ Response:', { 
      length: result.response?.length,
      stop: true 
    });
    
    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [AGENT] Error in WhatsApp Agent:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
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