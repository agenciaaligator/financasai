/**
 * Callback do OAuth do Google.
 * - Recebe o "code" do Google
 * - Troca por access_token + refresh_token
 * - Salva em calendar_connections (UPSERT preservando refresh_token se Google não devolver novo)
 * - Marca o magic_token como usado (se aplicável)
 * - Redireciona para SITE_URL/?tab=agenda&connected=true ou com mensagem de erro legível
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://donawilma.com.br";

function redirectWithError(reason: string, detail?: string) {
  const params = new URLSearchParams({ tab: "agenda", error: reason });
  if (detail) params.set("error_detail", detail.slice(0, 200));
  return Response.redirect(`${SITE_URL}/?${params.toString()}`, 302);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (errorParam) {
      console.error("[google-calendar-callback] Google returned error:", errorParam, errorDescription);
      return redirectWithError(errorParam, errorDescription ?? undefined);
    }
    if (!code || !state) {
      console.error("[google-calendar-callback] Missing code/state");
      return redirectWithError("missing_params");
    }

    let stateObj: { uid: string; n: string; t: number };
    try {
      stateObj = JSON.parse(atob(state));
    } catch {
      return redirectWithError("invalid_state");
    }

    if (Date.now() - stateObj.t > 15 * 60 * 1000) {
      return redirectWithError("state_expired");
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("[google-calendar-callback] Missing OAuth config", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasRedirectUri: !!redirectUri,
      });
      return redirectWithError("server_misconfigured", "missing_oauth_env");
    }

    console.log("[google-calendar-callback] Using redirect_uri:", redirectUri);

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
      console.error("[google-calendar-callback] Token exchange failed:", tokenRes.status, errText);
      // Tenta extrair mensagem do Google
      let detail = errText;
      try {
        const j = JSON.parse(errText);
        detail = j.error_description || j.error || errText;
      } catch { /* ignore */ }
      return redirectWithError("token_exchange_failed", detail);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      console.error("[google-calendar-callback] No access_token in response", tokenData);
      return redirectWithError("no_access_token");
    }

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    const { data: existing } = await supabase
      .from("calendar_connections")
      .select("id, refresh_token")
      .eq("user_id", stateObj.uid)
      .eq("provider", "google")
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabase
        .from("calendar_connections")
        .update({
          access_token,
          // Preserva refresh_token antigo se Google não enviar um novo
          refresh_token: refresh_token ?? (existing as any).refresh_token,
          expires_at: expiresAt,
          calendar_email: userInfo.email ?? null,
          calendar_id: "primary",
          is_active: true,
          needs_reauth: false,
        })
        .eq("id", (existing as any).id);
      if (updErr) {
        console.error("[google-calendar-callback] Update connection failed:", updErr);
        return redirectWithError("save_failed", updErr.message);
      }
      console.log("[google-calendar-callback] Reconnected user", stateObj.uid);
    } else {
      const { error: insErr } = await supabase.from("calendar_connections").insert({
        user_id: stateObj.uid,
        provider: "google",
        access_token,
        refresh_token,
        expires_at: expiresAt,
        calendar_email: userInfo.email ?? null,
        calendar_id: "primary",
        calendar_name: userInfo.email ?? null,
        is_active: true,
        needs_reauth: false,
      });
      if (insErr) {
        console.error("[google-calendar-callback] Insert connection failed:", insErr);
        return redirectWithError("save_failed", insErr.message);
      }
      console.log("[google-calendar-callback] Connected new user", stateObj.uid);
    }

    // Invalida tokens mágicos do user
    await supabase
      .from("calendar_connection_tokens")
      .update({ used: true })
      .eq("user_id", stateObj.uid)
      .eq("used", false);

    return Response.redirect(`${SITE_URL}/?tab=agenda&connected=true`, 302);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("google-calendar-callback error:", msg);
    return redirectWithError("internal", msg);
  }
});
