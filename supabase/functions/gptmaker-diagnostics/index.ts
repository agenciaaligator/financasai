import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Small helper to safely parse JSON error bodies
async function safeParseJSON(resp: Response): Promise<any | null> {
  try {
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const reqId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const nowIso = new Date().toISOString();

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // Allow overriding via body for testing, otherwise use Supabase secrets
    const token = (body.token ?? Deno.env.get("GPT_MAKER_TOKEN") ?? "").trim();
    const channelId = (body.channelId ?? Deno.env.get("GPT_MAKER_CHANNEL_ID") ?? "").trim();

    // We deliberately use an invalid phone to avoid sending real messages while testing
    const invalidPhone = body.testPhone ?? "00000000000"; // 11 zeros
    const testMessage = body.testMessage ?? "[diagnostic] ping";

    const issues: string[] = [];
    const details: Record<string, unknown> = {
      reqId,
      time: nowIso,
      provided: {
        hasToken: Boolean(token),
        hasChannelId: Boolean(channelId),
        channelIdPreview: channelId ? `${channelId.slice(0, 4)}***${channelId.slice(-4)}` : null,
      },
    };

    if (!token) issues.push("Token ausente (GPT_MAKER_TOKEN)");
    if (!channelId) issues.push("Channel ID ausente (GPT_MAKER_CHANNEL_ID)");

    let connectivity: { ok: boolean; status?: number } = { ok: false };
    let tokenValid = false;
    let channelValid = false;

    if (token && channelId) {
      // Attempt a POST with invalid phone to avoid real delivery
      const url = `https://api.gptmaker.ai/v2/channel/${encodeURIComponent(channelId)}/start-conversation`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Diagnostic": "true",
          "X-Request-ID": reqId,
        },
        body: JSON.stringify({ phone: invalidPhone, message: testMessage }),
      }).catch((e) => {
        details.fetchError = String(e);
        return null as unknown as Response;
      });

      if (resp) {
        connectivity = { ok: true, status: resp.status };
        const payload = await safeParseJSON(resp);
        details.response = { status: resp.status, payload };

        if (resp.status === 403) {
          tokenValid = false;
          issues.push("Token inválido ou sem permissão (403)");
        } else if (resp.status === 200) {
          tokenValid = true;
          channelValid = true;
          issues.push(
            "Atenção: a API aceitou a requisição. Verifique se um canal WhatsApp NÃO OFICIAL está configurado para evitar custos."
          );
        } else if (resp.status === 400) {
          tokenValid = true;
          // Try to distinguish messages
          const txt = JSON.stringify(payload).toLowerCase();
          if (txt.includes("channel") && txt.includes("not") && txt.includes("found")) {
            channelValid = false;
            issues.push("Channel ID não encontrado (400)");
          } else if (txt.includes("phone") || txt.includes("telefone")) {
            channelValid = true;
            issues.push("Telefone de teste inválido (como esperado). Token e Channel parecem válidos.");
          } else {
            issues.push("Erro 400 não identificado. Verifique o Channel ID e o tipo do canal (deve ser WhatsApp não oficial).");
          }
        } else {
          issues.push(`Status inesperado da API: ${resp.status}`);
        }
      } else {
        issues.push("Falha de conectividade com api.gptmaker.ai");
      }
    }

    const suggestions: string[] = [
      "Confirme no GPT Maker que o canal é do tipo WhatsApp não oficial",
      "Copie/cole novamente o Channel ID sem espaços ocultos",
      "Gere um novo token de API e atualize o secret GPT_MAKER_TOKEN",
    ];

    const result = {
      success: issues.length === 0 || connectivity.ok,
      reqId,
      connectivity,
      tokenValid,
      channelValid,
      issues,
      details,
      suggestions,
    };

    console.log("[gptmaker-diagnostics]", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[gptmaker-diagnostics] error", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});