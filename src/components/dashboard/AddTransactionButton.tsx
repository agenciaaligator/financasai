import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AddTransactionButtonProps {
  showForm: boolean;
  onToggle: () => void;
}

export function AddTransactionButton({ showForm, onToggle }: AddTransactionButtonProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-6">
      <Button 
        onClick={onToggle}
        className="bg-gradient-primary hover:shadow-primary transition-all duration-200"
      >
        <PlusCircle className="h-4 w-4 mr-2" />
        {showForm ? t('common.cancel', 'Cancelar') : t('transactions.add', 'Nova Transação')}
      </Button>
    </div>
  );
}