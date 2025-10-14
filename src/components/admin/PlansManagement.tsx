import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Pause, Play } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  role: string;
  max_transactions: number | null;
  max_categories: number | null;
  has_whatsapp: boolean;
  has_ai_reports: boolean;
  has_google_calendar: boolean;
  has_bank_integration: boolean;
  has_multi_user: boolean;
  has_priority_support: boolean;
  is_active: boolean;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

export function PlansManagement() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    description: "",
    price_monthly: "",
    price_yearly: "",
    role: "free",
    max_transactions: "",
    max_categories: "",
    has_whatsapp: false,
    has_ai_reports: false,
    has_google_calendar: false,
    has_bank_integration: false,
    has_multi_user: false,
    has_priority_support: false,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("role", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar planos", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (planId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .update({ is_active: !currentStatus })
        .eq("id", planId);

      if (error) throw error;
      toast.success(`Plano ${!currentStatus ? "ativado" : "pausado"} com sucesso!`);
      fetchPlans();
    } catch (error: any) {
      toast.error("Erro ao atualizar plano", { description: error.message });
    }
  };

  const handleSubmit = async () => {
    try {
      const planData = {
        name: formData.name,
        display_name: formData.display_name,
        description: formData.description || null,
        price_monthly: formData.price_monthly ? parseFloat(formData.price_monthly) : null,
        price_yearly: formData.price_yearly ? parseFloat(formData.price_yearly) : null,
        role: formData.role as 'free' | 'trial' | 'premium' | 'admin',
        max_transactions: formData.max_transactions ? parseInt(formData.max_transactions) : null,
        max_categories: formData.max_categories ? parseInt(formData.max_categories) : null,
        has_whatsapp: formData.has_whatsapp,
        has_ai_reports: formData.has_ai_reports,
        has_google_calendar: formData.has_google_calendar,
        has_bank_integration: formData.has_bank_integration,
        has_multi_user: formData.has_multi_user,
        has_priority_support: formData.has_priority_support,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("subscription_plans")
          .update(planData)
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("subscription_plans")
          .insert([planData]);

        if (error) throw error;
        toast.success("Plano criado com sucesso!");
      }

      setOpen(false);
      setEditingPlan(null);
      resetForm();
      fetchPlans();
    } catch (error: any) {
      toast.error("Erro ao salvar plano", { description: error.message });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      display_name: "",
      description: "",
      price_monthly: "",
      price_yearly: "",
      role: "free",
      max_transactions: "",
      max_categories: "",
      has_whatsapp: false,
      has_ai_reports: false,
      has_google_calendar: false,
      has_bank_integration: false,
      has_multi_user: false,
      has_priority_support: false,
    });
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      display_name: plan.display_name,
      description: plan.description || "",
      price_monthly: plan.price_monthly?.toString() || "",
      price_yearly: plan.price_yearly?.toString() || "",
      role: plan.role,
      max_transactions: plan.max_transactions?.toString() || "",
      max_categories: plan.max_categories?.toString() || "",
      has_whatsapp: plan.has_whatsapp,
      has_ai_reports: plan.has_ai_reports,
      has_google_calendar: plan.has_google_calendar,
      has_bank_integration: plan.has_bank_integration,
      has_multi_user: plan.has_multi_user,
      has_priority_support: plan.has_priority_support,
    });
    setOpen(true);
  };

  if (loading) return <div>Carregando planos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciar Planos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingPlan(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? "Editar Plano" : "Criar Novo Plano"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome Interno</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <Label>Nome Exibido</Label>
                  <Input value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preço Mensal (R$)</Label>
                  <Input type="number" value={formData.price_monthly} onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })} />
                </div>
                <div>
                  <Label>Preço Anual (R$)</Label>
                  <Input type="number" value={formData.price_yearly} onChange={(e) => setFormData({ ...formData, price_yearly: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Máx. Transações</Label>
                  <Input type="number" value={formData.max_transactions} onChange={(e) => setFormData({ ...formData, max_transactions: e.target.value })} />
                </div>
                <div>
                  <Label>Máx. Categorias</Label>
                  <Input type="number" value={formData.max_categories} onChange={(e) => setFormData({ ...formData, max_categories: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Funcionalidades</Label>
                <div className="grid grid-cols-2 gap-4">
                  {[ 
                    { key: 'has_whatsapp', label: 'WhatsApp' },
                    { key: 'has_ai_reports', label: 'Relatórios IA' },
                    { key: 'has_google_calendar', label: 'Google Calendar' },
                    { key: 'has_bank_integration', label: 'Integração Bancária' },
                    { key: 'has_multi_user', label: 'Multi-usuário' },
                    { key: 'has_priority_support', label: 'Suporte Prioritário' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Switch
                        checked={formData[key as keyof typeof formData] as boolean}
                        onCheckedChange={(checked) => setFormData({ ...formData, [key]: checked })}
                      />
                      <Label>{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingPlan ? "Atualizar" : "Criar"} Plano
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Preço Mensal</TableHead>
                <TableHead>Preço Anual</TableHead>
                <TableHead>Limites</TableHead>
                <TableHead>Funcionalidades</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{plan.display_name}</div>
                      <div className="text-sm text-muted-foreground">{plan.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {plan.price_monthly ? `R$ ${plan.price_monthly.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {plan.price_yearly ? `R$ ${plan.price_yearly.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Trans: {plan.max_transactions || "∞"}</div>
                      <div>Cat: {plan.max_categories || "∞"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {plan.has_whatsapp && <Badge variant="outline">WhatsApp</Badge>}
                      {plan.has_ai_reports && <Badge variant="outline">IA</Badge>}
                      {plan.has_google_calendar && <Badge variant="outline">Calendar</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Ativo" : "Pausado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(plan.id, plan.is_active)}
                      >
                        {plan.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
