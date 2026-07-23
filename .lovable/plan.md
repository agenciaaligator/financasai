
# Repaginação Visual — Landing + Admin

Adotar a linguagem visual dos mockups enviados (`dona-wilma-landing.html` e `dona-wilma-admin.html`): paleta terrosa e acolhedora, tipografia editorial com toques manuscritos, e a personificação da Dona Wilma como voz em toda a interface. **Nenhuma lógica de negócio, rota, hook, edge function, banco ou fluxo é alterada** — só camada de apresentação.

## 1. Design System (base para tudo)

Reescrever `src/index.css` e `tailwind.config.ts` com os novos tokens:

- **Cores (HSL)**
  - `--pinho` (primary): `#1E3B32` — verde pinho profundo
  - `--pinho-2`: `#2C5648` — pinho claro para gradiente
  - `--mel` (secondary): `#E3A63C` — mel/honey
  - `--mel-deep`: `#C6842A`, `--mel-soft`: `#F6E2B4`
  - `--creme` (background): `#F7F2E9`, `--creme-2` (card): `#FCFAF4`
  - `--sage`: `#E8ECE1`, `--terra` (foreground): `#2B2621`, `--terra-soft`: `#7A7167`
  - `--receita` (success): `#3F7D5F`, `--despesa` (destructive): `#C05C3E`
- **Tipografia**: adicionar Fraunces (headings), Nunito Sans (body), Caveat (accent manuscrito) via Google Fonts em `index.html`. Utilitários `.font-heading` (Fraunces) e `.hand` (Caveat).
- **Sombras/radius**: sombras suaves esverdeadas, `--radius: 18px`.
- **Sidebar tokens**: fundo pinho sólido, itens ativos com fundo creme.
- Atualiza também `--primary`, `--secondary`, `--muted`, etc., para que **todos os shadcn components herdem automaticamente** sem tocar em cada componente.

## 2. Landing Page

Reconstruir as seções em componentes existentes (`src/pages/Index.tsx` e filhos em `src/components/`) espelhando o mockup:

- **Nav**: sticky, glassmorphism creme, brand com "mark" circular pinho + nome em Fraunces, CTAs mel.
- **Hero**: grid 2 col — copy à esquerda (eyebrow sage, H1 Fraunces com trecho em itálico mel, lead, CTAs) + mock de conversa WhatsApp à direita, com "blob" mel e post-it manuscrito flutuante.
- **Strip de confiança**: barra pinho escura com 4 selos.
- **Empathy** (novo bloco): dores em cards creme + texto acolhedor.
- **Como funciona**: 3 steps com numeração serif gigante ao fundo.
- **Recursos**: bloco pinho escuro, cards translúcidos com ícones mel.
- **Homage** (Dona Wilma, história): mantém texto atual, só reveste no estilo.
- **Planos**: reutiliza `PlansSection` com estilos novos (cartão popular com borda mel).
- **FAQ**: `<details>` estilizado, mantém as perguntas já traduzidas.
- **CTA final** pinho + **Footer** pinho profundo.
- Todas as strings continuam vindo do i18n (5 idiomas); só troco classes/estrutura.

## 3. Admin / Dashboard

Repaginar shell e páginas sem trocar rotas nem hooks:

- **`AppSidebar.tsx`**: fundo pinho sólido, brand com "mark" circular mel, botão "Nova transação" mel arredondado, itens com estados hover/active creme, mini-card no rodapé com frase manuscrita ("tô de olho nas suas contas 💚").
- **`DashboardHeader.tsx`**: chips creme para idioma/sair.
- **`DashboardContent.tsx`**: adicionar **cartão de saudação Dona Wilma** no topo (gradient pinho, avatar "W" mel, tags CTA para WhatsApp/Agenda) reutilizando dados já existentes.
- **`SummaryCards` / KPIs**: cards creme com valor em Fraunces, sparkline sage/mel, cor por tipo (receita/despesa).
- **`BalanceAlert` / `LimitWarning`**: reformatar como "recado da Wilma" (borda esquerda despesa, avatar "W" mel, botão pinho).
- **Recado card**: caixa mel-soft com pin "Recadinho da Wilma" para dicas contextuais (metas vazias, sem receitas etc.) — usa lógica já existente do `MonthlyGoalsSection`/`FeatureFlags`, só muda apresentação.
- **Gráficos**: `FinancialChart` recebe paleta nova (receita verde, despesa terracota, sage neutro).
- **Tabela de transações**: linhas com ícone de categoria em pastilha colorida, valores tabular-nums.
- **Admin (`AdminPanel`, `AdminStats`, tabs)**: aplicar mesma linguagem de cards creme + tabs pinho, sem mexer nas queries.
- **Auth (`Login`, `Register`, `ResetPassword`)**: fundo creme com blob mel, card `.glass-card` sobre pinho suave; remover o `auth-dark` para casar com paleta clara (mantém os hooks e forms atuais).

## 4. Assets & pequenos ajustes

- Trocar o filtro `brightness-0 invert` do logo pelo logo original sobre pinho (o logo já é claro no sidebar).
- Atualizar meta description e og de acordo com o novo copy do hero, se necessário (mantendo padrão SEO).
- Preservar acessibilidade: contraste AA, `:focus-visible` mel, `prefers-reduced-motion`.

## O que NÃO muda

- Rotas, `App.tsx`, Supabase, edge functions, hooks (`useTransactions`, `useCommitments`, `useSubscription`…), i18n (5 locales), Stripe, WhatsApp agent, cron de lembretes, RLS, admin roles, feature flags.
- Nenhum arquivo em `supabase/functions/`, `src/hooks/`, `src/integrations/`, `src/lib/` é modificado.

## Detalhes técnicos (para referência)

- Fontes carregadas em `<head>` com `preconnect` — Fraunces (opsz 9..144, weights 400-700 + ital 500), Nunito Sans (400-800), Caveat (500-700).
- Tokens shadcn (`--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`, `--ring`, `--sidebar-*`) remapeados para a nova paleta — variantes de `Button`, `Card`, `Badge`, `Tabs`, `Table`, `Dialog`, `Sheet` herdam sem edição.
- Nova classe utilitária `.hand` (Caveat) e `.font-heading` (Fraunces) substituem os usos pontuais de `font-display` / `font-heading` atuais.
- `.glass-nav`, `.glass-card`, `.animated-bg` e demais utilitários do `index.css` reajustam alpha/tons para casar com creme (pinho fica no lugar do azul).
- Toda a copy nova ("Recadinho da Wilma", "Oi, meu bem", etc.) entra como chaves i18n em `pt-BR` e é replicada nos outros locales via helpers já usados.

## Entregáveis

1. `src/index.css` + `tailwind.config.ts` + `index.html` (fontes) atualizados.
2. Landing (`Index.tsx`, `FAQSection`, `PlansSection`, `StatsSection`, `TestimonialsSection`, `FeatureBlock`, `InteractionExamplesSection`, `FutureFeatures`, `ContactForm`) repaginados.
3. Shell admin (`AppSidebar`, `DashboardHeader`, `DashboardContent`, `SummaryCards`, `BalanceAlert`, `LimitWarning`, `MonthlyGoalsSection`, `FinancialChart`, `TransactionList`, `AdminPanel` + subcomponentes) repaginados.
4. Telas de auth (`Login`, `Register`, `ResetPassword`, `Welcome`) repaginadas.
5. Novas chaves i18n adicionadas aos 5 arquivos de `src/locales/`.
