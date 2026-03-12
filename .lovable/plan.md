

## Header Unificado + Breadcrumb nas Páginas Legais

### Problema
O header das páginas `/termos` e `/privacidade` tem links diferentes (Home, Termos, Privacidade + botão Voltar) enquanto a landing tem (Home, Como funciona, Planos, Contato + botão Entrar). O breadcrumb com o nome da página está embutido no header ao lado do logo.

### Solução

**Header idêntico à landing** em ambas as páginas legais:
- Mesmo menu: Home, Como funciona, Planos, Contato (navegam para `/#home`, `/#como-funciona`, etc.)
- Botão "Entrar" em vez de "Voltar"
- LanguageFlagSelector no mesmo lugar
- Mobile Sheet com os mesmos links + botão Entrar

**Breadcrumb separado** abaixo do header (na área do hero banner que já existe):
- Formato: `Home > Termos de Serviço` ou `Home > Política de Privacidade`
- "Home" clicável, página atual como texto simples
- Posicionado acima do título com ícone no hero banner

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Terms.tsx` | Header → cópia da landing (links de seção + Entrar); breadcrumb no hero banner |
| `src/pages/Privacy.tsx` | Mesmo tratamento |

