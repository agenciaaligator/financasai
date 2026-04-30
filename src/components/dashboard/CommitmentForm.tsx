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

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ConflictItem {
  title: string;
  scheduled_at: string;
  duration_minutes: number | null;
}

export function CommitmentForm({ onSuccess, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [reminder1] = useState(1440); // 1 dia antes (padrão)
  const [reminder2, setReminder2] = useState(60); // 1 hora antes (padrão)
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [showConflict, setShowConflict] = useState(false);

  const persist = async () => {
    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.functions.invoke("google-calendar-event", {
      body: {
        action: "create",
        title,
        description: description || undefined,
        location: location || undefined,
        scheduled_at,
        duration_minutes: duration,
        reminders_minutes: [reminder1, reminder2].filter(Boolean),
      },
    });
    if (error) throw error;
    toast({ title: "Compromisso criado", description: "Lembretes: 1 dia e 1 hora antes." });
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

      // Buscar conflitos do usuário no mesmo dia
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const dayStart = new Date(start);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(start);
        dayEnd.setHours(23, 59, 59, 999);

        const { data: existing } = await supabase
          .from("commitments")
          .select("title, scheduled_at, duration_minutes")
          .eq("user_id", user.id)
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString());

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
        title: "Erro ao criar",
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
        title: "Erro ao criar",
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
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Opcional" />
      </div>
      <div>
        <Label htmlFor="desc">Observações</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
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
        Lembretes pelo Google: 1 dia antes (e-mail) e {reminder2} min antes (push).
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Salvando..." : "Criar"}
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
