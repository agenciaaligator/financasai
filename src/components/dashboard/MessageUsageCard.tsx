import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { useMessageUsage } from "@/hooks/useMessageUsage";
import { useTranslation } from "react-i18next";

export function MessageUsageCard() {
  const { status, loading } = useMessageUsage();
  const { t } = useTranslation();

  if (loading || !status || !status.limite) return null;

  const { qtd_atual, limite, percentual, estado } = status;
  const clamped = Math.min(percentual, 120);

  const barColor =
    estado === "blocked"
      ? "bg-destructive"
      : estado === "over"
      ? "bg-destructive/80"
      : estado === "warning"
      ? "bg-yellow-500"
      : "bg-primary";

  const label =
    estado === "blocked"
      ? t("usage.blocked", "Limite atingido — respostas pausadas")
      : estado === "over"
      ? t("usage.over", "Você passou da franquia")
      : estado === "warning"
      ? t("usage.warning", "Você está perto do limite")
      : t("usage.ok", "Uso saudável");

  return (
    <Card className="border-0 shadow-sm md:col-span-1">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MessageCircle className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-1">
              {t("usage.thisMonth", "Seu uso este mês")}
            </p>
            <p className="font-heading text-lg font-bold text-foreground leading-tight">
              {qtd_atual.toLocaleString("pt-BR")}
              <span className="text-sm text-muted-foreground font-normal">
                {" "}
                / {limite.toLocaleString("pt-BR")}{" "}
                {t("usage.messages", "mensagens")}
              </span>
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${barColor} transition-all`}
                style={{ width: `${(clamped / 120) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
