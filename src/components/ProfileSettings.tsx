import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Lock, Crown, Calendar, Check, X, ExternalLink, RefreshCw, Bug, Shield, MessageSquare, Phone, BarChart3, CheckCircle2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useFeatureLimits } from "@/hooks/useFeatureLimits";
import { UpgradeModal } from "./UpgradeModal";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { GoogleCalendarConnect } from "./dashboard/GoogleCalendarConnect";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { profileSchema } from "@/lib/validations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function ProfileSettings() {
  // Estados do perfil básico
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Estados do WhatsApp (migrados do WhatsAppSetup)
  const [authCode, setAuthCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRecentWhatsAppActivity, setHasRecentWhatsAppActivity] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ last_activity?: string; expires_at?: string } | null>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscription, planName, isFreePlan, isTrial, isPremium, planLimits } = useSubscription();
  const { currentUsage, getTransactionProgress, getCategoryProgress } = useFeatureLimits();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const [managingSubscription, setManagingSubscription] = useState(false);
  const { syncNow, runDiagnostics, loading: gcLoading } = useGoogleCalendar();
  const { organization_id } = useOrganizationPermissions();

  const supabaseUrl = "https://fsamlnlabdjoqpiuhgex.supabase.co";

  useEffect(() => {
    fetchProfile();
    if (planLimits?.hasWhatsapp) {
      checkAuthenticationStatus();
      
      // Setup real-time listener para WhatsApp sessions
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
            checkAuthenticationStatus();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, planLimits]);

  // Poll status para WhatsApp
  useEffect(() => {
    if (!user || !planLimits?.hasWhatsapp) return;
    let active = true;
    let count = 0;
    let timer: any;

    const poll = async () => {
      if (!active) return;
      await checkAuthenticationStatus();
      await checkRecentWhatsAppActivity();
      count++;
      if (active && count < 12) {
        timer = setTimeout(poll, 5000);
      }
    };

    poll();
    return () => { 
      active = false; 
      if (timer) clearTimeout(timer); 
    };
  }, [user, planLimits]);

  useEffect(() => {
    if (planLimits?.hasWhatsapp) {
      fetchSessionInfo();
    }
  }, [isAuthenticated, hasRecentWhatsAppActivity, planLimits]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setFullName(data.full_name || "");
      setPhoneNumber(data.phone_number || "");
    }
  };


  const checkAuthenticationStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('is_whatsapp_authenticated_for_user', {
        p_user_id: user.id
      });
      
      if (error) {
        console.error('Erro RPC is_whatsapp_authenticated_for_user:', error);
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

    setSessionInfo(session);
  };

  const effectiveAuthenticated = isAuthenticated || 
    hasRecentWhatsAppActivity || 
    (sessionInfo?.expires_at && new Date(sessionInfo.expires_at) > new Date());
  
  const getStatusMessage = () => {
    if (!sessionInfo) return null;
    
    const now = new Date();
    const expiresAt = sessionInfo.expires_at ? new Date(sessionInfo.expires_at) : null;
    const lastActivity = sessionInfo.last_activity ? new Date(sessionInfo.last_activity) : null;
    
    if (expiresAt && expiresAt <= now) {
      return "Sessão expirada - Revalide";
    }
    
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

  const handleSaveAll = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Verificar se o usuário quer alterar a senha
      const isChangingPassword = newPassword.length > 0 || confirmPassword.length > 0;
      
      if (isChangingPassword) {
        // Validar senha
        if (newPassword.length < 6) {
          throw new Error("A nova senha deve ter pelo menos 6 caracteres");
        }
        
        if (newPassword !== confirmPassword) {
          throw new Error("As senhas não coincidem");
        }
      }
      
      // Salvar perfil (nome + telefone)
      const validated = profileSchema.parse({
        full_name: fullName,
        phone_number: phoneNumber || ''
      });

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: validated.full_name,
          phone_number: validated.phone_number || null
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;
      
      // Salvar senha (se preenchida)
      let passwordUpdated = false;
      if (isChangingPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword
        });
        
        if (passwordError) throw passwordError;
        
        passwordUpdated = true;
        // Limpar campos de senha após sucesso
        setNewPassword("");
        setConfirmPassword("");
        
        // Fazer logout após mudança de senha (nova sessão será criada no próximo login)
        setTimeout(async () => {
          await supabase.auth.signOut();
          window.location.href = '/';
        }, 2000);
      }
      
      // Feedback diferenciado
      toast({
        title: "✅ Alterações salvas!",
        description: passwordUpdated 
          ? "Perfil e senha atualizados com sucesso" 
          : "Informações do perfil atualizadas com sucesso"
      });
      
    } catch (error: any) {
      toast({
        title: "Erro ao salvar alterações",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número necessário",
        description: "Por favor, digite seu número de WhatsApp para continuar",
        variant: "destructive"
      });
      return;
    }

    setWhatsappLoading(true);
    try {
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
      setWhatsappLoading(false);
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

    setWhatsappLoading(true);
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
      setWhatsappLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!user || !phoneNumber) return;
    
    setWhatsappLoading(true);
    try {
      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('phone_number', phoneNumber);
      
      if (error) throw error;
      
      setIsAuthenticated(false);
      setHasRecentWhatsAppActivity(false);
      setSessionInfo(null);
      setAuthCode("");
      setCodeSent(false);
      
      toast({
        title: "✅ WhatsApp desconectado",
        description: "Agora você pode alterar o número ou reconectar",
      });
    } catch (error) {
      toast({
        title: "Erro ao desconectar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setWhatsappLoading(false);
    }
  };

  const getLastActivityMessage = (lastActivity?: string) => {
    if (!lastActivity) return "Sem atividade recente";
    
    const now = new Date();
    const activityDate = new Date(lastActivity);
    const diffMs = now.getTime() - activityDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Ativo agora";
    if (diffMins < 60) return `Ativo há ${diffMins} min`;
    if (diffHours < 24) return `Ativo há ${diffHours}h`;
    return `Ativo há ${diffDays}d`;
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Portal aberto!",
          description: "Gerencie sua assinatura na nova aba",
        });
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Erro ao abrir portal",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setManagingSubscription(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Informações do Perfil */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Informações do Perfil</span>
          </CardTitle>
          <CardDescription>
            Gerencie suas informações pessoais e dados de contato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Digite seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Número WhatsApp</Label>
              <Input
                id="phoneNumber"
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={effectiveAuthenticated}
                placeholder="5511999999999"
                className={effectiveAuthenticated ? "bg-muted" : ""}
              />
              {effectiveAuthenticated && (
                <p className="text-xs text-yellow-600">
                  ⚠️ Número em uso no WhatsApp. Desconecte na seção abaixo para alterar.
                </p>
              )}
              {!effectiveAuthenticated && (
                <p className="text-xs text-muted-foreground">
                  Formato internacional sem + (ex: 5511999999999)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Segurança */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5" />
            <span>Segurança</span>
          </CardTitle>
          <CardDescription>
            Atualize sua senha de acesso
          </CardDescription>
          <p className="text-xs text-muted-foreground mt-2">
            💡 Deixe os campos de senha em branco se não quiser alterá-la
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Único de Salvamento */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSaveAll} 
          disabled={loading}
          size="lg"
          className="bg-gradient-primary hover:shadow-primary min-w-[200px]"
        >
          {loading ? "Salvando..." : "💾 Salvar Alterações"}
        </Button>
      </div>

      {/* Card 3: Configuração WhatsApp */}
      {planLimits?.hasWhatsapp && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Configuração WhatsApp
            </CardTitle>
            <CardDescription>
              Configure seu WhatsApp para gerenciar finanças por mensagem. 
              Receba lembretes, crie transações e consulte saldos diretamente no app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={effectiveAuthenticated ? "default" : "secondary"}>
                {effectiveAuthenticated ? "✅ Conectado" : "❌ Desconectado"}
              </Badge>
            </div>

            {effectiveAuthenticated ? (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    WhatsApp conectado ao número:
                  </p>
                  {sessionInfo && (
                    <span className="text-xs text-muted-foreground">
                      {getLastActivityMessage(sessionInfo.last_activity)}
                    </span>
                  )}
                </div>
                <p className="text-sm">
                  <strong>{phoneNumber}</strong>
                </p>
                <Button
                  variant="destructive"
                  onClick={handleDisconnectWhatsApp}
                  disabled={whatsappLoading}
                >
                  {whatsappLoading ? "Desconectando..." : "Desconectar WhatsApp"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    ⬆️ <strong>Configure seu número no Card de Perfil acima</strong> antes de solicitar o código
                  </p>
                </div>

                <Button
                  onClick={handleRequestCode} 
                  disabled={whatsappLoading || !phoneNumber}
                  className="w-full"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {whatsappLoading ? "Enviando..." : "Solicitar Código"}
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
                      Após solicitar o código, insira-o aqui para validar
                    </p>
                    <Button 
                      onClick={handleVerifyCode} 
                      disabled={whatsappLoading || !authCode}
                      className="w-full"
                    >
                      {whatsappLoading ? "Verificando..." : "Validar Código"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">💡 Como usar</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  <li>Digite seu número no formato internacional (sem +)</li>
                  <li>Solicite o código de verificação</li>
                  <li>Insira o código recebido para validar</li>
                  <li>Pronto! Use os comandos pelo WhatsApp</li>
                </ul>
              </div>
            </div>

            <Collapsible open={commandsOpen} onOpenChange={setCommandsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium hover:underline">
                <span>📋 Comandos Disponíveis</span>
                <span className="text-xs text-muted-foreground">
                  {commandsOpen ? "Ocultar" : "Ver comandos"}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2 text-sm">📝 Transações</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• "gasto 50 mercado"</li>
                      <li>• "receita 1000 salario"</li>
                      <li>• "+100 freelance"</li>
                      <li>• "-30 combustível"</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2 text-sm">📊 Consultas</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• "saldo" - Ver saldo atual</li>
                      <li>• "relatorio" - Resumo mensal</li>
                      <li>• "ajuda" - Lista de comandos</li>
                    </ul>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Card 4: Google Calendar */}
      {planLimits?.hasGoogleCalendar && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Google Calendar</span>
            </CardTitle>
            <CardDescription>
              Sincronize automaticamente compromissos criados pelo WhatsApp com seu calendário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GoogleCalendarConnect />
            
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={syncNow} 
                disabled={gcLoading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${gcLoading ? 'animate-spin' : ''}`} />
                Sincronizar Agora
              </Button>
              <Button 
                onClick={runDiagnostics} 
                disabled={gcLoading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Bug className="h-4 w-4" />
                Diagnóstico
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card 5: Minha Assinatura */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-primary" />
            <span>Minha Assinatura</span>
          </CardTitle>
          <CardDescription>
            Gerencie seu plano e veja os recursos disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{planName}</h3>
                {subscription && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                  </p>
                )}
              </div>
              <Badge variant={isPremium ? "default" : isTrial ? "secondary" : "outline"}>
                {isPremium ? 'Premium' : isTrial ? 'Trial' : 'Gratuito'}
              </Badge>
            </div>

            {subscription?.current_period_end && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Calendar className="h-4 w-4" />
                <span>
                  Renova em: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Uso do Plano</h4>
            
            {getTransactionProgress() && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Transações</span>
                  <span className="font-medium">
                    {currentUsage.transactions}/{getTransactionProgress()?.limit || '∞'}
                  </span>
                </div>
                <Progress value={getTransactionProgress()?.percentage || 0} className="h-2" />
              </div>
            )}

            {getCategoryProgress() && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Categorias</span>
                  <span className="font-medium">
                    {currentUsage.categories}/{getCategoryProgress()?.limit || '∞'}
                  </span>
                </div>
                <Progress value={getCategoryProgress()?.percentage || 0} className="h-2" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Recursos Disponíveis</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasWhatsapp ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasAiReports ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>IA Reports</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasGoogleCalendar ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Google Calendar</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasBankIntegration ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Integração Bancária</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasMultiUser ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Multi-usuário</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasPrioritySupport ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Suporte Prioritário</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(isFreePlan || isTrial) && (
              <Button 
                className="w-full bg-gradient-primary hover:shadow-primary"
                onClick={() => setShowUpgradeModal(true)}
              >
                <Crown className="h-4 w-4 mr-2" />
                Fazer Upgrade para Premium
              </Button>
            )}

            {isPremium && subscriptionStatus?.stripe_customer_id && (
              <Button 
                className="w-full"
                variant="outline"
                onClick={handleManageSubscription}
                disabled={managingSubscription}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {managingSubscription ? 'Abrindo...' : 'Gerenciar Assinatura'}
              </Button>
            )}

            {subscriptionStatus?.stripe_subscription_id && (
              <p className="text-xs text-muted-foreground text-center">
                ID da Assinatura: {subscriptionStatus.stripe_subscription_id}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <UpgradeModal 
        open={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
