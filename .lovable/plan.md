
# Internacionalizar 100% da Landing Page

## Resumo

Existem 6 componentes com textos hardcoded que precisam ser migrados para o sistema i18n. Todos os 5 arquivos de idioma (pt-BR, pt-PT, en-US, es-ES, it-IT) serao atualizados com as novas chaves.

## Componentes a alterar

### 1. InteractionExamplesSection.tsx
Textos hardcoded: titulo, subtitulo, 12 exemplos de interacao, texto final.
- Adicionar `useTranslation()` e usar chaves `landing.interaction.*`

### 2. StatsSection.tsx
Textos hardcoded: titulo, subtitulo, 4 cards (titulo + descricao cada).
- Usar chaves `landing.stats.*`

### 3. TestimonialsSection.tsx
Textos hardcoded: 3 steps (titulo + descricao cada).
- Usar chaves `landing.steps.*`

### 4. FAQSection.tsx
Textos hardcoded: 4 perguntas + 4 respostas.
- Usar chaves `landing.faq.items.*`

### 5. PlansSection.tsx
Textos hardcoded: "Mensal", "Anual", "Mais popular", "Premium", "Plano completo...", lista de features (6 itens), "/mes", "Cobrado anualmente:", botao "Ir para pagamento", "Redirecionando...", texto do cupom, toast messages.
- Usar chaves `landing.plans.*`
- NAO alterar logica do Stripe, precos ou priceIds

### 6. Index.tsx (footer)
Texto hardcoded: "Desenvolvido por"
- Usar chave `landing.footer.developedBy`

## Novas chaves nos arquivos de idioma

Cada arquivo de locale recebera as seguintes novas chaves dentro de `landing`:

```text
landing.interaction.title
landing.interaction.subtitle
landing.interaction.footer
landing.interaction.examples (array de 12 exemplos)

landing.stats.title
landing.stats.subtitle
landing.stats.items[0-3].title
landing.stats.items[0-3].description

landing.steps.items[0-2].title
landing.steps.items[0-2].description

landing.faq.items[0-3].question
landing.faq.items[0-3].answer

landing.plans.monthly
landing.plans.yearly
landing.plans.mostPopular
landing.plans.premiumTitle
landing.plans.premiumDesc
landing.plans.perMonth
landing.plans.billedAnnually
landing.plans.goToPayment
landing.plans.redirecting
landing.plans.couponHint
landing.plans.features[0-5]
landing.plans.redirectingToast
landing.plans.redirectingToastDesc
landing.plans.errorTitle
landing.plans.errorDesc

landing.footer.developedBy
```

## Arquivos modificados

| Arquivo | Acao |
|---------|------|
| src/components/InteractionExamplesSection.tsx | Substituir hardcoded por t() |
| src/components/StatsSection.tsx | Substituir hardcoded por t() |
| src/components/TestimonialsSection.tsx | Substituir hardcoded por t() |
| src/components/FAQSection.tsx | Substituir hardcoded por t() |
| src/components/PlansSection.tsx | Substituir hardcoded por t() |
| src/pages/Index.tsx | Substituir "Desenvolvido por" por t() |
| src/locales/pt-BR.json | Adicionar novas chaves |
| src/locales/pt-PT.json | Adicionar novas chaves |
| src/locales/en-US.json | Adicionar novas chaves |
| src/locales/es-ES.json | Adicionar novas chaves |
| src/locales/it-IT.json | Adicionar novas chaves |

## O que NAO muda

- Logica do Stripe (precos, priceIds, checkout)
- Estrutura dos componentes
- Estilos visuais
- Componentes que ja usam t() (hero, nav, feature blocks)
