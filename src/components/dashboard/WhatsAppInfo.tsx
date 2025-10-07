import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WhatsAppInfo() {
  return (
    <Card className="mt-6 bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle>Integração WhatsApp</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Gerencie suas finanças pelo WhatsApp com recursos avançados:
        </p>
        
        <div className="space-y-4">
          {/* Adicionar Transações */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold">📝 Adicionar Transações:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• "gasto 50 mercado" - adiciona despesa</li>
              <li>• "receita 1000 salario" - adiciona receita</li>
              <li>• "+100 freelance" - adiciona receita</li>
              <li>• "-30 combustível hoje" - adiciona despesa</li>
            </ul>
          </div>

          {/* OCR de Notas Fiscais */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold">📸 Enviar Nota Fiscal (OCR):</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Tire uma foto da nota fiscal</li>
              <li>• Envie a imagem pelo WhatsApp</li>
              <li>• A IA extrai valor, local e categoria automaticamente!</li>
            </ul>
          </div>

          {/* Editar e Excluir */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold">✏️ Editar/Excluir Transações:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• "editar última" - edita a última transação</li>
              <li>• "excluir última" - deleta a última transação</li>
            </ul>
          </div>

          {/* Consultas */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold">📊 Consultas e Relatórios:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• "saldo" - ver saldo atual</li>
              <li>• "hoje" - relatório do dia</li>
              <li>• "semana" - relatório semanal</li>
              <li>• "mes" - relatório mensal</li>
            </ul>
          </div>

          {/* Ajuda */}
          <div className="bg-primary/10 p-3 rounded-lg">
            <p className="text-sm font-medium">💡 Dica: Digite "ajuda" no WhatsApp para ver todos os comandos disponíveis!</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}