import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

export function InteractionExamplesSection() {
  const { t } = useTranslation();

  const examples = Array.from({ length: 12 }, (_, i) => t(`landing.interaction.examples.${i}`));

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-14">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="icon-circle">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
          {t('landing.interaction.title')}
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          {t('landing.interaction.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 max-w-5xl mx-auto">
        {examples.map((example, index) => (
          <Badge 
            key={index}
            variant="outline"
            className="badge-hover px-5 py-2.5 text-sm border-2 border-primary/20 bg-white/50 backdrop-blur-sm cursor-default font-medium"
          >
            {example}
          </Badge>
        ))}
      </div>

      <div className="text-center mt-10">
        <p className="text-muted-foreground text-sm md:text-base">
          {t('landing.interaction.footer')}
        </p>
      </div>
    </section>
  );
}
