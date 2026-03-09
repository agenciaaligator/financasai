

## Remover scrollbar do sidebar

### Problema
O `SidebarContent` no `sidebar.tsx` usa `overflow-auto` (linha 405), o que gera uma scrollbar visível quando o conteúdo é ligeiramente maior que o container.

### Solução
Duas mudanças simples:

1. **`src/components/ui/sidebar.tsx` (L405)**: Trocar `overflow-auto` por `overflow-y-auto` e adicionar classes para esconder a scrollbar visualmente mantendo funcionalidade de scroll:
   - Adicionar `scrollbar-hide` ou usar as classes CSS nativas: `[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`

2. **`src/components/AppSidebar.tsx`**: Reduzir a altura dos items (`h-12` → `h-10`) e o padding (`py-4` → `py-3`) para que os itens caibam sem precisar de scroll, eliminando o problema na raiz.

A combinação das duas abordagens garante que mesmo se houver scroll (ex: tela muito pequena), a barra não aparece visualmente.

