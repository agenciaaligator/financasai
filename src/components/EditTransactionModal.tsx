import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Transaction, Category } from "@/hooks/useTransactions";
import { translateCategoryName } from "@/lib/categoryTranslations";

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
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [originalTitle, setOriginalTitle] = useState("");
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (transaction) {
      setTitle(transaction.title);
      setOriginalTitle(transaction.title);
      setAmount(transaction.amount.toString());
      setType(transaction.type as 'income' | 'expense');
      
      if (transaction.category_id) {
        const categoryExists = categories.find(cat => cat.id === transaction.category_id);
        if (categoryExists) {
          setCategoryId(transaction.category_id);
        }
      } else {
        setCategoryId("");
      }
      
      const dateValue = transaction.date.includes('T') 
        ? transaction.date.split('T')[0] 
        : transaction.date;
      setDate(dateValue);
      setDescription(transaction.description || "");
      setSuggestedCategory(null);
    }
  }, [transaction, categories]);

  useEffect(() => {
    if (title !== originalTitle && title.length >= 3) {
      const normalizedTitle = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      const matchedCategory = categories
        .filter(cat => cat.type === type)
        .find(cat => {
          const catName = cat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return normalizedTitle.includes(catName) || catName.includes(normalizedTitle);
        });
      
      if (matchedCategory && matchedCategory.id !== categoryId) {
        setSuggestedCategory(matchedCategory.id);
      } else {
        setSuggestedCategory(null);
      }
    } else {
      setSuggestedCategory(null);
    }
  }, [title, originalTitle, type, categories, categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || !title || !amount) return;

    setLoading(true);
    
    const { error } = await supabase
      .from('transactions')
      .update({
        title,
        amount: parseFloat(amount),
        type,
        category_id: categoryId || null,
        date,
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction.id)
      .select();

    if (error) {
      toast({
        title: t('editTransaction.updateError'),
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: t('editTransaction.updateSuccess'),
        description: t('editTransaction.updateSuccessDesc')
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
          <DialogTitle>{t('editTransaction.title')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editType">{t('editTransaction.type')}</Label>
              <Select value={type} onValueChange={(value: 'income' | 'expense') => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t('editTransaction.income')}</SelectItem>
                  <SelectItem value="expense">{t('editTransaction.expense')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editAmount">{t('editTransaction.amount')}</Label>
              <Input
                id="editAmount"
                type="number"
                step="0.01"
                placeholder={t('editTransaction.amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editTitle">{t('editTransaction.titleField')}</Label>
            <Input
              id="editTitle"
              type="text"
              placeholder={t('editTransaction.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editCategory">
                {t('editTransaction.category')}
                {suggestedCategory && (
                  <span className="ml-2 text-xs text-amber-600 font-normal">
                    {t('editTransaction.suggestion', { name: categories.find(c => c.id === suggestedCategory)?.name })}
                    <Button 
                      type="button" 
                      variant="link" 
                      size="sm"
                      onClick={() => {
                        setCategoryId(suggestedCategory);
                        setSuggestedCategory(null);
                      }}
                      className="ml-1 h-auto p-0 text-xs underline"
                    >
                      {t('editTransaction.apply')}
                    </Button>
                  </span>
                )}
              </Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('editTransaction.selectCategory')} />
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
              <Label htmlFor="editDate">{t('editTransaction.date')}</Label>
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
            <Label htmlFor="editDescription">{t('editTransaction.description')}</Label>
            <Textarea
              id="editDescription"
              placeholder={t('editTransaction.descriptionPlaceholder')}
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
              {loading ? t('editTransaction.saving') : t('editTransaction.saveChanges')}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('editTransaction.cancel')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
