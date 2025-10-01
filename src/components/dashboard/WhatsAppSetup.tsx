import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Shield, MessageSquare, BarChart3, Copy } from "lucide-react";

export function WhatsAppSetup() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPhoneNumber();
    checkAuthenticationStatus();
  }, [user]);

  const checkAuthenticationStatus = async () => {
    if (!user) return;

    // Verificar se existe sessão ativa no banco de dados
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (session && typeof session.session_data === 'object' && session.session_data !== null) {
      const sessionData = session.session_data as { authenticated?: boolean };
      if (sessionData.authenticated) {
        setIsAuthenticated(true);
      }
    }
  };

  const fetchPhoneNumber = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data?.phone_number) {
      setPhoneNumber(data.phone_number);
    }
  };

  const supabaseUrl = "https://fsamlnlabdjoqpiuhgex.supabase.co";
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  const handleRequestCode = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número necessário",
        description: "Digite seu número de WhatsApp no seu perfil primeiro",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Salvar número no perfil se o usuário alterou
      if (user) {
        await supabase
          .from('profiles')
          .update({ phone_number: phoneNumber.trim() })
          .eq('user_id', user.id);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          action: 'auth'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.response.includes('não encontrado') || result.response.includes('não está registrado')) {
          toast({
            title: "Número não cadastrado",
            description: "Salve o número no seu perfil primeiro",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Código gerado!",
            description: result.response,
          });
        }
      } else {
        throw new Error(result.error || 'Falha ao enviar código');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao solicitar código",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode) {
      toast({
        title: "Código necessário",
        description: "Digite o código recebido no WhatsApp",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          message: {
            body: `codigo ${authCode}`
          }
        })
      });

      const result = await response.json();
      
      if (result.success && result.response.includes('sucesso')) {
        setIsAuthenticated(true);
        toast({
          title: "Autenticado com sucesso!",
          description: "Agora você pode usar o assistente via WhatsApp",
        });
      } else {
        throw new Error('Código inválido');
      }
    } catch (error) {
      toast({
        title: "Código inválido",
        description: "Verifique o código e tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copiado!",
      description: "URL do webhook copiada para a área de transferência",
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Configuração WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Badge variant={isAuthenticated ? "default" : "secondary"}>
              {isAuthenticated ? "Autenticado" : "Não autenticado"}
            </Badge>
          </div>

          {/* Autenticação */}
          {!isAuthenticated && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Número do WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="5511999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use o formato internacional sem o sinal de +
                </p>
              </div>

              <Button 
                onClick={handleRequestCode} 
                disabled={loading || !phoneNumber}
                className="w-full"
              >
                <Phone className="h-4 w-4 mr-2" />
                {loading ? "Enviando..." : "Solicitar Código"}
              </Button>

              {phoneNumber && (
                <div className="space-y-2">
                  <Label htmlFor="code">Código de Verificação</Label>
                  <Input
                    id="code"
                    placeholder="123456"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    maxLength={6}
                  />
                  <Button 
                    onClick={handleVerifyCode} 
                    disabled={loading || !authCode}
                    variant="outline"
                    className="w-full"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {loading ? "Verificando..." : "Verificar Código"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Webhook URL para desenvolvedores */}
          <div className="space-y-2">
            <Label>Webhook URL (para configuração do WhatsApp)</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button onClick={copyWebhookUrl} size="sm" variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use esta URL para configurar o webhook no WhatsApp Business API
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Comandos disponíveis */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Comandos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <h4 className="font-medium mb-2">📝 Adicionar Transações</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "gasto 50 mercado"</li>
                <li>• "receita 1000 salario"</li>
                <li>• "+100 freelance"</li>
                <li>• "-30 combustível"</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">📊 Consultas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• "saldo" - Ver saldo atual</li>
                <li>• "relatorio" - Resumo mensal</li>
                <li>• "ajuda" - Lista de comandos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}