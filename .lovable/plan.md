

## Bug: Áudio "Sim" não é reconhecido na confirmação de OCR

### Causa Raiz

Dois problemas combinados:

1. **Webhook não limpa transcrições de áudio**: O webhook limpa pontuação apenas para mensagens de texto (linhas 678-692). Transcrições de áudio (Whisper/ElevenLabs) chegam ao agente com pontuação intacta — ex: "Sim." ou "Sim, por favor."

2. **Confirmação OCR usa match exato**: `handleOCRConfirmation` (linha 2936) faz `affirmative.includes(messageText.toLowerCase().trim())`, que requer correspondência exata. "sim." ou "sim, por favor" não estão na lista `['sim', 's', 'yes', 'y', 'confirmo', 'ok', 'salvar']`.

### Solução

Duas correções:

**1. Webhook (`whatsapp-webhook/index.ts`)**: Aplicar a mesma limpeza de pontuação nas transcrições de áudio (após linha 661), para que o texto chegue limpo ao agente:

```typescript
text = await transcribeAudio(message.audio.id, message.from);
// Limpar transcrição da mesma forma que texto
text = text
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();
forceText = true;
```

**2. Agent (`whatsapp-agent/index.ts`)**: Tornar a confirmação OCR mais flexível — usar `startsWith` ou regex em vez de `includes` exato, para cobrir variações como "sim por favor", "sim confirmo":

```typescript
const normalizedMsg = messageText.toLowerCase().trim();
const isAffirmative = /^(sim|s|yes|y|confirmo|ok|salvar)\b/.test(normalizedMsg);
const isNegative = /^(n[aã]o|n|no|cancelar)\b/.test(normalizedMsg);
```

### Arquivos Afetados (2)
1. `supabase/functions/whatsapp-webhook/index.ts` — limpar transcrição de áudio
2. `supabase/functions/whatsapp-agent/index.ts` — regex flexível no `handleOCRConfirmation`

