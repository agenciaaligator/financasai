

# Correcao do Seletor de Idioma no Mobile

## Problema

O `LanguageFlagSelector` usa um componente `Popover` (portal) para exibir a lista de idiomas. Quando esse Popover esta dentro de um `Sheet` (menu hamburger mobile), ocorrem conflitos de z-index e portais: o clique no idioma nao funciona corretamente, o menu nao fecha, e o idioma nao muda.

Isso afeta tanto a landing page (`Index.tsx`) quanto o dashboard mobile (`FinancialDashboard.tsx`).

## Solucao

Duas alteracoes minimas:

### 1. `LanguageFlagSelector` - Adicionar modo inline para mobile

Adicionar uma prop opcional `inline?: boolean`. Quando `true`, renderizar os idiomas diretamente como botoes visiveis (sem Popover), evitando qualquer conflito de portal/z-index dentro do Sheet.

Tambem adicionar uma prop `onSelect?: () => void` que sera chamada apos mudar o idioma, permitindo que o componente pai feche o menu mobile.

O modo desktop (Popover) permanece inalterado.

### 2. `Index.tsx` - Landing page mobile

- Tornar o Sheet mobile controlado com `useState` (atualmente e uncontrolled)
- Passar `inline` e `onSelect={() => setSheetOpen(false)}` ao `LanguageFlagSelector` dentro do Sheet mobile
- Nenhuma alteracao no desktop

### 3. Dashboard mobile (sem alteracao necessaria)

No dashboard mobile, o `LanguageFlagSelector` fica no header (fora do Sheet), entao o Popover funciona normalmente. Nao precisa de alteracao.

## Arquivos modificados

| Arquivo | Acao |
|---------|------|
| `src/components/LanguageFlagSelector.tsx` | Adicionar props `inline` e `onSelect`, renderizar modo inline quando `inline=true` |
| `src/pages/Index.tsx` | Sheet controlado, passar props de mobile ao seletor |

## O que NAO muda

- Desktop permanece identico (Popover normal)
- Dashboard mobile (seletor ja esta fora do Sheet)
- Logica de i18n (`i18n.changeLanguage`, `localStorage`)
- Nenhum componente recriado
