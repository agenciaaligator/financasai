import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CommitmentForm({ onSuccess, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [reminder1, setReminder1] = useState(1440); // 1 dia antes
  const [reminder2, setReminder2] = useState(30); // 30 min antes
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title || !date || !time) {
      toast({ title: "Preencha título, data e hora", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
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
      toast({ title: "Compromisso criado", description: "Lembretes ativos no Google Agenda." });
      onSuccess();
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
        Lembretes serão enviados pelo Google: 1 dia antes (e-mail) e {reminder2} min antes (push).
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Salvando..." : "Criar"}
        </Button>
      </div>
    </div>
  );
}
