

## Limpar Exemplos de Interação — Apenas Funcionalidades Existentes

### Problema
A seção "Interaja com a Dona Wilma 24h por dia" (`InteractionExamplesSection`) lista 12 exemplos, mas **6 deles** referem-se a recursos que não existem no MVP atual (lembretes, compromissos, agenda, aniversários, contas fixas visuais). Isso gera expectativa frustrada.

### Funcionalidades reais disponíveis via WhatsApp
- Registrar gasto / despesa (texto, áudio, foto/OCR)
- Registrar receita / entrada
- Consultar saldo (hoje, semana, mês)
- Consultar quanto gastou (período)
- Editar / apagar última transação
- Categorização inteligente automática

### Mudança

**Arquivo único:** `src/locales/pt-BR.json` (linhas 681 e 683-696)

Manter as **12 badges**, mas trocar as 6 que falam de lembretes/compromissos por exemplos reais. Ajustar também o subtítulo para remover "ou compromissos".

**Subtítulo (linha 681):**
- Antes: `"Pergunte o que quiser sobre suas finanças ou compromissos..."`
- Depois: `"Pergunte o que quiser sobre suas finanças. Veja alguns exemplos do que você pode dizer:"`

**Exemplos (linhas 684-695) — nova lista:**
```
0:  "Gastei 200 reais no cartão"           (mantido)
1:  "Recebi 10 mil reais de salário"       (mantido)
2:  "Quanto gastei hoje?"                  (mantido)
3:  "Saldo do mês?"                        (mantido)
4:  "Paguei 30 reais de gasolina"          (mantido)
5:  "Gastei 50 no mercado"                 (NOVO — substitui aluguel)
6:  "Quanto gastei esse mês?"              (mantido)
7:  "Quanto gastei essa semana?"           (NOVO — substitui lembretes)
8:  "Apagar última transação"              (NOVO — substitui reunião)
9:  "Recebi 500 de freela"                 (NOVO — substitui ligar cliente)
10: "Gastei 80 no Uber"                    (NOVO — substitui consulta)
11: "Editar última transação"              (NOVO — substitui aniversário)
```

### Escopo
- **Apenas** `pt-BR.json` (idioma atual exibido). Não toca em código TSX, layout, contagem ou outros locales — conforme pedido "não altere nada além disso".

### Arquivo afetado (1)
- `src/locales/pt-BR.json` — atualizar `landing.interaction.subtitle` e os 12 itens de `landing.interaction.examples`

