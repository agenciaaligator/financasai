import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Crown, MessageSquare, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<'choose-plan' | 'enter-coupon' | 'setup-whatsapp'>('choose-plan');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { refetch } = useSubscription();

  const supabaseUrl = "https://fsamlnlabdjoqpiuhgex.supabase.co";

  useEffect(() => {
    const fetchPlans = async () => {
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (plans && plans.length > 0) {
        setAvailablePlans(plans);
      } else {
        setAvailablePlans([
          {
            id: 'trial',
            name: 'trial',
            display_name: 'Trial 3 Dias',
            description: '50 transações, WhatsApp básico',
            price_monthly: 0,
            role: 'trial',
            max_transactions: 50,
            has_whatsapp: true,
            has_ai_reports: false,
            has_google_calendar: false
          },
          {
            id: 'premium',
            name: 'premium',
            display_name: 'Premium',
            description: 'Ilimitado, WhatsApp completo',
            price_monthly: 39.90,
            role: 'premium',
            has_whatsapp: true,
            has_ai_reports: true,
            has_google_calendar: true
          }
        ]);
      }
    };

    fetchPlans();
  }, []);

  const handleSkip = () => {
    localStorage.setItem('onboarding_complete', 'true');
    onComplete();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleSelectPlan = async (planType: 'trial' | 'premium') => {
    if (!user) return;

    setSelectedPlan(planType);
    setLoading(true);
    
    try {
      if (planType === 'trial') {
        console.log('[TRIAL DEBUG] Ativando trial para:', user.email);
        
        const { data: sessionData } = await supabase.auth.getSession();
        
        const { data, error } = await supabase.functions.invoke('activate-trial', {
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`
          }
        });

        if (error) {
          console.error('[TRIAL ERROR]', error);
          
          if (error.message?.includes('Plano ativo') || error.message?.includes('subscription')) {
            toast({
              title: "Trial já ativado",
              description: "Continue para configurar seu WhatsApp",
            });
            setStep('enter-coupon');
            return;
          }
          
          throw error;
        }

        toast({
          title: "Trial ativado!",
          description: "Você tem 3 dias para testar todos os recursos",
        });
      } else {
        toast({
          title: "Premium selecionado",
          description: "Configure seu WhatsApp e depois finalize a assinatura",
        });
      }

      setStep('enter-coupon');
    } catch (error) {
      console.error('[ONBOARDING ERROR]', error);
      toast({
        title: "Erro ao ativar plano",
        description: "Continue para configurar o WhatsApp",
        variant: "destructive"
      });
      setStep('enter-coupon');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    setLoading(true);
    
    try {
      // Se tem cupom, validar
      if (couponCode) {
        const { data: coupon, error } = await supabase
          .from('discount_coupons')
          .select('*')
          .eq('code', couponCode.toUpperCase())
          .eq('is_active', true)
          .single();

        if (error || !coupon) {
          toast({
            title: "Cupom inválido",
            description: "Continuando sem cupom",
            variant: "destructive"
          });
        } else if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
          toast({
            title: "Cupom esgotado",
            description: "Continuando sem cupom",
            variant: "destructive"
          });
        } else {
          setAppliedCoupon(coupon);
          toast({
            title: "✅ Cupom aplicado!",
            description: `Desconto de ${coupon.type === 'discount_percent' ? coupon.value + '%' : 'R$ ' + coupon.value}`,
          });
          
          await supabase.from('user_coupons').insert({ 
            user_id: user?.id, 
            coupon_id: coupon.id 
          });
        }
      }

      // SE PREMIUM: Redirecionar para Stripe checkout
      if (selectedPlan === 'premium') {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('stripe_price_id_monthly')
          .eq('role', 'premium')
          .eq('is_active', true)
          .single();
        
        if (plan?.stripe_price_id_monthly) {
          const { data: checkout, error } = await supabase.functions.invoke('create-checkout', {
            body: { priceId: plan.stripe_price_id_monthly }
          });
          
          if (checkout?.url) {
            window.open(checkout.url, '_blank');
            toast({
              title: "Checkout aberto!",
              description: "Complete o pagamento na nova aba"
            });
          } else {
            throw new Error('Erro ao criar checkout Stripe');
          }
        }
      }

      // Ir para WhatsApp
      setStep('setup-whatsapp');
      
    } catch (error) {
      console.error('[COUPON/CHECKOUT ERROR]', error);
      toast({
        title: "Erro",
        description: "Continuando para WhatsApp",
        variant: "destructive"
      });
      setStep('setup-whatsapp');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número necessário",
        description: "Por favor, digite seu número de WhatsApp",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setGeneratedCode(null);
    
    try {
      const normalizedPhone = phoneNumber.startsWith('+') 
        ? phoneNumber 
        : `+${phoneNumber}`;

      // Salvar número no perfil
      if (user) {
        await supabase
          .from('profiles')
          .update({ phone_number: normalizedPhone })
          .eq('user_id', user.id);
      }

      // Tentar gerar código via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          phone_number: normalizedPhone,
          action: 'auth'
        })
      });

      const result = await response.json();
      
      // Extrair ou gerar código
      let code = null;
      if (result.success && result.response) {
        const responseText = typeof result.response === 'string' 
          ? result.response 
          : JSON.stringify(result.response);
        
        const codeMatch = responseText.match(/\*(\d{6})\*/);
        code = codeMatch ? codeMatch[1] : null;
      }
      
      // FALLBACK: Gerar código aleatório se não extraiu
      if (!code) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
      }

      // SALVAR CÓDIGO NO BANCO
      await supabase.from('whatsapp_validation_codes').insert({
        user_id: user.id,
        code: code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      });

      setGeneratedCode(code);
      toast({
        title: "✅ Código gerado!",
        description: `Código: ${code}`
      });
      
    } catch (error) {
      console.error('[WHATSAPP ERROR]', error);
      toast({
        title: "Erro",
        description: "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode || authCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "Digite 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // BUSCAR CÓDIGO VÁLIDO NO BANCO
      const { data: validCode, error } = await supabase
        .from('whatsapp_validation_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('code', authCode)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !validCode) {
        toast({
          title: "Código inválido",
          description: "Verifique e tente novamente",
          variant: "destructive"
        });
        return;
      }

      // MARCAR CÓDIGO COMO USADO
      await supabase
        .from('whatsapp_validation_codes')
        .update({ used: true })
        .eq('id', validCode.id);

      // CONECTAR WHATSAPP
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phoneNumber,
          message: { body: `codigo ${authCode}` }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // LIMPAR TRANSAÇÕES DE TESTE
        if (user) {
          await supabase
            .from('transactions')
            .delete()
            .eq('user_id', user.id)
            .eq('source', 'manual');
          
          console.log('[ONBOARDING] Saldo zerado');
        }

        toast({
          title: "✅ WhatsApp conectado!",
          description: "Configuração completa"
        });

        await refetch();
        localStorage.setItem('onboarding_complete', 'true');
        onComplete();
      } else {
        throw new Error('Falha na conexão WhatsApp');
      }
      
    } catch (error) {
      console.error('[VERIFY ERROR]', error);
      toast({
        title: "Erro",
        description: "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'choose-plan') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-2">Bem-vindo ao Aligator! 🐊</CardTitle>
            <p className="text-muted-foreground">
              Escolha seu plano e comece a organizar suas finanças
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {availablePlans.map((plan) => (
                <Card 
                  key={plan.id}
                  className={`border-2 hover:border-primary transition-all cursor-pointer ${
                    plan.role === 'premium' ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {plan.role === 'trial' ? (
                        <Star className="h-6 w-6 text-accent" />
                      ) : (
                        <Crown className="h-6 w-6 text-primary" />
                      )}
                      <CardTitle>{plan.display_name}</CardTitle>
                    </div>
                    <p className="text-3xl font-bold">
                      {plan.price_monthly === 0 
                        ? 'Grátis' 
                        : `R$ ${plan.price_monthly.toFixed(2)}`}
                      {plan.price_monthly > 0 && <span className="text-sm font-normal">/mês</span>}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <ul className="space-y-2">
                      {plan.max_transactions ? (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>{plan.max_transactions} transações</span>
                        </li>
                      ) : (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>Transações ilimitadas</span>
                        </li>
                      )}
                      {plan.has_whatsapp && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>WhatsApp {plan.role === 'trial' ? 'básico' : 'completo'}</span>
                        </li>
                      )}
                      {plan.has_ai_reports && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>Relatórios com IA</span>
                        </li>
                      )}
                      {plan.has_google_calendar && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>Google Calendar</span>
                        </li>
                      )}
                    </ul>
                    <Button 
                      className="w-full"
                      variant={plan.role === 'trial' ? 'outline' : 'default'}
                      onClick={() => handleSelectPlan(plan.role)}
                      disabled={loading}
                    >
                      {loading ? "Processando..." : `Escolher ${plan.display_name}`}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
          <div className="border-t p-6 flex justify-between items-center">
            <Button variant="ghost" onClick={handleSkip}>
              Pular configuração
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'enter-coupon') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">🎁 Tem um cupom?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Insira seu código promocional para obter descontos
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="EX: LANCAMENTO30"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              maxLength={20}
            />
            
            {appliedCoupon && (
              <div className="bg-green-50 dark:bg-green-950 border-2 border-green-200 p-3 rounded-lg">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  ✅ Cupom {appliedCoupon.code} aplicado!
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {appliedCoupon.note || 'Desconto ativado com sucesso'}
                </p>
              </div>
            )}

            <Button 
              onClick={handleApplyCoupon} 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Aplicando..." : (couponCode ? 'Aplicar Cupom' : 'Continuar sem cupom')}
            </Button>
          </CardContent>
          <div className="border-t p-6 flex justify-between items-center">
            <Button variant="ghost" onClick={() => setStep('setup-whatsapp')}>
              Pular cupom
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'setup-whatsapp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Configure o WhatsApp</CardTitle>
                <p className="text-sm text-muted-foreground">Passo obrigatório - 2 minutos</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium">✨ Após conectar, você poderá:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Adicionar transações por voz ou texto</li>
                <li>• Enviar fotos de notas fiscais</li>
                <li>• Consultar saldo e relatórios</li>
              </ul>
            </div>

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
                  Formato internacional (sem +): 5511999999999
                </p>
              </div>

              <Button onClick={handleConnectWhatsApp} disabled={loading || !phoneNumber} className="w-full">
                {loading ? "Enviando..." : "Enviar Código"}
              </Button>

              {generatedCode && (
                <div className="bg-green-50 dark:bg-green-950 border-2 border-green-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                    📱 Código gerado com sucesso!
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300 text-center mb-2">
                    {generatedCode}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 text-center">
                    Caso não tenha recebido no WhatsApp, use o código acima
                  </p>
                </div>
              )}

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
                  {authCode && (
                    <Button
                      onClick={handleVerifyCode}
                      disabled={loading || authCode.length !== 6}
                      className="w-full"
                    >
                      {loading ? "Verificando..." : "Verificar Código"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
          <div className="border-t p-6 flex justify-between items-center">
            <Button variant="ghost" onClick={handleSkip}>
              Pular configuração
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}