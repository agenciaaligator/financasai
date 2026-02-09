import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </button>
          <Button variant="outline" onClick={() => navigate("/")}>Voltar</Button>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">Termos de Serviço</h1>
        <p className="text-sm text-muted-foreground mb-6">Última atualização: Fevereiro de 2025</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground">
              Ao utilizar o serviço Dona Wilma ("Serviço"), você concorda com estes Termos de Serviço. 
              Se não concordar, não utilize o Serviço. O Serviço é oferecido pela Aligator ("Empresa").
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground">
              A Dona Wilma é uma plataforma de gestão financeira e de compromissos pessoais que utiliza 
              inteligência artificial para categorizar transações e organizar agendas. O serviço inclui 
              integração com WhatsApp, Google Calendar e painel web.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Cadastro e Conta</h2>
            <p className="text-muted-foreground">
              Você é responsável por manter a confidencialidade de suas credenciais de acesso. 
              Todas as atividades realizadas em sua conta são de sua responsabilidade. Você deve 
              fornecer informações verdadeiras e atualizadas durante o cadastro.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Planos e Pagamento</h2>
            <p className="text-muted-foreground">
              O Serviço oferece planos gratuitos e pagos. Os planos pagos são cobrados de forma recorrente 
              (mensal ou anual) via Stripe. Você pode cancelar a qualquer momento através do portal de 
              gerenciamento de assinatura. Não há reembolso proporcional para períodos já pagos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Uso Aceitável</h2>
            <p className="text-muted-foreground">
              Você concorda em não utilizar o Serviço para fins ilegais, fraudulentos ou que violem 
              direitos de terceiros. O uso abusivo do bot de WhatsApp (spam, mensagens em massa) pode 
              resultar em suspensão da conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Propriedade Intelectual</h2>
            <p className="text-muted-foreground">
              Todo o conteúdo, design e código do Serviço são de propriedade da Empresa. Seus dados 
              financeiros e pessoais permanecem sendo de sua propriedade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground">
              O Serviço é fornecido "como está". A Empresa não se responsabiliza por decisões financeiras 
              tomadas com base nas informações do Serviço. A categorização automática por IA pode conter 
              imprecisões e deve ser verificada pelo usuário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Modificações</h2>
            <p className="text-muted-foreground">
              A Empresa reserva o direito de modificar estes termos a qualquer momento. Alterações 
              significativas serão comunicadas por e-mail ou notificação no Serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre estes termos, entre em contato pelo e-mail: contato@donawilma.com.br
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
