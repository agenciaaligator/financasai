

## Auditoria Completa de Responsividade e UX/UI - Dona Wilma

Após inspecionar todos os componentes, páginas e fluxos do projeto, identifiquei os problemas organizados por prioridade.

---

### PROBLEMAS CRITICOS (Deve Corrigir)

**1. TransactionFilters: TabsList com 5 abas espremidas no mobile (320-390px)**
- `grid-cols-5` no TabsList faz os textos "Último mês" ficarem cortados/ilegíveis em telas pequenas
- Correcao: usar scroll horizontal ou `grid-cols-3` + `grid-cols-2` em mobile, ou converter para Select no mobile

**2. DashboardContent - Transactions header: layout quebrado no mobile**
- L350-369: CardTitle com flex row `items-center justify-between` empilha mal no mobile — o contador "X de Y transações" e o botão refresh ficam sobrepostos ao título
- Correcao: `flex-col` no mobile com gap adequado

**3. ReportsPage: Pie chart labels cortados no mobile**
- L195: `label={({ name, percent }) => ...}` renderiza texto longo dentro do SVG que é cortado em telas < 400px
- Correcao: desabilitar labels inline no mobile, usar apenas legenda externa

**4. ReportsPage: YAxis do BarChart com valores monetários cortados**
- L224: `tickFormatter` mostra "R$ 1.000,00" que não cabe em viewports pequenos
- Correcao: usar formatação abreviada ("R$1k") ou esconder YAxis no mobile

**5. MonthlyGoalsSection: Botões edit/delete invisíveis no mobile (touch)**
- L141-149: `opacity-0 group-hover:opacity-100` — em dispositivos touch não existe hover, logo os botões ficam permanentemente invisíveis
- Correcao: tornar sempre visíveis no mobile (`md:opacity-0 md:group-hover:opacity-100`)

**6. SummaryCards: Valores com `text-[2rem]` transbordam em telas 320px**
- L25-26, L43-44, L61-62: valores como "R$ 12.345,67" com 2rem não cabem em cards de coluna única em telas muito pequenas
- Correcao: `text-xl sm:text-[2rem]`

**7. Landing Login button escondido em mobile < 640px**
- L85: `hidden sm:flex` faz o botão "Entrar" desaparecer em telas < 640px. O usuário precisa abrir o hamburger menu para fazer login
- Correcao: mostrar botão compacto no mobile ou mover para dentro do menu com destaque

---

### PROBLEMAS IMPORTANTES (Deveria Corrigir)

**8. TransactionList: Badges de categoria + fonte sobrepostos em mobile**
- L228-275: badges "Alimentação" + "WhatsApp" + valor monetário em flex row ficam apertados. A badges wrapping para nova linha ajuda mas a linha fica muito alta
- Correcao: reorganizar layout para mobile com valor na mesma linha do título e badges embaixo

**9. WhatsAppPage: Textos hardcoded em português**
- L337-401: "Configure em 2 minutos", "Número do WhatsApp", "Formato internacional", "Verificar Código" — tudo sem i18n
- Correcao: usar chaves `t('whatsapp.*')` em todos os textos

**10. FilteredSummaryCards: Grid 4 colunas no mobile**
- L48: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` — ok, mas os cards ficam muito altos em sequencia vertical. Considerar `grid-cols-2` para mobile

**11. DashboardContent welcome header hardcoded em português**
- L220-226: "Olá! 🎉" e "Como estão suas finanças hoje?" sem i18n
- Correcao: usar `t('dashboard.greeting')` e `t('dashboard.greetingSubtitle')`

**12. PlansSection: Preço com `text-5xl` estoura em 320px**
- L101, L159: valores como "R$ 29,90" com text-5xl ficam muito grandes em telas pequenas
- Correcao: `text-3xl sm:text-5xl`

**13. GoalModal: Input numérico sem `inputMode="decimal"`**
- L70-76: falta `inputMode="decimal"` no Input de valor, então o teclado mobile não mostra numpad
- Correcao: adicionar `inputMode="decimal"` no Input

**14. TransactionForm: Input amount sem `inputMode="decimal"`**
- L162-170: mesmo problema do GoalModal
- Correcao: adicionar `inputMode="decimal"`

---

### PROBLEMAS BAIXOS (Pode Corrigir Depois)

**15. App.css**: arquivo com CSS genérico do Vite (logo spin, read-the-docs) que não é usado — pode remover

**16. WelcomeScreen: Textos hardcoded em português sem i18n**

**17. FeatureBlock images: Sem width/height definidos** — pode causar CLS (Cumulative Layout Shift)

---

### PLANO DE IMPLEMENTACAO

**Arquivos a modificar:**

1. `src/components/TransactionFilters.tsx` — Responsive TabsList (scroll ou Select no mobile)
2. `src/components/dashboard/DashboardContent.tsx` — Fix transaction header, i18n welcome
3. `src/components/ReportsPage.tsx` — Pie chart labels, YAxis format, responsive tweaks
4. `src/components/dashboard/MonthlyGoalsSection.tsx` — Touch-friendly action buttons
5. `src/components/dashboard/SummaryCards.tsx` — Responsive font sizes
6. `src/components/TransactionList.tsx` — Better mobile card layout
7. `src/components/TransactionForm.tsx` — inputMode="decimal"
8. `src/components/dashboard/GoalModal.tsx` — inputMode="decimal"
9. `src/components/PlansSection.tsx` — Responsive price sizes
10. `src/components/dashboard/WhatsAppPage.tsx` — i18n for hardcoded strings
11. `src/pages/Index.tsx` — Login button visibility on small mobile
12. `src/components/dashboard/FilteredSummaryCards.tsx` — 2-col grid on mobile
13. `src/App.css` — Remove unused Vite boilerplate

