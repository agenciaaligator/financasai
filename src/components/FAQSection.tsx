import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";

export function FAQSection() {
  const { t } = useTranslation();

  const faqIndices = [0, 1, 2, 3];

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
