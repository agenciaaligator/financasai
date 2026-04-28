/**
 * Página /conectar-agenda?token=xxx
 * Aciona o OAuth do Google usando um magic_token (sem precisar de login web).
 */
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConnectCalendar() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Link inválido — token ausente.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/google-calendar-auth`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM",
            },
            body: JSON.stringify({ magic_token: token }),
          }
        );
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Não foi possível iniciar a conexão");
        }
        window.location.href = data.url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
        setLoading(false);
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Conectar Google Agenda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !error && (
            <div className="flex flex-col items-center gap-3 py-6">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Redirecionando para o Google...</p>
            </div>
          )}
          {error && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Peça à Dona Wilma um novo link pelo WhatsApp, ou conecte direto pelo app.
              </p>
              <Button onClick={() => navigate("/login")} className="w-full">
                Ir para o app
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
