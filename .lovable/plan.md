## Objetivo

1. Trazer de volta a foto/ilustração da personagem Dona Wilma para o site, num lugar estratégico (seção "Por trás do nome").
2. Corrigir o logo, que continua não aparecendo apesar do arquivo existir em `public/images/logo.png`.

---

## 1. Retrato da Dona Wilma na seção de homenagem

A imagem `src/assets/dona-wilma-landing-hero.jpg` já está importada em `Index.tsx` (linha 25) mas não é usada em lugar nenhum. Vou colocá-la dentro da seção `#sobre` (Homage), transformando o bloco atual (hoje só texto centralizado) num layout de duas colunas no desktop:

```text
┌──────────────────────────────────────────────┐
│  eyebrow · quem foi a Dona Wilma             │
│  Por trás do nome, uma história de verdade   │
├──────────────┬───────────────────────────────┤
│  [ retrato ] │  card creme com o texto,      │
│   polaroid   │  "com carinho ❤" e assinatura │
│   levemente  │  do Alexandre                 │
│   inclinado  │                               │
└──────────────┴───────────────────────────────┘
```

- No mobile: retrato aparece acima do card creme, mesma inclinação suave.
- Retrato com moldura estilo polaroid (fundo creme, borda, `shadow-soft`, leve `rotate(-2deg)`), reforçando o tom afetivo/editorial já usado no site.
- Alt text: "Dona Wilma, a inspiração por trás do produto".
- Nenhuma mudança nas chaves de tradução `landing.homage.*` — apenas o layout ganha a imagem ao lado.

## 2. Logo que "não aparece"

Hoje todos os pontos referenciam `/images/logo.png` (caminho servido pela pasta `public/`). O arquivo existe (400×90 PNG, 112 KB). Como o usuário está publicando em `donawilma.com.br` via Hostinger + GitHub, `public/` pode não estar sendo servido do mesmo jeito que no preview do Lovable, o que explica o logo sumir em produção mas não no admin/preview.

**Correção definitiva:** importar o logo como asset bundled pelo Vite, para o arquivo virar parte do build (com hash) e ser servido a partir de `/assets/…` — que funciona em qualquer host.

Passos:

1. Mover `public/images/logo.png` para `src/assets/logo.png` (via `mv`).
2. Criar um pequeno wrapper `src/components/BrandLogo.tsx` que importa o asset e aceita `className` + `invert?: boolean` (aplica `brightness-0 invert` quando `true`). Isso centraliza a marca — quando o usuário mandar o logo definitivo, troca-se em um único lugar.
3. Substituir os 10 usos de `<img src="/images/logo.png" … />` pelo `<BrandLogo />` nos arquivos:
   - `src/pages/Index.tsx` (header, mock de WhatsApp, footer)
   - `src/components/AppSidebar.tsx` (desktop e mobile)
   - `src/pages/Welcome.tsx`
   - `src/pages/ChoosePlan.tsx`
   - `src/pages/Terms.tsx` (3 ocorrências)
   - `src/pages/Privacy.tsx` (2 ocorrências)
4. Manter as classes de tamanho (`h-7`, `h-8`, `h-10`, `h-12`) e o `invert` onde aplicável (sidebar, footer, ChoosePlan, header de Terms/Privacy mobile).

## Fora de escopo

- Não vou mexer em lógica de negócio, i18n, Supabase, agente WhatsApp ou pagamentos.
- Não vou trocar o arquivo do logo em si — só o mecanismo de entrega, até você mandar a arte definitiva.

## Detalhes técnicos

- `BrandLogo.tsx` exporta um `<img>` com `src` vindo de `import logoUrl from "@/assets/logo.png"`, `alt="Dona Wilma"`, e concatena `className` externo com a classe `brightness-0 invert` quando `invert` for `true`.
- O retrato usa a mesma importação já existente `donaWilmaLandingHero` — sem novo arquivo, sem novo download.
- Layout da homage: `grid md:grid-cols-[minmax(0,320px)_1fr] gap-8 md:gap-12 items-center`. Título e eyebrow continuam centralizados acima do grid.
