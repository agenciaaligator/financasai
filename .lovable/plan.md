

## Adicionar Traduções Faltantes no Dashboard

### Problema
Ao mudar o idioma no dashboard, os textos de saudação e banner de boas-vindas permanecem em português porque as chaves de tradução não existem nos arquivos de locale.

### Chaves faltantes
Todas dentro do objeto `dashboard`:
- `greeting` — "Olá! 🎉"
- `greetingSubtitle` — "Como estão suas finanças hoje? Vamos dar uma olhada..."
- `welcomeTitle` — "Bem-vindo ao Dona Wilma!"
- `welcomeDesc` — "Envie mensagens pelo WhatsApp para registrar suas finanças:"
- `welcomeTip1` — "Gastei 50 no mercado"
- `welcomeTip2` — "Recebi 3000 de salário"
- `welcomeTip3` — "Reunião amanhã às 14h"
- `goals` — "Metas Mensais" (usado em FinancialDashboard.tsx tabTitleMap)

### Correções

Adicionar essas chaves ao objeto `dashboard` nos 5 arquivos de locale:

**`pt-BR.json`**: valores já são os fallbacks atuais (português)

**`en-US.json`**:
```json
"greeting": "Hello! 🎉",
"greetingSubtitle": "How are your finances today? Let's take a look...",
"welcomeTitle": "Welcome to Dona Wilma!",
"welcomeDesc": "Send WhatsApp messages to manage your finances:",
"welcomeTip1": "\"Spent 50 at the grocery store\"",
"welcomeTip2": "\"Received 3000 salary\"",
"welcomeTip3": "\"Meeting tomorrow at 2pm\"",
"goals": "Monthly Goals"
```

**`es-ES.json`**:
```json
"greeting": "¡Hola! 🎉",
"greetingSubtitle": "¿Cómo están tus finanzas hoy? Vamos a echar un vistazo...",
"welcomeTitle": "¡Bienvenido a Dona Wilma!",
"welcomeDesc": "Envía mensajes por WhatsApp para gestionar tus finanzas:",
"welcomeTip1": "\"Gasté 50 en el supermercado\"",
"welcomeTip2": "\"Recibí 3000 de salario\"",
"welcomeTip3": "\"Reunión mañana a las 14h\"",
"goals": "Metas Mensuales"
```

**`it-IT.json`**:
```json
"greeting": "Ciao! 🎉",
"greetingSubtitle": "Come stanno le tue finanze oggi? Diamo un'occhiata...",
"welcomeTitle": "Benvenuto su Dona Wilma!",
"welcomeDesc": "Invia messaggi WhatsApp per gestire le tue finanze:",
"welcomeTip1": "\"Ho speso 50 al supermercato\"",
"welcomeTip2": "\"Ho ricevuto 3000 di stipendio\"",
"welcomeTip3": "\"Riunione domani alle 14\"",
"goals": "Obiettivi Mensili"
```

**`pt-PT.json`**:
```json
"greeting": "Olá! 🎉",
"greetingSubtitle": "Como estão as suas finanças hoje? Vamos dar uma vista de olhos...",
"welcomeTitle": "Bem-vindo ao Dona Wilma!",
"welcomeDesc": "Envie mensagens pelo WhatsApp para registar as suas finanças:",
"welcomeTip1": "\"Gastei 50 no supermercado\"",
"welcomeTip2": "\"Recebi 3000 de salário\"",
"welcomeTip3": "\"Reunião amanhã às 14h\"",
"goals": "Metas Mensais"
```

**Arquivos**: `src/locales/pt-BR.json`, `src/locales/en-US.json`, `src/locales/es-ES.json`, `src/locales/it-IT.json`, `src/locales/pt-PT.json`

