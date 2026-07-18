import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Commitment {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  location: string | null;
  google_event_id: string | null;
}

export function useCommitments() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("commitments")
        .select("id, title, description, scheduled_at, duration_minutes, location, google_event_id")
        .eq("user_id", user.id)
        .gte("scheduled_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(100);

      if (error) throw error;
      setCommitments((data ?? []) as Commitment[]);
    } catch (e) {
      console.error("Error fetching commitments:", e);
      toast({
        title: "Não foi possível carregar seus compromissos",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { commitments, loading, refresh: fetch };
}
