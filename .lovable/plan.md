

## Padronizar Footer das Páginas Legais

O footer da home tem 5 links (Home, Como funciona, Planos, Termos, Privacidade), enquanto o das páginas legais tem apenas 3 (Home, Termos, Privacidade).

### Correção

Substituir a lista de links do footer em `Terms.tsx` e `Privacy.tsx` para incluir os 5 links, usando `navigate()` para navegar às seções da landing:

```
Home           → navigate("/#home")
Como funciona  → navigate("/#como-funciona")
Planos         → navigate("/#planos")
Termos         → navigate("/termos")
Privacidade    → navigate("/privacidade")
```

**Arquivos:** `src/pages/Terms.tsx` (linhas 188-192), `src/pages/Privacy.tsx` (linhas 188-192)

