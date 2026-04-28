/**
 * Callback do OAuth do Google.
 * - Recebe o "code" do Google
 * - Troca por access_token + refresh_token
 * - Salva em calendar_connections
 * - Marca o magic_token como usado (se aplicável)
 * - Redireciona para donawilma.com.br/agenda?connected=true
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://donawilma.com.br";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      return Response.redirect(`${SITE_URL}/agenda?error=${encodeURIComponent(errorParam)}`, 302);
    }
    if (!code || !state) {
      return Response.redirect(`${SITE_URL}/agenda?error=missing_params`, 302);
    }

    let stateObj: { uid: string; n: string; t: number };
    try {
      stateObj = JSON.parse(atob(state));
    } catch {
      return Response.redirect(`${SITE_URL}/agenda?error=invalid_state`, 302);
    }

    // State expira em 15min
    if (Date.now() - stateObj.t > 15 * 60 * 1000) {
      return Response.redirect(`${SITE_URL}/agenda?error=state_expired`, 302);
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI")!;

    // Troca code por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange failed:", errText);
      return Response.redirect(`${SITE_URL}/agenda?error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Pega email do user
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    // Upsert: se já existe conexão Google para este user, atualiza
    const { data: existing } = await supabase
      .from("calendar_connections")
      .select("id, refresh_token")
      .eq("user_id", stateObj.uid)
      .eq("provider", "google")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("calendar_connections")
        .update({
          access_token,
          refresh_token: refresh_token ?? existing.refresh_token,
          expires_at: expiresAt,
          calendar_email: userInfo.email,
          calendar_id: "primary",
          is_active: true,
          needs_reauth: false,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("calendar_connections").insert({
        user_id: stateObj.uid,
        provider: "google",
        access_token,
        refresh_token,
        expires_at: expiresAt,
        calendar_email: userInfo.email,
        calendar_id: "primary",
        calendar_name: userInfo.email,
        is_active: true,
      });
    }

    // Invalida tokens mágicos do user
    await supabase
      .from("calendar_connection_tokens")
      .update({ used: true })
      .eq("user_id", stateObj.uid)
      .eq("used", false);

    return Response.redirect(`${SITE_URL}/?tab=agenda&connected=true`, 302);
  } catch (err) {
    console.error("google-calendar-callback error:", err);
    return Response.redirect(`${SITE_URL}/agenda?error=internal`, 302);
  }
});
