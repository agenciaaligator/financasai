

## Correções: Menu Mobile Landing + Logo no Login

### Problemas Identificados

**1. Links do menu mobile na landing page não navegam para as seções**
O menu hamburger usa `<a href="#como-funciona" onClick={() => setSheetOpen(false)}>`. O componente Sheet (Radix) bloqueia o scroll do body enquanto está aberto. Quando o link é clicado, o browser tenta fazer scroll para o hash, mas o scroll está bloqueado. Ao fechar o Sheet, o scroll é desbloqueado, mas a navegação por hash já foi consumida — resultado: nada acontece.

**Correção**: Usar `scrollToSection(id)` com um pequeno delay após fechar o Sheet, em vez de depender do `href` nativo.

**2. Ícone Eye (👁) na tela de login em vez do logo**
O `LoginForm.tsx` (L71-74) mostra um ícone `Eye` dentro de um círculo gradiente. Deveria mostrar o logo do Dona Wilma.

---

### Arquivos a modificar

**`src/pages/Index.tsx`** (L97-101): Trocar os `<a href="#hash">` por botões que chamam `scrollToSection()` após fechar o Sheet:
```tsx
<button onClick={() => { setSheetOpen(false); setTimeout(() => scrollToSection('como-funciona'), 300); }}>
```

**`src/components/auth/LoginForm.tsx`** (L71-74): Substituir o ícone Eye pelo logo:
```tsx
<img src="/images/logo.png" alt="Dona Wilma" className="h-10" />
```
Em vez de:
```tsx
<div className="p-3 bg-gradient-primary rounded-full">
  <Eye className="h-8 w-8 text-white" />
</div>
```

