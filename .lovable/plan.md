
# Correcao: Navegacao "Criar conta" + i18n para Termos e Privacidade

## Problema 1: 404 ao clicar "Criar conta"

O `LoginForm.tsx` usa `navigate('/plans')` nas linhas 134 e 169, mas a rota correta no `App.tsx` e `/choose-plan`. Isso causa o erro 404 mostrado no screenshot.

### Correcao

- Linha 134: `navigate('/plans')` -> `navigate('/choose-plan')`
- Linha 169: `navigate('/plans')` -> `navigate('/choose-plan')`

## Problema 2: Termos e Privacidade sem traducao

As paginas `Terms.tsx` e `Privacy.tsx` tem todo o conteudo hardcoded em portugues. Precisam ser internacionalizadas com `t()`.

### Correcao

1. Adicionar chaves `legal.terms.*` e `legal.privacy.*` nos 5 arquivos de locale (pt-BR, pt-PT, en-US, es-ES, it-IT)
2. Atualizar `Terms.tsx` e `Privacy.tsx` para usar `useTranslation()` e `t()` em todos os textos
3. O botao "Voltar" tambem sera traduzido

### Chaves a adicionar (exemplo da estrutura)

```
legal.terms.title
legal.terms.lastUpdated
legal.terms.sections.acceptance.title / .content
legal.terms.sections.description.title / .content
... (9 secoes para termos)

legal.privacy.title
legal.privacy.lastUpdated
legal.privacy.sections.dataCollected.title / .content
... (9 secoes para privacidade)

legal.backButton
```

## Arquivos modificados

| Arquivo | Acao |
|---------|------|
| `src/components/auth/LoginForm.tsx` | Corrigir `/plans` para `/choose-plan` (2 ocorrencias) |
| `src/pages/Terms.tsx` | Usar `t()` para todos os textos |
| `src/pages/Privacy.tsx` | Usar `t()` para todos os textos |
| `src/locales/pt-BR.json` | Adicionar chaves `legal.*` |
| `src/locales/pt-PT.json` | Adicionar chaves `legal.*` |
| `src/locales/en-US.json` | Adicionar chaves `legal.*` |
| `src/locales/es-ES.json` | Adicionar chaves `legal.*` |
| `src/locales/it-IT.json` | Adicionar chaves `legal.*` |

## O que NAO muda

- Rotas no App.tsx (ja estao corretas)
- Logica de autenticacao
- Estilo visual das paginas
- Desktop language selector
