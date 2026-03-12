

## Correções: Scroll-to-top + Footer consistente nas páginas legais

### Problema 1: Página abre no meio/embaixo
Quando se navega via React Router para `/termos` ou `/privacidade`, o scroll position da página anterior é mantido. Falta um `window.scrollTo(0, 0)` no mount do componente.

**Correção**: Adicionar ao `useEffect` existente em ambos os arquivos (`Terms.tsx` e `Privacy.tsx`):
```tsx
window.scrollTo(0, 0);
```

### Problema 2: Footer diferente da home
O footer das páginas legais é simplificado (2 colunas inline), enquanto o footer da home tem 3 colunas (logo+tagline, links com Home/Como funciona/Planos/Termos/Privacidade, contato com email) e mais espaçamento.

**Correção**: Substituir o footer de ambas as páginas pelo mesmo layout de 3 colunas da landing page, com grid `md:grid-cols-3`, incluindo os mesmos links e seção de contato.

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Terms.tsx` | Adicionar `scrollTo(0,0)` no useEffect; substituir footer pelo layout da home |
| `src/pages/Privacy.tsx` | Mesmo |

