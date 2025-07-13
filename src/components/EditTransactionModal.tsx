import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Transaction, Category } from "@/hooks/useTransactions";

interface EditTransactionModalProps {
  transaction: Transaction | null;
  categories: Category[];
  onClose: () => void;
  onUpdate: () => void;
}

export function EditTransactionModal({ 
  transaction, 
  categories, 
  onClose, 
  onUpdate 
}: EditTransactionModalProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (transaction) {
      setTitle(transaction.title);
      setAmount(transaction.amount.toString());
      setType(transaction.type as 'income' | 'expense');
      
      // Fix: Reset category first, then find and set the correct one
      setCategoryId("");
      
      // Aguarda o próximo tick para garantir que as categorias estão disponíveis
      setTimeout(() => {
        if (transaction.category_id) {
          const categoryExists = categories.find(cat => cat.id === transaction.category_id);
          if (categoryExists) {
            console.log('Categoria encontrada:', categoryExists.name);
            setCategoryId(transaction.category_id);
          } else {
            console.log('Categoria não encontrada para ID:', transaction.category_id);
          }
        }
      }, 100);
      
      // Fix: Correct date handling to avoid timezone issues
      const dateValue = transaction.date;
      if (dateValue) {
        // Sempre usar a data exata do banco sem conversão de timezone
        const formattedDate = dateValue.includes('T') 
          ? dateValue.split('T')[0] 
          : dateValue;
        setDate(formattedDate);
      } else {
        setDate("");
      }
      setDescription(transaction.description || "");
      
      console.log('Editando transação:', {
        id: transaction.id,
        originalDate: transaction.date,
        formattedDate: dateValue?.includes('T') ? dateValue.split('T')[0] : dateValue,
        categoryId: transaction.category_id,
        categoriesAvailable: categories.length
      });
    }
  }, [transaction, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction || !title || !amount) {
      return;
    }

    setLoading(true);

    console.log('Salvando transação com data:', {
      originalDate: transaction.date,
      newDate: date,
      formattedForDB: date
    });
    
    const { data: updatedData, error } = await supabase
      .from('transactions')
      .update({
        title,
        amount: parseFloat(amount),
        type,
        category_id: categoryId || null,
        date: date, // Garantir que a data está no formato YYYY-MM-DD
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction.id)
      .select();

    if (error) {
      console.error('Erro ao atualizar transação:', error);
      toast({
        title: "Erro ao atualizar transação",
        description: error.message,
        variant: "destructive"
      });
    } else {
      console.log('Transação atualizada com sucesso. Dados retornados:', updatedData);
      toast({
        title: "Transação atualizada!",
        description: "A transação foi modificada com sucesso."
      });
      onUpdate();
      onClose();
    }

    setLoading(false);
  };

  if (!transaction) return null;

  return (
    <Dialog open={!!transaction} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editType">Tipo</Label>
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
              <Label htmlFor="editAmount">Valor (R$)</Label>
              <Input
                id="editAmount"
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
            <Label htmlFor="editTitle">Título</Label>
            <Input
              id="editTitle"
              type="text"
              placeholder="Ex: Mercado, Salário, etc."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editCategory">Categoria</Label>
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
              <Label htmlFor="editDate">Data</Label>
              <Input
                id="editDate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editDescription">Descrição (opcional)</Label>
            <Textarea
              id="editDescription"
              placeholder="Descrição adicional..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex space-x-2">
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-gradient-primary hover:shadow-primary transition-all duration-200"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}