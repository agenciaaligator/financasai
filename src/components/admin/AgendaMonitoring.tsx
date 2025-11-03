import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle2, XCircle, Play, Loader2, RefreshCw, Calendar, MessageCircle } from "lucide-react";

interface CronStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run?: string;
}

export function AgendaMonitoring() {
  const { toast } = useToast();
  const [cronStatus, setCronStatus] = useState<CronStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingReminders, setTestingReminders] = useState(false);
  const [testingDaily, setTestingDaily] = useState(false);
  const [testingSync, setTestingSync] = useState(false);
  const [testingReminderForce, setTestingReminderForce] = useState(false);

  useEffect(() => {
    loadCronStatus();
    // Comentado até pg_cron estar habilitado
    // const interval = setInterval(loadCronStatus, 30000);
    // return () => clearInterval(interval);
  }, []);

  const loadCronStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('get_cron_jobs_status' as any);
      
      if (error) {
        console.error('RPC Error:', error);
        toast({
          title: "Aviso",
          description: "Cron jobs ainda não configurados. Execute o script SQL fornecido.",
          variant: "destructive",
        });
        setCronStatus([]);
      } else if (data) {
        setCronStatus(data);
      }
    } catch (err) {
      console.error('Failed to load cron status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceReminders = async () => {
    setTestingReminders(true);
    try {
      // Obter user_id do usuário atual para teste imediato
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('📤 Invocando send-commitment-reminders com force=true e user_id...');
      const { data, error } = await supabase.functions.invoke('send-commitment-reminders', {
        body: { force: true, user_id: user?.id }
      });
      
      console.log('📥 Resposta:', { data, error });
      
      if (error) {
        console.error('❌ Erro ao forçar lembretes:', error);
        throw error;
      }
      
      if (data.success) {
        toast({
          title: "✅ Lembretes Enviados",
          description: `Enviadas: ${data.remindersSent || 0}, Erros: ${data.errors || 0}`,
        });
      } else {
        toast({
          title: "❌ Erro ao Enviar Lembretes",
          description: data.error || "Verifique os logs para mais detalhes",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ Erro crítico ao forçar lembretes:', error);
      toast({
        title: "❌ Erro",
        description: error.message || "Falha ao enviar lembretes. Verifique os logs da função.",
        variant: "destructive",
      });
    } finally {
      setTestingReminders(false);
    }
  };

  const handleForceDailySummary = async () => {
    setTestingDaily(true);
    try {
      // Obter user_id do usuário atual para teste imediato
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('📤 Invocando send-daily-agenda com user_id para teste...');
      const { data, error } = await supabase.functions.invoke('send-daily-agenda', {
        body: { user_id: user?.id }
      });
      
      console.log('📥 Resposta:', { data, error });
      
      if (error) {
        console.error('❌ Erro ao enviar resumo diário:', error);
        throw error;
      }
      
      if (data.success) {
        toast({
          title: "✅ Resumo Diário Enviado",
          description: `Enviadas: ${data.sent || 0}, Erros: ${data.errors || 0}`,
        });
      } else {
        toast({
          title: "❌ Erro ao Enviar Resumo",
          description: data.error || "Verifique os logs para mais detalhes",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ Erro crítico ao enviar resumo diário:', error);
      toast({
        title: "❌ Erro",
        description: error.message || "Falha ao enviar resumo diário. Verifique os logs da função.",
        variant: "destructive",
      });
    } finally {
      setTestingDaily(false);
    }
  };

  const handleForceGoogleSync = async () => {
    setTestingSync(true);
    try {
      const { error } = await supabase.functions.invoke('sync-all-google-calendars');
      
      if (error) throw error;
      
      toast({
        title: "Sincronização iniciada",
        description: "Processo de sincronização Google executado com sucesso",
      });
    } catch (error) {
      console.error('Error forcing Google sync:', error);
      toast({
        title: "Erro",
        description: "Falha ao sincronizar Google Calendar",
        variant: "destructive",
      });
    } finally {
      setTestingSync(false);
    }
  };

  const getCronIcon = (jobname: string) => {
    if (jobname.includes('reminder')) return <MessageCircle className="h-5 w-5" />;
    if (jobname.includes('agenda')) return <Calendar className="h-5 w-5" />;
    if (jobname.includes('sync')) return <RefreshCw className="h-5 w-5" />;
    return <Clock className="h-5 w-5" />;
  };

  const getCronLabel = (jobname: string) => {
    if (jobname.includes('reminder')) return 'Lembretes WhatsApp';
    if (jobname.includes('agenda')) return 'Resumo Diário';
    if (jobname.includes('sync')) return 'Sync Google';
    return jobname;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Status dos Cron Jobs
          </CardTitle>
          <CardDescription>
            Monitoramento de tarefas agendadas automáticas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cronStatus.length > 0 ? (
            <div className="space-y-4">
              {cronStatus.map((cron) => (
                <div
                  key={cron.jobname}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {getCronIcon(cron.jobname)}
                    <div>
                      <p className="font-medium">{getCronLabel(cron.jobname)}</p>
                      <p className="text-sm text-muted-foreground">
                        Agendamento: {cron.schedule}
                      </p>
                      {cron.last_run && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Última execução: {new Date(cron.last_run).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {cron.active ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Inativo
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum cron job configurado ainda.</p>
              <p className="text-sm mt-2">Execute o script SQL para configurar os crons.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Testes Manuais
          </CardTitle>
          <CardDescription>
            Execute manualmente as funções para teste
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <Button
              onClick={handleForceReminders}
              disabled={testingReminders}
              variant="outline"
              className="justify-start gap-2"
            >
              {testingReminders ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Forçar Lembretes WhatsApp Agora
            </Button>

            <div className="space-y-2">
              <Button
                onClick={async () => {
                  setTestingReminderForce(true);
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    const { data, error } = await supabase.functions.invoke('send-commitment-reminders', {
                      body: { force: true, user_id: user?.id }
                    });
                    if (error) throw error;

                    const deliveryStatus = data.deliverability;
                    const success = data.success;

                    if (success && deliveryStatus === 'sent_with_template') {
                      toast({
                        title: "✅ Mensagem enviada via template",
                        description: "Lembrete enviado usando template WhatsApp (fora da janela de 24h). Verifique seu WhatsApp.",
                      });
                    } else if (success && deliveryStatus === 'sent_text') {
                      toast({
                        title: "✅ Mensagem enviada como texto",
                        description: "Lembrete enviado com sucesso. Verifique seu WhatsApp.",
                      });
                    } else {
                      toast({
                        title: "❌ Falha no envio",
                        description: data.error || "Não foi possível enviar o lembrete",
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    toast({ title: "Erro ao testar lembretes", description: error.message, variant: "destructive" });
                  } finally {
                    setTestingReminderForce(false);
                  }
                }}
                disabled={testingReminderForce}
                variant="secondary"
                className="justify-start gap-2 w-full"
              >
                {testingReminderForce ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                Teste Lembrete (Mensagem Agora)
              </Button>
              <p className="text-xs text-muted-foreground px-2">
                💡 Se houver erro de template, o sistema enviará via WhatsApp template automaticamente
              </p>
            </div>

            <Button
              onClick={handleForceDailySummary}
              disabled={testingDaily}
              variant="outline"
              className="justify-start gap-2"
            >
              {testingDaily ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              Enviar Resumo Diário Teste
            </Button>

            <Button
              onClick={handleForceGoogleSync}
              disabled={testingSync}
              variant="outline"
              className="justify-start gap-2"
            >
              {testingSync ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar Google Calendar Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>⚙️ Instalação de Agendamentos (Cron Jobs)</CardTitle>
          <CardDescription>
            Configure os crons <strong>uma única vez</strong> para automação completa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-md space-y-3">
            <p className="text-sm text-muted-foreground">
              Execute os passos abaixo no SQL Editor do Supabase:
            </p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Abra o <a href="https://supabase.com/dashboard/project/fsamlnlabdjoqpiuhgex/sql/new" target="_blank" rel="noopener noreferrer" className="text-primary underline">SQL Editor</a></li>
              <li>Clique em "Copiar SQL" abaixo</li>
              <li>Cole no editor e execute</li>
              <li>Recarregue esta página e confirme que os crons aparecem ativos acima</li>
            </ol>
            <div className="relative">
              <pre className="bg-background p-3 rounded text-xs overflow-x-auto border max-h-64">
{`-- Lembretes de compromissos (a cada 5 minutos)
SELECT cron.schedule(
  'send-commitment-reminders-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-commitment-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb
  ) as request_id;
  $$
);

-- Resumo diário (8h BRT = 11h UTC)
SELECT cron.schedule(
  'send-daily-agenda-8am',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-daily-agenda',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb
  ) as request_id;
  $$
);

-- Sincronização Google (a cada 10 minutos)
SELECT cron.schedule(
  'sync-all-google-calendars-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/sync-all-google-calendars',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb
  ) as request_id;
  $$
);`}
              </pre>
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={() => {
                  const sql = `-- Lembretes de compromissos (a cada 5 minutos)
SELECT cron.schedule(
  'send-commitment-reminders-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-commitment-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb
  ) as request_id;
  $$
);

-- Resumo diário (8h BRT = 11h UTC)
SELECT cron.schedule(
  'send-daily-agenda-8am',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-daily-agenda',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb
  ) as request_id;
  $$
);

-- Sincronização Google (a cada 10 minutos)
SELECT cron.schedule(
  'sync-all-google-calendars-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/sync-all-google-calendars',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb
  ) as request_id;
  $$
);`;
                  navigator.clipboard.writeText(sql);
                  toast({
                    title: "SQL copiado!",
                    description: "Cole no SQL Editor do Supabase",
                  });
                }}
              >
                📋 Copiar SQL
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p><strong>Lembretes:</strong> Verifica a cada 5 minutos para não perder a janela</p>
              <p className="text-xs mt-1">• Envia 1 lembrete 24h e 1 lembrete 1h antes de cada compromisso</p>
              <p className="text-xs">• Nunca duplica: o sistema marca como enviado</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Resumo Diário:</strong> Enviado às 08:00 todos os dias com a
              agenda do dia via WhatsApp (ou mensagem informando que não há compromissos)
            </p>
          </div>
          <div className="flex gap-2">
            <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Sincronização:</strong> A cada 10 minutos importa eventos do
              Google Calendar para todos os usuários conectados
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
