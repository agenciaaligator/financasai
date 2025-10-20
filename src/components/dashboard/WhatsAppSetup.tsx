import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Shield, MessageSquare, BarChart3 } from "lucide-react";

export function WhatsAppSetup() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRecentWhatsAppActivity, setHasRecentWhatsAppActivity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [isTestingReminders, setIsTestingReminders] = useState(false);
  const [isTestingAgenda, setIsTestingAgenda] = useState(false);
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
      // Usar função segura do banco que verifica para qualquer usuário
      const { data, error } = await supabase.rpc('is_whatsapp_authenticated_for_user', {
        p_user_id: user.id
      });
      
      if (error) {
        console.error('Erro RPC is_whatsapp_authenticated_for_user:', error);
        setIsAuthenticated(false);
        return;
      }
      
      console.log('✅ RPC is_whatsapp_authenticated_for_user resultado:', data);
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

  const handleCheckStatus = async () => {
    setStatusLoading(true);
    try {
      await checkAuthenticationStatus();
      await checkRecentWhatsAppActivity();
      await fetchSessionInfo();
      
      const effective = isAuthenticated || hasRecentWhatsAppActivity || (sessionInfo?.expires_at && new Date(sessionInfo.expires_at) > new Date());
      
      toast({
        title: effective ? "✅ Conectado" : "❌ Não conectado",
        description: effective 
          ? `WhatsApp autenticado${getStatusMessage() ? ' - ' + getStatusMessage() : ''}` 
          : "WhatsApp não está autenticado. Solicite um novo código.",
      });
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível verificar o status",
        variant: "destructive"
      });
    } finally {
      setStatusLoading(false);
    }
  };


  // FASE 4: Status mais inteligente considerando last_activity
  const [sessionInfo, setSessionInfo] = useState<{ last_activity?: string; expires_at?: string } | null>(null);

  const fetchSessionInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', user.id)
      .single();

    if (!profile?.phone_number) return;

    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('last_activity, expires_at')
      .eq('phone_number', profile.phone_number)
      .maybeSingle();

    console.log('📱 Session info:', session);
    setSessionInfo(session);
  };

  useEffect(() => {
    fetchSessionInfo();
  }, [isAuthenticated, hasRecentWhatsAppActivity]);

  // FASE 1: effectiveAuthenticated considera RPC + expires_at ativo
  const effectiveAuthenticated = isAuthenticated || 
    hasRecentWhatsAppActivity || 
    (sessionInfo?.expires_at && new Date(sessionInfo.expires_at) > new Date());
  
  const getStatusMessage = () => {
    if (!sessionInfo) return null;
    
    const now = new Date();
    const expiresAt = sessionInfo.expires_at ? new Date(sessionInfo.expires_at) : null;
    const lastActivity = sessionInfo.last_activity ? new Date(sessionInfo.last_activity) : null;
    
    // Se expirou, mostrar expirado
    if (expiresAt && expiresAt <= now) {
      return "Sessão expirada - Revalide";
    }
    
    // Se sessão ativa, mostrar quando expira + último uso
    if (expiresAt && expiresAt > now && lastActivity) {
      const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let activityMsg = "";
      if (daysSinceActivity === 0) activityMsg = "usado hoje";
      else if (daysSinceActivity === 1) activityMsg = "usado ontem";
      else if (daysSinceActivity <= 7) activityMsg = `usado há ${daysSinceActivity} dias`;
      else activityMsg = `último uso há ${daysSinceActivity} dias`;
      
      return `Sessão ativa (${activityMsg}, expira em ${daysUntilExpiry}d)`;
    }
    
    return null;
  };

  const handleTestReminders = async () => {
    if (!user) return;
    
    setIsTestingReminders(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-commitment-reminders', {
        body: { force: true, user_id: user.id }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "✅ Teste de Lembretes",
          description: `Mensagem enviada! Enviadas: ${data.remindersSent || 1}, Erros: ${data.errors || 0}`,
        });
      } else {
        toast({
          title: "❌ Erro no Teste",
          description: data.error || "Não foi possível enviar mensagem de teste",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error testing reminders:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao testar lembretes",
        variant: "destructive",
      });
    } finally {
      setIsTestingReminders(false);
    }
  };

  const handleTestAgenda = async () => {
    if (!user) return;
    
    setIsTestingAgenda(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-daily-agenda', {
        body: { user_id: user.id }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "✅ Teste de Resumo Diário",
          description: `Mensagem enviada! Enviadas: ${data.sent || 0}, Erros: ${data.errors || 0}`,
        });
      } else {
        toast({
          title: "❌ Erro no Teste",
          description: data.error || "Não foi possível enviar resumo de teste",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error testing daily agenda:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao testar resumo diário",
        variant: "destructive",
      });
    } finally {
      setIsTestingAgenda(false);
    }
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
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={effectiveAuthenticated ? "default" : "secondary"}>
                {effectiveAuthenticated ? "Autenticado" : "Não autenticado"}
              </Badge>
              {effectiveAuthenticated && getStatusMessage() && (
                <span className="text-xs text-muted-foreground">
                  {getStatusMessage()}
                </span>
              )}
            </div>
            
            {/* FASE 4: Botões de revalidação e teste */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckStatus}
                disabled={statusLoading}
              >
                {statusLoading ? "Verificando..." : "Verificar status"}
              </Button>
              
              {effectiveAuthenticated && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setIsAuthenticated(false);
                      setCodeSent(false);
                      setAuthCode("");
                      await handleRequestCode();
                    }}
                  >
                    Revalidar WhatsApp
                  </Button>
                  
                </>
              )}
            </div>
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

          {/* Botões de teste disponíveis para todos */}
          {phoneNumber && (
            <div className="space-y-2 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Testes do Sistema:</p>
              <p className="text-xs text-muted-foreground mb-3">
                ⚠️ Os lembretes reais são enviados apenas 24h e 1h antes de cada compromisso
              </p>
              
              <Button 
                onClick={handleTestReminders}
                disabled={isTestingReminders}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {isTestingReminders ? "Enviando..." : "🔔 Testar Lembretes (meu número)"}
              </Button>
              
              <Button 
                onClick={handleTestAgenda}
                disabled={isTestingAgenda}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {isTestingAgenda ? "Enviando..." : "📅 Testar Resumo Diário (meu número)"}
              </Button>
            </div>
          )}
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