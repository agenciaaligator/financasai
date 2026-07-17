// Temporary function to set WhatsApp verified display name via Meta API.
// Will be removed after use.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (!token || !phoneId) throw new Error("Missing WhatsApp env vars");

    const body = await req.json().catch(() => ({}));
    const name = body.name || "Dona Wilma";

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ verified_name: name }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ status: res.status, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.ok ? 200 : 400,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
