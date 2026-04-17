

## Diagnóstico

A captura mostra "ALEXANDRE" digitado mas quase invisível. Causa: **conflito de classes CSS** no `Register.tsx`.

O `Input` global (`src/components/ui/input.tsx`) já define:
- `bg-background/50` (fundo claro/escuro do tema)
- **sem cor de texto explícita** → herda `text-foreground` (que no tema escuro é claro, mas o fundo do Input também fica claro nesse contexto = texto branco em fundo branco)

No `Register.tsx`, cada campo passa:
```tsx
className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
```

Mas como o `Input` base já tem `bg-background/50` (que renderiza quase branco em cima do card translúcido) **e** o `focus-visible:bg-background` força fundo branco sólido no foco, o `text-white` adicionado fica **branco sobre branco** = invisível.

Mesmo problema afeta: Nome, E-mail, Senha (todos os campos do Register).

## As correções de segurança afetaram isso?

**Não.** As migrations recentes mexeram apenas em:
- `whatsapp_validation_codes` (DROP policy SELECT)
- `organization_invitations` (CREATE policy DELETE)
- `whatsapp_sessions` (DELETE da sessão órfã da MARINES)

Nenhum arquivo de UI, formulário, auth ou Input foi tocado. Esse bug de contraste **já existia** e só ficou visível agora porque você foi testar o cadastro.

## Plano de correção (1 arquivo)

Trocar a estratégia de cor nos 4 campos do `Register.tsx` para garantir contraste em qualquer estado (normal, foco, autofill do navegador):

**`src/pages/Register.tsx`** — nos 3 `<Input>` (nome, email, senha):
- Substituir `bg-white/10 border-white/20 text-white placeholder:text-white/40` por classes que **sobrescrevem** o background base do Input e travam a cor do texto:
  - `!bg-white/10` (force override do `bg-background/50`)
  - `!text-white` (força branco mesmo em foco)
  - `border-white/20`
  - `placeholder:text-white/40`
  - `focus-visible:!bg-white/15` (sobrescreve o `focus-visible:bg-background` que estava deixando fundo branco sólido)
  - `autofill:bg-white/10` + `[-webkit-text-fill-color:white]` (corrige o autofill amarelo do Chrome que também esconde o texto)

Resultado: texto branco legível sobre fundo translúcido escuro em **todos** os estados (normal, focado, preenchido pelo navegador).

## Posso testar com novo usuário depois disso?

**Sim, com tranquilidade.** Resumo de defesas em camadas (já validadas):

| Camada | Status |
|---|---|
| Cadastro → email confirmação | ✅ |
| `/boas-vindas` sem assinatura → `/escolher-plano` | ✅ |
| Dashboard sem assinatura → bloqueado | ✅ |
| WhatsApp claim code sem assinatura → recusa | ✅ |
| WhatsApp agent sem assinatura → bloqueia mensagem | ✅ |
| Sessão órfã (caso MARINES) → removida | ✅ |
| **Contraste de inputs no cadastro** | 🔴 **vai corrigir agora** |

Após o ajuste de CSS, o fluxo end-to-end está pronto para teste real.

