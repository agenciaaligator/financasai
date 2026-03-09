

## Redesign Completo do Dashboard Dona Wilma

### Escopo

Atualizar a identidade visual do dashboard com a nova paleta, tipografia (Crimson Text + Inter), sidebar com gradiente e emojis, cards com border-radius 20px, animações fadeInUp, e estilo "conversacional" nas transacoes.

### Arquivos a Modificar

#### 1. `index.html` - Adicionar fontes Google
- Adicionar `<link>` para **Crimson Text** (italic, 600, 700) e **Inter** (400, 500, 600, 700)

#### 2. `src/index.css` - Nova paleta de cores CSS
Substituir as CSS variables `:root` com:
- `--primary` baseado em `#2B5B84` (HSL ~207 50% 34%)
- `--secondary` baseado em `#E8B86D` (HSL ~37 74% 67%)
- `--success` baseado em `#27AE60` (HSL ~145 63% 42%)
- `--warning: 36 90% 51%` (para `#F39C12`)
- `--background: 210 17% 98%` (off-white `#F8F9FA`)
- `--border: 210 16% 93%` (`#E9ECEF`)
- `--foreground` baseado em `#2C3E50`
- `--muted-foreground` baseado em `#7F8C8D`
- Atualizar gradientes: `--gradient-primary` para `#2B5B84 -> #1e4a6b`
- `--shadow-card: 0 8px 25px rgba(43, 91, 132, 0.08)`
- Sidebar variables: background com gradiente azul petroleo, foreground branco
- Adicionar `font-family: 'Inter', sans-serif` no `body`
- Adicionar classes utilitarias: `.font-heading` para Crimson Text
- Adicionar keyframes: `fadeInUp`, `float`
- Adicionar classe `.dw-card` com border-radius 20px, hover translateY(-4px), transition

#### 3. `tailwind.config.ts` - Adicionar fontes e animacoes
- Adicionar `fontFamily: { heading: ['Crimson Text', 'serif'], body: ['Inter', 'sans-serif'] }`
- Adicionar keyframes `fadeInUp` e `float`
- Adicionar animacoes correspondentes

#### 4. `src/components/AppSidebar.tsx` - Sidebar redesenhada
- Remover imports Lucide (DollarSign, TrendingUp, Tags, etc.)
- Substituir icones por emojis: `📊 💰 📂 📈 👤 🛡️`
- Logo: "Dona Wilma" em `font-heading italic text-2xl text-white`
- Subtitulo: "Sua assistente financeira pessoal"
- Background: `bg-gradient-to-br from-[#2B5B84] to-[#1e4a6b]`
- Links: hover com `translate-x-1` e `bg-white/10 backdrop-blur`
- Botao Nova Transacao com emoji ➕ e estilo dourado (`--secondary`)
- Micro-animacao float no icone/logo

#### 5. `src/components/dashboard/SummaryCards.tsx` - Cards financeiros unicos
- Border-radius 20px via classe `rounded-[20px]`
- `::before` simulado com div absoluta colored top border (4px): azul para saldo, verde para receitas, vermelho para despesas
- Icones grandes (60px) com gradient background circular
- Emojis: 💰 Saldo, 📈 Receitas, 📉 Despesas
- Labels uppercase com `tracking-wider text-xs uppercase`
- Valores `text-[2rem] font-bold`
- Hover: `hover:-translate-y-1 hover:shadow-lg transition-all duration-300`
- Animacao fadeInUp escalonada via `animation-delay`

#### 6. `src/components/FinancialChart.tsx` - Grafico humanizado
- Titulo: "Como seu dinheiro se comportou" em `font-heading`
- Cores atualizadas: income `#27AE60`, expense `#dc2626` (ou `#E74C3C`)

#### 7. `src/components/TransactionList.tsx` - Transacoes como conversas
- Emoji avatar circular (48px) baseado em categoria (mapeamento: alimentacao 🍔, transporte 🚗, saude 💊, lazer 🎮, default 💬)
- Hover: `hover:translate-x-1 hover:bg-muted/30 transition-all`
- Meta info: badge "WhatsApp" ou "Manual" como fonte (baseado em `transaction.source` se existir, senao "Manual")
- Border-radius cards 20px

#### 8. `src/components/dashboard/DashboardContent.tsx` - Header acolhedor
- No dashboard tab, adicionar header section:
  - Background branco com elemento decorativo dourado (div com `bg-[#E8B86D]` blur)
  - Titulo: `Ola, [Nome]! 🎉` em `font-heading text-[2.5rem]`
  - Subtitulo: "Como estao suas financas hoje? Vamos dar uma olhada..."
  - `rounded-[20px] p-8`
- Card do grafico: titulo "Como seu dinheiro se comportou"
- Card transacoes: titulo "💬 Suas ultimas conversas financeiras"

#### 9. `src/components/FinancialDashboard.tsx` - Header desktop atualizado
- Titulo principal em `font-heading` ao inves de gradient text
- Manter estrutura mas aplicar nova tipografia

### Detalhes Tecnicos

- Cores serao definidas em HSL nas CSS variables para compatibilidade com Tailwind `hsl(var(--xxx))`
- Fontes carregadas via Google Fonts CDN no `index.html`
- Animacoes `fadeInUp` com delays escalonados (0ms, 100ms, 200ms) nos 3 summary cards
- A micro-animacao `float` usa `translateY` oscilante no logo da sidebar
- Nenhuma dependencia nova necessaria

