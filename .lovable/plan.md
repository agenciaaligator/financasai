

## Corrigir Todas as Traduções Faltantes no Dashboard e WhatsApp

### Problema
Vários componentes do dashboard ainda possuem textos em português hardcoded, sem usar o sistema i18n. Ao trocar idioma, esses textos permanecem em português.

### Componentes Afetados e Strings Hardcoded

**1. `src/components/DeleteConfirmationDialog.tsx`** — 100% hardcoded em português:
- "Confirmar exclusão"
- "Você está prestes a deletar..."
- "Esta ação não pode ser desfeita!"
- "Digite DELETAR para confirmar"
- placeholder "Digite DELETAR"
- "Cancelar"
- "Deletar permanentemente"
- `itemType` props passadas em português ('transação', 'categoria', etc.) — precisam ser traduzidas no ponto de chamada

**2. `src/components/EditTransactionModal.tsx`** — 100% hardcoded em português:
- "Editar Transação"
- "Tipo", "Valor (R$)", "Título", "Categoria", "Data"
- "Receita", "Despesa"
- "Descrição (opcional)"
- "Salvando...", "Salvar Alterações", "Cancelar"
- "Selecione uma categoria"
- "Sugestão: ...", "Aplicar"
- Toast messages: "Erro ao atualizar transação", "Transação atualizada!"
- Placeholder texts

**3. `src/components/dashboard/LimitWarning.tsx`** — 100% hardcoded em português:
- "transações" / "categorias"
- "Limite de X atingido" / "Atenção: Limite de X"
- "Você está usando X de Y..."

**4. `src/components/dashboard/WhatsAppPage.tsx`** — Parcialmente traduzido, mas muitas strings hardcoded:
- "Configure em 2 minutos"
- "Após conectar, você poderá:"
- Lista de funcionalidades (voz, OCR, saldo)
- "Número do WhatsApp" label
- "Formato internacional..."
- "Código de verificação"
- "Enviando...", "Verificar Código"
- Toasts: "Número necessário", "Código enviado!", "Código inválido", etc.
- "Envie 'ajuda' no WhatsApp..."
- Todos os exemplos de comandos do accordion (gasto 50, receita 1000, etc.)
- `getLastActivityMessage()` — retorna "há X horas" hardcoded

**5. `src/components/dashboard/WhatsAppInfo.tsx`** — 100% hardcoded em português (integração WhatsApp, comandos, dicas)

### Correções

**Passo 1**: Adicionar todas as chaves faltantes nos 5 arquivos de locale:
- `src/locales/pt-BR.json` — chaves em português
- `src/locales/en-US.json` — traduções para inglês
- `src/locales/es-ES.json` — traduções para espanhol
- `src/locales/it-IT.json` — traduções para italiano
- `src/locales/pt-PT.json` — variante portuguesa

Chaves a adicionar/organizar:
- `deleteDialog.*` — todas as strings do diálogo de exclusão
- `editTransaction.*` — todas as strings do modal de edição
- `limitWarning.*` — strings do aviso de limite
- `whatsapp.*` — strings faltantes da página WhatsApp (usar as chaves já definidas que existem mas não são usadas no código, como `setupIn2Min`, `afterConnect`, `addByVoice`, `sendReceipts`, `checkBalance`, `numberRequired`, `codeSent`, etc.)

**Passo 2**: Atualizar os componentes para usar `useTranslation()`:
- `DeleteConfirmationDialog.tsx` — adicionar `useTranslation`, substituir todas as strings
- `EditTransactionModal.tsx` — adicionar `useTranslation`, substituir todas as strings
- `LimitWarning.tsx` — adicionar `useTranslation`, substituir strings
- `WhatsAppPage.tsx` — substituir strings hardcoded pelas chaves `whatsapp.*` que já existem nos locales mas não estão sendo usadas no componente
- `WhatsAppInfo.tsx` — adicionar `useTranslation`, substituir todas as strings

**Passo 3**: Nos componentes que chamam `DeleteConfirmationDialog`, traduzir o `itemType`:
- Em `CategoryManager.tsx` e outros, passar `itemType` traduzido

### Arquivos Afetados (10 arquivos)
- `src/components/DeleteConfirmationDialog.tsx`
- `src/components/EditTransactionModal.tsx`
- `src/components/dashboard/LimitWarning.tsx`
- `src/components/dashboard/WhatsAppPage.tsx`
- `src/components/dashboard/WhatsAppInfo.tsx`
- `src/locales/pt-BR.json`
- `src/locales/en-US.json`
- `src/locales/es-ES.json`
- `src/locales/it-IT.json`
- `src/locales/pt-PT.json`

