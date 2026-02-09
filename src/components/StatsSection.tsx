import { Card, CardContent } from "@/components/ui/card";
import { Brain, Clock, Shield, Smartphone } from "lucide-react";

interface Benefit {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function StatsSection() {
  const benefits: Benefit[] = [
    {
      icon: <Smartphone className="h-8 w-8 text-primary" />,
      title: "Direto no WhatsApp",
      description: "Registre finanças e compromissos sem abrir nenhum app"
    },
    {
      icon: <Brain className="h-8 w-8 text-primary" />,
      title: "IA que entende você",
      description: "Categorização automática com inteligência artificial"
    },
    {
      icon: <Clock className="h-8 w-8 text-primary" />,
      title: "Disponível 24h",
      description: "Sua assessora pessoal trabalhando o tempo todo"
    },
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "Seguro e privado",
      description: "Seus dados protegidos com criptografia de ponta"
    }
  ];

  return (
    <section className="container mx-auto px-4 py-20 bg-muted/30">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Por que escolher a Dona Wilma?
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Simplicidade e tecnologia para facilitar seu dia a dia
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {benefits.map((benefit, index) => (
          <Card key={index} className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-6 space-y-3 flex flex-col items-center">
              {benefit.icon}
              <h3 className="text-lg font-semibold">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">
                {benefit.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
