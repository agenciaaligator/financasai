import { useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmationDialogProps {
  itemName: string;
  itemType: 'transaction' | 'category' | 'commitment' | 'member';
  onConfirm: () => void;
  children: React.ReactNode;
}

export function DeleteConfirmationDialog({
  itemName,
  itemType,
  onConfirm,
  children
}: DeleteConfirmationDialogProps) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const expectedText = t('deleteDialog.confirmWord');
  
  const handleConfirm = () => {
    onConfirm();
    setConfirmText("");
    setOpen(false);
  };
  
  const handleCancel = () => {
    setConfirmText("");
    setOpen(false);
  };

  const translatedItemType = t(`deleteDialog.${itemType}`);
  const article = (itemType === 'commitment' || itemType === 'member') 
    ? t('deleteDialog.theItemMasc') 
    : t('deleteDialog.theItem');
  
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('deleteDialog.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              {t('deleteDialog.aboutToDelete')} {article} {translatedItemType}{" "}
              <strong>"{itemName}"</strong>.
            </p>
            <p className="text-destructive font-semibold">
              {t('deleteDialog.cannotBeUndone')}
            </p>
            <p>
              {t('deleteDialog.typeToConfirm', { word: expectedText }).split(expectedText)[0]}
              <code className="bg-muted px-2 py-1 rounded font-mono">{expectedText}</code>
              {t('deleteDialog.typeToConfirm', { word: expectedText }).split(expectedText)[1]}
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder={t('deleteDialog.placeholder')}
              className="border-destructive focus:ring-destructive"
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {t('deleteDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={confirmText !== expectedText}
            className="bg-destructive hover:bg-destructive/90"
          >
            {t('deleteDialog.deletePermanently')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
