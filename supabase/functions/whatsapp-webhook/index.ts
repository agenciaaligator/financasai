import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppMessage {
  from: string;
  text: string;
  timestamp: string;
}

interface Transaction {
  title: string;
  amount: number;
  type: 'income' | 'expense';
  description?: string;
  date: string;
  source: 'whatsapp';
  user_id: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function parseTransactionFromText(text: string): Partial<Transaction> | null {
  // Padrões para identificar transações
  const patterns = [
    // "gasto 50 mercado" ou "receita 1000 salario"
    /^(gasto|receita|despesa|ganho)\s+(\d+(?:[\.,]\d{2})?)\s+(.+)$/i,
    // "50 mercado" (assume despesa)
    /^(\d+(?:[\.,]\d{2})?)\s+(.+)$/i,
    // "+1000 salario" (receita) ou "-50 mercado" (despesa)
    /^([+-])(\d+(?:[\.,]\d{2})?)\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = text.trim().match(pattern);
    if (match) {
      let type: 'income' | 'expense' = 'expense';
      let amount: number;
      let title: string;

      if (match[1] && match[2] && match[3]) {
        // Primeiro padrão: "gasto 50 mercado"
        const action = match[1].toLowerCase();
        type = ['receita', 'ganho'].includes(action) ? 'income' : 'expense';
        amount = parseFloat(match[2].replace(',', '.'));
        title = match[3];
      } else if (match[1] && match[2] && !match[3]) {
        // Segundo padrão: "50 mercado"
        amount = parseFloat(match[1].replace(',', '.'));
        title = match[2];
        type = 'expense'; // Assume despesa por padrão
      } else if (match[1] && match[2] && match[3]) {
        // Terceiro padrão: "+1000 salario"
        type = match[1] === '+' ? 'income' : 'expense';
        amount = parseFloat(match[2].replace(',', '.'));
        title = match[3];
      } else {
        continue;
      }

      return {
        title: title.trim(),
        amount,
        type,
        date: new Date().toISOString().split('T')[0],
        source: 'whatsapp'
      };
    }
  }

  return null;
}

async function findUserByPhone(phone: string) {
  // Buscar usuário pelo telefone nos metadados
  const { data: users } = await supabase.auth.admin.listUsers();
  
  const user = users?.users?.find(u => 
    u.user_metadata?.phone === phone || 
    u.phone === phone
  );
  
  return user;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));

    // Verificar se é uma mensagem de texto
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const text = message.text?.body;

      if (text) {
        console.log(`Message from ${from}: ${text}`);

        // Tentar encontrar o usuário pelo telefone
        const user = await findUserByPhone(from);
        
        if (!user) {
          console.log(`User not found for phone: ${from}`);
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'Usuário não encontrado. Registre-se primeiro no app.' 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Tentar interpretar a mensagem como uma transação
        const transaction = parseTransactionFromText(text);
        
        if (transaction) {
          // Inserir transação no banco
          const { data, error } = await supabase
            .from('transactions')
            .insert([{
              ...transaction,
              user_id: user.id
            }])
            .select()
            .single();

          if (error) {
            console.error('Error inserting transaction:', error);
            return new Response(JSON.stringify({ 
              success: false, 
              message: 'Erro ao salvar transação' 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log('Transaction created:', data);
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: `Transação registrada: ${transaction.type === 'income' ? 'Receita' : 'Despesa'} de R$ ${transaction.amount.toFixed(2)} - ${transaction.title}`,
            transaction: data
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // Mensagem não reconhecida como transação
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'Mensagem não reconhecida. Use formatos como: "gasto 50 mercado", "receita 1000 salario", "+100 freelance" ou "-30 combustível"'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Verificação de webhook do WhatsApp
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === 'WHATSAPP_VERIFY_TOKEN') {
        console.log('Webhook verified');
        return new Response(challenge, { status: 200 });
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Webhook received' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in WhatsApp webhook:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);