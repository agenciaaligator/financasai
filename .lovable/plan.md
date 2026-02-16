

# Corrigir Sessao WhatsApp Nao Criada + Rebranding Residual

## Problema Raiz

O codigo de validacao e salvo na tabela `whatsapp_validation_codes` **sem o campo `user_id`** (sempre NULL). Quando o `validate-code` verifica o codigo, ele encontra o registro, mas como `codeValidation.user_id` e NULL, o bloco que cria a sessao WhatsApp **nunca e executado**:

```text
if (codeValidation.user_id) {  // <-- sempre false, pois user_id e NULL
  // criar sessao... NUNCA EXECUTA
}
```

Resultado: o toast mostra "WhatsApp conectado!" mas nenhuma sessao e criada no banco. O `checkAuthenticationStatus()` retorna false e o status continua "Desconectado".

Alem disso, o menu de ajuda ainda diz "Assistente Financeiro" em vez de "Dona Wilma", e a edge function `whatsapp-agent` precisa ser re-deployada para que as mensagens corretas aparecam em producao.

## Solucao

### 1. Salvar `user_id` no codigo de validacao (whatsapp-agent/index.ts)

No bloco `send-validation-code` (linha ~6808), adicionar `user_id` ao insert:

```typescript
.insert({
  phone_number: cleanPhone,
  code,
  expires_at: expiresAt.toISOString(),
  used: false,
  user_id: body.userId || null  // <-- ADICIONAR
})
```

Isso garante que quando `validate-code` buscar o registro, `codeValidation.user_id` tera o valor correto e a sessao sera criada.

### 2. Trocar "Assistente Financeiro" por "Dona Wilma" (whatsapp-agent/index.ts)

Linha ~2630: Atualizar o `getHelpMenu()`:

```typescript
return `🤖 *Dona Wilma - WhatsApp*\n\n` +
```

### 3. Re-deployar a edge function whatsapp-agent

Deploy obrigatorio para que todas as correcoes (branding + criacao de sessao) entrem em vigor.

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| supabase/functions/whatsapp-agent/index.ts | Adicionar `user_id` ao insert do codigo + renomear "Assistente Financeiro" |

## Resultado Esperado

1. Usuario solicita codigo no perfil -> codigo salvo COM `user_id`
2. Usuario valida codigo -> sessao WhatsApp criada automaticamente
3. Status muda para "Conectado" imediatamente
4. Mensagens do WhatsApp mostram "Dona Wilma" em todos os pontos
