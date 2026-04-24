
## Adicionar campo Telefone (opcional) ao formulário de contato

A versão anterior já está implementada e funcionando. Esta iteração adiciona apenas o campo **telefone opcional** (para aumentar conversão e dar canal alternativo de resposta), conforme a nova especificação. Resto do sistema permanece intacto.

---

### 1. Banco de dados (migration)

Adicionar coluna em `contact_messages`:

```text
phone  text  null
```

Sem índice (campo opcional, baixo volume de busca).

Atualizar trigger `validate_contact_message` para:
- Trim do `phone` quando presente.
- Se preenchido, validar formato básico: 8–20 caracteres, apenas dígitos, espaços, `+`, `-`, `(`, `)`.
- Permitir `NULL` / vazio (vira `NULL`).

---

### 2. Edge Function `submit-contact-message`

Atualizar `BodySchema` (Zod):
- Adicionar `phone: z.string().trim().max(20).optional().or(z.literal(""))`.
- Normalizar string vazia para `null` antes do insert.
- Incluir `phone` no `.insert()`.

---

### 3. Componente `ContactForm.tsx`

- Adicionar campo `phone` ao state e ao schema Zod do cliente (mesmas regras: opcional, máx 20, regex permissivo).
- Novo `<Input type="tel" inputMode="tel">` posicionado entre Email e Assunto, com label "Telefone (opcional)".
- Mobile-first: campo full-width, mesmo estilo dos demais.
- Enviar `phone` no payload (`undefined` se vazio).

---

### 4. Admin — `MessagesManagement.tsx`

- Listar `phone` na linha da mensagem quando presente (badge discreto ou linha secundária abaixo do email).
- No `Dialog` de detalhe: exibir telefone como link `tel:` clicável quando houver, abaixo do email.
- Atualizar select da query para incluir `phone` (ou `select('*')` se já é o caso).

---

### 5. i18n — novas chaves nos 5 locales

Adicionar em `pt-BR`, `pt-PT`, `en-US`, `es-ES`, `it-IT`:

```text
landing.contactSection.fields.phone.label      // "Telefone (opcional)" / "Phone (optional)" / etc.
landing.contactSection.fields.phone.placeholder
admin.messages.fields.phone                     // label "Telefone" no detalhe
validation.contact.phoneInvalid                 // "Formato de telefone inválido"
```

---

### 6. Restrições mantidas

- Não toca: checkout, onboarding, Stripe, login, WhatsApp core, dashboard financeiro.
- Honeypot, cooldown 30s, rate limit por IP (3/10min) e anti-duplicata SQL continuam ativos.
- RLS continua: insert público, select/update/delete só admin/master.
- Sem dependência de email externo.

---

### Arquivos

**Migration**
- Nova migration: `ALTER TABLE contact_messages ADD COLUMN phone text` + `CREATE OR REPLACE FUNCTION validate_contact_message` (atualizada com validação de phone).

**Editar**
- `supabase/functions/submit-contact-message/index.ts` — schema + insert.
- `src/components/ContactForm.tsx` — campo + validação + payload.
- `src/components/admin/MessagesManagement.tsx` — exibição na lista e no detalhe.
- `src/locales/{pt-BR,pt-PT,en-US,es-ES,it-IT}.json` — novas chaves.

### Critérios de sucesso

- Telefone opcional aceito e salvo (ou `null` se vazio).
- Validação client + server consistente.
- Telefone visível no admin com link `tel:` clicável.
- Sem regressão no formulário, anti-spam ou inbox.
- Funciona nos 5 idiomas e em mobile (320px+).
