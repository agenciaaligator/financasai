import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const COOLDOWN_SECONDS = 30;
const COOLDOWN_KEY = "contact_form_cooldown_until";

export function ContactForm() {
  const { t } = useTranslation();

  const schema = z.object({
    name: z.string().trim().min(2, t("validation.contact.nameMin")).max(120, t("validation.contact.nameMax")),
    email: z.string().trim().email(t("validation.contact.emailInvalid")).max(255, t("validation.contact.emailMax")),
    subject: z.string().trim().min(3, t("validation.contact.subjectMin")).max(200, t("validation.contact.subjectMax")),
    message: z.string().trim().min(10, t("validation.contact.messageMin")).max(5000, t("validation.contact.messageMax")),
  });

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Cooldown ticker
  useEffect(() => {
    const until = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
    const update = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setCooldownLeft(left);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [success]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldownLeft > 0) return;

    // Honeypot — finge sucesso silencioso
    if (form.website.trim()) {
      console.log("[ContactForm] honeypot triggered");
      setSuccess(true);
      return;
    }

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const k = iss.path[0] as string;
        if (!fieldErrors[k]) fieldErrors[k] = iss.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    console.log("[ContactForm] submitting");

    try {
      const { data, error } = await supabase.functions.invoke("submit-contact-message", {
        body: {
          ...parsed.data,
          website: form.website,
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });

      if (error || (data as any)?.error) {
        const code = (data as any)?.error || "generic";
        console.log("[ContactForm] error", code, error);
        const map: Record<string, string> = {
          rate_limit: t("landing.contactSection.errors.rateLimit"),
          duplicate: t("landing.contactSection.errors.duplicate"),
          validation: t("landing.contactSection.errors.validation"),
          generic: t("landing.contactSection.errors.generic"),
        };
        toast.error(map[code] || map.generic);
        setLoading(false);
        return;
      }

      console.log("[ContactForm] success");
      const until = Date.now() + COOLDOWN_SECONDS * 1000;
      sessionStorage.setItem(COOLDOWN_KEY, String(until));
      setSuccess(true);
      setForm({ name: "", email: "", subject: "", message: "", website: "" });
      toast.success(t("landing.contactSection.success"));
    } catch (err) {
      console.log("[ContactForm] exception", err);
      toast.error(t("landing.contactSection.errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h3 className="font-display text-xl font-bold">{t("landing.contactSection.successTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("landing.contactSection.success")}</p>
        <Button variant="outline" onClick={() => setSuccess(false)} disabled={cooldownLeft > 0}>
          {cooldownLeft > 0
            ? t("landing.contactSection.cooldown", { seconds: cooldownLeft })
            : t("landing.contactSection.sendAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 md:p-8 space-y-4" noValidate>
      {/* Honeypot — invisível para humanos */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => update("website", e.target.value)}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact-name">{t("landing.contactSection.fields.name.label")}</Label>
          <Input
            id="contact-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder={t("landing.contactSection.fields.name.placeholder")}
            disabled={loading}
            maxLength={120}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-email">{t("landing.contactSection.fields.email.label")}</Label>
          <Input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder={t("landing.contactSection.fields.email.placeholder")}
            disabled={loading}
            maxLength={255}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-subject">{t("landing.contactSection.fields.subject.label")}</Label>
        <Input
          id="contact-subject"
          value={form.subject}
          onChange={(e) => update("subject", e.target.value)}
          placeholder={t("landing.contactSection.fields.subject.placeholder")}
          disabled={loading}
          maxLength={200}
          aria-invalid={!!errors.subject}
        />
        {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message">{t("landing.contactSection.fields.message.label")}</Label>
        <Textarea
          id="contact-message"
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          placeholder={t("landing.contactSection.fields.message.placeholder")}
          disabled={loading}
          maxLength={5000}
          rows={6}
          aria-invalid={!!errors.message}
        />
        <div className="flex justify-between items-center">
          {errors.message ? (
            <p className="text-xs text-destructive">{errors.message}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">{form.message.length}/5000</span>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full font-semibold"
        disabled={loading || cooldownLeft > 0}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t("landing.contactSection.submitting")}
          </>
        ) : cooldownLeft > 0 ? (
          t("landing.contactSection.cooldown", { seconds: cooldownLeft })
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            {t("landing.contactSection.submit")}
          </>
        )}
      </Button>
    </form>
  );
}
