/**
 * Cria/atualiza/deleta eventos no Google Calendar a partir do app.
 * Lembretes são SEMPRE configurados como propriedades do evento (Google envia o push).
 * Zero cron de lembrete no Supabase.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidGoogleToken } from "../_shared/google-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventInput {
  action: "create" | "update" | "delete";
  google_event_id?: string;
  title?: string;
  description?: string;
  location?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  reminders_minutes?: number[]; // ex: [1440, 30] = 1 dia antes (e-mail) + 30min antes (popup)
}

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
    const { data: userData, error } = await supabase.auth.getUser(jwt);
    if (error || !userData.user) throw new Error("Invalid session");
    const userId = userData.user.id;

    const body = (await req.json()) as EventInput;

    const { data: conn } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .eq("is_active", true)
      .maybeSingle();

    if (!conn) throw new Error("Google Calendar não conectado");

    const accessToken = await getValidGoogleToken(supabase, conn as any);
    const calId = conn.calendar_id || "primary";
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;

    if (body.action === "delete") {
      if (!body.google_event_id) throw new Error("google_event_id required");
      const res = await fetch(`${baseUrl}/${body.google_event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        throw new Error(`Delete failed: ${res.status} ${await res.text()}`);
      }
      await supabase.from("commitments").delete().eq("google_event_id", body.google_event_id).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.title || !body.scheduled_at) {
      throw new Error("title and scheduled_at required");
    }

    const startISO = body.scheduled_at;
    const endISO = new Date(
      new Date(body.scheduled_at).getTime() + (body.duration_minutes ?? 60) * 60_000
    ).toISOString();

    const remindersMinutes = body.reminders_minutes ?? [1440, 30];
    const overrides = remindersMinutes.map((m, i) => ({
      method: i === 0 && m >= 60 ? "email" : "popup",
      minutes: m,
    }));

    const eventPayload = {
      summary: body.title,
      description: body.description,
      location: body.location,
      start: { dateTime: startISO, timeZone: "America/Sao_Paulo" },
      end: { dateTime: endISO, timeZone: "America/Sao_Paulo" },
      reminders: { useDefault: false, overrides },
    };

    let googleEventId = body.google_event_id;
    let res: Response;

    if (body.action === "update" && googleEventId) {
      res = await fetch(`${baseUrl}/${googleEventId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventPayload),
      });
    } else {
      res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventPayload),
      });
    }

    if (!res.ok) {
      throw new Error(`Google API error: ${res.status} ${await res.text()}`);
    }

    const ev = await res.json();
    googleEventId = ev.id;

    // Espelha em commitments
    const commitmentPayload = {
      user_id: userId,
      title: body.title,
      description: body.description ?? null,
      location: body.location ?? null,
      scheduled_at: startISO,
      duration_minutes: body.duration_minutes ?? 60,
      google_event_id: googleEventId,
    };

    const { data: existing } = await supabase
      .from("commitments")
      .select("id")
      .eq("google_event_id", googleEventId!)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("commitments").update(commitmentPayload).eq("id", existing.id);
    } else {
      await supabase.from("commitments").insert(commitmentPayload);
    }

    return new Response(JSON.stringify({ success: true, google_event_id: googleEventId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("google-calendar-event error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
