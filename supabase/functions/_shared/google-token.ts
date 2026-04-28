/**
 * Helper compartilhado: garante um access_token válido do Google.
 * Se expirou (ou expira em <60s), renova via refresh_token.
 * Marca needs_reauth=true se o refresh falhar.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface GoogleConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  needs_reauth?: boolean;
}

export async function getValidGoogleToken(
  supabase: ReturnType<typeof createClient>,
  connection: GoogleConnection
): Promise<string> {
  const expiresAt = new Date(connection.expires_at).getTime();
  const now = Date.now();

  // Se ainda válido por mais de 60s, retorna direto
  if (expiresAt - now > 60_000) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    await markNeedsReauth(supabase, connection.id);
    throw new Error("No refresh_token available; user must reconnect");
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: connection.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Google token refresh failed:", res.status, errText);
    if (res.status === 400 || res.status === 401) {
      await markNeedsReauth(supabase, connection.id);
    }
    throw new Error(`Refresh failed [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  const newAccessToken = data.access_token as string;
  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

  await supabase
    .from("calendar_connections")
    .update({
      access_token: newAccessToken,
      expires_at: newExpiresAt,
      needs_reauth: false,
    })
    .eq("id", connection.id);

  return newAccessToken;
}

async function markNeedsReauth(supabase: ReturnType<typeof createClient>, id: string) {
  await supabase
    .from("calendar_connections")
    .update({ needs_reauth: true })
    .eq("id", id);
}
