

## Diagnóstico do "looping na tela"

Olhando a captura: você está em `/register` **sem `?plan=monthly` ou `?plan=yearly` na URL** (entrou pelo botão direto, não pela seleção de plano). Veja o fluxo no `Register.tsx`:

```
linha 25: const plan = searchParams.get("plan");  // null se não veio da seção de planos
...
linha 120: if (plan) {
  // redireciona pro Stripe
} else {
  linha 157: navigate("/choose-plan");  // sem plano → manda escolher
}
```

**Não é looping** — é o comportamento correto: quando você se cadastra **sem ter escolhido um plano antes**, o sistema cria a conta e te leva pra `/choose-plan`. Mas como o Supabase está com **email confirmation ativo**, a sessão não fica logada imediatamente, então o `/choose-plan` (ou um guard nele) pode estar te jogando de volta pra `/` ou pra outra tela, dando sensação de loop.

Causas possíveis (uma das três):

1. **Email confirmation ativa no Supabase**: `signUp()` retorna sucesso mas **sem sessão** (precisa confirmar email). O `navigate("/choose-plan")` acontece, mas se a página `/choose-plan` exigir auth, redireciona pra `/` ou pra login → você vê a tela de cadastro de novo se clicar em "Começar".
2. **Email já existia** (você testou várias vezes com o mesmo): cai no `identities.length === 0` (linha 97) → toast de "email já existe" + fica na tela. Sem o toast aparecer claramente, parece travado.
3. **Toast de erro genérico apareceu rápido e sumiu** (`common.genericError`).

## Plano de correção (3 mudanças focadas)

### 1. `src/pages/Register.tsx` — feedback claro + fluxo correto pós-signup

- **Adicionar logs detalhados** em cada etapa para diagnóstico futuro.
- Quando **não há sessão ativa após signUp** (email confirmation), redirecionar para uma **tela intermediária explicando "confirme seu email"** em vez de `/choose-plan` (que pode rejeitar usuário sem auth).
- Quando **`plan` é nulo**, ainda assim guardar o destino na URL: `/choose-plan?from=register&email=...` para o `ChoosePlan` saber o contexto.

### 2. `src/pages/ChoosePlan.tsx` — verificar guard

Confirmar se a página exige auth. Se exigir e o usuário acabou de se cadastrar mas **ainda não confirmou email**, ela precisa:
- Aceitar usuário não autenticado (mostra planos públicos), OU
- Mostrar tela "confirme seu email primeiro" com link reenviar.

### 3. Botão "Começar" da landing page → garantir `?plan=` na URL

Se o botão principal da landing leva pra `/register` **sem plano**, o usuário sempre cai no caminho `else` e é mandado pra `/choose-plan`. O fluxo recomendado é: **landing → escolher plano → cadastro com plano na URL → Stripe**. Vou verificar o botão e ajustar se necessário.

## Antes de implementar — preciso confirmar com você

Tenho duas perguntas críticas para escolher o caminho certo:

**Pergunta 1**: Você entrou em `/register` clicando em qual botão? (a) "Começar agora" da landing, (b) link "Cadastre-se" do login, (c) URL direta?

**Pergunta 2**: Apareceu algum **toast/notificação** durante a tentativa? (verde ou vermelho, mesmo que rápido)

A resposta muda o que precisa ser corrigido — se foi pelo (a) "Começar agora" sem plano, o problema é que esse botão deveria levar pra `/choose-plan` antes do cadastro, não direto pra `/register`. Se foi com toast vermelho, é email duplicado ou erro de Supabase que vou caçar nos logs do edge function.

Posso também investigar agora `ChoosePlan.tsx` e o botão da landing pra te dar uma resposta definitiva sem precisar dessas perguntas — quer que eu investigue ou prefere responder?

