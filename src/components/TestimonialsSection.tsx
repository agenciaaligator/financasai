import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, DollarSign, Calendar } from "lucide-react";

interface Step {
  icon: React.ReactNode;
  step: string;
  title: string;
  description: string;
}

export function TestimonialsSection() {
  const steps: Step[] = [
    {
      icon: <MessageSquare className="h-10 w-10 text-primary" />,
      step: "1",
      title: "Envie uma mensagem",
      description: "Mande um texto ou áudio pelo WhatsApp como 'gastei 50 no mercado' ou 'reunião amanhã às 10h'"
    },
    {
      icon: <DollarSign className="h-10 w-10 text-primary" />,
      step: "2",
      title: "A IA organiza tudo",
      description: "A Dona Wilma entende, categoriza e registra automaticamente suas finanças e compromissos"
    },
    {
      icon: <Calendar className="h-10 w-10 text-primary" />,
      step: "3",
      title: "Acompanhe no painel",
      description: "Veja gráficos, relatórios e sua agenda completa no painel web ou receba resumos no WhatsApp"
    }
  ];

  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      {steps.map((item, index) => (
        <Card key={index} className="text-center hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary/20">
          <CardContent className="p-8 space-y-4 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {item.icon}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              {item.step}
            </div>
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="text-sm text-muted-foreground">
              {item.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
