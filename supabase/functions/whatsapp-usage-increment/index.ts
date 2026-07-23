// Incrementa o contador de mensagens WhatsApp cobráveis para um usuário.
// Chamado pelo n8n/Make/backend com header `x-webhook-secret: WHATSAPP_USAGE_SECRET`.
//
// Body:
//  { user_id: uuid, qtd?: number = 1 }
//
// Retorna: { qtd_atual, limite, percentual, estado, bloqueado, ciclo_inicio, ciclo_fim }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("WHATSAPP_USAGE_SECRET");
  const provided = req.headers.get("x-webhook-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { user_id?: string; qtd?: number };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = payload?.user_id;
  const qtd = Math.max(1, Math.floor(Number(payload?.qtd ?? 1)));

  if (!userId || typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "user_id_required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("increment_usage_mensagens", {
    p_user_id: userId,
    p_qtd: qtd,
  });

  if (error) {
    console.error("[whatsapp-usage-increment] rpc error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
