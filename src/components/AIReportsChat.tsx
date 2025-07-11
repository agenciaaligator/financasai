import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export function AIReportsChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const quickQuestions = [
    "Como está meu saldo do mês?",
    "Qual minha maior despesa?",
    "Estou tendo lucro ou prejuízo?",
    "Me dê um resumo da semana",
    "Quais são minhas principais receitas?"
  ];

  const addMessage = (type: 'user' | 'ai', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const getAIReport = async (userQuestion?: string) => {
    if (!user) return;

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-reports', {
        body: {
          period,
          user_id: user.id,
          question: userQuestion || question
        }
      });

      if (error) throw error;

      if (data.success) {
        addMessage('ai', data.report);
      } else {
        throw new Error(data.error || 'Erro ao gerar relatório');
      }

    } catch (error: any) {
      console.error('Error getting AI report:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o relatório. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userQuestion = question.trim();
    addMessage('user', userQuestion);
    setQuestion("");
    
    await getAIReport(userQuestion);
  };

  const handleQuickQuestion = async (quickQuestion: string) => {
    addMessage('user', quickQuestion);
    await getAIReport(quickQuestion);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="h-6 w-6 text-primary" />
            <span>Assistente Financeiro IA</span>
          </CardTitle>
          <p className="text-muted-foreground">
            Converse comigo sobre suas finanças. Posso gerar relatórios e responder suas dúvidas sobre receitas, despesas e muito mais!
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seletor de Período */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Período:</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Hoje</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="year">Este Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Perguntas Rápidas */}
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Perguntas rápidas:</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickQuestion(q)}
                    disabled={loading}
                    className="text-xs"
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.length > 0 && (
            <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4 bg-muted/30">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.type === 'user'
                        ? 'bg-primary text-primary-foreground ml-4'
                        : 'bg-white border mr-4'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.type === 'ai' && (
                        <Bot className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
                      )}
                      {message.type === 'user' && (
                        <User className="h-4 w-4 mt-1 text-primary-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                        <div className={`text-xs mt-1 opacity-70`}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border rounded-lg p-3 mr-4">
                    <div className="flex items-center space-x-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Gerando relatório...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Digite sua pergunta sobre finanças..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !question.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
            <strong>💡 Dicas:</strong> Você pode perguntar sobre lucros, prejuízos, categorias específicas, 
            comparações entre períodos, ou pedir resumos detalhados. 
            O assistente analisará seus dados financeiros em tempo real!
          </div>
        </CardContent>
      </Card>
    </div>
  );
}