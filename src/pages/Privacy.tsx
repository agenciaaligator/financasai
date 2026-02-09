import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Privacy() {
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
        <h1 className="text-3xl font-bold mb-8">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-6">Última atualização: Fevereiro de 2025</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Dados Coletados</h2>
            <p className="text-muted-foreground">
              Coletamos os seguintes dados: e-mail, nome, número de telefone (WhatsApp), 
              dados financeiros inseridos por você (transações, categorias), compromissos e 
              informações de pagamento processadas pelo Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Uso dos Dados</h2>
            <p className="text-muted-foreground">
              Seus dados são utilizados exclusivamente para: fornecer o Serviço (categorização, 
              relatórios, lembretes), processar pagamentos, enviar notificações sobre sua conta 
              e compromissos, e melhorar o Serviço com análises agregadas e anônimas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Compartilhamento</h2>
            <p className="text-muted-foreground">
              Não vendemos ou compartilhamos seus dados pessoais com terceiros para fins de 
              marketing. Compartilhamos dados apenas com: Stripe (processamento de pagamentos), 
              Meta/WhatsApp (envio de mensagens), Google (sincronização de calendário, quando 
              autorizado por você) e Supabase (armazenamento seguro de dados).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Inteligência Artificial</h2>
            <p className="text-muted-foreground">
              Utilizamos IA (OpenAI) para processar suas mensagens de WhatsApp e categorizar 
              transações. As mensagens são enviadas de forma segura e não são utilizadas para 
              treinar modelos de IA de terceiros. Os dados processados são armazenados apenas 
              em sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Segurança</h2>
            <p className="text-muted-foreground">
              Utilizamos criptografia em trânsito (HTTPS/TLS) e em repouso. Os dados são 
              armazenados em servidores seguros com acesso restrito. Implementamos autenticação 
              segura e políticas de acesso baseadas em função (RLS).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground">
              Conforme a Lei Geral de Proteção de Dados (LGPD), você tem direito a: acessar 
              seus dados, corrigir dados incorretos, solicitar exclusão de seus dados, revogar 
              consentimento e solicitar portabilidade. Para exercer esses direitos, entre em 
              contato pelo e-mail: contato@donawilma.com.br
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
            <p className="text-muted-foreground">
              Utilizamos cookies essenciais para manter sua sessão de login ativa. Não utilizamos 
              cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Retenção de Dados</h2>
            <p className="text-muted-foreground">
              Seus dados são mantidos enquanto sua conta estiver ativa. Após o cancelamento, 
              os dados são retidos por 30 dias para possível reativação e depois excluídos 
              permanentemente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contato do Encarregado (DPO)</h2>
            <p className="text-muted-foreground">
              Para questões relacionadas à privacidade e proteção de dados, entre em contato: 
              contato@donawilma.com.br
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
