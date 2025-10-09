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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Commitment {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  category: "payment" | "meeting" | "appointment" | "other";
  reminder_sent: boolean;
  created_at: string;
}

export function CommitmentsManager() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduled_at: "",
    category: "other" as "payment" | "meeting" | "appointment" | "other",
  });

  useEffect(() => {
    fetchCommitments();
  }, []);

  const fetchCommitments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("commitments")
        .select("*")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setCommitments((data || []) as Commitment[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar compromissos",
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
          .from("commitments")
          .update(formData)
          .eq("id", editingId);

        if (error) throw error;
        
        toast({
          title: "Compromisso atualizado",
          description: "Compromisso atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from("commitments")
          .insert({
            ...formData,
            user_id: user.id,
          });

        if (error) throw error;
        
        toast({
          title: "Compromisso criado",
          description: "Compromisso criado com sucesso!",
        });
      }

      setFormData({
        title: "",
        description: "",
        scheduled_at: "",
        category: "other",
      });
      setEditingId(null);
      setShowForm(false);
      fetchCommitments();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar compromisso",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (commitment: Commitment) => {
    setFormData({
      title: commitment.title,
      description: commitment.description || "",
      scheduled_at: commitment.scheduled_at,
      category: commitment.category,
    });
    setEditingId(commitment.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este compromisso?")) return;

    try {
      const { error } = await supabase
        .from("commitments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Compromisso excluído",
        description: "Compromisso excluído com sucesso!",
      });

      fetchCommitments();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir compromisso",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCategoryBadge = (category: string) => {
    const variants = {
      payment: "bg-red-500",
      meeting: "bg-blue-500",
      appointment: "bg-green-500",
      other: "bg-gray-500",
    };
    const labels = {
      payment: "Pagamento",
      meeting: "Reunião",
      appointment: "Consulta",
      other: "Outro",
    };
    return (
      <Badge className={variants[category as keyof typeof variants]}>
        {labels[category as keyof typeof labels]}
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
          {showForm ? "Cancelar" : "Novo Compromisso"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar Compromisso" : "Novo Compromisso"}</CardTitle>
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
              <div>
                <label className="text-sm font-medium">Data e Hora</label>
                <Input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">Pagamento</SelectItem>
                    <SelectItem value="meeting">Reunião</SelectItem>
                    <SelectItem value="appointment">Consulta</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">
                {editingId ? "Atualizar" : "Criar"} Compromisso
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
                <TableHead>Data/Hora</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commitments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum compromisso cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                commitments.map((commitment) => (
                  <TableRow key={commitment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{commitment.title}</div>
                        {commitment.description && (
                          <div className="text-xs text-muted-foreground">{commitment.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(commitment.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getCategoryBadge(commitment.category)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(commitment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(commitment.id)}
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
