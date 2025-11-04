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
import { Plus, Pause, Play, Pencil, Trash2, Building2, Home } from "lucide-react";
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

interface RecurringTransactionsManagerProps {
  categories: any[];
}

export function RecurringTransactionsManager({
  categories,
}: RecurringTransactionsManagerProps) {
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

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: "Diária",
      weekly: "Semanal",
      monthly: "Mensal",
      yearly: "Anual",
      custom: "Personalizada",
    };
    return labels[frequency] || frequency;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando contas fixas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contas Fixas</h2>
          <p className="text-muted-foreground">
            Gerencie suas receitas e despesas recorrentes
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingTransaction(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta Fixa
        </Button>
      </div>

      {/* Lista de próximos vencimentos */}
      <RecurringInstancesList
        instances={instances}
        recurringTransactions={recurringTransactions}
        onPayInstance={payInstance}
        onPostponeInstance={postponeInstance}
      />

      {/* Lista de contas fixas cadastradas */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle>Contas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {recurringTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Nenhuma conta fixa cadastrada
              </p>
              <Button
                onClick={() => {
                  setEditingTransaction(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Conta
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Contexto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                        {transaction.type === "expense" ? "Despesa" : "Receita"}
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
                      {getFrequencyLabel(transaction.frequency)}
                    </TableCell>
                    <TableCell>
                      {transaction.organization_id ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span className="text-sm">Empresa</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Home className="h-4 w-4" />
                          <span className="text-sm">Pessoal</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.is_active ? "default" : "secondary"}>
                        {transaction.is_active ? "Ativa" : "Pausada"}
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

      {/* Form Dialog */}
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

      {/* Delete Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Conta Fixa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta conta fixa? Todas as instâncias
              pendentes também serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
