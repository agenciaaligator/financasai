## Objetivo

Enriquecer a tela `/boas-vindas` com instruções claras para o usuário de primeira viagem, deixando explícito que **a Google Agenda só pode ser conectada pelo painel web** (não pelo WhatsApp), além de explicar os recursos principais do app.

## O que será adicionado

Uma nova seção **"Próximos passos no painel web"** dentro do card de boas-vindas, posicionada **logo após o grid de dicas do WhatsApp** (💡 "Como usar") e **antes do botão "Começar a usar"**.

### Conteúdo da nova seção

Título: **"📌 O que fazer no painel web"**

Subtítulo curto: "Algumas configurações só ficam aqui pelo navegador. Faça uma vez e esqueça."

4 cards (mesmo estilo bento dos cards de dicas):

1. **📅 Conectar Google Agenda** *(destaque visual — borda primária)*
   - "A sincronização da agenda é feita **só pelo painel web** (aqui pelo navegador)."
   - "Acesse a aba **Agenda** → botão **Conectar Google Agenda**."
   - "Depois, é só pedir compromissos pelo WhatsApp que aparecem automaticamente no seu Google."

2. **🏷️ Categorias e metas**
   - "Aba **Categorias**: personalize as suas e crie metas mensais."
   - "O Dona Wilma avisa no WhatsApp quando você se aproxima do limite."

3. **📊 Relatórios e histórico**
   - "Aba **Relatórios**: gráficos de 12 meses, comparativos e exportação."
   - "Aba **Movimentações**: edite ou exclua qualquer lançamento."

4. **⚙️ Configurações da conta**
   - "Atualize dados, plano e WhatsApp conectado em **Configurações**."
   - "Acesse o painel pelo computador ou celular: `donawilma.com.br`."

### Ajuste no card de Google Agenda

Acrescentar um pequeno aviso **dentro do bloco "Conectar Google Agenda"** (`AgendaPage.tsx`, no estado "não conectado"), reforçando que essa ação **precisa ser feita pelo navegador** (não funciona pelo WhatsApp). Isso evita que o usuário fique perdido quando, mais tarde, tentar pedir ao bot para conectar.

### Internacionalização

Todas as novas strings entram nos 5 arquivos de locale (`pt-BR`, `pt-PT`, `en-US`, `es-ES`, `it-IT`) sob a chave `welcome.webPanelSteps.*`.

## Arquivos afetados

- `src/pages/Welcome.tsx` — nova seção "O que fazer no painel web" + grid de 4 cards.
- `src/locales/pt-BR.json`, `pt-PT.json`, `en-US.json`, `es-ES.json`, `it-IT.json` — novas chaves traduzidas.
- `src/components/dashboard/AgendaPage.tsx` — pequeno aviso "esta etapa só funciona pelo navegador" no bloco inicial.

## Fora do escopo

- Não mexer em fluxo de OTP/WhatsApp.
- Não mudar layout do card principal nem do progresso.
- Sem alterações em backend, banco ou edge functions.
