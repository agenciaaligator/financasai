## Objetivo

Fechar os 3 avisos (warn) restantes do scanner do Supabase, sem quebrar nada em produção.

Os avisos são:
1. `SUPA_function_search_path_mutable` — função(ões) sem `search_path` fixo.
2. `SUPA_anon_security_definer_function_executable` — função `SECURITY DEFINER` executável por `anon`.
3. `SUPA_authenticated_security_definer_function_executable` — função `SECURITY DEFINER` executável por `authenticated`.

## Como eu vou fazer (você só aprova)

Você não precisa mexer em nada no dashboard do Supabase desta vez. Todo o ajuste é via migração SQL, que eu preparo e você aprova no botão padrão.

### Passo 1 — Descobrir exatamente quais funções o scanner está apontando
Rodar o `security--get_scan_results` pra ler os 3 findings e ver o nome da função em cada um (o scanner entrega o nome no payload).

### Passo 2 — Para cada função apontada, decidir caso a caso
Regra de bolso:
- **Se a função é helper interno** (só chamada por outras funções `SECURITY DEFINER` ou por triggers, nunca pelo cliente): `REVOKE EXECUTE ... FROM anon, authenticated` + garantir `SET search_path = 'public'`.
- **Se a função é chamada legitimamente pelo frontend** (ex: RPC `get_usage_status`, `accept_organization_invite`, `check_email_available`, `check_phone_available`): mantém a permissão pro role certo (`authenticated` ou `anon` conforme o uso real), só garante o `search_path` fixo e proteção `auth.uid()` interna quando fizer sentido. Nesses casos o finding específico de "executable por authenticated" será marcado como `ignore` com justificativa (é uso legítimo).
- **Se a função é claramente pública** (ex: `check_email_available` chamada na tela de cadastro antes do login): mantém `anon`, só fixa `search_path`, e o finding vira `ignore` justificado.

### Passo 3 — Rodar 1 migração consolidada
Uma única migração faz:
- `ALTER FUNCTION public.<fn>() SET search_path = 'public'` para toda função que ainda estiver mutável.
- `REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM anon, authenticated` nas funções internas identificadas.
- Regrant explícito só onde o frontend realmente chama.

### Passo 4 — Rerodar o scanner e fechar
- `security--run_security_scan` pra confirmar que os warnings sumiram.
- `manage_security_finding` com `mark_as_fixed` nos que foram corrigidos e `ignore` (com justificativa clara) nos que forem uso legítimo público.
- Atualizar a `security-memory` pra futuras varreduras não reabrirem os casos legítimos.

## O que muda no app do ponto de vista do usuário final

Nada. É hardening puro de banco. Nenhuma tela, texto, cobrança, fluxo de WhatsApp, agenda, Stripe ou onboarding é tocado. Se por acaso alguma RPC pública for revogada por engano, o efeito seria "botão X deixa de funcionar" — por isso o Passo 2 é caso a caso antes de revogar qualquer coisa.

## Custo

Zero. Tudo nativo Supabase, sem terceiros.

Me aprova o plano que eu já sigo pro Passo 1 (leitura dos findings) e volto com a migração pronta pra você aprovar.