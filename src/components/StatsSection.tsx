import { Card, CardContent } from "@/components/ui/card";

interface Stat {
  label: string;
  sublabel: string;
  value: string;
  description: string;
}

export function StatsSection() {
  const stats: Stat[] = [
    {
      label: "Processamento em segundos",
      sublabel: "REGISTROS PROCESSADOS",
      value: "+150.2K",
      description: "Categorizadas automaticamente"
    },
    {
      label: "Crescendo a cada dia",
      sublabel: "VALOR GERENCIADO",
      value: "+163.7 Milhões",
      description: "Em finanças organizadas"
    },
    {
      label: "Lembretes ilimitados",
      sublabel: "COMPROMISSOS LEMBRADOS",
      value: "+87.3K",
      description: "De compromissos organizados"
    },
    {
      label: "Tecnologia de ponta",
      sublabel: "PRECISÃO DA IA",
      value: "99.9%",
      description: "Na categorização e registro automático"
    }
  ];

  return (
    <section className="container mx-auto px-4 py-20 bg-muted/30">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Números que comprovam
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Milhares de transações e compromissos gerenciados com precisão e inteligência
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-8">
        {stats.map((stat, index) => (
          <Card key={index} className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {stat.sublabel}
              </p>
              <p className="text-4xl md:text-5xl font-bold text-primary">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground">
                {stat.description}
              </p>
              <p className="text-xs text-muted-foreground/70 pt-2">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        92% dos usuários avaliaram como 'excelente' o donawilma.com
      </p>
    </section>
  );
}
