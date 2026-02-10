import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LimitWarningProps {
  type: "transaction" | "category";
  current: number;
  limit: number;
  planName: string;
}

export const LimitWarning = ({ type, current, limit, planName }: LimitWarningProps) => {
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
    <Alert variant={isAtLimit ? "destructive" : "default"} className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {isAtLimit ? `Limite de ${itemName} atingido` : `Atenção: Limite de ${itemName}`}
      </AlertTitle>
      <AlertDescription>
        <span>
          Você está usando {current} de {limit} {itemName} disponíveis no plano {planName}.
        </span>
      </AlertDescription>
    </Alert>
  );
};
