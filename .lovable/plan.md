# Zerar transações da conta admin

## Conta alvo
- Email: `contato@aligator.com.br`
- user_id: `2efec051-aa64-4f31-8c1b-c22ac51d7d7b`
- Transações atuais: **14** (1 receita + 13 despesas)

## Escopo
Apenas a tabela `transactions`. Nada de recorrentes, compromissos, metas, categorias, perfil, assinatura ou WhatsApp — tudo isso permanece intacto.

## Ação
Executar via ferramenta de insert do Supabase:

```sql
DELETE FROM public.transactions
WHERE user_id = '2efec051-aa64-4f31-8c1b-c22ac51d7d7b';
```

Filtro estrito por `user_id` garante que nenhum outro usuário/organização seja afetado.

## Verificação pós-execução
`SELECT COUNT(*) FROM transactions WHERE user_id = '2efec051-...';` deve retornar `0`.

## Observação
Operação **irreversível** — não há soft delete nem lixeira. Confirme antes de aprovar.
