

# Controlar Email de Confirmacao e Fluxo de Registro

## Problema Atual
O `supabase.auth.signUp()` dispara o email de confirmacao imediatamente, antes do usuario completar o checkout no Stripe. Isso causa confusao porque o usuario recebe um email "ative sua conta" enquanto ainda esta na tela de pagamento.

## Sobre o Erro do Cupom
O erro "Ocorreu um erro. Tente novamente." ao aplicar o cupom `ALIGATO26` e um problema no **Stripe Dashboard**, nao no codigo. Verifique:
- Se o promotion code `ALIGATO26` existe e esta ativo no Stripe Dashboard (Coupons > Promotion Codes)
- Se a moeda do cupom corresponde a moeda do preco (BRL)
- Se o cupom nao expirou

Nenhuma alteracao de codigo e necessaria para isso.

## Opcoes para o Email de Confirmacao

### Opcao A: Manter como esta (recomendado)
O email chega antes do pagamento, mas com as correcoes ja feitas no `AuthCallback.tsx`, se o usuario clicar no link antes de pagar, sera redirecionado para `/choose-plan`. Fluxo funcional, sem alteracoes adicionais.

### Opcao B: Desabilitar auto-confirm e enviar email apos pagamento
Isso requer:
1. Desabilitar "Confirm email" no Supabase Auth settings
2. Criar uma edge function que envia o email de confirmacao manualmente apos o webhook do Stripe confirmar o pagamento
3. Mudancas significativas na arquitetura de autenticacao

**Recomendacao**: Opcao A. O fluxo atual ja funciona corretamente com as correcoes implementadas. O email de confirmacao antes do pagamento e o comportamento padrao de praticamente todos os SaaS.

## Alteracao Proposta (nenhuma)
Nenhuma alteracao de codigo e necessaria. Os dois problemas reportados sao:
1. Cupom: resolver no Stripe Dashboard
2. Email antecipado: comportamento esperado, ja tratado pelas correcoes anteriores
