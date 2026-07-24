
## Escopo
Refatorar apenas a landing (`src/pages/Index.tsx`) + componentes auxiliares. **Não tocar** em: seção "Por trás do nome", ContactForm, rotas, hooks, autenticação, textos de preços/features dos planos.

## 1. Remover fotos de banco de imagens
Todas as `imageSrc` em `/images/landing/*.png` (whatsapp-financeiro, whatsapp-registros, dashboard-painel, categorias) serão substituídas por **mockups estilizados em JSX**, renderizados com Tailwind na paleta da marca (`--creme-2`, `--pinho`, `--mel`, `--sage`).

Novo componente `src/components/ProductMockup.tsx` com 3 variantes:
- `chat` — bolhas de WhatsApp reais da Wilma (reaproveita estilo `.wa-bubble` já existente)
- `dashboard` — card com saldo + mini gráfico de barras (SVG inline) + linha de categorias
- `categorias` — lista de chips coloridos com valores

Cada mockup renderizado em card `bg-[hsl(var(--creme-2))]` com sombra suave, `rotate-[2deg]` (alternando ±) e um post-it manuscrito (Caveat) no canto. Único retrato real preservado: `dona-wilma-retrato.jpg` na seção "Por trás do nome".

## 2. Consolidar seções
Estrutura atual (7 seções entre hero e planos):
- Como funciona (5 FeatureBlocks)
- InteractionExamples
- Depoimentos/TestimonialsSection
- StatsSection
- Homenagem
- Planos
- FAQ / Contato

Nova estrutura:
1. **Hero** (mantido, com ajustes de animação)
2. **Vídeo "Veja a Dona Wilma em ação"** (novo — item 4)
3. **"Como funciona"** — 3 passos horizontais com 1 mockup por passo:
   - Passo 1: manda no zap (mockup chat)
   - Passo 2: ela organiza (mockup categorias)
   - Passo 3: você acompanha (mockup dashboard)
4. **"O que ela cuida por você"** — grid 4 cards compactos: Painel, Categorias, Google Agenda, Alertas inteligentes (ícones Lucide em chip).
5. **InteractionExamples** (mantido, mais compacto)
6. **Homenagem** (INTOCADA)
7. **Planos**
8. **FAQ**
9. **Contato**

Removidos: `TestimonialsSection`, `StatsSection`, os 5 `FeatureBlock` grandes. Componentes ficam no repo mas deixam de ser importados na landing.

Redução esperada: ~50% na altura da página.

## 3. Ícones uniformes
Todos os ícones das seções passam a ser `lucide-react` (traço 2px, 24px) renderizados dentro de `<span className="icon-chip">` (novo utilitário em `index.css`): `inline-flex, w-11 h-11, rounded-2xl, bg-[hsl(var(--sage))]` ou `bg-[hsl(var(--mel-soft))]`, ícone com `text-[hsl(var(--pinho))]`. Remover qualquer emoji usado como ícone estrutural (mantém apenas emojis dentro das bolhas de chat e post-its, que são parte da voz da marca).

## 4. Seção de vídeo
Nova seção logo após o hero:
```tsx
<section id="video">
  {/* TROCAR: URL do vídeo */}
  const VIDEO_URL = ""; // placeholder
</section>
```
- Se `VIDEO_URL` vazio: capa `bg-[hsl(var(--pinho))]` 16:9, botão play em `--mel` centralizado, manuscrito "vem ver como eu cuido de você 😊" em Caveat.
- Se preenchido: `<iframe>` YouTube embed 16:9, `rounded-[18px]`, `shadow-card`, borda `border border-[hsl(var(--linha))]`.

## 5. Animações reais
- **Hero — bolhas sequenciais**: novo componente `HeroChatAnimation` com estado `visibleBubbles`, `useEffect` com `setTimeout` encadeado. Entre bolhas mostra indicador "digitando..." (3 dots animados). Ao final, pausa 4s e reinicia (`setInterval`).
- **Scroll reveal**: já existe `IntersectionObserver` — reforçar CSS `.scroll-reveal` com `opacity:0; transform:translateY(16px); transition: all 500ms ease-out` e `.revealed { opacity:1; transform:none }`. Adicionar `{ threshold: 0.15 }` e `observer.unobserve` após revelar (uma única vez).
- **Cards/botões hover**: utilitário `.hover-lift` em `index.css` — `transition:transform .2s, box-shadow .2s; hover:translate-y-[-2px] hover:shadow-lg`.
- **Post-its**: classe `.postit` já existe — garantir `rotate-[2deg] a 4deg` e sombra de papel (`box-shadow: 2px 3px 0 rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.05)`).
- **prefers-reduced-motion**: em `index.css`, `@media (prefers-reduced-motion: reduce)` zerando todas as transições/animações/keyframes; hero animation checa `window.matchMedia('(prefers-reduced-motion: reduce)').matches` e mostra todas as bolhas de uma vez.

## 6. Planos — tema claro
Refatorar `src/components/PlansSection.tsx`:
- Wrapper externo: fundo `bg-[hsl(var(--creme))]` (removendo o gradiente escuro atual).
- Cards: `bg-[hsl(var(--creme-2))]`, texto `text-foreground`, features `text-foreground/75`.
- Card anual: `border-2 border-[hsl(var(--mel))]` + `shadow-lg`.
- Tag "melhor valor": `bg-[hsl(var(--mel))] text-[hsl(var(--pinho))]` no topo.
- Botões: mantém `btn-mel` (anual) e outline pinho (mensal).
- **Textos e valores intocados** (todas as chaves i18n preservadas).

## Arquivos afetados
- `src/pages/Index.tsx` — reestrutura da landing (única mudança grande)
- `src/components/ProductMockup.tsx` — NOVO
- `src/components/HeroChatAnimation.tsx` — NOVO (extrai bolhas do hero)
- `src/components/VideoSection.tsx` — NOVO
- `src/components/PlansSection.tsx` — reestilização (sem tocar em i18n/lógica)
- `src/index.css` — utilitários `.icon-chip`, `.hover-lift`, refino `.scroll-reveal`, `@media (prefers-reduced-motion)`

## Fora de escopo
- Sem alterações em rotas, hooks, i18n de conteúdo, autenticação, admin, edge functions, banco.
- `FeatureBlock`, `TestimonialsSection`, `StatsSection` deixam de ser usados na landing mas não são deletados (podem ser reutilizados em outras páginas).
