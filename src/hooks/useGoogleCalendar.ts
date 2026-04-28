import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface CalendarConnection {
  id: string;
  provider: string;
  calendar_email: string | null;
  is_active: boolean;
  needs_reauth: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export function useGoogleCalendar() {
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchConnection = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("calendar_connections")
      .select("id, provider, calendar_email, is_active, needs_reauth, last_sync_at, created_at")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle();

    setConnection(data as CalendarConnection | null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConnection(); }, [fetchConnection]);

  const connect = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", { body: {} });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de autorização não recebida");
      }
    } catch (e) {
      toast({
        title: "Erro ao conectar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!connection) return;
    const { error } = await supabase
      .from("calendar_connections")
      .delete()
      .eq("id", connection.id);
    if (error) {
      toast({ title: "Erro ao desconectar", description: error.message, variant: "destructive" });
      return;
    }
    setConnection(null);
    toast({ title: "Agenda desconectada" });
  }, [connection]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", { body: {} });
      if (error) throw error;
      toast({ title: "Sincronizado", description: `${data?.synced ?? 0} compromissos atualizados` });
      await fetchConnection();
    } catch (e) {
      toast({
        title: "Erro ao sincronizar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [fetchConnection]);

  return { connection, loading, syncing, connect, disconnect, sync, refresh: fetchConnection };
}
