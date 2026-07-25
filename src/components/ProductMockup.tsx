import { ArrowUpRight, ShoppingCart, Home, Utensils, Car, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

type Variant = "chat" | "dashboard" | "categorias";

interface Props {
  variant: Variant;
  tilt?: "l" | "r";
  postit?: string;
  className?: string;
}

export function ProductMockup({ variant, tilt = "r", postit, className = "" }: Props) {
  return (
    <div className={`relative ${className}`}>
      <div className={`mockup-card ${tilt === "l" ? "mockup-tilt-l" : "mockup-tilt-r"} lift-sm`}>
        {variant === "chat" && <ChatMockup />}
        {variant === "dashboard" && <DashboardMockup />}
        {variant === "categorias" && <CategoriasMockup />}
      </div>
      {postit && (
        <div
          className="postit postit-paper absolute hand text-xl"
          style={{ top: "-14px", right: "-10px", transform: "rotate(4deg)" }}
          aria-hidden="true"
        >
          {postit}
        </div>
      )}
    </div>
  );
}

function ChatMockup() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 py-1">
      <Bubble side="me">{t("landing.mockups.chat.me1")}</Bubble>
      <Bubble side="her">
        <span dangerouslySetInnerHTML={{ __html: t("landing.mockups.chat.her1") }} />
      </Bubble>
      <Bubble side="me">{t("landing.mockups.chat.me2")}</Bubble>
      <Bubble side="her">{t("landing.mockups.chat.her2")}</Bubble>
    </div>
  );
}

function Bubble({ side, children }: { side: "me" | "her"; children: React.ReactNode }) {
  const base =
    "text-sm px-3 py-2 rounded-2xl max-w-[85%] leading-snug shadow-sm";
  return side === "me" ? (
    <div className={`${base} self-end bg-[hsl(var(--mel-soft))] text-[hsl(var(--pinho))] rounded-br-md`}>
      {children}
    </div>
  ) : (
    <div className={`${base} self-start bg-white text-foreground rounded-bl-md border border-[hsl(var(--border))]`}>
      {children}
    </div>
  );
}

function DashboardMockup() {
  const { t } = useTranslation();
  const bars = [40, 65, 32, 78, 55, 90, 48];
  const weekdays = t("landing.mockups.weekdays", { returnObjects: true }) as string[];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            {t("landing.mockups.dashboard.balance")}
          </p>
          <p className="font-heading text-2xl font-bold text-[hsl(var(--pinho))]">R$ 2.847,00</p>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-[hsl(var(--receita))] bg-[hsl(var(--receita-bg))] px-2 py-1 rounded-full">
          <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          +12%
        </div>
      </div>

      <div className="flex items-end gap-1.5 h-20">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              height: `${h}%`,
              background: i === 5 ? "hsl(var(--mel))" : "hsl(var(--pinho) / 0.75)",
            }}
          />
        ))}
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
        {weekdays.map((d, i) => <span key={i}>{d}</span>)}
      </div>
    </div>
  );
}

function CategoriasMockup() {
  const { t } = useTranslation();
  const cats = [
    { icon: ShoppingCart, label: t("landing.mockups.categories.market"), value: "R$ 320", pct: 68, color: "hsl(var(--mel))" },
    { icon: Home, label: t("landing.mockups.categories.home"), value: "R$ 1.200", pct: 92, color: "hsl(var(--pinho))" },
    { icon: Utensils, label: t("landing.mockups.categories.food"), value: "R$ 180", pct: 40, color: "hsl(var(--receita))" },
    { icon: Car, label: t("landing.mockups.categories.transport"), value: "R$ 95", pct: 22, color: "hsl(var(--mel-deep))" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--pinho))] uppercase tracking-wider">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        {t("landing.mockups.categories.title")}
      </div>
      {cats.map(({ icon: Icon, label, value, pct, color }) => (
        <div key={label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${color}`, color: "#fff" }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="font-medium text-foreground">{label}</span>
            </div>
            <span className="font-semibold text-[hsl(var(--pinho))]">{value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[hsl(var(--sage))] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
