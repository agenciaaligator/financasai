import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

export function InteractionExamplesSection() {
  const { t } = useTranslation();

  const examples = Array.from({ length: 12 }, (_, i) => t(`landing.interaction.examples.${i}`));

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <MessageSquare className="h-8 w-8 text-primary" />
          <h2 className="text-3xl md:text-4xl font-bold">
            {t('landing.interaction.title')}
          </h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          {t('landing.interaction.subtitle')}
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
          {t('landing.interaction.footer')}
        </p>
      </div>
    </section>
  );
}
