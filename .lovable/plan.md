

## Refactor Completo do Dashboard — Layout Bento Grid Moderno

### Visão Geral

Transformar o dashboard atual (blocos verticais empilhados) em um layout Bento Grid profissional com cards compactos, sparklines, avatar da Dona Wilma, sidebar minimalista e tipografia Plus Jakarta Sans.

### Arquivos Afetados (10)

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `index.html` | Adicionar fonte Plus Jakarta Sans no Google Fonts |
| 2 | `src/index.css` | Trocar font-family body para Plus Jakarta Sans, reduzir margens globais, ajustar cores navy (#020617), background mais claro |
| 3 | `tailwind.config.ts` | Adicionar `'Plus Jakarta Sans'` ao fontFamily, ajustar heading para Plus Jakarta Sans |
| 4 | `src/components/ui/card.tsx` | Uniformizar `rounded-2xl` (16px→24px), remover hover translate padrão |
| 5 | `src/components/AppSidebar.tsx` | Sidebar mais estreita e minimalista — ícones Lucide ao invés de emojis, remover descriptions, tipografia Plus Jakarta Sans |
| 6 | `src/components/dashboard/DashboardContent.tsx` | Refatorar tab "dashboard" para Bento Grid com CSS Grid, integrar hero card compacto com avatar, mover BalanceAlert para lateral |
| 7 | `src/components/dashboard/SummaryCards.tsx` | Cards menores com sparklines (últimos 7 dias), ícones Lucide modernos ao invés de emojis em círculos grandes |
| 8 | `src/components/dashboard/BalanceAlert.tsx` | Trocar borda vermelha agressiva por borda lateral amarela-laranja sutil com ícone info, texto sugestivo |
| 9 | `src/components/FinancialChart.tsx` | Card bento dedicado, estado vazio limpo, donut chart compacto |
| 10 | `src/assets/dona-wilma-avatar.jpg` | Copiar imagem uploaded como avatar |

### Detalhamento Técnico

#### 1. Tipografia & Fontes
- Google Fonts: adicionar `Plus+Jakarta+Sans:wght@400;500;600;700`
- `body { font-family: 'Plus Jakarta Sans', sans-serif; }`
- `.font-heading` também usa Plus Jakarta Sans (bold 700)
- Remover Crimson Text do heading

#### 2. Sidebar Minimalista
- Trocar emojis (📊💰📂) por ícones Lucide (`LayoutDashboard`, `ArrowLeftRight`, `FolderOpen`, `Target`, `BarChart3`, `MessageCircle`, `User`, `Shield`)
- Remover `description` de cada item (só título + ícone)
- Desktop: sidebar mais estreita (~220px expanded, ~56px collapsed)
- Manter gradiente azul petróleo mas com tom mais escuro (#020617 → #0f172a)

#### 3. Hero Card Compacto (Welcome)
```text
┌─────────────────────────────────────────────────────┐
│ [Avatar 48px]  Olá, email! Dona Wilma está pronta.  │
│                Suas finanças hoje:                    │
│                [● WhatsApp Conectado]                │
└─────────────────────────────────────────────────────┘
```
- Avatar da imagem uploaded (headshot recortado) importado como `src/assets/dona-wilma-avatar.jpg`
- Badge WhatsApp status inline
- Altura máxima ~80px

#### 4. Bento Grid Layout (Dashboard Tab)
```text
┌──────────────────────┬──────────┬──────────┐
│   Hero Welcome Card  │  Saldo   │ Receitas │
│   (col-span-2)       │  + spark │ + spark  │
├──────────────────────┼──────────┼──────────┤
│   Despesas + spark   │ Gráfico Donut       │
│                      │ (col-span-2)        │
├──────────────────────┴─────────────────────┤
│   Últimas Transações (full width)          │
│   + coluna "Origem" com badge WhatsApp     │
└────────────────────────────────────────────┘
```
- CSS Grid: `grid-cols-3` com gaps de `gap-4`
- Cards com `rounded-2xl border border-border`

#### 5. Sparklines nos Summary Cards
- Usar recharts `<Sparkline>` ou mini `<LineChart>` (já instalado)
- Calcular totais diários dos últimos 7 dias a partir das transações
- Linha fina (2px) na cor do card (verde/vermelho/azul)
- Altura ~30px, sem eixos

#### 6. BalanceAlert Redesign
- Remover `border-destructive bg-destructive/5`
- Usar `border-l-4 border-warning bg-warning/5`
- Ícone `Info` em amarelo-laranja ao invés de `AlertTriangle` vermelho
- Texto: "Seu saldo está negativo. Ver sugestões de economia →"
- Posição: card compacto no grid (não full-width banner)

#### 7. Welcome Banner → "Dica do Dia"
- Converter o banner longo com tips em card compacto "💡 Dica do dia"
- Texto rotativo simples (ex: "Envie 'gastei 50 no mercado' pelo WhatsApp")
- Max 2 linhas

#### 8. TransactionList — Coluna "Origem"
- Adicionar badge `WhatsApp` (verde) ou `Manual` (cinza) baseado em `transaction.source`
- A função `getTransactionSource` já existe (linha 128-130)
- Exibir inline ao lado da data ou como coluna separada

#### 9. Cores Globais
- Background: `#f8fafc` (slate-50) — manter claro
- Navy dark: `#020617` para textos fortes (slate-950)
- Cards: branco `#ffffff` com `border border-slate-200`
- Manter verde (#27AE60), vermelho (destructive), laranja (#F39C12)

### Ordem de Implementação

1. Fontes e CSS globais (index.html, index.css, tailwind.config.ts)
2. Card component (rounded-2xl)
3. Sidebar minimalista (AppSidebar.tsx)
4. Avatar asset copy
5. Hero card + Bento Grid layout (DashboardContent.tsx)
6. SummaryCards com sparklines
7. BalanceAlert redesign
8. Chart card e TransactionList com badge origem

