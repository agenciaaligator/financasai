import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Shield, MessageSquare, BarChart3, Activity } from "lucide-react";

export function WhatsAppSetup() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRecentWhatsAppActivity, setHasRecentWhatsAppActivity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPhoneNumber();
    checkAuthenticationStatus();
    
    // Setup real-time listener for session changes
    const channel = supabase
      .channel('whatsapp-session-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_sessions',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          // Re-check authentication when session changes
          checkAuthenticationStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Poll status for a short period to reflect changes quickly
  useEffect(() => {
    if (!user) return;
    let active = true;
    let count = 0;
    let timer: any;

    const poll = async () => {
      if (!active) return;
      await checkAuthenticationStatus();
      await checkRecentWhatsAppActivity();
      count++;
      if (active && count < 12) { // ~1 min @ 5s
        timer = setTimeout(poll, 5000);
      }
    };

    poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [user]);

  const checkAuthenticationStatus = async () => {
    if (!user) return;

    try {
      // Usar função segura do banco que verifica diretamente
      const { data, error } = await supabase.rpc('is_whatsapp_authenticated');
      
      if (error) {
        console.error('Erro ao verificar autenticação:', error);
        setIsAuthenticated(false);
        return;
      }
      
      setIsAuthenticated(data === true);
    } catch (error) {
      console.error('Erro ao verificar autenticação WhatsApp:', error);
      setIsAuthenticated(false);
    }
  };

  const checkRecentWhatsAppActivity = async () => {
    if (!user) return false;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('source', 'whatsapp')
        .gte('created_at', since)
        .limit(1);
      if (error) {
        console.error('Erro ao verificar atividade WhatsApp:', error);
        setHasRecentWhatsAppActivity(false);
        return false;
      }
      const has = Array.isArray(data) && data.length > 0;
      setHasRecentWhatsAppActivity(has);
      return has;
    } catch (e) {
      console.error('Erro ao verificar atividade WhatsApp:', e);
      setHasRecentWhatsAppActivity(false);
      return false;
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

  const handleRequestCode = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número necessário",
        description: "Por favor, digite seu número de WhatsApp para continuar",
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
            description: "Atualize seu número no perfil e tente novamente",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Código enviado!",
            description: "Verifique o código gerado e insira abaixo para validar",
          });
        }
      } else {
        throw new Error(result.error || 'Falha ao enviar código');
      }

      await checkAuthenticationStatus();
      await checkRecentWhatsAppActivity();
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
        description: "Por favor, digite o código de 6 dígitos",
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
          title: "✅ WhatsApp autenticado!",
          description: "Agora você pode gerenciar suas finanças pelo WhatsApp",
        });
        setAuthCode("");
        await checkAuthenticationStatus();
        await checkRecentWhatsAppActivity();
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

  const handleRunDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gptmaker-diagnostics');
      
      if (error) throw error;
      
      console.log('📊 Diagnóstico GPT Maker:', data);
      
      if (data.success || data.tokenValid) {
        toast({
          title: "✅ Configuração OK",
          description: "GPT Maker está configurado. Verifique o console para detalhes.",
        });
      } else {
        toast({
          title: "⚠️ Problemas detectados",
          description: data.issues?.join('\n') || "Verifique o console para detalhes",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      toast({
        title: "Erro no diagnóstico",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setDiagnosticsLoading(false);
    }
  };


  const effectiveAuthenticated = isAuthenticated || hasRecentWhatsAppActivity;

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
            <Badge variant={effectiveAuthenticated ? "default" : "secondary"}>
              {effectiveAuthenticated ? "Autenticado" : "Não autenticado"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await checkAuthenticationStatus();
                await checkRecentWhatsAppActivity();
              }}
            >
              Verificar status
            </Button>
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
                  Use o formato internacional (sem +): exemplo 5511999999999
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
                    placeholder="Digite o código de 6 dígitos"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Insira o código gerado acima na plataforma
                  </p>
                  <Button 
                    onClick={handleVerifyCode} 
                    disabled={loading || !authCode}
                    variant="outline"
                    className="w-full"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {loading ? "Verificando..." : "Validar Código"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnóstico */}
      {isAuthenticated && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Diagnóstico de Conexão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Teste se o GPT Maker está enviando mensagens corretamente para o sistema
            </p>
            <Button
              onClick={handleRunDiagnostics}
              disabled={diagnosticsLoading}
              variant="outline"
              className="w-full"
            >
              <Activity className="mr-2 h-4 w-4" />
              {diagnosticsLoading ? "Testando..." : "Executar Diagnóstico"}
            </Button>
          </CardContent>
        </Card>
      )}

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