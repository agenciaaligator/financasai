import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UsageStatus {
  qtd_atual: number;
  limite: number | null;
  percentual: number;
  estado: "ok" | "warning" | "over" | "blocked";
  bloqueado: boolean;
  ciclo_inicio: string;
  ciclo_fim: string;
}

export function useMessageUsage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_usage_status", { p_user_id: user.id });
    if (!error && data) setStatus(data as unknown as UsageStatus);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`usage_mensagens_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "usage_mensagens", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return { status, loading, reload: load };
}
