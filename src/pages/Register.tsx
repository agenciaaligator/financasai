import { useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Loader2, ArrowRight, LogIn, ShieldCheck, CreditCard, MessageCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "@/components/ui/phone-input.css";
import { getPriceId, getDisplayPrice, getCurrencyFromLocale, formatPrice } from "@/config/pricing";

type FlowState = "idle" | "creating" | "verifying" | "preparing" | "redirecting";

// Wait for the profile to exist (created by the on_auth_user_created trigger).
// Returns true if found within the timeout, false otherwise.
const waitForProfile = async (userId: string, timeoutMs = 8000): Promise<boolean> => {
  const start = Date.now();
  let delay = 250;
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return true;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 1000);
  }
  return false;
};

// Promise with timeout (rejects if it takes too long)
const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${label}`)), ms)
    ),
  ]);
};

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const planParam = searchParams.get("plan");
  const plan: "monthly" | "yearly" | null =
    planParam === "monthly" || planParam === "yearly" ? planParam : null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [flow, setFlow] = useState<FlowState>("idle");

  // Single-flow enforcement: no plan → send user to plan selection.
  if (!plan) {
    return <Navigate to="/choose-plan" replace />;
  }

  const loading = flow !== "idle";
  const currency = getCurrencyFromLocale(i18n.language);
  const planPrice = formatPrice(getDisplayPrice(plan, i18n.language), currency);
  const cycleLabel = plan === "monthly" ? t("welcome.monthly", "Mensal") : t("welcome.yearly", "Anual");
  const periodLabel = plan === "monthly" ? t("welcome.perMonth", "mês") : t("welcome.perYear", "ano");

  const flowLabel = (): string => {
    switch (flow) {
      case "creating": return t("register.statusCreating", "Criando sua conta...");
      case "verifying": return t("register.statusVerifying", "Preparando seu perfil...");
      case "preparing": return t("register.statusPreparing", "Preparando o pagamento...");
      case "redirecting": return t("register.statusRedirecting", "Redirecionando para o checkout...");
      default: return "";
    }
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    const normalizedEmail = email.toLowerCase().trim();

    if (!isValidEmail(normalizedEmail)) {
      toast({
        title: t("register.invalidEmailTitle", "E-mail inválido"),
        description: t("register.invalidEmailDesc", "Verifique se digitou o e-mail corretamente."),
        variant: "destructive",
      });
      return;
    }

    setFlow("creating");
    console.log("[REGISTER] Starting signup for:", normalizedEmail, "plan:", plan);

    try {
      // 0. PRE-CHECK: e-mail and phone availability before signUp
      const [emailCheck, phoneCheck] = await Promise.all([
        supabase.rpc("check_email_available", { p_email: normalizedEmail }),
        phone
          ? supabase.rpc("check_phone_available", { p_phone: phone })
          : Promise.resolve({ data: true, error: null } as any),
      ]);

      if (!emailCheck.error && emailCheck.data === false) {
        toast({
          title: t("register.emailAlreadyUsedTitle", "Esse e-mail já tem conta"),
          description: t("register.emailAlreadyUsedDesc", "Faça login para acessar ou recupere sua senha."),
          variant: "destructive",
        });
        setFlow("idle");
        return;
      }

      if (!phoneCheck.error && phoneCheck.data === false) {
        toast({
          title: t("register.phoneAlreadyUsedTitle", "Esse WhatsApp já está em uso"),
          description: t("register.phoneAlreadyUsedDesc", "Esse número já está vinculado a outra conta. Use outro número ou faça login na conta existente."),
          variant: "destructive",
        });
        setFlow("idle");
        return;
      }

      // 1. signUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: name.trim(),
            phone_number: phone || undefined,
            password_set: true,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message || "";
        const status = (signUpError as any).status;

        if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("User already registered")) {
          toast({
            title: t("register.emailAlreadyUsedTitle", "Esse e-mail já tem conta"),
            description: t("register.emailAlreadyUsedDesc", "Faça login para acessar ou recupere sua senha."),
            variant: "destructive",
          });
          setFlow("idle");
          return;
        }
        if (msg.includes("Password should be at least") || msg.toLowerCase().includes("password")) {
          toast({ title: t("register.weakPassword"), description: t("register.weakPasswordDesc"), variant: "destructive" });
          setFlow("idle");
          return;
        }
        if (msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("email")) {
          toast({
            title: t("register.invalidEmailTitle", "E-mail inválido"),
            description: t("register.invalidEmailDesc", "Verifique se digitou o e-mail corretamente."),
            variant: "destructive",
          });
          setFlow("idle");
          return;
        }
        if (msg.includes("rate limit") || msg.includes("seconds") || status === 429) {
          toast({
            title: t("register.rateLimitTitle", "Aguarde alguns segundos"),
            description: t("register.rateLimitDesc", "Por segurança, aguarde 30 segundos antes de tentar novamente."),
            variant: "destructive",
          });
          setFlow("idle");
          return;
        }
        if (msg.toLowerCase().includes("phone") || msg.includes("phone_number")) {
          toast({
            title: t("register.phoneAlreadyUsedTitle", "Esse WhatsApp já está em uso"),
            description: t("register.phoneAlreadyUsedDesc", "Esse número já está vinculado a outra conta. Use outro número ou faça login na conta existente."),
            variant: "destructive",
          });
          setFlow("idle");
          return;
        }
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error("User creation failed");
      }

      // 2. Wait for profile (created by trigger).
      setFlow("verifying");
      const profileOk = await waitForProfile(signUpData.user.id, 8000);
      if (!profileOk) {
        console.error("[REGISTER] Profile not created within timeout");
        toast({
          title: t("register.profileMissingTitle", "Não conseguimos preparar sua conta"),
          description: t("register.profileMissingDesc", "Sua conta foi criada, mas houve atraso na preparação do perfil. Tente fazer login em alguns segundos."),
          variant: "destructive",
        });
        setFlow("idle");
        return;
      }

      // Best-effort: ensure password_set flag is true
      supabase
        .from("profiles")
        .update({ password_set: true })
        .eq("user_id", signUpData.user.id)
        .then(({ error: profileErr }) => {
          if (profileErr) console.warn("[REGISTER] Profile update (non-blocking):", profileErr);
        });

      // 3. Create checkout (with timeout)
      setFlow("preparing");
      const locale = i18n.language;
      const priceId = getPriceId(plan, locale);

      const { data: checkoutData, error: checkoutError } = await withTimeout(
        supabase.functions.invoke("create-checkout", {
          body: {
            priceId,
            locale,
            userId: signUpData.user.id,
            email: normalizedEmail,
          },
        }),
        15000,
        "create-checkout"
      );

      if (checkoutError || !checkoutData?.url) {
        console.error("[REGISTER] Checkout error:", checkoutError);
        toast({
          title: t("landing.plans.errorTitle", "Não foi possível abrir o pagamento"),
          description: t("landing.plans.errorDesc", "Sua conta já foi criada. Tente novamente em instantes."),
          variant: "destructive",
        });
        setFlow("idle");
        return;
      }

      setFlow("redirecting");
      toast({
        title: t("landing.plans.redirectingToast", "Abrindo o checkout..."),
        description: t("landing.plans.redirectingToastDesc", "Você será redirecionado para finalizar o pagamento."),
      });
      window.location.href = checkoutData.url;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      console.error("[REGISTER] Error:", error);

      if (msg.startsWith("timeout:")) {
        toast({
          title: t("register.timeoutTitle", "O pagamento está demorando para abrir"),
          description: t("register.timeoutDesc", "Sua conta foi criada. Tente novamente em alguns segundos."),
          variant: "destructive",
        });
      } else if (!navigator.onLine || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        toast({
          title: t("register.networkErrorTitle", "Sem conexão"),
          description: t("register.networkErrorDesc", "Verifique sua internet e tente novamente."),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("register.unexpectedTitle", "Não conseguimos concluir agora"),
          description: t("register.unexpectedDesc", "Tente novamente em alguns segundos. Se continuar, fale com o suporte."),
          variant: "destructive",
        });
      }
      setFlow("idle");
    }
  };

  // Full-screen "redirecting" overlay only on the last step
  if (flow === "redirecting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-white text-lg">{flowLabel()}</p>
          <p className="text-white/60 text-sm">
            {t("landing.plans.redirectingToastDesc", "Aguarde enquanto preparamos seu checkout")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-white">Dona Wilma</span>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/login")}
            className="border-white/30 text-white bg-white/10 hover:bg-white/20"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {t("register.alreadyHaveAccount")}
          </Button>
        </nav>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-md space-y-5">
        {/* Plan summary card */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-lg border border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/60">
                  {t("register.selectedPlan", "Plano selecionado")}
                </p>
                <p className="text-lg font-semibold text-white mt-1">
                  Premium {cycleLabel}
                </p>
                <p className="text-2xl font-bold text-white mt-2">
                  {planPrice}
                  <span className="text-sm font-normal text-white/70">/{periodLabel}</span>
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        {/* Stepper */}
        <div className="flex items-center justify-between text-xs text-white/70 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">1</div>
            <span className="text-white">{t("register.stepAccount", "Criar conta")}</span>
          </div>
          <div className="flex-1 h-px bg-white/20 mx-2" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/10 border border-white/30 text-white/60 flex items-center justify-center text-[10px] font-bold">2</div>
            <span>{t("register.stepPayment", "Pagamento")}</span>
          </div>
          <div className="flex-1 h-px bg-white/20 mx-2" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/10 border border-white/30 text-white/60 flex items-center justify-center text-[10px] font-bold">3</div>
            <span>{t("register.stepWhatsApp", "WhatsApp")}</span>
          </div>
        </div>

        {/* Form card */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-white">{t("register.title")}</CardTitle>
            <CardDescription className="text-white/60">
              {t("register.subtitleNew", "Você criará sua conta agora. O pagamento abre na próxima etapa.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/90">{t("register.name")}</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("register.namePlaceholder")}
                  required
                  disabled={loading}
                  className="!bg-white/10 !text-white border-white/20 placeholder:text-white/40 focus-visible:!bg-white/15"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">{t("register.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("register.emailPlaceholder")}
                  required
                  disabled={loading}
                  className="!bg-white/10 !text-white border-white/20 placeholder:text-white/40 focus-visible:!bg-white/15"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90">{t("register.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("register.passwordPlaceholder")}
                  required
                  minLength={8}
                  disabled={loading}
                  className="!bg-white/10 !text-white border-white/20 placeholder:text-white/40 focus-visible:!bg-white/15"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white/90">
                  {t("register.whatsapp")}
                  <span className="text-white/40 ml-1">({t("register.optional")})</span>
                </Label>
                <PhoneInput
                  international
                  defaultCountry="BR"
                  value={phone}
                  onChange={(value) => setPhone(value || "")}
                  className="phone-input-dark flex h-11 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base text-white ring-offset-background"
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || !name.trim() || !email.trim() || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {flowLabel()}
                  </>
                ) : (
                  <>
                    {t("register.continueToPayment", "Continuar para o pagamento")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              {/* Trust signals */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] text-white/50">
                <div className="flex flex-col items-center gap-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{t("register.trustSecure", "Pagamento seguro")}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  <span>Stripe</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>{t("register.trustWhatsApp", "WhatsApp depois")}</span>
                </div>
              </div>

              <p className="text-center text-xs text-white/40 pt-1">
                {t("landing.plans.termsAgreement")}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
