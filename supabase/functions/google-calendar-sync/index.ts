/**
 * Sincroniza eventos do Google Calendar com a tabela commitments.
 * Chamado sob demanda (botão "Sincronizar agora") ou pelo webhook.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidGoogleToken } from "../_shared/google-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !userData.user) throw new Error("Invalid session");

    const userId = userData.user.id;

    const { data: conn } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .eq("is_active", true)
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ synced: 0, message: "No connection" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidGoogleToken(supabase, conn as any);

    // Busca eventos dos próximos 90 dias
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${conn.calendar_id || "primary"}/events`);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google API error [${res.status}]: ${errText}`);
    }

    const data = await res.json();
    const items = (data.items ?? []) as any[];

    let synced = 0;
    for (const ev of items) {
      if (ev.status === "cancelled") {
        await supabase.from("commitments").delete().eq("google_event_id", ev.id).eq("user_id", userId);
        continue;
      }

      const startStr = ev.start?.dateTime || ev.start?.date;
      if (!startStr) continue;

      const scheduledAt = new Date(startStr).toISOString();
      let durationMinutes = 60;
      if (ev.start?.dateTime && ev.end?.dateTime) {
        durationMinutes = Math.max(
          15,
          Math.round((new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime()) / 60000)
        );
      }

      const payload = {
        user_id: userId,
        title: ev.summary || "Sem título",
        description: ev.description || null,
        scheduled_at: scheduledAt,
        location: ev.location || null,
        google_event_id: ev.id,
        duration_minutes: durationMinutes,
      };

      // Upsert por google_event_id
      const { data: existing } = await supabase
        .from("commitments")
        .select("id")
        .eq("google_event_id", ev.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase.from("commitments").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("commitments").insert(payload);
      }
      synced++;
    }

    await supabase
      .from("calendar_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", conn.id);

    return new Response(JSON.stringify({ synced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("google-calendar-sync error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
