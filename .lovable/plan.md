

# Plano: Exclusao de Usuario + Limpeza UX de Contas Fixas + Edge Function delete-user-admin

## 1. Criar edge function `delete-user-admin`

O botao de exclusao no Admin Panel chama `supabase.functions.invoke('delete-user-admin')`, mas essa funcao **nao existe** no codigo. Precisa ser criada para que voce consiga excluir o usuario `alexandre@aligator.com.br` (e futuros usuarios de teste).

**Arquivo novo**: `supabase/functions/delete-user-admin/index.ts`

A funcao deve:
- Verificar que o chamador e admin/master
- Receber `user_id` no body
- Deletar na ordem correta (respeitando foreign keys):
  1. `whatsapp_sessions` (by user_id)
  2. `whatsapp_validation_codes` (by user_id)
  3. `whatsapp_auth_codes` (by user_id)
  4. `recurring_instances` (via recurring_transactions do user)
  5. `recurring_transactions` (by user_id)
  6. `reminder_settings` (by user_id)
  7. `work_hours` (by user_id)
  8. `whatsapp_settings` (by user_id)
  9. `transactions` (by user_id)
  10. `categories` (by user_id)
  11. `organization_members` (by user_id)
  12. `organization_invitations` (by invited_by)
  13. `organizations` (by owner_id)
  14. `user_subscriptions` (by user_id)
  15. `user_roles` (by user_id)
  16. `profiles` (by user_id)
  17. `auth.users` via `supabase.auth.admin.deleteUser()`
- Retornar `{ success: true }`

---

## 2. Remover coluna "Contexto" (Pessoal/Empresa) das Contas Fixas

O produto e single-user. A distincao "Pessoal vs Empresa" nao faz sentido e confunde. Todas as transacoes ja estao vinculadas a organizacao do usuario automaticamente.

### RecurringTransactionsManager.tsx
- Remover coluna "Contexto" da tabela (linhas 151, 191-203)
- Remover imports `Building2`, `Home`

### RecurringTransactionForm.tsx
- Remover o seletor "Pessoal / Empresa" (botoes nas linhas 111-130)
- Remover estado `context` e logica `organization_id` baseada em context
- Remover imports `Building2`, `Home`
- O `organization_id` sera preenchido automaticamente pelo hook (ja faz isso)

---

## 3. Internacionalizar Contas Fixas

Todos os textos do `RecurringTransactionsManager.tsx`, `RecurringTransactionForm.tsx` e `RecurringInstancesList.tsx` estao hardcoded em portugues.

### Adicionar `useTranslation` nos 3 componentes

Chaves a criar nos 5 locales (`recurring.*`):

**RecurringTransactionsManager**: "Contas Fixas", "Gerencie suas receitas e despesas recorrentes", "Nova Conta Fixa", "Contas Cadastradas", "Nenhuma conta fixa cadastrada", "Criar Primeira Conta", colunas da tabela, labels de frequencia, badges de status, dialog de exclusao

**RecurringTransactionForm**: "Editar Conta Fixa", "Nova Conta Fixa", labels dos campos (Titulo, Tipo, Valor, Categoria, Frequencia, Dia do Mes, Dia da Semana, Intervalo, Data Inicio, Data Fim, Observacoes), opcoes de frequencia, dias da semana, botoes

**RecurringInstancesList**: "Proximos Vencimentos", "Nenhum vencimento pendente", colunas, badges de status, botoes "Dar Baixa" e "Adiar", dialog de adiamento

---

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/delete-user-admin/index.ts` | **NOVO** - Edge function para exclusao completa de usuario |
| `src/components/RecurringTransactionsManager.tsx` | Remover coluna Contexto, adicionar i18n |
| `src/components/RecurringTransactionForm.tsx` | Remover seletor Pessoal/Empresa, adicionar i18n |
| `src/components/RecurringInstancesList.tsx` | Adicionar i18n |
| `src/locales/pt-BR.json` | Chaves `recurring.*` |
| `src/locales/en-US.json` | Chaves `recurring.*` |
| `src/locales/es-ES.json` | Chaves `recurring.*` |
| `src/locales/pt-PT.json` | Chaves `recurring.*` |
| `src/locales/it-IT.json` | Chaves `recurring.*` |

## O que NAO sera alterado
- Nenhuma tabela no Supabase (o campo `organization_id` continua existindo, apenas nao e mais exibido ao usuario)
- Nenhuma nova dependencia
- O hook `useRecurringTransactions` continua funcionando igual (ja preenche `organization_id` automaticamente)

