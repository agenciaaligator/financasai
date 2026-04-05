

## Revisao Completa do Site — Problemas Identificados e Correcoes

### Problemas Encontrados

#### 1. CONTEUDO — Textos hardcoded sem i18n

| Arquivo | Problema |
|---------|----------|
| `UpgradeModal.tsx` (linhas 56-70, 83-94, 115, 147, 153) | Textos em portugues hardcoded: "Assine o Premium", "Por que escolher o Premium?", "Mensal", "Anual", "por mes", "Cobrado", "Assinar Agora", "Plano Atual", "Cupons e descontos..." |
| `WelcomeScreen.tsx` (linhas 32-44, 49) | Textos hardcoded: "Bem-vindo", "Sua conta Dona Wilma esta pronta", "Resumo do pedido", "Plano:", "Valor:", "Comece agora:" |
| `DashboardContent.tsx` (linhas 46-51) | Array TIPS hardcoded em portugues, nao usa i18n |

#### 2. CONTEUDO — Inconsistencias nos Termos de Servico

| Arquivo | Problema |
|---------|----------|
| `pt-BR.json` (linha 743) | Secao "Planos e Pagamento" menciona "planos gratuitos e pagos" — o modelo nao tem plano gratuito |

#### 3. USABILIDADE — Link WhatsApp de contato falso

| Arquivo | Problema |
|---------|----------|
| `Index.tsx` (linha 387) | `href="https://wa.me/5511999999999"` — numero placeholder, nao funcional |

#### 4. USABILIDADE — Secao "Contato" duplicada visualmente

| Arquivo | Problema |
|---------|----------|
| `Index.tsx` (linhas 371-417) | Secao Contato tem `bg-muted/30` e esta colada na secao FAQ que tambem tem `bg-muted/30`, criando um bloco visual unico sem separacao |

#### 5. LOGICA — WelcomeScreen usa exports deprecated

| Arquivo | Problema |
|---------|----------|
| `WelcomeScreen.tsx` (linha 3) | Importa `DISPLAY_PRICES` e `formatPrice` do pricing.ts — estes sao exports de compatibilidade retroativa, fixos em BRL. Deveria usar `getDisplayPrice()` + `getCurrencyFromLocale()` para respeitar o idioma do usuario |

#### 6. LOGICA — UpgradeModal features hardcoded

| Arquivo | Problema |
|---------|----------|
| `UpgradeModal.tsx` (linhas 30-37) | Lista de features do premium esta hardcoded em portugues no componente, diferente da PlansSection que usa chaves i18n |

#### 7. LOGICA — Admin acessivel por 2 caminhos

| Arquivo | Problema |
|---------|----------|
| `App.tsx` (linha 85) | Rota `/admin` renderiza `AdminRoute` (componente standalone com proprio loading) |
| `AppSidebar.tsx` + `DashboardContent.tsx` | Tab "admin" dentro do dashboard renderiza `AdminPanel` inline |
| Efeito | Admin funciona nos 2 lugares, mas a rota `/admin` nao tem sidebar/header do dashboard. A tab do sidebar e o caminho preferido. A rota `/admin` pode confundir |

#### 8. VISUAL — Floating cards do hero saem da tela em mobile

| Arquivo | Problema |
|---------|----------|
| `Index.tsx` (linhas 205, 218) | Cards flutuantes com `absolute -bottom-6 -left-8` e `absolute -top-4 -right-6` podem transbordar em telas de 320-375px |

#### 9. LOGICA — Social proof com dados placeholder

| Arquivo | Problema |
|---------|----------|
| `Index.tsx` (linhas 182-190) | Circulos coloridos genericos como avatares (sem imagens reais), contagem via i18n key `socialProofCount` — possivelmente exibindo numero inventado |

#### 10. USABILIDADE — Dashboard "Dica do dia" nao internacionalizada

| Arquivo | Problema |
|---------|----------|
| `DashboardContent.tsx` (linhas 46-51) | Array TIPS com 4 dicas hardcoded em portugues |

---

### Plano de Correcao (7 tarefas)

| # | Arquivo(s) | Correcao |
|---|-----------|----------|
| 1 | `UpgradeModal.tsx` | Substituir todos os textos hardcoded por chaves i18n (`t('upgrade.title')`, etc). Adicionar chaves correspondentes nos 5 arquivos de locale |
| 2 | `WelcomeScreen.tsx` | Internacionalizar textos + migrar de `DISPLAY_PRICES`/`formatPrice` para `getDisplayPrice()`/`getCurrencyFromLocale()` com locale do i18n |
| 3 | `DashboardContent.tsx` | Mover array TIPS para chaves i18n (`dashboard.tips.0` a `dashboard.tips.3`) nos 5 locales |
| 4 | `pt-BR.json` (+ outros locales) | Corrigir secao legal.terms.sections.payment: remover mencao a "planos gratuitos", ajustar para "O Servico oferece planos pagos (mensal ou anual)" |
| 5 | `Index.tsx` linha 387 | Trocar `5511999999999` pelo numero real do WhatsApp Business (pode ser o mesmo `WHATSAPP_PHONE_NUMBER_ID` ou pedir ao usuario) |
| 6 | `Index.tsx` linhas 205-223 | Adicionar `hidden sm:block` nos floating cards do hero para evitar overflow em mobile, ou limitar posicao com `left-0 bottom-0` responsivo |
| 7 | `Index.tsx` linha 371 | Remover `bg-muted/30` da secao Contato para diferencia-la da FAQ, ou adicionar separador visual |

### Observacoes (nao bloqueantes)

- **Rota `/admin`**: manter funcionando como fallback, mas pode ser removida no futuro ja que o admin e acessivel pela tab do sidebar
- **Social proof**: os circulos genericos sao aceitaveis como MVP, mas idealmente devem ter fotos ou ser removidos
- **Google Calendar mencionado no UpgradeModal**: feature "Google Calendar" esta listada nas features premium, confirmar se esta realmente ativa no produto

