import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WhatsAppInfo() {
  return (
    <Card className="mt-6 bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle>Integração WhatsApp</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Você pode adicionar transações via WhatsApp usando os seguintes formatos:
        </p>
        <div className="bg-muted/30 p-4 rounded-lg space-y-2">
          <p className="text-sm"><strong>Exemplos:</strong></p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• "gasto 50 mercado" - adiciona despesa</li>
            <li>• "receita 1000 salario" - adiciona receita</li>
            <li>• "+100 freelance" - adiciona receita</li>
            <li>• "-30 combustível" - adiciona despesa</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}