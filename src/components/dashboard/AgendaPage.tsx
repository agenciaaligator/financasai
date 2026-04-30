import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, AlertTriangle, CheckCircle2, Plus, MapPin, Clock, Pencil, Trash2 } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useCommitments, type Commitment } from "@/hooks/useCommitments";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { CommitmentForm } from "./CommitmentForm";
import { Badge } from "@/components/ui/badge";

export function AgendaPage() {
  const { connection, loading, syncing, connect, disconnect, sync, refresh: refreshConnection } = useGoogleCalendar();
  const { commitments, loading: loadingCommitments, refresh } = useCommitments();
  const [params] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [deleting, setDeleting] = useState<Commitment | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  useEffect(() => {
    if (params.get("connected") === "true" || connection?.is_active) {
      (async () => {
        await refreshConnection();
        if (connection?.is_active && !connection?.needs_reauth) {
          await sync();
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingInProgress(true);
    try {
      if (deleting.google_event_id) {
        const { error } = await supabase.functions.invoke("google-calendar-event", {
          body: { action: "delete", google_event_id: deleting.google_event_id },
        });
        if (error) throw error;
      } else {
        // Sem evento Google — apenas remover do banco
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("commitments").delete().eq("id", deleting.id).eq("user_id", user.id);
        }
      }
      toast({ title: "Compromisso excluído" });
      setDeleting(null);
      refresh();
    } catch (e) {
      toast({
        title: "Erro ao excluir",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setDeletingInProgress(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><RefreshCw className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Agenda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connection ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecte sua Google Agenda para receber lembretes automáticos no seu celular —
                sem custo, sem instalar nada extra.
              </p>
              <Button onClick={connect} size="lg" className="w-full sm:w-auto">
                <Calendar className="h-4 w-4 mr-2" />
                Conectar Google Agenda
              </Button>
              <p className="text-xs text-muted-foreground">
                Lembretes pelo Google (push e e-mail) e <strong>1 hora antes pelo WhatsApp</strong>.
              </p>
            </div>
          ) : (connection.needs_reauth || !connection.is_active) ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Sua conexão com o Google Agenda está inativa</p>
                  <p className="text-muted-foreground">
                    Reconecte agora para que os compromissos agendados pelo WhatsApp apareçam no seu Google Agenda.
                  </p>
                </div>
              </div>
              <Button onClick={connect} className="w-full sm:w-auto">Reconectar Google Agenda</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm flex-1">
                  <p className="font-medium">Conectado: {connection.calendar_email}</p>
                  {connection.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Última sincronização: {new Date(connection.last_sync_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={sync} disabled={syncing} variant="outline" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  Sincronizar agora
                </Button>
                <Button onClick={disconnect} variant="ghost" size="sm">
                  Desconectar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compromissos criados aqui ou pelo WhatsApp aparecem automaticamente no Google Agenda.
                Lembretes: <strong>1 dia antes</strong> (Google) e <strong>1 hora antes</strong> (Google + WhatsApp).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {connection && !connection.needs_reauth && connection.is_active && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Próximos compromissos</CardTitle>
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(!showForm);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </CardHeader>
          <CardContent>
            {(showForm || editing) && (
              <div className="mb-4">
                <CommitmentForm
                  initial={editing ?? undefined}
                  onSuccess={() => { setShowForm(false); setEditing(null); refresh(); }}
                  onCancel={() => { setShowForm(false); setEditing(null); }}
                />
              </div>
            )}
            {loadingCommitments ? (
              <div className="flex justify-center p-4"><RefreshCw className="animate-spin h-4 w-4" /></div>
            ) : commitments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum compromisso agendado.
              </p>
            ) : (
              <ul className="space-y-3">
                {commitments.map((c) => (
                  <li key={c.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{c.title}</h4>
                          {c.google_event_id && <Badge variant="secondary" className="text-xs">Google</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(c.scheduled_at).toLocaleString("pt-BR")}
                          {c.location && (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.location}</span>
                          )}
                        </div>
                        {c.description && (
                          <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Editar"
                          onClick={() => { setEditing(c); setShowForm(false); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Excluir"
                          onClick={() => setDeleting(c)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compromisso?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  <strong>{deleting.title}</strong> —{" "}
                  {new Date(deleting.scheduled_at).toLocaleString("pt-BR")}
                  <br />
                  Será removido também do seu Google Agenda e os lembretes serão cancelados.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInProgress}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deletingInProgress}>
              {deletingInProgress ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
