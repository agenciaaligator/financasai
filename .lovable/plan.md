

# Mensagem de Boas-Vindas Automatica apos Validacao do WhatsApp

## O que muda

Apos o usuario validar o codigo com sucesso e a sessao ser criada, o sistema enviara automaticamente uma mensagem de boas-vindas pelo WhatsApp com:
- Confirmacao de que a conta foi conectada
- Instrucoes basicas de uso
- Convite para enviar "ajuda" para ver todos os comandos

## Alteracao tecnica

### Arquivo: `supabase/functions/whatsapp-agent/index.ts`

No bloco `validate-code`, logo apos a sessao ser criada com sucesso (linha ~6933), adicionar o envio automatico de uma mensagem de boas-vindas usando a funcao `sendWhatsAppMessage` que ja existe no codigo:

```typescript
// Apos: console.log('[VALIDATE-CODE] WhatsApp session created successfully');

// Enviar mensagem de boas-vindas
const welcomePhone = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;
await sendWhatsAppMessage(welcomePhone,
  `Ola! Sou a *Dona Wilma*, sua assistente financeira pelo WhatsApp.\n\n` +
  `Sua conta foi conectada com sucesso!\n\n` +
  `*Como usar:*\n` +
  `- Envie "gasto 50 mercado" para registrar uma despesa\n` +
  `- Envie "receita 1000 salario" para registrar uma receita\n` +
  `- Envie uma foto de nota fiscal para registro automatico\n` +
  `- Envie "saldo" para ver seu saldo atual\n\n` +
  `Digite *ajuda* para ver todos os comandos disponiveis.`
);
```

O envio sera feito dentro de um try/catch para nao bloquear a resposta de validacao caso a mensagem falhe.

### Deploy

Re-deploy da edge function `whatsapp-agent` para aplicar a mudanca.

## Resultado esperado

1. Usuario valida o codigo no perfil
2. Status muda para "Conectado" na interface
3. Usuario recebe imediatamente uma mensagem no WhatsApp com boas-vindas e instrucoes
4. Usuario ja sabe exatamente o que fazer a seguir
