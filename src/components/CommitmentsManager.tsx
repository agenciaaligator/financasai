import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Edit, Trash2, Clock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { GoogleCalendarConnect } from "./dashboard/GoogleCalendarConnect";
import { GoogleCalendarOnboarding } from "./GoogleCalendarOnboarding";
import { useTranslation } from "react-i18next";
import { useUserRole } from "@/hooks/useUserRole";

interface Commitment {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  category: "payment" | "meeting" | "appointment" | "other";
  reminder_sent: boolean;
  created_at: string;
  location?: string | null;
  participants?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  google_event_id?: string | null;
}

export function CommitmentsManager() {
  console.log('📅 CommitmentsManager rendering...');
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { isConnected, syncEvent } = useGoogleCalendar();
  
  // Inicializar showOnboarding com callback para verificar isConnected
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const hasSeenOnboarding = localStorage.getItem('googleCalendarOnboardingSeen');
    // Só mostra se: não viu onboarding E não está conectado
    return !hasSeenOnboarding && !isConnected;
  });
  const { t } = useTranslation();
  const { isAdmin, isPremium, loading: roleLoading } = useUserRole();
  
  // Verificar se tem acesso ao Google Calendar (Premium ou Admin)
  const hasGoogleCalendarAccess = isAdmin || isPremium;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduled_at: "",
    category: "other" as "payment" | "meeting" | "appointment" | "other",
    location: "",
    participants: "",
    duration_minutes: 60,
    notes: "",
  });

  useEffect(() => {
    fetchCommitments();
    
    // Se conectar, fechar onboarding
    if (isConnected) {
      setShowOnboarding(false);
    }
  }, [isConnected]);

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

      // Converter datetime-local (interpretado como America/Sao_Paulo) → UTC
      const brasiliaDate = fromZonedTime(formData.scheduled_at, "America/Sao_Paulo");
      const utcISO = brasiliaDate.toISOString();

      const dataToSave = {
        ...formData,
        scheduled_at: utcISO
      };

      if (editingId) {
        const { error } = await supabase
          .from("commitments")
          .update(dataToSave)
          .eq("id", editingId);

        if (error) throw error;

        // Sincronizar com Google Calendar se conectado
        if (isConnected) {
          const syncResult = await syncEvent('update', editingId);
          if (!syncResult.success) {
            toast({
              title: "Compromisso atualizado",
              description: "Salvo, mas não foi possível sincronizar com Google Calendar.",
              variant: "destructive",
            });
            setFormData({
              title: "",
              description: "",
              scheduled_at: "",
              category: "other",
              location: "",
              participants: "",
              duration_minutes: 60,
              notes: "",
            });
            setEditingId(null);
            setShowForm(false);
            fetchCommitments();
            return;
          }
        }
        
        toast({
          title: t('agenda.commitmentUpdated') || "Compromisso atualizado",
          description: isConnected 
            ? t('agenda.updatedAndSynced') || "Atualizado e sincronizado com Google Calendar!" 
            : t('agenda.updatedSuccess') || "Atualizado com sucesso!",
        });
      } else {
        const { data: newCommitment, error } = await supabase
          .from("commitments")
          .insert({
            ...dataToSave,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        // Sincronizar com Google Calendar se conectado
        if (isConnected && newCommitment) {
          const syncResult = await syncEvent('create', newCommitment.id);
          if (!syncResult.success) {
            toast({
              title: "Compromisso criado",
              description: "Salvo, mas não foi possível sincronizar com Google Calendar.",
              variant: "destructive",
            });
            setFormData({
              title: "",
              description: "",
              scheduled_at: "",
              category: "other",
              location: "",
              participants: "",
              duration_minutes: 60,
              notes: "",
            });
            setEditingId(null);
            setShowForm(false);
            fetchCommitments();
            return;
          }
        }
        
        toast({
          title: t('agenda.commitmentCreated') || "Compromisso criado!",
          description: isConnected 
            ? t('agenda.syncedWithGoogle') || "Sincronizado com Google Calendar automaticamente!" 
            : t('agenda.tipConnectGoogle') || "💡 Dica: Conecte o Google Calendar para sincronização automática.",
        });
      }

      setFormData({
        title: "",
        description: "",
        scheduled_at: "",
        category: "other",
        location: "",
        participants: "",
        duration_minutes: 60,
        notes: "",
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
    // Converter ISO UTC → datetime-local (America/Sao_Paulo)
    const brasiliaDate = toZonedTime(commitment.scheduled_at, "America/Sao_Paulo");
    const localISO = format(brasiliaDate, "yyyy-MM-dd'T'HH:mm");
    
    setFormData({
      title: commitment.title,
      description: commitment.description || "",
      scheduled_at: localISO,
      category: commitment.category,
      location: commitment.location || "",
      participants: commitment.participants || "",
      duration_minutes: commitment.duration_minutes || 60,
      notes: commitment.notes || "",
    });
    setEditingId(commitment.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este compromisso?")) return;

    try {
      // Sincronizar com Google Calendar ANTES de deletar
      if (isConnected) {
        await syncEvent('delete', id);
      }

      const { error } = await supabase
        .from("commitments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: t('agenda.commitmentDeleted') || "Compromisso excluído",
        description: isConnected 
          ? t('agenda.deletedFromGoogle') || "Excluído e removido do Google Calendar!" 
          : t('agenda.deletedSuccess') || "Excluído com sucesso!",
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
      <GoogleCalendarOnboarding 
        open={showOnboarding} 
        onOpenChange={setShowOnboarding}
      />
      
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          {t('dashboard.agenda') || 'Agenda'}
        </h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancelar" : "Novo Compromisso"}
        </Button>
      </div>

      {/* Google Calendar Integration Card */}
      {roleLoading ? (
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 animate-pulse" />
              Carregando...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-16 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      ) : hasGoogleCalendarAccess ? (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {t('agenda.googleCalendarSync') || 'Sincronização Google Calendar'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('agenda.googleCalendarDescription') || 'Seus compromissos serão automaticamente sincronizados com o Google Calendar'}
            </p>
          </CardHeader>
          <CardContent>
            <GoogleCalendarConnect />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-2 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Google Calendar - Premium
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Sincronize automaticamente seus compromissos com o Google Calendar. 
              Disponível nos planos Premium e Enterprise.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="default" onClick={() => window.location.href = '/settings'}>
              Ver Planos
            </Button>
          </CardContent>
        </Card>
      )}

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

              {formData.category === 'meeting' && (
                <div>
                  <label className="text-sm font-medium">Participantes</label>
                  <Input
                    value={formData.participants}
                    onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                    placeholder="Ex: João Silva, Maria Santos"
                  />
                </div>
              )}

              {(formData.category === 'meeting' || formData.category === 'appointment') && (
                <div>
                  <label className="text-sm font-medium">Local</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ex: Rua Exemplo, 123 - Sala 45"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Duração (minutos)</label>
                <Input
                  type="number"
                  min="15"
                  step="15"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Observações</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Anotações adicionais..."
                />
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
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{commitment.title}</div>
                          {commitment.google_event_id && (
                            <Badge variant="outline" className="gap-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                              <Check className="h-3 w-3" />
                              {t('agenda.synced') || 'Sincronizado'}
                            </Badge>
                          )}
                        </div>
                        {commitment.description && (
                          <div className="text-xs text-muted-foreground">{commitment.description}</div>
                        )}
                        {commitment.participants && (
                          <div className="text-xs text-blue-600 mt-1">👥 {commitment.participants}</div>
                        )}
                        {commitment.location && (
                          <div className="text-xs text-green-600 mt-1">📍 {commitment.location}</div>
                        )}
                        {commitment.duration_minutes && commitment.duration_minutes !== 60 && (
                          <div className="text-xs text-purple-600 mt-1">⏱️ {commitment.duration_minutes}min</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatInTimeZone(commitment.scheduled_at, "America/Sao_Paulo", "dd/MM/yyyy, HH:mm")}
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
