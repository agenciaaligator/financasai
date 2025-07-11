import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

interface AddTransactionButtonProps {
  showForm: boolean;
  onToggle: () => void;
}

export function AddTransactionButton({ showForm, onToggle }: AddTransactionButtonProps) {
  return (
    <div className="mb-6">
      <Button 
        onClick={onToggle}
        className="bg-gradient-primary hover:shadow-primary transition-all duration-200"
      >
        <PlusCircle className="h-4 w-4 mr-2" />
        {showForm ? 'Cancelar' : 'Nova Transação'}
      </Button>
    </div>
  );
}