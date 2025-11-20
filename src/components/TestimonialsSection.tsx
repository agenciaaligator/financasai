import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Quote } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface Testimonial {
  name: string;
  role: string;
  photo: string;
  text: string;
  initials: string;
}

export function TestimonialsSection() {
  const testimonials: Testimonial[] = [
    {
      name: "Ana Paula Silva",
      role: "Empreendedora",
      photo: "/placeholder.svg",
      initials: "AP",
      text: "A Dona Wilma mudou completamente minha rotina! Agora consigo organizar minhas finanças e compromissos em um só lugar. Recomendo muito!"
    },
    {
      name: "Roberto Mendes",
      role: "Consultor Financeiro",
      photo: "/placeholder.svg",
      initials: "RM",
      text: "Recomendo para todos os meus clientes. A integração com WhatsApp é perfeita e os relatórios com IA são incrivelmente úteis!"
    },
    {
      name: "Carla Oliveira",
      role: "Designer",
      photo: "/placeholder.svg",
      initials: "CO",
      text: "Antes eu esquecia compromissos importantes. Com os lembretes da Dona Wilma, isso nunca mais aconteceu. Ferramenta essencial!"
    },
    {
      name: "Marcos Ferreira",
      role: "Médico",
      photo: "/placeholder.svg",
      initials: "MF",
      text: "A melhor ferramenta para quem tem agenda cheia. Simples, eficiente e muito bem feita. Vale cada centavo!"
    }
  ];

  return (
    <Carousel className="w-full max-w-5xl mx-auto">
      <CarouselContent>
        {testimonials.map((testimonial, index) => (
          <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
            <Card className="h-full">
              <CardContent className="flex flex-col items-center text-center p-6 space-y-4">
                <Quote className="h-8 w-8 text-primary opacity-50" />
                
                <p className="text-sm text-muted-foreground italic min-h-[80px]">
                  "{testimonial.text}"
                </p>
                
                <div className="flex flex-col items-center gap-2 mt-auto">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={testimonial.photo} alt={testimonial.name} />
                    <AvatarFallback>{testimonial.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
