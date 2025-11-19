import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlansSection } from "@/components/PlansSection";
import { Calendar } from "lucide-react";

const Plans = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/')}>
              Voltar
            </Button>
          </div>
        </nav>
      </header>

      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-4">
          Escolha seu plano
        </h1>
        <p className="text-center text-muted-foreground mb-12">
          Comece gratuitamente e faça upgrade quando precisar
        </p>
        
        <PlansSection />
      </div>
    </div>
  );
};

export default Plans;
