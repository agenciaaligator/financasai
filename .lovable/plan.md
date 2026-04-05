

## Destaque no Preço Mensal Equivalente do Plano Anual

### O que muda

No card do plano Anual, inverter a hierarquia visual: o valor em destaque (grande) passa a ser o **equivalente mensal** (R$ 19,92/mês), e o valor cheio anual (R$ 239,00/ano) fica menor abaixo, como informação complementar.

### Mudança no arquivo

**`src/components/PlansSection.tsx`** — linhas 157-173 (bloco de preço do card anual):

Antes:
- Grande: `R$ 239,00 /ano`
- Pequeno: `Equivalente a R$ 19,92/mês`

Depois:
- Grande: `R$ 19,92 /mês`
- Pequeno: `Cobrado R$ 239,00/ano`

Código resultante:
```tsx
<div className="mb-2">
  <div className="flex items-baseline gap-2">
    <span className="font-display text-3xl sm:text-5xl font-bold text-white">
      {formatPrice(getYearlyMonthlyEquivalent(locale), currency)}
    </span>
    <span className="text-white/50">{t('landing.plans.perMonth')}</span>
  </div>
</div>
<div className="mb-6">
  <p className="text-sm text-white/50">
    {t('landing.plans.chargedAnnually')}: {formatPrice(getDisplayPrice('yearly', locale), currency)}{t('landing.plans.perYear')}
  </p>
</div>
```

Mesma lógica aplicada ao **`src/components/UpgradeModal.tsx`** (linhas 100-115) para manter consistência no modal de upgrade.

### Arquivos afetados (2)
1. `src/components/PlansSection.tsx` — inverter hierarquia de preço no card anual
2. `src/components/UpgradeModal.tsx` — mesma inversão no modal de upgrade

