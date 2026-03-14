import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";

interface LimitWarningProps {
  type: "transaction" | "category";
  current: number;
  limit: number;
  planName: string;
}

export const LimitWarning = ({ type, current, limit, planName }: LimitWarningProps) => {
  const { t } = useTranslation();
  
  if (limit === null || limit === undefined || current === undefined || current === null) {
    return null;
  }
  
  const percentage = (current / limit) * 100;
  if (percentage < 80) return null;

  const isAtLimit = percentage >= 100;
  const itemName = type === "transaction" 
    ? t('limitWarning.transactions') 
    : t('limitWarning.categories');

  return (
    <Alert variant={isAtLimit ? "destructive" : "default"} className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {isAtLimit 
          ? t('limitWarning.limitReached', { item: itemName }) 
          : t('limitWarning.limitWarning', { item: itemName })}
      </AlertTitle>
      <AlertDescription>
        <span>
          {t('limitWarning.usageMessage', { current, limit, item: itemName, plan: planName })}
        </span>
      </AlertDescription>
    </Alert>
  );
};
