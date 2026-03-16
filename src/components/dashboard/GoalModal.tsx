import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { translateCategoryName } from "@/lib/categoryTranslations";

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (categoryId: string, amount: number) => Promise<any>;
  categories: any[];
  existingGoalCategoryIds: string[];
  editingGoal?: { categoryId: string; amount: number } | null;
}

export function GoalModal({ open, onClose, onSave, categories, existingGoalCategoryIds, editingGoal }: GoalModalProps) {
  const { t } = useTranslation();
  const [categoryId, setCategoryId] = useState(editingGoal?.categoryId || "");
  const [amount, setAmount] = useState(editingGoal?.amount?.toString() || "");
  const [saving, setSaving] = useState(false);

  const expenseCategories = categories.filter((c: any) => c.type === "expense");

  // When editing, show all; when creating, hide already-used categories
  const availableCategories = editingGoal
    ? expenseCategories
    : expenseCategories.filter((c: any) => !existingGoalCategoryIds.includes(c.id));

  const handleSave = async () => {
    if (!categoryId || !amount || Number(amount) <= 0) return;
    setSaving(true);
    const result = await onSave(categoryId, Number(amount));
    setSaving(false);
    if (result?.success || !result?.error) {
      setCategoryId("");
      setAmount("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingGoal ? t('goals.editGoal', 'Editar Meta') : t('goals.newGoal', 'Nova Meta Mensal')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>{t('goals.category', 'Categoria')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={!!editingGoal}>
              <SelectTrigger>
                <SelectValue placeholder={t('goals.selectCategory', 'Selecione uma categoria')} />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat: any) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: cat.color }} />
                      {translateCategoryName(cat.name, t)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('goals.monthlyLimit', 'Limite mensal')}</Label>
            <Input
              type="number"
              min="1"
              step="0.01"
              inputMode="decimal"
              placeholder="800.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button onClick={handleSave} disabled={saving || !categoryId || !amount}>
              {t('common.save', 'Salvar')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
