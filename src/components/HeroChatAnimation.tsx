import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type Bubble = { side: "me" | "her"; html: string };

const TYPING_MS = 900;
const READ_MS = 700;
const PAUSE_END_MS = 4000;

export function HeroChatAnimation() {
  const { t, i18n } = useTranslation();

  const SCRIPT: Bubble[] = useMemo(() => [
    { side: "me",  html: t("landing.heroChat.b0") },
    { side: "her", html: t("landing.heroChat.b1") },
    { side: "me",  html: t("landing.heroChat.b2") },
    { side: "her", html: t("landing.heroChat.b3") },
    { side: "me",  html: t("landing.heroChat.b4") },
    { side: "her", html: t("landing.heroChat.b5") },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [i18n.language, t]);

  const [visible, setVisible] = useState<number>(SCRIPT.length);
  const [typing, setTyping] = useState<"me" | "her" | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(SCRIPT.length);
      setTyping(null);
      return;
    }

    let cancelled = false;
    const timeouts: number[] = [];

    const run = async () => {
      while (!cancelled) {
        setVisible(0);
        setTyping(null);
        await wait(400, timeouts);
        for (let i = 0; i < SCRIPT.length; i++) {
          if (cancelled) return;
          setTyping(SCRIPT[i].side);
          await wait(TYPING_MS, timeouts);
          if (cancelled) return;
          setTyping(null);
          setVisible(i + 1);
          await wait(READ_MS, timeouts);
        }
        await wait(PAUSE_END_MS, timeouts);
      }
    };

    run();
    return () => {
      cancelled = true;
      timeouts.forEach((tid) => window.clearTimeout(tid));
    };
  }, [SCRIPT]);

  return (
    <div className="wa-body">
      {SCRIPT.slice(0, visible).map((b, i) => (
        <div
          key={i}
          className={`wa-bubble ${b.side === "me" ? "wa-bubble-me" : "wa-bubble-her"}`}
          style={{ animation: "fadeInUp 300ms ease-out both" }}
          dangerouslySetInnerHTML={{ __html: `${b.html}<span class="wa-time">14:0${i}</span>` }}
        />
      ))}
      {typing && (
        <div
          className={`typing-dots ${typing === "me" ? "self-end" : ""}`}
          style={{
            alignSelf: typing === "me" ? "flex-end" : "flex-start",
            background: typing === "me" ? "hsl(var(--mel-soft))" : "#fff",
          }}
          aria-label="typing"
        >
          <span /><span /><span />
        </div>
      )}
    </div>
  );
}

function wait(ms: number, store: number[]) {
  return new Promise<void>((resolve) => {
    const id = window.setTimeout(() => resolve(), ms);
    store.push(id);
  });
}
