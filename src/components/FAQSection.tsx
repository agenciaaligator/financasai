import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";
import { CALENDAR_ENABLED } from "@/lib/featureFlags";

export function FAQSection() {
  const { t } = useTranslation();

  // Itens 4 e 5 tratam do Google Agenda — ocultos enquanto a integração não está liberada
  const faqIndices = CALENDAR_ENABLED ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3];

  return (
    <Accordion type="single" collapsible className="w-full space-y-4">
      {faqIndices.map((index) => (
        <AccordionItem 
          key={index} 
          value={`item-${index}`}
          className="modern-card px-6 border-0"
        >
          <AccordionTrigger className="faq-trigger text-left font-semibold py-5 hover:no-underline">
            {t(`landing.faq.items.${index}.question`)}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
            {t(`landing.faq.items.${index}.answer`)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
