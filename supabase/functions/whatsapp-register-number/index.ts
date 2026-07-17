import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json().catch(() => ({}));
    if (pin && !/^\d{6}$/.test(String(pin))) {
      return new Response(
        JSON.stringify({ error: 'PIN inválido: envie 6 dígitos numéricos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: 'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausentes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/register`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        ...(pin ? { pin: String(pin) } : {}),
      }),
    });

    const bodyText = await resp.text();
    let bodyJson: unknown = null;
    try { bodyJson = JSON.parse(bodyText); } catch { /* keep text */ }

    return new Response(
      JSON.stringify({ status: resp.status, ok: resp.ok, body: bodyJson ?? bodyText }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
