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
    <Accordion type="single" collapsible className="w-full">
      {faqIndices.map((index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="text-left">
            {t(`landing.faq.items.${index}.question`)}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {t(`landing.faq.items.${index}.answer`)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
