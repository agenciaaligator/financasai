import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Pencil } from "lucide-react";
import { GoalModal } from "./GoalModal";
import { GoalProgress } from "@/hooks/useMonthlyGoals";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MonthlyGoalsSectionProps {
  goalsWithProgress: GoalProgress[];
  categories: any[];
  existingGoalCategoryIds: string[];
  onAddGoal: (categoryId: string, amount: number) => Promise<any>;
  onDeleteGoal: (goalId: string) => void;
  loading: boolean;
}

function getProgressColor(pct: number): string {
  if (pct >= 90) return "bg-destructive";
  if (pct >= 70) return "bg-[hsl(var(--warning))]";
  return "bg-[hsl(var(--success))]";
}

function getProgressLabel(pct: number, t: any): string {
  if (pct >= 100) return t('goals.exceeded', 'Excedido!');
  if (pct >= 90) return t('goals.critical', 'Crítico');
  if (pct >= 70) return t('goals.attention', 'Atenção');
  return t('goals.onTrack', 'No caminho');
}

export function MonthlyGoalsSection({
  goalsWithProgress,
  categories,
  existingGoalCategoryIds,
  onAddGoal,
  onDeleteGoal,
  loading,
}: MonthlyGoalsSectionProps) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<{ categoryId: string; amount: number } | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  const handleEdit = (gp: GoalProgress) => {
    setEditingGoal({ categoryId: gp.goal.category_id, amount: gp.goal.amount });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingGoal(null);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-semibold text-foreground">
            🎯 {t('goals.title', 'Metas Mensais')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('goals.subtitle', 'Defina limites de gastos por categoria e acompanhe seu progresso')}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          {t('goals.addGoal', 'Definir Meta')}
        </Button>
      </div>

      {goalsWithProgress.length === 0 ? (
        <Card className="dw-card bg-card shadow-card border-0">
          <CardContent className="py-12 text-center">
            <p className="text-4xl mb-4">🎯</p>
            <p className="text-lg font-medium text-foreground mb-2">
              {t('goals.emptyTitle', 'Nenhuma meta definida')}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {t('goals.emptyDesc', 'Defina metas para acompanhar seus gastos por categoria')}
            </p>
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('goals.createFirst', 'Criar primeira meta')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goalsWithProgress.map((gp) => {
            const clampedPct = Math.min(gp.percentage, 100);
            const remaining = gp.goal.amount - gp.spent;

            return (
              <TooltipProvider key={gp.goal.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="dw-card bg-card shadow-card border-0 relative group">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full inline-block"
                              style={{ backgroundColor: gp.categoryColor }}
                            />
                            <span className="font-medium">{gp.categoryName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {gp.percentage >= 90 && (
                              <Badge variant="destructive" className="text-xs">
                                {gp.percentage}%
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleEdit(gp)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              onClick={() => setDeletingGoalId(gp.goal.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="relative">
                          <Progress value={clampedPct} className="h-3" />
                          <div
                            className={`absolute inset-0 h-3 rounded-full ${getProgressColor(gp.percentage)} transition-all`}
                            style={{ width: `${clampedPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {formatCurrency(gp.spent)} / {formatCurrency(gp.goal.amount)}
                          </span>
                          <span className={`font-medium ${gp.percentage >= 90 ? 'text-destructive' : gp.percentage >= 70 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--success))]'}`}>
                            {getProgressLabel(gp.percentage, t)}
                          </span>
                        </div>
                        {remaining > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {t('goals.remaining', 'Restam {{value}}', { value: formatCurrency(remaining) })}
                          </p>
                        )}
                        {remaining <= 0 && (
                          <p className="text-xs text-destructive font-medium">
                            {t('goals.overBudget', 'Estourou {{value}}', { value: formatCurrency(Math.abs(remaining)) })}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('goals.tooltip', 'Você já gastou {{spent}} de {{total}} nesta categoria', { spent: formatCurrency(gp.spent), total: formatCurrency(gp.goal.amount) })}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}

      <GoalModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSave={onAddGoal}
        categories={categories}
        existingGoalCategoryIds={existingGoalCategoryIds}
        editingGoal={editingGoal}
      />

      <DeleteConfirmationDialog
        open={!!deletingGoalId}
        onConfirm={() => {
          if (deletingGoalId) onDeleteGoal(deletingGoalId);
          setDeletingGoalId(null);
        }}
        onCancel={() => setDeletingGoalId(null)}
        title={t('goals.deleteTitle', 'Excluir Meta')}
        description={t('goals.deleteDesc', 'Tem certeza que deseja excluir esta meta?')}
      />
    </div>
  );
}
