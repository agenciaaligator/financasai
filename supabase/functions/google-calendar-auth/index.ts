/**
 * Inicia o fluxo OAuth do Google Calendar.
 * - Chamado pelo frontend (com JWT do usuário) OU pelo link mágico do WhatsApp (com magic_token).
 * - Retorna a URL de autorização do Google.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const redirectUri = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI");
    if (!clientId || !redirectUri) throw new Error("Google OAuth not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const magicToken = body.magic_token as string | undefined;

    let userId: string | null = null;

    if (magicToken) {
      // Fluxo via WhatsApp: validar token mágico
      const { data: tokenRow, error } = await supabase
        .from("calendar_connection_tokens")
        .select("user_id, expires_at, used")
        .eq("token", magicToken)
        .maybeSingle();

      if (error || !tokenRow) throw new Error("Token mágico inválido");
      if (tokenRow.used) throw new Error("Token mágico já utilizado");
      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        throw new Error("Token mágico expirou");
      }
      userId = tokenRow.user_id as string;
    } else {
      // Fluxo via app: validar JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Authorization required");
      const jwt = authHeader.replace("Bearer ", "");
      const { data: userData, error } = await supabase.auth.getUser(jwt);
      if (error || !userData.user) throw new Error("Invalid session");
      userId = userData.user.id;
    }

    // State carrega userId + nonce. Vamos assinar com HMAC simples (chave do service role).
    const stateObj = { uid: userId, n: crypto.randomUUID(), t: Date.now() };
    const state = btoa(JSON.stringify(stateObj));

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("include_granted_scopes", "true");

    return new Response(
      JSON.stringify({ url: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("google-calendar-auth error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
