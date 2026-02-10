
# UX/UI Dashboard Improvements + i18n Preparation

## Overview

This plan covers two major areas: (1) visual/UX improvements to the dashboard, and (2) full i18n integration across the frontend. No backend, database, or business logic changes.

## PHASE 1: UX/UI Dashboard Improvements

### 1.1 Toggle "Ver apenas minhas transacoes" (improved)

**Files:** `src/components/dashboard/DashboardContent.tsx`

Current state: a plain Switch + Label, easy to miss. 

Changes:
- Wrap the Switch in a small styled container with background (`bg-muted/50 rounded-lg px-3 py-2`)
- Add a subtle helper text below: "Filtra transacoes para mostrar somente as suas"
- Make ON state visually distinct (green accent border or background shift)
- Apply same style in both dashboard tab (line 371-382) and transactions tab (line 479-489)

### 1.2 Card "Meu Plano" (improved)

**File:** `src/components/dashboard/SummaryCards.tsx`

Changes:
- Add a status badge (green dot + "Ativo") next to plan name
- Replace raw plan name with clearer layout: plan name on top, access type below (e.g., "Acesso completo" or "Acesso limitado")
- Change "Upgrade" button text to "Gerenciar assinatura" for premium users, calling the `customer-portal` edge function
- Keep "Upgrade" for free/trial users (existing behavior)
- Remove Progress bars for premium users (they have unlimited)

### 1.3 Financial Chart improvements

**File:** `src/components/FinancialChart.tsx`

Changes:
- Increase chart height from 200px to 280px for both charts
- Improve tooltip: add white background with shadow, better formatted currency
- Improve legend font size and spacing
- Use softer colors with better contrast: income `#059669` (darker green), expense `#dc2626` (darker red)
- Add `radius` to bar chart bars for rounded corners
- Increase padding between pie chart and bar chart (spacing)

### 1.4 Transaction List visual hierarchy

**File:** `src/components/TransactionList.tsx`

Changes:
- Make the amount (`font-bold`) larger: `text-base sm:text-lg` instead of `text-sm sm:text-base`
- Add +/- prefix more prominently
- Make category/source badges lighter: use `variant="outline"` with lower opacity for source badge
- Reduce user badge prominence (smaller, more subtle)
- Add subtle left border color based on transaction type: green for income, red for expense (replace current `border-l-primary/20`)

### 1.5 Remove debug diagnostic card

**File:** `src/components/dashboard/DashboardContent.tsx`

The transactions tab shows a diagnostic card with "Permissao ver outros", "Minhas", "Da org" counts (lines 448-471). This is developer-only info. Remove it.

## PHASE 2: i18n Integration

### 2.1 Expand translation files

**Files:** All 4 locale files + create `src/locales/pt-PT.json`

The current locale files have partial coverage. Expand them with keys for:
- Sidebar menu items (dashboard, transactions, lancamentos, contas_fixas, categories, reports, news, profile, admin)
- Summary cards (monthBalance, income, expenses, myPlan, active, manageSubscription, upgrade)
- Transaction list (noTransactions, showingRange, manual, whatsapp, filterActive)
- Filters (period, type, source, category, search, clearFilters, all, today, week, month)
- Chart labels (incomeVsExpenses, byCategory)
- Dashboard header titles
- Common actions and error messages
- Landing page texts (hero, features, FAQ, plans, CTA)

Remove the entire `agenda` section from all locale files (feature removed from MVP).

Create `pt-PT.json` by copying `pt-BR.json` and adjusting vocabulary (e.g., "Lancamentos" stays, but some expressions may differ).

### 2.2 Apply `useTranslation` to dashboard components

**Files affected:**
- `src/components/AppSidebar.tsx` - sidebar items titles and descriptions
- `src/components/dashboard/SummaryCards.tsx` - card titles, labels
- `src/components/dashboard/DashboardContent.tsx` - tab titles, buttons, labels
- `src/components/FinancialChart.tsx` - chart labels, tooltips
- `src/components/TransactionList.tsx` - empty states, badges, pagination text
- `src/components/TransactionFilters.tsx` - filter labels
- `src/components/dashboard/AddTransactionButton.tsx` - button text
- `src/components/FinancialDashboard.tsx` - header tab titles (mobile + desktop)

Pattern: import `useTranslation`, call `const { t } = useTranslation()`, replace hardcoded strings with `t('key')`.

### 2.3 Add language selector to ProfileSettings

**File:** `src/components/ProfileSettings.tsx`

Add the existing `LanguageSelector` component (already built at `src/components/LanguageSelector.tsx`) to the profile settings page, in a new "Idioma / Language" section near the top.

### 2.4 Add pt-PT to LanguageSelector and i18n config

**Files:** `src/i18n.ts`, `src/components/LanguageSelector.tsx`

- Import and register `pt-PT` in i18n config
- Add Portuguese (Portugal) option to the language selector dropdown

## Files Summary

| File | Action |
|------|--------|
| `src/components/dashboard/DashboardContent.tsx` | Improve toggle UX, remove debug card |
| `src/components/dashboard/SummaryCards.tsx` | Improve "Meu Plano" card, add i18n |
| `src/components/FinancialChart.tsx` | Better spacing, colors, tooltips, add i18n |
| `src/components/TransactionList.tsx` | Visual hierarchy improvements, add i18n |
| `src/components/TransactionFilters.tsx` | Add i18n |
| `src/components/AppSidebar.tsx` | Add i18n to menu items |
| `src/components/FinancialDashboard.tsx` | Add i18n to header titles |
| `src/components/dashboard/AddTransactionButton.tsx` | Add i18n |
| `src/components/ProfileSettings.tsx` | Add LanguageSelector |
| `src/locales/pt-BR.json` | Expand keys, remove agenda section |
| `src/locales/en-US.json` | Expand keys, remove agenda section |
| `src/locales/es-ES.json` | Expand keys, remove agenda section |
| `src/locales/it-IT.json` | Expand keys, remove agenda section |
| `src/locales/pt-PT.json` | Create (new file) |
| `src/i18n.ts` | Add pt-PT |
| `src/components/LanguageSelector.tsx` | Add pt-PT option |

## What will NOT change

- No backend/edge function changes
- No database changes
- No Stripe logic changes
- No new features
- No component rewrites (incremental edits only)
- No WhatsApp agent changes (WhatsApp i18n is out of scope for this phase -- requires edge function changes)

## Execution order

1. Phase 1: UX improvements (toggle, plan card, chart, transaction list, remove debug card)
2. Phase 2: Expand locale files + create pt-PT
3. Phase 2: Apply `useTranslation` across components
4. Phase 2: Add LanguageSelector to ProfileSettings
