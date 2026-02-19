
## Corrigir botao "Voltar" invisivel na pagina /choose-plan

### Problema
Na pagina `/choose-plan`, o botao "Voltar" no canto superior direito usa `variant="outline"` do shadcn, que aplica `bg-background` (fundo branco) e cor de texto padrao. Isso faz com que o texto fique branco sobre fundo branco, tornando-o invisivel no header escuro.

A classe `text-white` passada via className e sobrescrita pelo `bg-background` do variant outline que traz o fundo branco.

### Solucao
Alterar o botao na linha 33 de `src/pages/ChoosePlan.tsx` para usar `variant="ghost"` em vez de `variant="outline"`, mantendo as classes customizadas para o visual correto sobre fundo escuro.

### Alteracao

**Arquivo:** `src/pages/ChoosePlan.tsx` (linha 33)

De:
```tsx
<Button variant="outline" onClick={() => navigate('/')} className="border-white/20 text-white hover:bg-white/10">
```

Para:
```tsx
<Button variant="ghost" onClick={() => navigate('/')} className="border border-white/20 text-white hover:bg-white/10 hover:text-white">
```

Isso remove o `bg-background` (branco) que vinha do variant outline e usa `ghost` que nao tem fundo, preservando o texto branco visivel sobre o header escuro.
