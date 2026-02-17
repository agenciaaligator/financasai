

# Plano Completo: Correcao de Datas OCR + Keywords Recorrentes + i18n Admin

## Problema 1: OCR nao distingue contas de comprovantes

O prompt do Gemini Vision (linha 1120-1134) pede apenas "Data (formato DD/MM/AAAA, se visivel)" sem distinguir entre:
- **Comprovante de despesa** (cupom fiscal, recibo): a data relevante e a data da compra
- **Conta/boleto** (luz, agua, telefone): a data relevante e a data de **vencimento**

Uma conta de luz tem multiplas datas (emissao, leitura anterior, leitura atual, vencimento). O prompt atual nao instrui a IA a priorizar o vencimento, e a heuristica de data (linhas 3653-3668) descarta qualquer data com mais de 35 dias de diferenca -- inclusive datas **futuras** validas.

### Correcao no prompt OCR (`analyzeReceipt`, linhas 1120-1134)

Alterar o prompt para:

- Adicionar campo `due_date` (data de vencimento) ao JSON de retorno
- Adicionar campo `document_type` para classificar: `receipt` (comprovante/cupom) ou `bill` (conta/boleto/fatura)
- Instruir a IA: "Se for uma conta (boleto, fatura, conta de luz/agua/telefone), extraia a DATA DE VENCIMENTO como `due_date`. Se for um comprovante de compra, extraia a data da compra como `date`."

Novo formato de retorno:
```json
{
  "amount": 132.86,
  "merchant": "ENEL",
  "category": "Moradia",
  "date": "15/02/2026",
  "due_date": "04/03/2026",
  "document_type": "bill"
}
```

### Correcao na logica de data ao salvar (`handleOCRConfirmation`, linhas 2824-2841)

- Se `document_type === 'bill'` e `due_date` existe, usar `due_date` como data da transacao
- Caso contrario, usar `date` (comportamento atual)

### Correcao na heuristica de data (`saveTransaction`, linhas 3653-3668)

Alterar de:
- Rejeitar datas com mais de 35 dias no passado

Para:
- Aceitar datas ate **60 dias no passado**
- Aceitar datas ate **90 dias no futuro** (contas com vencimento adiante)
- So sobrescrever com data atual se estiver FORA dessas janelas

### Correcao na exibicao ao usuario (linhas 2771-2776)

Quando o documento for uma conta (`bill`), mostrar:
```
📸 *Conta Analisada!*

💰 Valor: R$ 132.86
🏪 Empresa: ENEL
📂 Categoria: Moradia
📅 Vencimento: 04/03/2026

Salvar essa despesa? *(sim/nao)*
```

Em vez de "Data:", mostrar "Vencimento:" quando for uma conta.

---

## Problema 2: Keywords de recorrencia incompletas

A lista `recurringKeywords` (linha 3760) nao inclui concessionarias nem servicos comuns.

### Correcao: Expandir a lista com

**Energia**: `energia`, `eletricidade`, `enel`, `eletropaulo`, `cpfl`, `cemig`, `light`, `equatorial`, `celesc`, `copel`, `energisa`, `neoenergia`, `coelba`

**Gas**: `gas`, `comgas`, `naturgy`

**Saneamento**: `saneamento`, `sabesp`, `cedae`, `copasa`, `sanepar`, `embasa`

**Outros servicos**: `lixo`, `taxa`, `parcela`, `financiamento`, `consorcio`, `streaming`, `hbo`, `amazon`, `disney`, `youtube`, `deezer`, `apple`

---

## Problema 3: Link de producao incorreto

Na linha 3757, o agente retorna o link do ambiente de preview em vez de producao.

### Correcao

Trocar `https://bc45aac3-c622-434f-ad58-afc37c18c6c2.lovableproject.com` para `https://donawilma.lovable.app`

---

## Problema 4: Admin Panel sem internacionalizacao

Os 4 componentes do admin (`AdminPanel.tsx`, `AdminStats.tsx`, `UsersManagement.tsx`, `SubscriptionsManagement.tsx`) tem todos os textos hardcoded em portugues.

### Correcao

Adicionar `useTranslation()` nos 4 componentes e mover todos os textos para chaves `admin.*` nos 5 arquivos de locale.

**AdminPanel.tsx**: titulo, subtitulo, tabs (Estatisticas, Usuarios, Assinaturas)

**AdminStats.tsx**: nomes dos cards, secoes, labels

**UsersManagement.tsx**: titulo, colunas, roles, botoes, toasts, confirmacoes

**SubscriptionsManagement.tsx**: titulo, colunas, badges, mensagens vazias

---

## Resumo de arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/whatsapp-agent/index.ts` | Prompt OCR com `due_date` + `document_type`, heuristica 60d/90d, keywords expandidas, link producao |
| `src/components/admin/AdminPanel.tsx` | i18n com `useTranslation` |
| `src/components/admin/AdminStats.tsx` | i18n com `useTranslation` |
| `src/components/admin/UsersManagement.tsx` | i18n com `useTranslation` |
| `src/components/admin/SubscriptionsManagement.tsx` | i18n com `useTranslation` |
| `src/locales/pt-BR.json` | Chaves `admin.*` |
| `src/locales/en-US.json` | Chaves `admin.*` |
| `src/locales/es-ES.json` | Chaves `admin.*` |
| `src/locales/pt-PT.json` | Chaves `admin.*` |
| `src/locales/it-IT.json` | Chaves `admin.*` |

## O que NAO sera alterado
- Nenhuma tabela no Supabase
- Nenhuma nova dependencia
- Nenhuma alteracao em componentes fora do admin e do whatsapp-agent
