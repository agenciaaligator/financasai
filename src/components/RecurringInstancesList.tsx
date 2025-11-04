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
import { RecurringInstance, RecurringTransaction } from "@/hooks/useRecurringTransactions";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Clock, Pause, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RecurringInstancesListProps {
  instances: RecurringInstance[];
  recurringTransactions: RecurringTransaction[];
  onPayInstance: (instanceId: string) => Promise<void>;
  onPostponeInstance: (instanceId: string, newDate: string, notes?: string) => Promise<void>;
}

export function RecurringInstancesList({
  instances,
  recurringTransactions,
  onPayInstance,
  onPostponeInstance,
}: RecurringInstancesListProps) {
  const [postponeDialog, setPostponeDialog] = useState<{
    open: boolean;
    instanceId: string;
    currentDate: string;
  }>({ open: false, instanceId: "", currentDate: "" });
  
  const [postponeData, setPostponeData] = useState({
    newDate: "",
    notes: "",
  });

  const getRecurringTransaction = (instanceId: string) => {
    const instance = instances.find((i) => i.id === instanceId);
    return recurringTransactions.find(
      (rt) => rt.id === instance?.recurring_transaction_id
    );
  };

  const getStatusBadge = (instance: RecurringInstance) => {
    switch (instance.status) {
      case "paid":
        return <Badge className="bg-success">Pago</Badge>;
      case "postponed":
        return <Badge variant="secondary">Adiado</Badge>;
      case "paused":
        return <Badge variant="outline">Pausado</Badge>;
      default:
        return isPast(parseISO(instance.due_date)) ? (
          <Badge variant="destructive">Vencido</Badge>
        ) : (
          <Badge variant="outline">Agendado</Badge>
        );
    }
  };

  const handlePostpone = async () => {
    await onPostponeInstance(
      postponeDialog.instanceId,
      postponeData.newDate,
      postponeData.notes
    );
    setPostponeDialog({ open: false, instanceId: "", currentDate: "" });
    setPostponeData({ newDate: "", notes: "" });
  };

  const pendingInstances = instances.filter(
    (i) => i.status === "scheduled" || i.status === "postponed"
  );

  return (
    <>
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle>Próximos Vencimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInstances.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum vencimento pendente
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInstances.map((instance) => {
                  const recurring = getRecurringTransaction(instance.id);
                  return (
                    <TableRow key={instance.id}>
                      <TableCell className="font-medium">
                        {recurring?.title || "—"}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(instance.due_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            recurring?.type === "expense"
                              ? "text-destructive"
                              : "text-success"
                          }
                        >
                          {recurring?.type === "expense" ? "-" : "+"}
                          {instance.amount.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(instance)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {instance.status === "scheduled" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onPayInstance(instance.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Dar Baixa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPostponeDialog({
                                  open: true,
                                  instanceId: instance.id,
                                  currentDate: instance.due_date,
                                });
                                setPostponeData({
                                  newDate: instance.due_date,
                                  notes: instance.notes || "",
                                });
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Adiar
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para adiar */}
      <Dialog
        open={postponeDialog.open}
        onOpenChange={(open) =>
          setPostponeDialog({ ...postponeDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adiar Vencimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Data de Vencimento</Label>
              <Input
                type="date"
                value={postponeData.newDate}
                onChange={(e) =>
                  setPostponeData({ ...postponeData, newDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={postponeData.notes}
                onChange={(e) =>
                  setPostponeData({ ...postponeData, notes: e.target.value })
                }
                placeholder="Motivo do adiamento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setPostponeDialog({ open: false, instanceId: "", currentDate: "" })
              }
            >
              Cancelar
            </Button>
            <Button onClick={handlePostpone}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
