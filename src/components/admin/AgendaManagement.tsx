import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Evento {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  created_at: string;
}

export function AgendaManagement() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "pending" as "pending" | "confirmed" | "cancelled" | "completed",
  });

  useEffect(() => {
    fetchEventos();
  }, []);

  const fetchEventos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("eventos")
        .select("*")
        .order("start_date", { ascending: true });

      if (error) throw error;
      setEventos((data || []) as Evento[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar eventos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingId) {
        const { error } = await supabase
          .from("eventos")
          .update(formData)
          .eq("id", editingId);

        if (error) throw error;
        
        toast({
          title: "Evento atualizado",
          description: "Evento atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from("eventos")
          .insert({
            ...formData,
            user_id: user.id,
          });

        if (error) throw error;
        
        toast({
          title: "Evento criado",
          description: "Evento criado com sucesso!",
        });
      }

      setFormData({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        status: "pending",
      });
      setEditingId(null);
      setShowForm(false);
      fetchEventos();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar evento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (evento: Evento) => {
    setFormData({
      title: evento.title,
      description: evento.description || "",
      start_date: evento.start_date,
      end_date: evento.end_date,
      status: evento.status,
    });
    setEditingId(evento.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;

    try {
      const { error } = await supabase
        .from("eventos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Evento excluído",
        description: "Evento excluído com sucesso!",
      });

      fetchEventos();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir evento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "bg-yellow-500",
      confirmed: "bg-blue-500",
      cancelled: "bg-red-500",
      completed: "bg-green-500",
    };
    const labels = {
      pending: "Pendente",
      confirmed: "Confirmado",
      cancelled: "Cancelado",
      completed: "Concluído",
    };
    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Agenda
        </h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancelar" : "Novo Evento"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar Evento" : "Novo Evento"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data Início</label>
                  <Input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Data Fim</label>
                  <Input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full border rounded p-2"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="pending">Pendente</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>
              <Button type="submit">
                {editingId ? "Atualizar" : "Criar"} Evento
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum evento cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                eventos.map((evento) => (
                  <TableRow key={evento.id}>
                    <TableCell className="font-medium">{evento.title}</TableCell>
                    <TableCell>
                      {format(new Date(evento.start_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(evento.end_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getStatusBadge(evento.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(evento)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(evento.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}