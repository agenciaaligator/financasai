import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface BalanceAlertProps {
  isNegative: boolean;
}

export function BalanceAlert({ isNegative }: BalanceAlertProps) {
  if (!isNegative) return null;

  return (
    <Card className="mb-6 border-destructive bg-destructive/5">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-destructive font-medium">Atenção! Seu saldo está negativo</p>
            <p className="text-sm text-muted-foreground">
              Considere revisar seus gastos ou aumentar sua receita
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}