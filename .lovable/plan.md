

## Substituir logo "Dona Wilma" em todo o site

O logo atual usa um ícone Calendar + texto "Dona Wilma" em vários locais, e na página de login usa a imagem redonda `99e234ab`. O novo logo (horizontal, com coração+gráfico+texto) será copiado para `public/images/logo.png` e substituído em todos os pontos.

### Locais a alterar

| Arquivo | Local | Mudança |
|---------|-------|---------|
| `src/pages/Index.tsx` (L68-72) | Navbar da landing | Trocar ícone Calendar + texto por `<img>` do logo |
| `src/pages/Index.tsx` (L377-381) | Footer | Idem, versão branca/invertida ou mesma imagem |
| `src/pages/Login.tsx` (L8-14) | Tela de login | Trocar imagem redonda + texto por logo horizontal |
| `src/pages/Terms.tsx` (L19-22) | Header termos | Trocar Calendar + texto por logo |
| `src/pages/Privacy.tsx` (L19-22) | Header privacidade | Idem |
| `src/pages/ChoosePlan.tsx` (L29-31) | Header planos | Idem |
| `src/pages/Welcome.tsx` (L240-242) | Header boas-vindas | Idem |
| `src/components/AppSidebar.tsx` (L60-67) | Sidebar mobile | Trocar emoji 💰 + texto por logo (com filtro brightness para fundo escuro) |
| `src/components/AppSidebar.tsx` (L114-123) | Sidebar desktop | Idem |
| `index.html` (L11, 25, 31) | Favicon + OG/Twitter images | Atualizar referências para o novo logo |

### Implementação

1. Copiar `user-uploads://logo_transparente_site_400x90.png` → `public/images/logo.png`
2. Em cada local acima, substituir o bloco `Calendar icon + span` por `<img src="/images/logo.png" alt="Dona Wilma" className="h-8" />` (ajustando altura conforme contexto)
3. No sidebar (fundo escuro), usar `className="brightness-0 invert"` para tornar o logo branco
4. No footer (fundo escuro), mesma técnica de inversão
5. Na página de login, usar o logo maior (`h-12`) centralizado, removendo a imagem redonda e o `<h1>`
6. No `index.html`, atualizar favicon e og:image para `/images/logo.png`

