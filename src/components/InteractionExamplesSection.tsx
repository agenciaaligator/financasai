import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

export function InteractionExamplesSection() {
  const examples = [
    "Gastei 200 reais no cartão",
    "Recebi 10 mil reais de salário",
    "Quanto gastei hoje?",
    "Saldo do mês?",
    "Paguei 30 reais de gasolina",
    "Tenho aluguel dia 22",
    "Quanto gastei esse mês?",
    "Quais lembretes eu tenho hoje?",
    "Reunião amanhã às 14h",
    "Lembrar de ligar para o cliente",
    "Consulta médica na sexta",
    "Aniversário do João dia 15"
  ];

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <MessageSquare className="h-8 w-8 text-primary" />
          <h2 className="text-3xl md:text-4xl font-bold">
            Interaja com a Dona Wilma 24h por dia
          </h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Pergunte o que quiser sobre suas finanças ou compromissos. 
          Veja alguns exemplos do que você pode dizer:
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 max-w-5xl mx-auto">
        {examples.map((example, index) => (
          <Badge 
            key={index}
            variant="outline"
            className="px-4 py-2 text-sm border-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all cursor-default"
          >
            {example}
          </Badge>
        ))}
      </div>

      <div className="text-center mt-8">
        <p className="text-muted-foreground">
          E muito mais... A IA entende linguagem natural e está sempre pronta para ajudar!
        </p>
      </div>
    </section>
  );
}
