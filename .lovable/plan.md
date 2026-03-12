

## Revisão Completa para Lançamento + Redesign das Páginas Legais

### 1. REDESIGN: Termos de Serviço e Política de Privacidade

As páginas atuais são minimalistas — apenas header com logo + botão voltar e conteúdo simples. Para diferenciá-las como páginas independentes com identidade visual própria:

**Novo layout proposto para ambas (`Terms.tsx` e `Privacy.tsx`):**
- Header com logo clicável, título da página em destaque, e botão "Voltar ao site"
- Breadcrumb visual (Home > Termos de Serviço)
- Sidebar/índice com âncoras para cada seção (navegação interna)
- Footer completo reutilizando o mesmo footer da landing (logo, links, copyright, Aligator)
- Card com fundo branco para o conteúdo, separando visualmente do background
- Remover import não usado de `Calendar` em ambos os arquivos

**Arquivos:** `src/pages/Terms.tsx`, `src/pages/Privacy.tsx`

---

### 2. LINKS DO FOOTER: Usar React Router

No footer da landing (`Index.tsx` L388-389), os links para `/termos` e `/privacidade` usam `<a href>` que causa full page reload. Trocar por `<Link>` do React Router ou `onClick={() => navigate(...)}`

**Arquivo:** `src/pages/Index.tsx`

---

### 3. TEXTOS HARDCODED EM PORTUGUÊS (Landing Page)

Strings na landing que não passam pelo i18n:

| Linha | Texto | Chave sugerida |
|-------|-------|----------------|
| 148 | "Inteligência Artificial para sua vida" | `landing.hero.badge` |
| 187 | "+500 usuários ativos" | `landing.hero.socialProof` |
| 210-211 | "WhatsApp" / "Gastei 50 no mercado" | `landing.hero.floatingWhatsapp` / `landing.hero.floatingMessage` |
| 220 | "Registrado!" | `landing.hero.floatingSuccess` |

**Arquivos:** `src/pages/Index.tsx` + todos os 5 arquivos de locale

---

### 4. COPYRIGHT DESATUALIZADO

`pt-BR.json` L700: `"© 2025 Dona Wilma"` — estamos em 2026. Atualizar para usar ano dinâmico ou corrigir para 2025-2026 em todos os locales.

**Arquivos:** todos os 5 locales (`pt-BR`, `pt-PT`, `en-US`, `es-ES`, `it-IT`)

---

### 5. SIDEBAR SEM ABA "METAS" NO LOCALE (duplicação)

Em `pt-BR.json` há duas definições de `sidebar` — uma em L41-55 e outra em L835-837 apenas com `goals` e `goalsDesc`. A segunda sobrescreve parcialmente a primeira. Mesclar em uma única entrada.

**Arquivo:** `src/locales/pt-BR.json` (e verificar nos outros locales)

---

### RESUMO DAS MUDANÇAS

| # | Arquivo | O que muda |
|---|---------|------------|
| 1 | `src/pages/Terms.tsx` | Redesign completo com header diferenciado, índice lateral, footer |
| 2 | `src/pages/Privacy.tsx` | Mesmo redesign |
| 3 | `src/pages/Index.tsx` | Links footer com navigate(), i18n dos textos hardcoded |
| 4 | `src/locales/pt-BR.json` | Novas chaves hero, copyright 2026, merge sidebar duplicado |
| 5 | `src/locales/en-US.json` | Mesmas novas chaves traduzidas |
| 6 | `src/locales/es-ES.json` | Mesmas novas chaves traduzidas |
| 7 | `src/locales/it-IT.json` | Mesmas novas chaves traduzidas |
| 8 | `src/locales/pt-PT.json` | Mesmas novas chaves traduzidas |

