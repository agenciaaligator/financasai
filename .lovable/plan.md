

## Confirmação que preciso de você

**Apenas 1 coisa**: você autoriza eu desligar "Confirm email" no Supabase Dashboard (Auth → Providers → Email)? Isso é manual, você precisa clicar — eu não tenho acesso ao toggle.

## Consequências de desligar email confirmation

| Item | Antes (com confirmação) | Depois (sem confirmação) |
|---|---|---|
| Email é validado | Sim, antes do acesso | Não, mas Stripe valida identidade via cartão |
| Risco de email falso | Baixo | Baixíssimo (cartão real exigido) |
| UX | 4 fricções (cadastro, email, checkout, welcome) | 3 fricções (cadastro, checkout, welcome) |
| Conta órfã sem pagar | Acontecia (Marines) | Impossível: sem cartão, sem acesso |
| Recuperação de senha | Funciona | Funciona igual (usa email cadastrado) |
| Caso "não recebi email" | Suporte recorrente | Eliminado |

**Por que é a melhor opção**: o Stripe já é uma camada de validação muito mais forte que email — exige cartão real, nome, CVV, endereço. Validar email **antes** do pagamento é redundante e cria fricção sem ganho real. Empresas como Linear, Vercel, Cal.com, Notion fazem exatamente isso: cadastro → uso imediato (ou pagamento → uso). Email só vira obrigatório se a pessoa quiser recuperar senha.

## Revisão do onboarding atual vs benchmark SaaS mundial

### Fluxo atual (mapeado)

```
Landing
  → "Começar agora" (sem plano) → /register
  → Plano selecionado → /register?plan=X
/register → signUp() → email enviado
  → se plan: Stripe checkout → /payment-success → /boas-vindas
  → se !plan: tela "confira seu email" → /choose-plan → ...
/boas-vindas → conectar WhatsApp → OTP → dashboard
```

### Problemas identificados (8)

1. **Dois caminhos no /register** (com/sem plano) — gera código duplicado e bugs como o da Marines
2. **Email enviado antes do pagamento** — confunde, gera 2x signup, invalida tokens
3. **Sem indicador de progresso visual** — usuário não sabe em que etapa está (1 de 3? 2 de 3?)
4. **Sem resumo do plano no checkout interno** — usuário esquece o que está comprando
5. **Sem prova social no /register** — momento crítico de abandono
6. **Sem "o que acontece depois"** — usuário não sabe que vai conectar WhatsApp
7. **Tela "confira seu email" sem botão reenviar** — se perder o email, fica travado
8. **/boas-vindas não tem skip nem progresso** — pressão psicológica desnecessária

### Benchmark: como Stripe Atlas, Linear, Cal.com, Vercel fazem

- **Cadastro de 1 etapa só** (nome + email + senha, sem confirmação prévia)
- **Stepper visual** no topo (●—●—○ "Conta · Pagamento · WhatsApp")
- **Resumo persistente do plano** sempre visível durante o flow
- **Auto-login após signup** (sem email confirmation barrier)
- **Email transacional de boas-vindas** disparado depois do pagamento (não antes)
- **"Próxima etapa" explícita** em cada tela ("Falta 1 minuto pra terminar")
- **Resgate de abandono**: se sair no meio, email "Termine seu cadastro" 24h depois (Lovable Email nativo)

## Plano de redesign do onboarding (ordenado por impacto)

### Fase 1 — Eliminar a fonte do problema (você aprova → eu aplico)

1. **Você desliga "Confirm email"** no Supabase Dashboard
2. **Refatorar `Register.tsx`**: remover toda lógica de `emailSent`, `identities.length === 0`, fluxo dual com/sem plano
3. **Forçar fluxo único**: landing → `/choose-plan` (obrigatório) → `/register?plan=X` → Stripe → `/payment-success` → `/boas-vindas` → WhatsApp → dashboard
4. **Remover botões de "Cadastre-se" sem plano** da landing/login (ou redirecionar para `/choose-plan`)

### Fase 2 — Adicionar clareza visual

5. **Stepper de 3 etapas** no topo de `/register`, `/payment-success`, `/boas-vindas`:
   ```
   ●——————●——————○
   Conta   Pagamento  WhatsApp
   ```
6. **Card de resumo do plano** fixo no topo de `/register?plan=X` ("Você está assinando: Plano Anual · R$ XX,XX")
7. **Bloco "o que acontece em seguida"** no `/register`: 3 ícones explicando (1) pagamento seguro Stripe (2) email de boas-vindas (3) conectar WhatsApp em 1 minuto

### Fase 3 — Reduzir ansiedade

8. **Selo de segurança** no `/register` ("🔒 Pagamento processado pela Stripe · Cancele quando quiser")
9. **Microcopy reassurance** no botão final ("Continuar para pagamento seguro" em vez de "Criar conta")
10. **Email transacional de boas-vindas** disparado pelo `stripe-webhook` após pagamento confirmado (Lovable Email nativo, custo zero) — substitui o email de confirmação do Supabase como ponto de contato

### Fase 4 — Robustez (se quiser depois)

11. Email de "termine seu cadastro" 24h após abandono no checkout
12. Página `/escolher-plano` aceita usuário não-autenticado com CTA claro

## Resposta direta sobre "tanta insegurança"

A insegurança que você sentiu **não é de complexidade técnica** — é de:

1. Decisões de UX legadas que se acumularam sem revisão holística (email confirmation + 2 fluxos no register + sem stepper)
2. Falta de teste real com usuário ansioso (a Marines expôs isso)
3. Eu corrigi pontualmente cada bug em vez de redesenhar o fluxo

Esse plano resolve as 3 causas raiz de uma vez. Após Fase 1+2 implementadas, o onboarding fica no nível dos melhores SaaS do mercado para o seu segmento. Fase 3 é o polimento que diferencia.

## Tempo estimado

- Fase 1: 1 mensagem (10 min de implementação)
- Fase 2: 1 mensagem (15 min)
- Fase 3: 1 mensagem (10 min)
- **Total**: 3 turnos para chegar a um onboarding de nível Linear/Cal.com

Aprove a Fase 1 (e me confirme que pode desligar email confirmation no Supabase) que eu sigo direto. Fases 2 e 3 podem vir em sequência ou separadas, como preferir.

