import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BalanceAlertProps {
  isNegative: boolean;
}

export function BalanceAlert({ isNegative }: BalanceAlertProps) {
  const { t } = useTranslation();
  
  if (!isNegative) return null;

  return (
    <Card className="border-l-4 border-l-warning bg-warning/5 border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
            <Info className="h-4 w-4 text-warning" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t('dashboard.balanceAlert.title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.balanceAlert.description')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
