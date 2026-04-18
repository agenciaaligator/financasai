

## O que significam os 2 alertas de segurança

São **avisos (warnings)**, não erros críticos. O sistema não está vulnerável, mas o scanner sugere endurecer dois pontos. Vou explicar cada um em linguagem direta e dizer o que recomendo fazer.

---

### Alerta 1 — "Stripe price IDs exposed to anonymous users"

**O que é:** A tabela `subscription_plans` está marcada como pública (qualquer visitante do site, mesmo sem login, pode lê-la). Isso é **proposital** — a landing page precisa mostrar os preços antes do cadastro. O problema apontado é que, junto com `nome`, `preço` e `descrição`, a tabela também expõe os campos `stripe_price_id_monthly` e `stripe_price_id_yearly`.

**Risco real:** Baixíssimo. Price IDs do Stripe (`price_1T0RbZJH...`) **não são segredos** — eles aparecem na URL do Checkout do Stripe quando o usuário clica em "Assinar". Não dão acesso a nada, não permitem fraude, não revelam dados do seu negócio. São apenas identificadores internos.

**Por que o scanner reclama:** Boa prática genérica diz "não exponha identificadores internos sem necessidade". Mas no nosso caso a página de planos é pública por design.

**Recomendação:** **Ignorar este alerta.** A exposição é intencional e inofensiva. Posso marcá-lo como "ignored" no scanner com justificativa registrada.

---

### Alerta 2 — "WhatsApp validation codes accessible only to service role with no user-facing policy"

**O que é:** A tabela `whatsapp_validation_codes` (que guarda os códigos `DW-XXXX` por ~10 minutos) tem **apenas uma política de RLS** que permite acesso ao `service_role` (as edge functions). Não há política para usuários autenticados normais.

**Risco real:** **Zero.** Isso é exatamente o comportamento desejado:
- Códigos OTP nunca devem ser legíveis pelo frontend
- Apenas as edge functions (`whatsapp-claim-code`, `whatsapp-webhook`) precisam ler/escrever
- Quando uma tabela tem RLS habilitado e não há política para `authenticated`, o Postgres **nega por padrão** — que é o que queremos

**Por que o scanner reclama:** É um aviso defensivo: "confirme que isso é intencional". Não é um bug.

**Recomendação:** **Ignorar este alerta.** O design está correto — códigos OTP devem ser opacos ao cliente.

---

## Plano de execução

Marcar os dois findings como **"ignored"** no scanner de segurança, com justificativa registrada para cada um, para que parem de aparecer na lista. Nenhuma alteração de código ou banco é necessária.

| Finding | Ação | Justificativa registrada |
|---|---|---|
| `subscription_plans_stripe_price_ids_public` | Ignore | Price IDs do Stripe não são segredos; visíveis na URL do Checkout. Tabela é pública por design (landing page de planos). |
| `whatsapp_validation_codes_no_user_policy` | Ignore | Comportamento intencional: códigos OTP só devem ser acessíveis ao service_role das edge functions. RLS sem política de authenticated nega por padrão, que é o objetivo. |

Após aprovar, o scanner removerá esses dois itens da lista ativa (eles ficarão na aba "Ignored", auditáveis depois).

