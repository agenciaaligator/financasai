import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useFeatureLimits } from "@/hooks/useFeatureLimits";
import { UpgradeModal } from "./UpgradeModal";
import { useToast } from "@/hooks/use-toast";
import { transactionSchema } from "@/lib/validations";

interface TransactionFormProps {
  onSubmit: (transaction: {
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category_id?: string;
    date: string;
    description?: string;
    source: 'manual' | 'whatsapp';
  }) => void;
  onCancel: () => void;
}

export function TransactionForm({ onSubmit, onCancel }: TransactionFormProps) {
  // Calcular data local (Brasil UTC-3) para evitar data do dia seguinte
  const getLocalDate = () => {
    const now = new Date();
    const brazilOffset = -3 * 60; // UTC-3 em minutos
    const localTime = new Date(now.getTime() + (brazilOffset * 60 * 1000));
    const year = localTime.getUTCFullYear();
    const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(getLocalDate());
  const [description, setDescription] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const { categories } = useTransactions();
  const { canCreateTransaction, refetchUsage } = useFeatureLimits();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !amount) {
      return;
    }

    try {
      // Validar dados
      const validated = transactionSchema.parse({
        title,
        amount: parseFloat(amount),
        type,
        category_id: categoryId || undefined,
        date,
        description: description || undefined,
      });

      // Verificar limite antes de criar
      const limitCheck = canCreateTransaction();
      if (!limitCheck.allowed) {
        setUpgradeReason(limitCheck.reason || 'Upgrade necessário para criar mais transações.');
        setShowUpgradeModal(true);
        toast({
          title: "Limite atingido",
          description: limitCheck.reason,
          variant: "destructive"
        });
        return;
      }

      onSubmit({
        title: validated.title,
        amount: validated.amount,
        type: validated.type,
        category_id: validated.category_id,
        date: validated.date,
        description: validated.description,
        source: 'manual'
      });

      // Atualizar uso após criar
      await refetchUsage();

      // Reset form
      setTitle("");
      setAmount("");
      setType('expense');
      setCategoryId("");
      setDate(getLocalDate());
      setDescription("");
    } catch (error: any) {
      toast({
        title: "Erro de validação",
        description: error.errors?.[0]?.message || "Dados inválidos",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Nova Transação</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={type} onValueChange={(value: 'income' | 'expense') => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              type="text"
              placeholder="Ex: Mercado, Salário, etc."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(cat => cat.type === type)
                    .map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descrição adicional..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex space-x-2">
            <Button 
              type="submit" 
              className="flex-1 bg-gradient-primary hover:shadow-primary transition-all duration-200"
            >
              Adicionar Transação
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
      
      <UpgradeModal 
        open={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
      />
    </Card>
  );
}