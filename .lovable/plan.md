

## Plano — Onboarding com Validação Reversa de WhatsApp (custo zero)

### Conceito

Substituir o fluxo atual ("sistema envia código → usuário digita") por:
**"sistema gera código curto → usuário envia esse código pelo WhatsApp dele para o número da Dona Wilma → webhook valida automaticamente"**.

Vantagens:
- ✅ Custo zero por validação (mensagem inbound não cobra nada na Meta)
- ✅ 100% de entrega (é o usuário que envia, não a Meta que entrega)
- ✅ Abre janela de 24h automaticamente — todas as mensagens do agente depois funcionam
- ✅ Confirma que o número realmente tem WhatsApp ativo (impossível fraudar)
- ✅ Fim do problema "código não chegou"

### Novo fluxo `/boas-vindas`

```text
1. Usuário chega em /boas-vindas após confirmar email + assinatura
2. Sistema gera código curto de 6 caracteres alfanuméricos (ex: "DW-A7K2")
   - prefixo "DW-" deixa óbvio que é da Dona Wilma
   - salva em whatsapp_validation_codes (claim_code, user_id, expires_at: 30min)
3. Tela mostra:
   ┌─────────────────────────────────────────┐
   │ Conecte seu WhatsApp                    │
   │                                         │
   │ Envie esta mensagem do SEU WhatsApp     │
   │ para o nosso número:                    │
   │                                         │
   │   ┌───────────────────────┐            │
   │   │   DW-A7K2             │  [Copiar]  │
   │   └───────────────────────┘            │
   │                                         │
   │ Para: +55 11 9XXXX-XXXX  [Abrir WhatsApp]│
   │                                         │
   │ ⏳ Aguardando sua mensagem...          │
   └─────────────────────────────────────────┘
4. Botão "Abrir WhatsApp" abre wa.me/<numero>?text=DW-A7K2
   (mensagem já preenchida — usuário só clica em enviar)
5. UI faz polling a cada 3s em whatsapp_validation_codes
   buscando used=true para esse user_id
6. Webhook (whatsapp-webhook) detecta código no texto recebido:
   - extrai phone do remetente
   - busca código pendente válido → marca used=true + grava phone_number
   - cria whatsapp_sessions(user_id, phone_number) → permanente (10y)
   - responde no WhatsApp: "✅ Conectado! Já pode começar. Mande 'oi' para testar."
7. UI detecta validação → redireciona para /dashboard
```

### Mudanças no código

#### 1. Banco — adicionar coluna `claim_code`
Migração:
- `ALTER TABLE whatsapp_validation_codes ADD COLUMN claim_code TEXT UNIQUE`
- índice em `claim_code` para lookup rápido no webhook
- manter `code` antigo para compatibilidade

#### 2. Edge function nova — `whatsapp-claim-code` (substitui `send-validation-code`)
- recebe `user_id`
- gera código `DW-XXXX` (4 chars alfanuméricos sem ambíguos: sem 0/O/I/1)
- salva em DB com expiração 30min
- **não envia nada via WhatsApp**
- retorna `{ claim_code, dona_wilma_number }`

#### 3. `whatsapp-webhook/index.ts` — interceptar claim codes ANTES da lógica de agente
- regex `^DW-[A-Z0-9]{4}$` no texto recebido (case-insensitive, trim)
- se bater: chamar handler de claim → marcar used, criar sessão, responder confirmação, retornar 200
- só prossegue para o agente normal se não for claim code

#### 4. `src/pages/Welcome.tsx` — nova UI
- remove campos "telefone" e "código"
- mostra: claim code grande + botão copiar + botão "Abrir WhatsApp" (deep link `wa.me/`)
- polling a cada 3s via `useQuery` com `refetchInterval` em `whatsapp_sessions` (RLS já permite o user ler a própria sessão)
- quando sessão aparecer → toast "Conectado!" → `navigate('/')`
- timer de 30min com botão "Gerar novo código" se expirar
- estados: `waiting` (default), `connected` (sucesso), `expired` (timeout)

#### 5. Locales — atualizar chaves do bloco `welcome`
- adicionar: `claimCodeTitle`, `claimCodeInstruction`, `copyCode`, `copied`, `openWhatsApp`, `waitingMessage`, `expiredCode`, `generateNewCode`, `successConnected`
- remover/depreciar: `phoneLabel`, `phoneHint`, `sendCode`, `codeLabel`, `codePlaceholder`, `verify` (não são mais usados)
- 5 idiomas

#### 6. Variável de configuração
- secret novo `DONA_WILMA_PUBLIC_NUMBER` (ex: `5511999999999`) — número exibido na UI e usado no `wa.me/` link
- **Ação manual sua:** confirmar qual é o número público da Dona Wilma para eu colocar no secret

#### 7. Bug paralelo — trigger `handle_new_user_simple`
- já está correto (lê `raw_user_meta_data->>'phone_number'`), mas o `SignUpForm.tsx` provavelmente está enviando como `phone` em vez de `phone_number`
- conferir e padronizar para `phone_number`

### Edge cases tratados

| Cenário | Comportamento |
|---------|---------------|
| Usuário envia código errado | Webhook ignora, agente normal processa como mensagem comum (provavelmente cai em "não cadastrado") |
| Código expirado | Polling detecta `expires_at < now`, UI mostra "Gerar novo código" |
| Mesmo número já validado p/ outro user | Webhook responde "Este WhatsApp já está conectado a outra conta" e não cria sessão |
| Usuário fecha aba e volta | `Welcome.tsx` busca último código pendente do user antes de gerar novo |
| Mensagem chega com texto extra (ex: "DW-A7K2 oi") | Regex permite código no início OU como mensagem inteira após trim |

### Arquivos afetados

- **Migração SQL** (1) — adicionar `claim_code` em `whatsapp_validation_codes`
- **Edge function nova** (1) — `supabase/functions/whatsapp-claim-code/index.ts`
- **Edge function editada** (1) — `supabase/functions/whatsapp-webhook/index.ts` (handler de claim)
- **Edge function depreciada** — `whatsapp-agent/send-validation-code.ts` mantém para fallback mas não é mais chamada
- **Frontend** (1) — `src/pages/Welcome.tsx` reescrita
- **Locales** (5) — chaves novas em pt-BR, pt-PT, en-US, es-ES, it-IT
- **Secret novo** (1) — `DONA_WILMA_PUBLIC_NUMBER`

### Antes de eu implementar — preciso confirmar

1. **Qual é o número público do WhatsApp Business da Dona Wilma?** (formato: `5511999999999`, sem `+`, sem espaços) — vai aparecer na tela e no link `wa.me/`
2. **OK manter o fluxo antigo (envio do código pela Meta) como fallback escondido?** Se sim, deixo um botão "Receber código por mensagem (alternativo)" pequeno embaixo. Se não, removo de vez. Recomendo **remover** — simplifica e elimina o caso da MARINES de vez.

