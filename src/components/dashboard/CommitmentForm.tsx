import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface InitialValues {
  id?: string;
  google_event_id?: string | null;
  title?: string;
  description?: string | null;
  location?: string | null;
  scheduled_at?: string; // ISO
  duration_minutes?: number | null;
}

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
  initial?: InitialValues; // se presente, modo edição
}

interface ConflictItem {
  title: string;
  scheduled_at: string;
  duration_minutes: number | null;
}

function isoToDateTimeLocal(iso?: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function CommitmentForm({ onSuccess, onCancel, initial }: Props) {
  const isEdit = Boolean(initial?.id);
  const initDT = isoToDateTimeLocal(initial?.scheduled_at);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [date, setDate] = useState(initDT.date);
  const [time, setTime] = useState(initDT.time);
  const [duration, setDuration] = useState(initial?.duration_minutes ?? 60);
  const [reminder1] = useState(1440); // 1 dia antes (e-mail Google)
  const [reminder2, setReminder2] = useState(60); // 1 hora antes (push Google + WhatsApp)
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [showConflict, setShowConflict] = useState(false);

  const persist = async () => {
    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.functions.invoke("google-calendar-event", {
      body: {
        action: isEdit ? "update" : "create",
        google_event_id: initial?.google_event_id ?? undefined,
        title,
        description: description || undefined,
        location: location || undefined,
        scheduled_at,
        duration_minutes: duration,
        reminders_minutes: [reminder1, reminder2].filter(Boolean),
      },
    });
    if (error) throw error;
    toast({
      title: isEdit ? "Compromisso atualizado" : "Compromisso criado",
      description: "Lembretes: 1 dia antes (Google), 1 hora antes (Google + WhatsApp).",
    });
    onSuccess();
  };

  const submit = async () => {
    if (!title || !date || !time) {
      toast({ title: "Preencha título, data e hora", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start.getTime() + duration * 60_000);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const dayStart = new Date(start);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(start);
        dayEnd.setHours(23, 59, 59, 999);

        let query = supabase
          .from("commitments")
          .select("id, title, scheduled_at, duration_minutes")
          .eq("user_id", user.id)
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString());

        if (initial?.id) query = query.neq("id", initial.id);

        const { data: existing } = await query;

        const overlaps = (existing ?? []).filter((c: any) => {
          const cStart = new Date(c.scheduled_at);
          const cEnd = new Date(cStart.getTime() + ((c.duration_minutes ?? 60) * 60_000));
          return cStart < end && cEnd > start;
        });

        if (overlaps.length > 0) {
          setConflicts(overlaps as ConflictItem[]);
          setShowConflict(true);
          setSubmitting(false);
          return;
        }
      }

      await persist();
    } catch (e) {
      toast({
        title: isEdit ? "Erro ao atualizar" : "Erro ao criar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDespiteConflict = async () => {
    setShowConflict(false);
    setSubmitting(true);
    try {
      await persist();
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div>
        <Label htmlFor="title">Título *</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Dentista" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="date">Data *</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="time">Hora *</Label>
          <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="location">Local</Label>
        <Input id="location" value={location ?? ""} onChange={(e) => setLocation(e.target.value)} placeholder="Opcional" />
      </div>
      <div>
        <Label htmlFor="desc">Observações</Label>
        <Textarea id="desc" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Duração (min)</Label>
          <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={15} step={15} />
        </div>
        <div>
          <Label>Lembrar antes (min)</Label>
          <Input type="number" value={reminder2} onChange={(e) => setReminder2(Number(e.target.value))} min={5} step={5} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Lembretes: <strong>1 dia antes</strong> (e-mail Google) e <strong>{reminder2} min antes</strong> (push Google + WhatsApp).
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar"}
        </Button>
      </div>

      <AlertDialog open={showConflict} onOpenChange={setShowConflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Conflito de horário</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Você já tem compromisso(s) nesse horário:</p>
                <ul className="text-sm space-y-1 mt-2 bg-muted/40 p-3 rounded">
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      • <strong>{c.title}</strong> —{" "}
                      {new Date(c.scheduled_at).toLocaleString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      ({c.duration_minutes ?? 60} min)
                    </li>
                  ))}
                </ul>
                <p className="pt-2">Deseja agendar mesmo assim ou escolher outro horário?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Escolher outro horário</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDespiteConflict}>
              Agendar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
