import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQSection() {
  const faqs = [
    {
      question: "Como funciona a segurança dos meus dados?",
      answer: "Utilizamos criptografia de ponta a ponta e armazenamento seguro no Supabase, com certificação ISO 27001. Seus dados são protegidos com os mais altos padrões de segurança da indústria, incluindo backups automáticos diários."
    },
    {
      question: "Posso cancelar minha assinatura a qualquer momento?",
      answer: "Sim! Você pode cancelar a qualquer momento sem multas, taxas ou burocracia. Seu plano permanece ativo até o final do período pago, e você mantém acesso a todos os seus dados."
    },
    {
      question: "A integração com Google Calendar é automática?",
      answer: "Sim, após conectar sua conta Google (processo de 2 cliques), todos os compromissos são sincronizados automaticamente em tempo real. Alterações feitas na Dona Wilma aparecem no Google Calendar e vice-versa."
    },
    {
      question: "Como funciona o WhatsApp integrado?",
      answer: "Você recebe lembretes e notificações diretamente no seu WhatsApp. Também pode adicionar compromissos e registrar transações conversando naturalmente com a Dona Wilma, sem precisar abrir o aplicativo!"
    },
    {
      question: "Existe um período de teste gratuito?",
      answer: "Sim! O plano Gratuito não tem limite de tempo e oferece recursos essenciais. Você pode começar agora mesmo e fazer upgrade para planos premium quando precisar de mais funcionalidades."
    }
  ];

  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="text-left">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
