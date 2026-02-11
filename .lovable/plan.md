

# Corrigir erro no cadastro de transacoes via WhatsApp

## Diagnostico

A mensagem generica acontece porque o `whatsapp-webhook` recebe um erro HTTP do `whatsapp-agent` (linha 1084-1089) e envia o fallback. O agente esta falhando no deploy ou na execucao.

### Problema 1: Erro de compilacao no whatsapp-agent (CRITICO)

Linha 53 e linha 58 do `whatsapp-agent/index.ts` ambas declaram:
```text
const MAX_AUTH_ATTEMPTS_PER_HOUR = 3;
```
Isso causa um erro de compilacao Deno (`Duplicate identifier`), impedindo o deploy da funcao. Resultado: toda chamada ao agent retorna erro HTTP, e o webhook envia a mensagem generica.

### Problema 2: Falta de config.toml para as edge functions

O `supabase/config.toml` esta praticamente vazio -- nao tem configuracao de `verify_jwt = false` para as funcoes. Isso pode causar rejeicao JWT em certas situacoes.

### Problema 3: SUPABASE_SERVICE_ROLE_KEY pode estar desatualizada

Como o projeto foi migrado, a service role key configurada nos secrets pode ser do projeto antigo.

## Plano de correcao

### Passo 1: Corrigir duplicata no whatsapp-agent

Remover a linha 58 (`const MAX_AUTH_ATTEMPTS_PER_HOUR = 3;`) que e duplicada da linha 53.

### Passo 2: Adicionar log de diagnostico

No inicio do handler `serve()` do whatsapp-agent, adicionar log verificando se as variaveis de ambiente existem (sem logar valores):

```text
console.log("ENV check:", {
  SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  WHATSAPP_ACCESS_TOKEN: !!Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
});
```

### Passo 3: Melhorar error handling no catch principal

No catch final (linha 7187), logar mais detalhes do erro:

```text
console.error('Error in WhatsApp Agent:', {
  message: error.message,
  stack: error.stack,
  name: error.name
});
```

### Passo 4: Atualizar config.toml

Adicionar `verify_jwt = false` para `whatsapp-agent` e `whatsapp-webhook`:

```text
[functions.whatsapp-agent]
verify_jwt = false

[functions.whatsapp-webhook]
verify_jwt = false
```

### Passo 5: Verificar e redeployar

Apos as correcoes, redeployar ambas as funcoes e verificar os logs para confirmar se o SUPABASE_SERVICE_ROLE_KEY esta presente. Se nao estiver, sera necessario atualizar o secret com a chave do projeto atual.

## Arquivos modificados

| Arquivo | Acao |
|---------|------|
| supabase/functions/whatsapp-agent/index.ts | Remover const duplicada, melhorar logs |
| supabase/config.toml | Adicionar verify_jwt = false |

## Resultado esperado

O agente voltara a fazer deploy corretamente, e transacoes via WhatsApp serao salvas normalmente. Se o problema persistir apos o deploy, os novos logs indicarao exatamente o que esta falhando (ex: service role key invalida).

