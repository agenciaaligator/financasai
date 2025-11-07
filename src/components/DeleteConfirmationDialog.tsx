import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmationDialogProps {
  itemName: string;
  itemType: 'transação' | 'categoria' | 'compromisso' | 'membro';
  onConfirm: () => void;
  children: React.ReactNode;
}

export function DeleteConfirmationDialog({
  itemName,
  itemType,
  onConfirm,
  children
}: DeleteConfirmationDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const expectedText = "DELETAR";
  
  const handleConfirm = () => {
    onConfirm();
    setConfirmText("");
    setOpen(false);
  };
  
  const handleCancel = () => {
    setConfirmText("");
    setOpen(false);
  };
  
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confirmar exclusão
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Você está prestes a deletar {itemType === 'transação' ? 'a' : 'o'} {itemType}{" "}
              <strong>"{itemName}"</strong>.
            </p>
            <p className="text-destructive font-semibold">
              ⚠️ Esta ação não pode ser desfeita!
            </p>
            <p>
              Digite <code className="bg-muted px-2 py-1 rounded font-mono">{expectedText}</code> para confirmar:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Digite DELETAR"
              className="border-destructive focus:ring-destructive"
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={confirmText !== expectedText}
            className="bg-destructive hover:bg-destructive/90"
          >
            Deletar permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
