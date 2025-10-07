import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { UpgradeModal } from "../UpgradeModal";

interface LimitWarningProps {
  type: "transaction" | "category";
  current: number;
  limit: number;
  planName: string;
}

export const LimitWarning = ({ type, current, limit, planName }: LimitWarningProps) => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Don't show warning for unlimited plans or invalid data
  if (limit === null || limit === undefined || current === undefined || current === null) {
    return null;
  }
  
  const percentage = (current / limit) * 100;
  
  // Only show warning at 80% or above
  if (percentage < 80) return null;

  const isAtLimit = percentage >= 100;
  const itemName = type === "transaction" ? "transações" : "categorias";

  return (
    <>
      <Alert variant={isAtLimit ? "destructive" : "default"} className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>
          {isAtLimit ? `Limite de ${itemName} atingido` : `Atenção: Limite de ${itemName}`}
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Você está usando {current} de {limit} {itemName} disponíveis no plano {planName}.
            {isAtLimit && " Faça upgrade para continuar adicionando."}
          </span>
          <Button 
            variant={isAtLimit ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowUpgradeModal(true)}
            className="ml-4"
          >
            Fazer Upgrade
          </Button>
        </AlertDescription>
      </Alert>

      <UpgradeModal 
        open={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        reason={`Você atingiu o limite de ${itemName} do plano ${planName}`}
      />
    </>
  );
};
