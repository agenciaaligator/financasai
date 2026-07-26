## Diagnóstico

O erro na tela é do próprio Supabase: **"Configuring leaked password protection via HaveIBeenPwned.org is available on Pro Plans and up."**

Ou seja, o toggle **"Prevent use of leaked passwords"** só pode ser ativado se o seu projeto Supabase estiver no **plano Pro** (ou superior). No plano Free ele fica bloqueado — não tem como habilitar por código, migração, ou qualquer ajuste no nosso app. É uma trava comercial do Supabase.

Isso não é um bug do sistema Dona Wilma, e não afeta nenhuma funcionalidade do app. É apenas o último finding de segurança daquela rodada que não conseguimos fechar sem upgrade do Supabase.

## Opções

Você tem duas saídas — escolha qual prefere:

### Opção A — Fazer upgrade do projeto Supabase para Pro
- Custo: ~US$ 25/mês direto com o Supabase (cobrado por eles, fora do Lovable).
- Depois do upgrade, o toggle destrava e você consegue ativar em 1 clique.
- Além do leaked password protection, o Pro libera backups diários, mais recursos de compute, etc.
- Recomendado se você planeja escalar o app com muitos usuários pagantes.

### Opção B — Ignorar o finding com justificativa
- Zero custo.
- Marcamos o finding `SUPA_auth_leaked_password_protection` como **ignored** com a explicação "Requires Supabase Pro plan; project is on Free tier. Will revisit after upgrade."
- O scanner para de alertar sobre isso.
- Mitigação prática: seu fluxo de cadastro já exige senha via Supabase Auth (com regras de comprimento mínimo), e o cadastro é sempre precedido de pagamento Stripe — o que já filtra bots.
- Podemos revisitar assim que o projeto crescer e o upgrade Pro fizer sentido.

## O que eu recomendo

Dada sua diretriz de **controle rígido de custos e priorizar soluções nativas gratuitas**, minha recomendação é a **Opção B (ignorar com justificativa)**. Não vale pagar US$25/mês só por esse item enquanto o app ainda está estabilizando. Podemos reabrir quando você estiver com receita recorrente saudável.

## Plano de execução (se você escolher Opção B)

1. Chamar `security--manage_security_finding` com operação `ignore` no finding `SUPA_auth_leaked_password_protection`, com a explicação sobre o plano Free.
2. Atualizar a memória de segurança (`security--update_memory`) registrando que esse finding fica dispensado até um eventual upgrade Pro, para que futuras varreduras não reabram o alerta.
3. Nenhuma mudança em código, banco ou edge functions.

Me confirme qual opção você quer seguir (A ou B) que eu executo.
