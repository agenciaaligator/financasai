import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useFeatureLimits } from "@/hooks/useFeatureLimits";
import { useCategoryPatterns } from "@/hooks/useCategoryPatterns";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { transactionSchema } from "@/lib/validations";
import { translateCategoryName } from "@/lib/categoryTranslations";

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
  const { t } = useTranslation();

  const getLocalDate = () => {
    const now = new Date();
    const brazilOffset = -3 * 60;
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
  const [suggestion, setSuggestion] = useState<{ category_id: string; category_name?: string } | null>(null);
  
  const { categories } = useTransactions();
  const { canCreateTransaction, refetchUsage } = useFeatureLimits();
  const { suggestCategory, learnPattern } = useCategoryPatterns();
  const { toast } = useToast();

  // Auto-suggest category when title changes
  useEffect(() => {
    if (title.length >= 3 && !categoryId) {
      const filteredCategories = categories.filter(c => c.type === type);
      const result = suggestCategory(title, filteredCategories);
      if (result) {
        setSuggestion({ category_id: result.category_id, category_name: result.category_name });
      } else {
        setSuggestion(null);
      }
    } else {
      setSuggestion(null);
    }
  }, [title, type, categoryId, categories, suggestCategory]);

  const acceptSuggestion = () => {
    if (suggestion) {
      setCategoryId(suggestion.category_id);
      setSuggestion(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !amount) return;

    try {
      const validated = transactionSchema.parse({
        title,
        amount: parseFloat(amount),
        type,
        category_id: categoryId || undefined,
        date,
        description: description || undefined,
      });

      const limitCheck = canCreateTransaction();
      if (!limitCheck.allowed) {
        toast({
          title: t('categories.limitReached', 'Limite atingido'),
          description: limitCheck.reason,
          variant: "destructive"
        });
        return;
      }

      // Learn pattern if category was selected
      if (categoryId && title) {
        await learnPattern(title, categoryId);
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

      await refetchUsage();

      setTitle("");
      setAmount("");
      setType('expense');
      setCategoryId("");
      setDate(getLocalDate());
      setDescription("");
      setSuggestion(null);
    } catch (error: any) {
      toast({
        title: t('categories.validationError', 'Erro de validação'),
        description: error.errors?.[0]?.message || t('categories.invalidData', 'Dados inválidos'),
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('transactions.add', 'Nova Transação')}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t('transactions.type', 'Tipo')}</Label>
              <Select value={type} onValueChange={(value: 'income' | 'expense') => { setType(value); setCategoryId(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t('transactions.income', 'Receita')}</SelectItem>
                  <SelectItem value="expense">{t('transactions.expense', 'Despesa')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t('transactions.amount', 'Valor')} (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">{t('transactions.title', 'Título')}</Label>
            <Input
              id="title"
              type="text"
              placeholder={t('categories.titlePlaceholder', 'Ex: Mercado, Salário, etc.')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            {/* Smart suggestion */}
            {suggestion && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50 border border-accent">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {t('categories.suggestion', 'Sugestão: {{category}}', { category: suggestion.category_name })}
                </span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="ml-auto h-6 text-xs"
                  onClick={acceptSuggestion}
                >
                  {t('categories.accept', 'Aceitar')}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">{t('transactions.category', 'Categoria')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('categories.selectCategory', 'Selecione uma categoria')} />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(cat => cat.type === type)
                    .map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {translateCategoryName(category.name, t)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">{t('transactions.date', 'Data')}</Label>
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
            <Label htmlFor="description">{t('transactions.description', 'Descrição')} ({t('categories.optional', 'opcional')})</Label>
            <Textarea
              id="description"
              placeholder={t('categories.descriptionPlaceholder', 'Descrição adicional...')}
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
              {t('categories.addTransaction', 'Adicionar Transação')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('common.cancel', 'Cancelar')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
