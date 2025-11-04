import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RecurringTransaction } from "@/hooks/useRecurringTransactions";
import { Building2, Home } from "lucide-react";

interface RecurringTransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  categories: any[];
  editData?: RecurringTransaction;
}

export function RecurringTransactionForm({
  open,
  onOpenChange,
  onSubmit,
  categories,
  editData,
}: RecurringTransactionFormProps) {
  const [formData, setFormData] = useState({
    title: editData?.title || "",
    description: editData?.description || "",
    amount: editData?.amount?.toString() || "",
    type: editData?.type || "expense",
    category_id: editData?.category_id || "",
    frequency: editData?.frequency || "monthly",
    day_of_month: editData?.day_of_month?.toString() || "1",
    day_of_week: editData?.day_of_week?.toString() || "1",
    interval_days: editData?.interval_days?.toString() || "1",
    start_date: editData?.start_date || new Date().toISOString().split("T")[0],
    end_date: editData?.end_date || "",
    is_active: editData?.is_active ?? true,
    organization_id: editData?.organization_id || "",
  });

  const [context, setContext] = useState<"personal" | "business">("personal");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      amount: parseFloat(formData.amount),
      day_of_month: formData.frequency === "monthly" ? parseInt(formData.day_of_month) : null,
      day_of_week: formData.frequency === "weekly" ? parseInt(formData.day_of_week) : null,
      interval_days: formData.frequency === "custom" ? parseInt(formData.interval_days) : null,
      end_date: formData.end_date || null,
      reminders: [1440, 60], // 24h e 1h antes
      organization_id: context === "business" ? formData.organization_id || null : null,
    };

    await onSubmit(data);
    onOpenChange(false);
  };

  const filteredCategories = categories.filter(
    (cat) => cat.type === formData.type
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editData ? "Editar Conta Fixa" : "Nova Conta Fixa"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contexto */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={context === "personal" ? "default" : "outline"}
              onClick={() => setContext("personal")}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Pessoal
            </Button>
            <Button
              type="button"
              variant={context === "business" ? "default" : "outline"}
              onClick={() => setContext("business")}
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              Empresa
            </Button>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Aluguel, Mensalidade..."
              required
            />
          </div>

          {/* Tipo e Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "income" | "expense") =>
                  setFormData({ ...formData, type: value, category_id: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) =>
                setFormData({ ...formData, category_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frequência */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequência *</Label>
            <Select
              value={formData.frequency}
              onValueChange={(value) =>
                setFormData({ ...formData, frequency: value as any })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diária</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
                <SelectItem value="custom">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Configurações específicas de frequência */}
          {formData.frequency === "monthly" && (
            <div className="space-y-2">
              <Label htmlFor="day_of_month">Dia do Mês *</Label>
              <Input
                id="day_of_month"
                type="number"
                min="1"
                max="31"
                value={formData.day_of_month}
                onChange={(e) =>
                  setFormData({ ...formData, day_of_month: e.target.value })
                }
                required
              />
            </div>
          )}

          {formData.frequency === "weekly" && (
            <div className="space-y-2">
              <Label htmlFor="day_of_week">Dia da Semana *</Label>
              <Select
                value={formData.day_of_week}
                onValueChange={(value) =>
                  setFormData({ ...formData, day_of_week: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Domingo</SelectItem>
                  <SelectItem value="1">Segunda</SelectItem>
                  <SelectItem value="2">Terça</SelectItem>
                  <SelectItem value="3">Quarta</SelectItem>
                  <SelectItem value="4">Quinta</SelectItem>
                  <SelectItem value="5">Sexta</SelectItem>
                  <SelectItem value="6">Sábado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.frequency === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="interval_days">Intervalo (dias) *</Label>
              <Input
                id="interval_days"
                type="number"
                min="1"
                value={formData.interval_days}
                onChange={(e) =>
                  setFormData({ ...formData, interval_days: e.target.value })
                }
                required
              />
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Data Início *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Data Fim (opcional)</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Observações</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editData ? "Salvar Alterações" : "Criar Conta Fixa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
