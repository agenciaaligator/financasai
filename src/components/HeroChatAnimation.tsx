import { useEffect, useState } from "react";

type Bubble = { side: "me" | "her"; text: React.ReactNode };

const SCRIPT: Bubble[] = [
  { side: "me", text: <>Gastei 47 reais no mercado agora</> },
  { side: "her", text: <>Anotei, viu? <b>R$ 47,00</b> em Mercado 🛒. Esse mês você já tá em R$ 320 nessa categoria.</> },
  { side: "me", text: <>Nossa, tá alto</> },
  { side: "her", text: <>Tá sim, meu bem. Quer que eu te avise quando passar de R$ 400? 💚</> },
  { side: "me", text: <>Pode ser! E me lembra do aluguel dia 5</> },
  { side: "her", text: <>Deixa comigo. Dia 5 eu te aviso do <b>aluguel</b> bem cedinho ⏰</> },
];

const TYPING_MS = 900;
const READ_MS = 700;
const PAUSE_END_MS = 4000;

export function HeroChatAnimation() {
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
    let timeouts: number[] = [];

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
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <div className="wa-body">
      {SCRIPT.slice(0, visible).map((b, i) => (
        <div
          key={i}
          className={`wa-bubble ${b.side === "me" ? "wa-bubble-me" : "wa-bubble-her"}`}
          style={{ animation: "fadeInUp 300ms ease-out both" }}
        >
          {b.text}
          <span className="wa-time">14:0{i}</span>
        </div>
      ))}
      {typing && (
        <div
          className={`typing-dots ${typing === "me" ? "self-end" : ""}`}
          style={{
            alignSelf: typing === "me" ? "flex-end" : "flex-start",
            background: typing === "me" ? "hsl(var(--mel-soft))" : "#fff",
          }}
          aria-label="digitando"
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
