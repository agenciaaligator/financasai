## Configuração de envio de e-mails via SMTP da Hostinger

Vamos usar a conta `contato@donawilma.com.br` como remetente único para os 3 fluxos: autenticação (Supabase), confirmação de formulário de contato e notificações do app.

### Arquitetura escolhida

```text
                   ┌─────────────────────────────────────┐
                   │  smtp.hostinger.com:465 (SSL)       │
                   │  user: contato@donawilma.com.br     │
                   └──────────────┬──────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼────────┐      ┌─────────▼──────────┐    ┌─────────▼──────────┐
│ Supabase Auth  │      │ send-app-email     │    │ submit-contact-    │
│ (SMTP custom)  │      │ (edge function)    │    │ message (já existe)│
│ reset/signup   │      │ notificações       │    │ + envio confirmação│
└────────────────┘      └────────────────────┘    └────────────────────┘
```

### O que será feito

**1. Supabase Auth → SMTP customizado da Hostinger**
- Configuração feita no painel do Supabase (Authentication → Emails → SMTP Settings) por você, com os valores que vou te entregar prontos. Isso faz com que confirmação de cadastro, recuperação de senha e magic links saiam de `contato@donawilma.com.br` em vez de `noreply@mail.app.supabase.io`.
- Personalizar os 4 templates de e-mail do Supabase (Confirm signup, Reset password, Magic link, Change email) com a identidade visual da Dona Wilma e o domínio canônico `https://donawilma.com.br`.

**2. Nova edge function `send-app-email` (genérica via SMTP)**
- Usa a biblioteca `denomailer` (SMTP nativo Deno) — sem dependência de Resend ou serviços terceiros.
- Lê credenciais SMTP de secrets do Supabase: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`.
- Aceita `{ to, subject, html, text, replyTo? }` com validação Zod.
- Será o ponto único para qualquer notificação transacional do app (alertas de meta, boas-vindas pós-onboarding, avisos de assinatura, etc.).
- CORS, validação de input, logs e rate-limit por IP.

**3. Atualizar `submit-contact-message`**
- Após inserir a mensagem na tabela, chamar `send-app-email` para:
  - Notificar `contato@donawilma.com.br` com os dados do contato (`replyTo` = e-mail do remetente, para responder direto).
  - Enviar confirmação de recebimento ao usuário ("Recebemos sua mensagem, retornaremos em breve").
- Templates HTML inline com a identidade visual.

**4. Adicionar 3 secrets no Supabase**
- `SMTP_HOST` = `smtp.hostinger.com`
- `SMTP_PORT` = `465`
- `SMTP_USER` = `contato@donawilma.com.br`
- `SMTP_PASS` = (senha da caixa de e-mail Hostinger — você fornece via prompt seguro)
- `SMTP_FROM_NAME` = `Dona Wilma`

**5. Documentação**
- Atualizar `CONFIGURACAO_SUPABASE.md` com o passo a passo SMTP no Supabase Auth e os templates customizados.
- Criar memória técnica `mem://infrastructure/smtp-hostinger-config` com host, porta, encoding e regra de uso.

### O que VOCÊ precisa fazer (passo a passo simples)

1. **Aguardar propagação DNS** (já em andamento — verifique em https://dnschecker.org).
2. **Quando eu pedir, fornecer a senha da caixa `contato@donawilma.com.br`** (a mesma usada no webmail da Hostinger). Vou pedir via prompt seguro do Lovable, não vai ficar no código.
3. **No painel do Supabase**, depois que eu te avisar, colar as configurações SMTP (vou te entregar o bloco pronto: host, porta, user, sender name, sender email).
4. **Cole os 4 templates HTML** que vou gerar nos campos correspondentes em Authentication → Emails → Templates.

### Limites e observações importantes

- **Volume**: o SMTP da Hostinger tem limite típico de **~100 e-mails por hora** e ~3000/dia por conta (varia por plano). Para o estágio atual (MVP), é mais que suficiente.
- **Entregabilidade**: como os DNS estão na Hostinger, SPF e DKIM já vêm configurados automaticamente para a conta — a entregabilidade fica boa nativamente.
- **Senha de e-mail ≠ senha do painel Hostinger**: é a senha específica da caixa de e-mail (criada quando você criou a conta `contato@`).
- **Se um dia o volume crescer** (>3k/dia), migramos para Resend ou Lovable Emails sem alterar o código do app — só trocamos a config SMTP nos secrets.

### Detalhes técnicos (para minha referência)

- Lib SMTP: `denomailer@1.6.0` (ESM compatível com edge functions Deno).
- Conexão: TLS implícito na porta 465 (`tls: true`), fallback para 587 STARTTLS se necessário.
- O `auth-email-hook` do Lovable NÃO será usado — o Supabase nativo envia direto via SMTP customizado, mais simples e sem orquestração extra.
- O helper `buildSiteUrl()` (já existente) será usado em todos os links dentro dos templates HTML para garantir que apontem para `https://donawilma.com.br`.
