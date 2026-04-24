

## Correção do autofill + revisão geral do sistema

### Problema raiz identificado

Em `src/index.css` (linhas 124–132) existe uma regra **global com `!important`** que força texto branco no autofill:

```css
input:-webkit-autofill { -webkit-text-fill-color: white !important; ... }
```

Essa regra foi criada para a tela escura de Login/Register, mas é aplicada em **todos os inputs do site** — inclusive o ContactForm que tem fundo claro (`#F8F9FA`). Resultado: texto branco sobre fundo branco = **invisível**, exatamente o que aparece nas imagens enviadas.

A regra inline no `Input.tsx` não consegue sobrescrever porque a global usa `!important`.

---

### 1. Correção do autofill (escopada por contexto)

Reescrever o bloco `input:-webkit-autofill` em `src/index.css` para ser **contextual**:

- **Padrão (tema claro / landing / dashboard):** usar `hsl(var(--foreground))` (cor escura `#2C3E50`) como `-webkit-text-fill-color`, com `box-shadow inset` transparente para preservar o fundo claro do input.
- **Telas escuras (Login, Register, ResetPassword):** manter texto branco. Aplicar via seletor escopado, ex.: `.auth-dark input:-webkit-autofill { ... white ... }`, e adicionar a classe `auth-dark` no container raiz dessas três páginas.
- Remover o `!important` da regra padrão; manter apenas onde absolutamente necessário no escopo escuro.
- Limpar a regra duplicada inline em `src/components/ui/input.tsx` (fica redundante).

Resultado: nome, e-mail, telefone autopreenchidos ficam **visíveis** no formulário de contato e em qualquer outro input claro, sem quebrar Login/Register.

---

### 2. Revisão geral — itens encontrados

**a) Domínio personalizado (`donawilma.com.br`)**
Vários arquivos ainda usam `donawilma.lovable.app`:
- `index.html` — canonical, og:url, og:image, twitter:image, JSON-LD `url`
- `public/robots.txt` — Sitemap
- `public/sitemap.xml` — todas as `<loc>`

Atualizar todas para `https://donawilma.com.br` (mantendo o caminho). Isso melhora SEO, OG previews (WhatsApp/Facebook), e indexação no Google após a publicação no domínio próprio.

**b) Textarea sem o mesmo padrão visual dos Inputs**
`src/components/ui/textarea.tsx` ainda usa `text-sm`, `border` (1px), `rounded-md` — destoa do `Input` (que é `rounded-[16px]`, `border-2`, `h-12`, foco com glow). No ContactForm o campo Mensagem visualmente "quebra" em relação aos outros. Alinhar o estilo do Textarea ao do Input para consistência premium.

**c) Footer / Contato — referências antigas a e-mail fixo**
`src/pages/Terms.tsx` (linha 199) e os 5 locales (Terms + Privacy) ainda mostram `contato@donawilma.com.br` como canal de contato. Decisão de produto recente: contato é **apenas pelo formulário**. Substituir por uma frase localizada apontando para `/#contato` (ex.: "Entre em contato pelo nosso formulário"). Não removo o e-mail dos textos legais da LGPD se você preferir manter um endereço formal — me confirme.

**d) Acessibilidade do ContactForm**
- Falta `aria-describedby` ligando os erros aos inputs (atualmente só `aria-invalid`).
- Faltam `autoComplete="name|email|tel"` nos campos — isso melhora a UX de autofill e confiabilidade do navegador.
Adicionar ambos.

**e) Limpeza menor**
- `src/components/ui/input.tsx`: remover as classes inline de autofill (já tratadas globalmente).
- Verificar se a página `/auth-dark` realmente precisa do escopo (Login, Register, ResetPassword) — adicionar a classe no wrapper raiz dessas três páginas.

---

### 3. O que NÃO será alterado

- Stripe / checkout / webhook
- Onboarding / WhatsApp core
- Auth flow / dashboard financeiro
- Tabela `contact_messages`, RLS, edge function `submit-contact-message`
- Lógica anti-spam (honeypot, cooldown, rate-limit, dedupe)

---

### Arquivos a editar

- `src/index.css` — regra autofill escopada (correção principal)
- `src/components/ui/input.tsx` — remover override redundante
- `src/components/ui/textarea.tsx` — alinhar estilo ao Input
- `src/components/ContactForm.tsx` — `autoComplete` + `aria-describedby`
- `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/pages/ResetPassword.tsx` — adicionar `auth-dark` no wrapper
- `index.html` — substituir domínio para `donawilma.com.br` em canonical / OG / Twitter / JSON-LD
- `public/robots.txt`, `public/sitemap.xml` — substituir domínio
- `src/pages/Terms.tsx` + 5 locales (Terms + Privacy) — substituir e-mail fixo por link para o formulário (sujeito à sua confirmação para os textos legais)

### Critérios de sucesso

- Autofill no formulário de contato mostra texto **escuro e legível** sobre fundo claro.
- Autofill no Login/Register continua **branco e legível** sobre fundo escuro.
- Meta tags, sitemap e robots apontam para `donawilma.com.br`.
- Textarea visualmente consistente com Inputs.
- Sem regressão em formulários existentes, dashboard ou auth.

