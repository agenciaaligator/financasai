import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRecurringTransactions } from "@/hooks/useRecurringTransactions";
import { RecurringTransactionForm } from "./RecurringTransactionForm";
import { RecurringInstancesList } from "./RecurringInstancesList";
import { Plus, Pause, Play, Pencil, Trash2 } from "lucide-react";
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
import { useTranslation } from "react-i18next";

interface RecurringTransactionsManagerProps {
  categories: any[];
}

export function RecurringTransactionsManager({
  categories,
}: RecurringTransactionsManagerProps) {
  const { t } = useTranslation();
  const {
    recurringTransactions,
    instances,
    loading,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    payInstance,
    postponeInstance,
    pauseRecurring,
    resumeRecurring,
  } = useRecurringTransactions();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string;
  }>({ open: false, id: "" });

  const handleSubmit = async (data: any) => {
    if (editingTransaction) {
      await updateRecurringTransaction(editingTransaction.id, data);
    } else {
      await addRecurringTransaction(data);
    }
    setEditingTransaction(null);
  };

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    await deleteRecurringTransaction(deleteDialog.id);
    setDeleteDialog({ open: false, id: "" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("recurring.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("recurring.title")}</h2>
          <p className="text-muted-foreground">{t("recurring.description")}</p>
        </div>
        <Button
          onClick={() => {
            setEditingTransaction(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("recurring.add")}
        </Button>
      </div>

      <RecurringInstancesList
        instances={instances}
        recurringTransactions={recurringTransactions}
        onPayInstance={payInstance}
        onPostponeInstance={postponeInstance}
      />

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle>{t("recurring.registeredBills")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recurringTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {t("recurring.noBills")}
              </p>
              <Button
                onClick={() => {
                  setEditingTransaction(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("recurring.createFirst")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("recurring.columns.title")}</TableHead>
                  <TableHead>{t("recurring.columns.type")}</TableHead>
                  <TableHead>{t("recurring.columns.amount")}</TableHead>
                  <TableHead>{t("recurring.columns.frequency")}</TableHead>
                  <TableHead>{t("recurring.columns.status")}</TableHead>
                  <TableHead className="text-right">{t("recurring.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {transaction.title}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transaction.type === "expense"
                            ? "destructive"
                            : "default"
                        }
                      >
                        {transaction.type === "expense" ? t("recurring.type.expense") : t("recurring.type.income")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          transaction.type === "expense"
                            ? "text-destructive"
                            : "text-success"
                        }
                      >
                        {transaction.type === "expense" ? "-" : "+"}
                        {transaction.amount.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {t(`recurring.frequency.${transaction.frequency}`)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.is_active ? "default" : "secondary"}>
                        {transaction.is_active ? t("recurring.status.active") : t("recurring.status.paused")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            transaction.is_active
                              ? pauseRecurring(transaction.id)
                              : resumeRecurring(transaction.id)
                          }
                        >
                          {transaction.is_active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(transaction)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDeleteDialog({ open: true, id: transaction.id })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecurringTransactionForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingTransaction(null);
        }}
        onSubmit={handleSubmit}
        categories={categories}
        editData={editingTransaction}
      />

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("recurring.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("recurring.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t("recurring.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
