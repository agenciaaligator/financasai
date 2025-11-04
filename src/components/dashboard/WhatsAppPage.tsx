import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { MessageSquare, Link2, Phone, LogOut } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function WhatsAppPage() {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkingOrg, setLinkingOrg] = useState(false);
  const [linkedOrgName, setLinkedOrgName] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ last_activity?: string; expires_at?: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { organization_id } = useOrganizationPermissions();

  const supabaseUrl = "https://fsamlnlabdjoqpiuhgex.supabase.co";

  const fetchLinkedOrganization = async () => {
    if (!user) return;
    
    try {
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('organization_id')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (session?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', session.organization_id)
          .single();
        
        setLinkedOrgName(org?.name || null);
      } else {
        setLinkedOrgName(null);
      }
    } catch (error) {
      console.error('Error fetching linked organization:', error);
    }
  };

  const fetchSessionInfo = async () => {
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

  useEffect(() => {
    fetchPhoneNumber();
    checkAuthenticationStatus();
    fetchLinkedOrganization();
    fetchSessionInfo();
    
    // Real-time listener for session changes
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
          fetchLinkedOrganization();
          fetchSessionInfo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleConnect = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número necessário",
        description: "Por favor, digite seu número de WhatsApp",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Salvar número no perfil
      if (user) {
        await supabase
          .from('profiles')
          .update({ phone_number: phoneNumber.trim() })
          .eq('user_id', user.id);
      }

      // Solicitar código
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
            description: "Verifique o código gerado e insira abaixo",
          });
        }
      } else {
        throw new Error(result.error || 'Falha ao enviar código');
      }

      await checkAuthenticationStatus();
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao conectar",
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
        description: "Digite o código de 6 dígitos",
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
          title: "🎉 WhatsApp conectado!",
          description: "Agora você pode gerenciar suas finanças pelo WhatsApp. Envie 'ajuda' para ver os comandos.",
        });
        setAuthCode("");
        await checkAuthenticationStatus();
        await fetchLinkedOrganization();
        await fetchSessionInfo();
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

  const handleLinkToCurrentOrg = async () => {
    if (!organization_id) {
      toast({
        title: "Erro",
        description: "Você não pertence a nenhuma organização",
        variant: "destructive"
      });
      return;
    }

    setLinkingOrg(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-session-set-org', {
        body: { organization_id }
      });

      if (error) throw error;

      toast({
        title: "✅ Organização vinculada!",
        description: data.message || "WhatsApp vinculado à organização com sucesso",
      });
      
      await fetchLinkedOrganization();
      window.dispatchEvent(new Event('force-transactions-refetch'));

    } catch (error) {
      console.error('Error linking WhatsApp to organization:', error);
      toast({
        title: "Erro ao vincular",
        description: error instanceof Error ? error.message : "Não foi possível vincular",
        variant: "destructive"
      });
    } finally {
      setLinkingOrg(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('user_id', user.id);

      setIsAuthenticated(false);
      setLinkedOrgName(null);
      setSessionInfo(null);
      
      toast({
        title: "WhatsApp desconectado",
        description: "Você pode reconectar quando quiser",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível desconectar",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getLastActivityMessage = () => {
    if (!sessionInfo?.last_activity) return null;
    
    const now = new Date();
    const lastActivity = new Date(sessionInfo.last_activity);
    const hoursSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60));
    
    if (hoursSinceActivity < 1) return "há menos de 1 hora";
    if (hoursSinceActivity === 1) return "há 1 hora";
    if (hoursSinceActivity < 24) return `há ${hoursSinceActivity} horas`;
    
    const daysSinceActivity = Math.floor(hoursSinceActivity / 24);
    if (daysSinceActivity === 1) return "há 1 dia";
    return `há ${daysSinceActivity} dias`;
  };

  // Estado não conectado (Onboarding)
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{t('whatsapp.title')}</CardTitle>
                <p className="text-sm text-muted-foreground">Configure em 2 minutos</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium">✨ Após conectar, você poderá:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Adicionar transações por voz ou texto</li>
                <li>• Enviar fotos de notas fiscais (OCR automático)</li>
                <li>• Consultar saldo e relatórios instantaneamente</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Número do WhatsApp
                </Label>
                <Input
                  id="phone"
                  placeholder="5511999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Formato internacional (sem +): 5511999999999
                </p>
              </div>

              {phoneNumber && (
                <div className="space-y-2">
                  <Label htmlFor="code">Código de verificação</Label>
                  <Input
                    id="code"
                    placeholder="123456"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite o código de 6 dígitos gerado
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={loading || !phoneNumber}
                  className="flex-1"
                >
                  {loading ? "Enviando..." : t('whatsapp.connect')}
                </Button>
                {authCode && (
                  <Button
                    onClick={handleVerifyCode}
                    disabled={loading || authCode.length !== 6}
                    variant="default"
                  >
                    Verificar Código
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado conectado (Gestão)
  return (
    <div className="space-y-6">
      {/* Status da Conexão */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">WhatsApp</CardTitle>
                <Badge variant="default" className="mt-1 bg-green-600">
                  ✓ {t('whatsapp.connected')}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">📱 Número</p>
              <p className="font-mono text-sm">+{phoneNumber}</p>
            </div>
            
            {linkedOrgName && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">📂 {t('whatsapp.linkedTo')}</p>
                <p className="font-semibold text-sm">{linkedOrgName}</p>
              </div>
            )}
            
            {sessionInfo?.last_activity && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">🕐 {t('whatsapp.lastActivity')}</p>
                <p className="text-sm">{getLastActivityMessage()}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {organization_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLinkToCurrentOrg}
                disabled={linkingOrg}
              >
                <Link2 className="h-4 w-4 mr-2" />
                {linkingOrg ? "Vinculando..." : t('whatsapp.changeOrg')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('whatsapp.disconnect')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comandos Disponíveis (Accordion) */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle>📖 {t('whatsapp.quickGuide')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Envie "ajuda" no WhatsApp para ver esta lista por lá também!
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="add">
            <AccordionItem value="add">
              <AccordionTrigger>📝 {t('whatsapp.addTransactions')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• "gasto 50 mercado" - adiciona despesa</li>
                  <li>• "receita 1000 salario" - adiciona receita</li>
                  <li>• "+100 freelance" - adiciona receita</li>
                  <li>• "-30 combustível hoje" - adiciona despesa</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ocr">
              <AccordionTrigger>📸 {t('whatsapp.ocr')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Tire uma foto da nota fiscal</li>
                  <li>• Envie a imagem pelo WhatsApp</li>
                  <li>• A IA extrai valor, local e categoria automaticamente!</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="edit">
              <AccordionTrigger>✏️ {t('whatsapp.editDelete')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• "editar última" - edita a última transação</li>
                  <li>• "excluir última" - deleta a última transação</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="queries">
              <AccordionTrigger>📊 {t('whatsapp.queries')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• "saldo" - ver saldo atual</li>
                  <li>• "hoje" - relatório do dia</li>
                  <li>• "semana" - relatório semanal</li>
                  <li>• "mes" - relatório mensal</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
