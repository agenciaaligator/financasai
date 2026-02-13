

# Upgrade Completo -- Secao de Planos Premium

## Resumo

Redesenhar completamente o `PlansSection.tsx` com layout premium de 2 cards lado a lado (mensal + anual), visual SaaS internacional, cabecalho forte i18n, e precos exatos do Stripe. Atualizar tambem o `ChoosePlan.tsx` com o mesmo visual. Corrigir precos em `pricing.ts`.

---

## 1. Correcao critica de precos (`src/config/pricing.ts`)

Atualizar os valores de exibicao para corresponder ao Stripe:

| Moeda | Mensal | Anual |
|-------|--------|-------|
| BRL | R$ 24,90 | R$ 239,00 |
| USD | $8.90 | $79.00 |
| EUR | EUR 8.90 | EUR 79.00 |

Remover `getYearlyMonthlyEquivalent` (divisao anual/12) como funcao de preco principal. Manter apenas como helper de exibicao visual do "equivalente mensal" no card anual, claramente separado do preco real.

Remover `calculateYearlySavings` (calculo automatico de desconto). Se necessario, o desconto sera exibido como texto fixo via i18n.

Manter os mesmos priceIds ja configurados. Nenhum calculo altera o priceId enviado ao Stripe.

---

## 2. Novo layout visual (`src/components/PlansSection.tsx`)

### Estrutura: 2 cards lado a lado

```text
+---------------------------+    +---------------------------+
|     Premium Monthly       |    |  * Best Value             |
|                           |    |     Premium Annual        |
|      R$ 24,90/mes         |    |      R$ 239/ano           |
|                           |    |   equiv. R$ 19,92/mes     |
|  - Transacoes ilimitadas  |    |   Cobrado anualmente.     |
|  - Categorizacao IA       |    |                           |
|  - WhatsApp integrado     |    |  - Transacoes ilimitadas  |
|  - Insights financeiros   |    |  - Categorizacao IA       |
|  - Dashboard completo     |    |  - WhatsApp integrado     |
|  - Suporte prioritario    |    |  - Insights financeiros   |
|                           |    |  - Dashboard completo     |
|  [ Start Now ]            |    |  - Suporte prioritario    |
|                           |    |                           |
|  Cancel anytime           |    |  [ Start Now ]            |
|  No long-term commitment  |    |                           |
+---------------------------+    +---------------------------+
```

### Detalhes visuais

- Fundo da secao: gradiente escuro (azul profundo para roxo sutil) usando classes Tailwind `bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950`
- Cards com `bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl` (glassmorphism escuro)
- Card anual levemente maior (`scale-105`) com borda dourada/primaria e badge "Best Value" ou "Mais Popular"
- Preco principal em `text-5xl font-bold text-white`
- Subtexto do equivalente mensal no card anual em `text-sm text-white/60`
- Botoes com hover elegante: `hover:scale-105 transition-all duration-300`
- Features com icone Check verde
- Textos em branco/white para contraste com fundo escuro
- Responsivo: stack vertical em mobile, lado a lado em desktop (`grid md:grid-cols-2`)

### Cabecalho da secao (i18n)

Novo texto forte acima dos cards:

- pt-BR: "Sua vida financeira sob controle. Sem planilhas. Sem complicacao."
- en-US: "Your financial life under control. No spreadsheets. No complexity."
- es-ES: "Tu vida financiera bajo control. Sin hojas de calculo. Sin complicaciones."
- it-IT: "La tua vita finanziaria sotto controllo. Senza fogli di calcolo. Senza complicazioni."
- pt-PT: "A sua vida financeira sob controlo. Sem folhas de calculo. Sem complicacoes."

### Remocao do toggle mensal/anual

Os 2 cards sao exibidos simultaneamente, sem toggle. Cada card tem seu proprio botao de checkout.

---

## 3. Atualizar `src/pages/ChoosePlan.tsx`

Aplicar o mesmo visual premium: 2 cards lado a lado com fundo escuro, mesma logica de checkout por card.

---

## 4. Novas chaves i18n (todos os 5 locales)

```text
landing.plans.sectionTitle    -> "Sua vida financeira sob controle."
landing.plans.sectionSubtitle -> "Sem planilhas. Sem complicacao."
landing.plans.monthlyTitle    -> "Premium Mensal" / "Premium Monthly"
landing.plans.annualTitle     -> "Premium Anual" / "Premium Annual"
landing.plans.bestValue       -> "Melhor valor" / "Best Value"
landing.plans.perYear         -> "/ano" / "/year"
landing.plans.equivalentTo   -> "Equivalente a" / "Equivalent to"
landing.plans.chargedAnnually -> "Cobrado anualmente." / "Charged annually."
landing.plans.cancelAnytime   -> "Cancele quando quiser" / "Cancel anytime"
landing.plans.noCommitment    -> "Sem compromisso de longo prazo" / "No long-term commitment"
landing.plans.startNow        -> "Comecar agora" / "Start Now"
```

---

## 5. Arquivos modificados

| Arquivo | Acao |
|---------|------|
| `src/config/pricing.ts` | Corrigir precos USD/EUR, remover calculo de savings |
| `src/components/PlansSection.tsx` | Redesenho completo: 2 cards, fundo escuro, visual premium |
| `src/pages/ChoosePlan.tsx` | Mesmo redesenho premium |
| `src/locales/pt-BR.json` | Novas chaves de planos |
| `src/locales/en-US.json` | Novas chaves de planos |
| `src/locales/es-ES.json` | Novas chaves de planos |
| `src/locales/pt-PT.json` | Novas chaves de planos |
| `src/locales/it-IT.json` | Novas chaves de planos |

## O que NAO muda

- `create-checkout` (backend)
- `stripe-webhook`
- `check-subscription`
- Price IDs do Stripe
- Rotas
- Banco de dados

