
# Corrigir Envio de Codigo de Validacao WhatsApp

## Problema Diagnosticado

Existem dois fluxos diferentes e inconsistentes para conectar o WhatsApp:

1. **Welcome.tsx (onboarding)**: usa `action: 'send-validation-code'` que envia o codigo via mensagem do WhatsApp e depois valida com `action: 'validate-code'` -- funciona parcialmente mas tem bug no formato do numero.
2. **ProfileSettings.tsx (perfil)**: usa `action: 'auth'` que gera o codigo e **retorna na resposta JSON** sem enviar pelo WhatsApp. O frontend nem sequer mostra esse codigo ao usuario, entao ele nunca recebe nada.

Alem disso, o bloco `send-validation-code` envia o numero COM o prefixo `+` para a API do WhatsApp, que exige o numero SEM o `+`. A funcao `sendWhatsAppMessage` (usada em outros pontos) ja faz essa limpeza, mas o bloco de `send-validation-code` chama a API diretamente sem remover o `+`.

A mensagem do codigo tambem diz "Aligator" em vez de "Dona Wilma".

## Solucao

Unificar ambos os fluxos para usar `send-validation-code` + `validate-code`, e corrigir o bug do formato do numero.

### 1. Corrigir `send-validation-code` no whatsapp-agent (index.ts)

- **Linha 6784**: Remover o `+` antes de enviar para a API do WhatsApp:
  ```
  to: cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone
  ```
- **Linha 6787**: Trocar "Aligator" por "Dona Wilma":
  ```
  body: `Codigo de Verificacao Dona Wilma\n\nSeu codigo: *${code}*\n\nValido por 30 minutos.\n\nNao compartilhe este codigo.`
  ```

### 2. Atualizar ProfileSettings.tsx (handleRequestCode)

Trocar `action: 'auth'` por `action: 'send-validation-code'` e usar `supabase.functions.invoke` em vez de fetch direto:

```typescript
const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
  body: {
    action: 'send-validation-code',
    phone_number: phoneNumber,
    userId: user?.id,
  },
});
```

### 3. Atualizar ProfileSettings.tsx (handleVerifyCode)

Trocar o envio de mensagem `codigo XXXXXX` por `action: 'validate-code'`:

```typescript
const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
  body: {
    action: 'validate-code',
    phone_number: phoneNumber,
    code: authCode,
    userId: user?.id,
  },
});
```

Apos validacao bem-sucedida, criar/atualizar a sessao do WhatsApp (como ja faz o Welcome.tsx).

### 4. Corrigir o send-validation-code.ts (arquivo separado)

Mesma correcao do `+` no numero e da marca "Aligator" para "Dona Wilma". Este arquivo parece nao ser usado (o codigo duplicado esta no index.ts), mas por consistencia sera atualizado.

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| supabase/functions/whatsapp-agent/index.ts | Remover `+` do numero na API, trocar "Aligator" por "Dona Wilma" |
| supabase/functions/whatsapp-agent/send-validation-code.ts | Mesmas correcoes acima |
| src/components/ProfileSettings.tsx | Usar `send-validation-code` + `validate-code` em vez de `auth` |

## Resultado Esperado

- Usuario solicita codigo no Perfil ou Onboarding
- Codigo de 6 digitos chega via mensagem no WhatsApp (formatado como "Dona Wilma")
- Usuario digita o codigo na interface
- Sessao do WhatsApp e criada com sucesso
