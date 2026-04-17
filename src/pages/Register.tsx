import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Loader2, ArrowRight, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "@/components/ui/phone-input.css";
import {
  getCurrencyFromLocale,
  getPriceId,
} from "@/config/pricing";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const plan = searchParams.get("plan") as "monthly" | "yearly" | null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    setLoading(true);
    console.log("[REGISTER] Starting signup for:", email, "plan:", plan);
    try {
      const normalizedEmail = email.toLowerCase().trim();

      // 1. Sign up user
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
        if (
          signUpError.message.includes("already registered") ||
          signUpError.message.includes("already been registered") ||
          signUpError.message.includes("User already registered")
        ) {
          toast({
            title: t("register.emailExists"),
            description: t("register.emailExistsDesc"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        if (signUpError.message.includes("Password should be at least")) {
          toast({
            title: t("register.weakPassword"),
            description: t("register.weakPasswordDesc"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        if (signUpError.message.includes("rate limit") || signUpError.message.includes("seconds") || (signUpError as any).status === 429) {
          toast({
            title: t("register.rateLimitTitle", "Aguarde alguns segundos"),
            description: t("register.rateLimitDesc", "Por segurança, aguarde 30 segundos antes de tentar novamente."),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error("User creation failed");
      }

      // Detect fake signup (email confirmation enabled + duplicate email)
      // Supabase returns 200 with empty identities array
      if (
        signUpData.user.identities &&
        signUpData.user.identities.length === 0
      ) {
        toast({
          title: t("register.emailExists"),
          description: t("register.emailExistsDesc"),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 2. Update profile: password_set = true (best-effort, trigger already handles this)
      supabase
        .from("profiles")
        .update({ password_set: true })
        .eq("user_id", signUpData.user.id)
        .then(({ error: profileErr }) => {
          if (profileErr) console.warn("[REGISTER] Profile update (non-blocking):", profileErr);
        });

      // 3. If plan selected, redirect to Stripe checkout
      if (plan) {
        setRedirecting(true);
        const locale = i18n.language;
        const priceId = getPriceId(plan === "yearly" ? "yearly" : "monthly", locale);

        toast({
          title: t("landing.plans.redirectingToast"),
          description: t("landing.plans.redirectingToastDesc"),
        });

        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
          "create-checkout",
          {
            body: { 
              priceId, 
              locale,
              userId: signUpData.user.id,
              email: normalizedEmail,
            },
          }
        );

        if (checkoutError || !checkoutData?.url) {
          console.error("[REGISTER] Checkout error:", checkoutError);
          setRedirecting(false);
          toast({
            title: t("landing.plans.errorTitle"),
            description: t("landing.plans.errorDesc"),
            variant: "destructive",
          });
          // Show email-sent screen as safe fallback
          setEmailSent(true);
          setLoading(false);
          return;
        }

        window.location.href = checkoutData.url;
      } else {
        // No plan selected: account created, email confirmation pending.
        // Show clear "check your email" screen instead of bouncing through guards.
        console.log("[REGISTER] No plan, showing email-sent screen");
        setEmailSent(true);
      }
    } catch (error) {
      console.error("[REGISTER] Error:", error);
      toast({
        title: t("common.error"),
        description: t("common.genericError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-white text-lg">{t("landing.plans.redirectingToast", "Redirecionando para pagamento...")}</p>
          <p className="text-white/60 text-sm">{t("landing.plans.redirectingToastDesc", "Aguarde enquanto preparamos seu checkout")}</p>
        </div>
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <ArrowRight className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {t("register.checkEmailTitle", "Confira seu e-mail")}
          </h2>
          <p className="text-white/80">
            {t("register.checkEmailDesc", "Enviamos um link de confirmação para")} <strong className="text-white">{email}</strong>.
          </p>
          <p className="text-white/60 text-sm">
            {t("register.checkEmailHint", "Clique no link do e-mail para ativar sua conta. Confira a caixa de spam se não encontrar.")}
          </p>
          <div className="pt-2 space-y-2">
            <Button onClick={() => navigate("/choose-plan")} className="w-full" size="lg">
              {t("register.choosePlanCta", "Escolher meu plano")}
            </Button>
            <Button onClick={() => navigate("/login")} variant="outline" className="w-full border-white/30 text-white bg-white/10 hover:bg-white/20">
              {t("register.alreadyHaveAccount", "Já tenho conta")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-white">Dona Wilma</span>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="border-white/30 text-white bg-white/10 hover:bg-white/20"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {t("register.alreadyHaveAccount")}
          </Button>
        </nav>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">
              {t("register.title")}
            </CardTitle>
            <CardDescription className="text-white/60">
              {t("register.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/90">
                  {t("register.name")}
                </Label>
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
                <Label htmlFor="email" className="text-white/90">
                  {t("register.email")}
                </Label>
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
                <Label htmlFor="password" className="text-white/90">
                  {t("register.password")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("register.passwordPlaceholder")}
                  required
                  minLength={6}
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
                    {t("register.creating")}
                  </>
                ) : (
                  <>
                    {t("register.createAccount")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-white/40 pt-2">
                {t("landing.plans.termsAgreement")}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
