

# Corrigir Fluxo de Recuperacao de Senha - Race Condition

## Problema Raiz

O problema e uma **race condition** entre o Supabase client e o componente `ResetPassword.tsx`:

1. Usuario clica no link do email e chega em `/reset-password#access_token=...`
2. O Supabase client (com `detectSessionInUrl: true`) detecta os tokens do hash, processa-os e **limpa o hash da URL**
3. O `useEffect` do `ResetPassword.tsx` executa a funcao `init()`:
   - Chama `getSession()` (async/await) - durante esse await, o evento `PASSWORD_RECOVERY` pode ja ter sido disparado
   - Tenta ler `window.location.hash` - mas o hash ja foi consumido e limpo pelo Supabase client
   - So DEPOIS disso registra o listener `onAuthStateChange` - mas o evento ja passou
4. Nenhuma das 3 estrategias funciona, o timeout de 8s dispara e redireciona para `/`

Em resumo: o listener e registrado **tarde demais**, e o hash ja foi **consumido** pelo Supabase client.

## Solucao

Reordenar a logica do `useEffect` no `ResetPassword.tsx`:

1. **Capturar o hash ANTES de qualquer operacao async** (salvar em variavel local antes que o Supabase client o limpe)
2. **Registrar o `onAuthStateChange` PRIMEIRO** (sincronamente, antes de qualquer await)
3. **Depois** verificar `getSession()` como fallback
4. **Depois** tentar parsear o hash salvo como ultimo recurso

### Codigo revisado (ResetPassword.tsx useEffect):

```text
useEffect:
  1. Capturar window.location.hash em variavel local (SINCRONO)
  2. Registrar onAuthStateChange listener (SINCRONO)
     - Se evento PASSWORD_RECOVERY ou SIGNED_IN com sessao -> resolve()
  3. Verificar getSession() (ASYNC)
     - Se sessao existe -> resolve()
  4. Se hash foi capturado, tentar setSession manual (ASYNC)
     - Se sucesso -> resolve()
  5. Timeout 10s -> reject()
```

Essa ordem garante que:
- O listener esta ativo ANTES de qualquer processamento async
- O hash e capturado ANTES do Supabase client limpa-lo
- Nao importa a ordem dos eventos, pelo menos uma das estrategias vai funcionar

## Alteracao tecnica

### Arquivo: `src/pages/ResetPassword.tsx`

Substituir o `useEffect` (linhas 29-104) pela nova logica reordenada.

A mudanca principal e:
- Mover `onAuthStateChange` para ser a PRIMEIRA coisa executada
- Salvar `window.location.hash` em variavel local imediatamente
- Mover `getSession()` para DEPOIS do listener
- Aumentar timeout para 10s para dar mais margem

## Arquivo alterado

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/ResetPassword.tsx` | Reordenar useEffect: listener primeiro, getSession depois, hash capturado sincrono |

## Resultado esperado

1. Usuario clica no link de recuperacao no email
2. Chega em `/reset-password` com tokens
3. Listener captura o evento OU getSession encontra a sessao OU hash manual funciona
4. Formulario de nova senha aparece corretamente
5. Usuario define nova senha e e redirecionado

