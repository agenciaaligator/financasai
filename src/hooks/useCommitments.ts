import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("commitments")
      .select("id, title, description, scheduled_at, duration_minutes, location, google_event_id")
      .eq("user_id", user.id)
      .gte("scheduled_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(100);

    setCommitments((data ?? []) as Commitment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { commitments, loading, refresh: fetch };
}
