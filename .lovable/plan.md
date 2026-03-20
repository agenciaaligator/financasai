

## Fix: WhatsApp Agent Ignoring Social Messages (obrigado, valeu, etc.)

### Root Cause

Line 2406 in `whatsapp-agent/index.ts`:
```typescript
if (nlpResult && nlpResult.confidence > 0.7) {
```

The NLP returns `{"intent": "other", "confidence": 0.5}` for "muito obrigado". Since 0.5 < 0.7, the entire NLP block is skipped — including the `case 'other'` handler at line 2466-2486 that has the gratitude regex. The message then falls through to the transaction parser (fails), and hits the generic "Não entendi" fallback.

### Fix

Add a social message detection check **before** the NLP confidence gate, right after the greeting detection block (around line 2392). This handles common social phrases (obrigado, valeu, legal, etc.) without depending on NLP confidence:

```typescript
// PRIORIDADE 2.5: Detectar mensagens sociais simples (antes do NLP)
const gratitudeMatch = /obrigad[oa]?|valeu|thanks|muito bom|legal|show|massa|top/i.test(normalizedText);
if (gratitudeMatch) {
  return {
    response: '😊 Por nada! Estou aqui sempre que precisar. É só me chamar! 💙',
    sessionData: { ...sessionData, conversation_state: 'idle' }
  };
}
```

### File Changed
- `supabase/functions/whatsapp-agent/index.ts` — add social message detection before NLP block (~line 2393)

This is a 5-line fix. The existing NLP `case 'other'` block remains as a secondary fallback for less common phrases.

