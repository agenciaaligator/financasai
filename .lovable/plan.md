

## Correções no Dashboard: Formulário persistente, logo distorcido e textos encavalados

### Problemas identificados

1. **Formulário persiste ao trocar de aba**: Em `FinancialDashboard.tsx`, o `showForm` não é resetado ao mudar de tab. O formulário renderiza acima do `DashboardContent` independentemente da aba ativa (linhas 205-212 desktop, 132-139 mobile).

2. **Logo distorcido no sidebar**: A imagem usa apenas `h-8 brightness-0 invert` sem `object-contain`, podendo distorcer.

3. **Textos encavalados no menu**: Cada item do sidebar mostra título + descrição dentro de um container `h-10`, que é insuficiente para duas linhas de texto, causando sobreposição.

### Correções

**Arquivo: `src/components/FinancialDashboard.tsx`**
- No `handleTabChange` e no `setCurrentTab` do desktop, adicionar `setShowForm(false)` para fechar o formulário ao trocar de aba
- Alternativamente, fechar o form no `useEffect` que já observa `currentTab` (linha 47-49):
  ```ts
  useEffect(() => {
    setShowForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);
  ```

**Arquivo: `src/components/AppSidebar.tsx`**
- Logo: adicionar `object-contain` à tag `<img>` do logo (linhas 60, 107)
- Menu items desktop: aumentar altura de `h-10` para `h-auto min-h-[2.5rem] py-2` nos `SidebarMenuButton` (linhas 137, 121) para acomodar título + descrição sem encavalar
- Menu items mobile: mesma correção nos botões mobile (linha 81), já usam `h-12` mas convém usar `h-auto min-h-[3rem] py-2`

