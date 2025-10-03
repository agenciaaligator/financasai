import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Settings, 
  Smartphone, 
  MessageSquare, 
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  PiggyBank,
  Target,
  Calendar,
  Bell,
  Share2,
  Download
} from "lucide-react";

export function FutureFeatures() {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [suggestionTitle, setSuggestionTitle] = useState("");
  const [suggestionDescription, setSuggestionDescription] = useState("");
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const features = [
    {
      id: "recurring-transactions",
      title: "Transações Recorrentes",
      description: "Configure despesas e receitas que se repetem automaticamente",
      icon: <Calendar className="h-6 w-6" />,
      status: "planned",
      category: "automation"
    },
    {
      id: "budgets",
      title: "Orçamentos e Metas",
      description: "Defina limites de gastos por categoria e acompanhe o progresso",
      icon: <Target className="h-6 w-6" />,
      status: "planned",
      category: "planning"
    },
    {
      id: "savings-goals",
      title: "Metas de Economia",
      description: "Crie objetivos de poupança e monitore seu progresso",
      icon: <PiggyBank className="h-6 w-6" />,
      status: "planned",
      category: "planning"
    },
    {
      id: "multi-account",
      title: "Múltiplas Contas",
      description: "Gerencie diferentes contas bancárias e cartões de crédito",
      icon: <CreditCard className="h-6 w-6" />,
      status: "development",
      category: "accounts"
    },
    {
      id: "notifications",
      title: "Notificações Inteligentes",
      description: "Alertas personalizados sobre gastos, metas e vencimentos",
      icon: <Bell className="h-6 w-6" />,
      status: "planned",
      category: "alerts"
    },
    {
      id: "family-sharing",
      title: "Compartilhamento Familiar",
      description: "Permita que familiares vejam e contribuam com as finanças",
      icon: <Users className="h-6 w-6" />,
      status: "research",
      category: "sharing"
    },
    {
      id: "expense-photos",
      title: "Fotos de Comprovantes",
      description: "Anexe fotos de recibos e notas fiscais às transações",
      icon: <Smartphone className="h-6 w-6" />,
      status: "planned",
      category: "documentation"
    },
    {
      id: "bank-integration",
      title: "Integração Bancária",
      description: "Importe transações automaticamente do seu banco",
      icon: <DollarSign className="h-6 w-6" />,
      status: "research",
      category: "integration"
    },
    {
      id: "investment-tracking",
      title: "Acompanhamento de Investimentos",
      description: "Monitore seus investimentos e rendimentos",
      icon: <TrendingUp className="h-6 w-6" />,
      status: "research",
      category: "investments"
    },
    {
      id: "export-advanced",
      title: "Exportação Avançada",
      description: "Exporte relatórios em PDF, Excel e outros formatos",
      icon: <Download className="h-6 w-6" />,
      status: "development",
      category: "reports"
    },
    {
      id: "social-features",
      title: "Recursos Sociais",
      description: "Compare gastos com amigos e participe de desafios de economia",
      icon: <Share2 className="h-6 w-6" />,
      status: "research",
      category: "social"
    },
    {
      id: "ai-insights",
      title: "Insights Avançados de IA",
      description: "Análises preditivas e recomendações personalizadas",
      icon: <MessageSquare className="h-6 w-6" />,
      status: "development",
      category: "ai"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "development": return "bg-blue-100 text-blue-800";
      case "planned": return "bg-green-100 text-green-800";
      case "research": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "development": return "Em Desenvolvimento";
      case "planned": return "Planejado";
      case "research": return "Em Pesquisa";
      default: return "Indefinido";
    }
  };

  const categoryNames = {
    automation: "Automação",
    planning: "Planejamento",
    accounts: "Contas",
    alerts: "Alertas",
    sharing: "Compartilhamento",
    documentation: "Documentação",
    integration: "Integração",
    investments: "Investimentos",
    reports: "Relatórios",
    social: "Social",
    ai: "Inteligência Artificial"
  };

  useEffect(() => {
    if (user) {
      fetchUserVotes();
    }
  }, [user]);

  const fetchUserVotes = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('feature_votes')
      .select('feature_id')
      .eq('user_id', user.id);
    
    if (data) {
      setUserVotes(new Set(data.map(v => v.feature_id)));
    }
  };

  const handleVote = async (featureId: string) => {
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Faça login para votar nas funcionalidades",
        variant: "destructive"
      });
      return;
    }

    if (userVotes.has(featureId)) {
      // Remover voto
      const { error } = await supabase
        .from('feature_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('feature_id', featureId);
      
      if (!error) {
        setUserVotes(prev => {
          const newSet = new Set(prev);
          newSet.delete(featureId);
          return newSet;
        });
        toast({
          title: "Voto removido",
          description: "Seu voto foi removido desta funcionalidade",
        });
      }
    } else {
      // Adicionar voto
      const { error } = await supabase
        .from('feature_votes')
        .insert({ user_id: user.id, feature_id: featureId });
      
      if (!error) {
        setUserVotes(prev => new Set([...prev, featureId]));
        toast({
          title: "Voto registrado!",
          description: "Obrigado por votar nesta funcionalidade. Sua opinião é muito importante!",
        });
      }
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Faça login para enviar sugestões",
        variant: "destructive"
      });
      return;
    }

    if (!suggestionTitle.trim() || !suggestionDescription.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e a descrição da sugestão",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('feature_suggestions')
      .insert({
        user_id: user.id,
        title: suggestionTitle,
        description: suggestionDescription
      });

    if (error) {
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar sua sugestão. Tente novamente.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Sugestão enviada!",
        description: "Obrigado por contribuir! Sua sugestão será analisada pela equipe.",
      });
      setSuggestionTitle("");
      setSuggestionDescription("");
    }
    setSubmitting(false);
  };

  const categories = [...new Set(features.map(f => f.category))];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-6 w-6 text-primary" />
            <span>Próximas Funcionalidades</span>
          </CardTitle>
          <p className="text-muted-foreground">
            Veja o que está sendo desenvolvido e vote nas funcionalidades que mais te interessam!
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Select onValueChange={setSelectedFeature}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {categoryNames[category as keyof typeof categoryNames]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features
              .filter(feature => !selectedFeature || selectedFeature === "all" || feature.category === selectedFeature)
              .map((feature) => (
                <Card key={feature.id} className="relative hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {feature.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{feature.title}</h3>
                          <Badge className={getStatusColor(feature.status)}>
                            {getStatusLabel(feature.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground mb-4">{feature.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {categoryNames[feature.category as keyof typeof categoryNames]}
                      </Badge>
                      <Button 
                        variant={userVotes.has(feature.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleVote(feature.id)}
                      >
                        {userVotes.has(feature.id) ? "✓ Votado" : "👍 Votar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2">💡 Tem uma ideia?</h3>
            <p className="text-blue-600 mb-4">
              Sugira uma nova funcionalidade que gostaria de ver no app!
            </p>
            <div className="space-y-4">
              <Input 
                placeholder="Título da funcionalidade" 
                value={suggestionTitle}
                onChange={(e) => setSuggestionTitle(e.target.value)}
              />
              <Textarea 
                placeholder="Descreva sua ideia em detalhes..." 
                value={suggestionDescription}
                onChange={(e) => setSuggestionDescription(e.target.value)}
              />
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleSubmitSuggestion}
                disabled={submitting}
              >
                {submitting ? "Enviando..." : "Enviar Sugestão"}
              </Button>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>🚀 <strong>Roadmap atualizado em:</strong> Janeiro 2025</p>
            <p>📊 Baseado no feedback dos usuários e análise de mercado</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}