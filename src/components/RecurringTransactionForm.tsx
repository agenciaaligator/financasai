import { useState, useEffect } from "react";
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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    type: "expense",
    category_id: "",
    frequency: "monthly",
    day_of_month: "1",
    day_of_week: "1",
    interval_days: "1",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      setFormData({
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
      });
    }
  }, [open, editData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      amount: parseFloat(formData.amount),
      day_of_month: formData.frequency === "monthly" ? parseInt(formData.day_of_month) : null,
      day_of_week: formData.frequency === "weekly" ? parseInt(formData.day_of_week) : null,
      interval_days: formData.frequency === "custom" ? parseInt(formData.interval_days) : null,
      end_date: formData.end_date || null,
      reminders: [1440, 60],
    };

    await onSubmit(data);
    onOpenChange(false);
  };

  const filteredCategories = categories.filter(
    (cat) => cat.type === formData.type
  );

  const weekdays = [
    { value: "0", label: t("recurring.form.sunday") },
    { value: "1", label: t("recurring.form.monday") },
    { value: "2", label: t("recurring.form.tuesday") },
    { value: "3", label: t("recurring.form.wednesday") },
    { value: "4", label: t("recurring.form.thursday") },
    { value: "5", label: t("recurring.form.friday") },
    { value: "6", label: t("recurring.form.saturday") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editData ? t("recurring.edit") : t("recurring.add")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">{t("recurring.form.title")} *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t("recurring.form.titlePlaceholder")}
              required
            />
          </div>

          {/* Tipo e Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t("recurring.form.type")} *</Label>
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
                  <SelectItem value="expense">{t("recurring.type.expense")}</SelectItem>
                  <SelectItem value="income">{t("recurring.type.income")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t("recurring.form.amount")} *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder={t("recurring.form.amountPlaceholder")}
                required
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="category">{t("recurring.form.category")}</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) =>
                setFormData({ ...formData, category_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("recurring.form.categoryPlaceholder")} />
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
            <Label htmlFor="frequency">{t("recurring.form.frequencyLabel")} *</Label>
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
                <SelectItem value="daily">{t("recurring.frequency.daily")}</SelectItem>
                <SelectItem value="weekly">{t("recurring.frequency.weekly")}</SelectItem>
                <SelectItem value="monthly">{t("recurring.frequency.monthly")}</SelectItem>
                <SelectItem value="yearly">{t("recurring.frequency.yearly")}</SelectItem>
                <SelectItem value="custom">{t("recurring.frequency.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.frequency === "monthly" && (
            <div className="space-y-2">
              <Label htmlFor="day_of_month">{t("recurring.form.dayOfMonth")} *</Label>
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
              <Label htmlFor="day_of_week">{t("recurring.form.dayOfWeek")} *</Label>
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
                  {weekdays.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.frequency === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="interval_days">{t("recurring.form.intervalDays")} *</Label>
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
              <Label htmlFor="start_date">{t("recurring.form.startDate")} *</Label>
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
              <Label htmlFor="end_date">{t("recurring.form.endDate")}</Label>
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
            <Label htmlFor="description">{t("recurring.form.notes")}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t("recurring.form.notesPlaceholder")}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">
              {editData ? t("recurring.form.saveChanges") : t("recurring.form.createBill")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
