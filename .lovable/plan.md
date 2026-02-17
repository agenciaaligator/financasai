
# Limpeza da Pagina de Perfil

## Problema

A pagina de Perfil exibe dois cards que confundem o usuario:

1. **"Minha Assinatura"** - Mostra barras de progresso de uso (transacoes/categorias), lista de recursos disponiveis (WhatsApp, IA Reports, Integracao Bancaria, Suporte Prioritario), e badge "Sem assinatura". Como o produto tem apenas o plano Premium, essas informacoes nao agregam valor e confundem.

2. **"Manutencao do Sistema"** - Expoe um botao "Forcar Atualizacao Completa" que limpa cache e recarrega a pagina. Isso e uma ferramenta de desenvolvimento/suporte que nao deveria estar acessivel ao usuario final. Pode causar perda de dados locais se clicado por engano.

## Solucao

### Remover o card "Manutencao do Sistema" (linhas 1024-1062)
- Remover completamente. Nao ha motivo para o usuario ter acesso a isso.
- Remover os imports nao utilizados (`RefreshCw`, `Bug`) se nao forem usados em outro lugar do componente.

### Simplificar o card "Minha Assinatura" (linhas 898-1022)
Em vez de remover completamente, simplificar para mostrar apenas:
- O status da assinatura (Premium Ativo / Sem assinatura)
- Data de renovacao (se houver)
- Botao "Gerenciar Assinatura" (link para o portal Stripe)

Remover:
- Barras de progresso de uso (transacoes/categorias) - nao faz sentido com limites infinitos no Premium
- Grid de "Recursos Disponiveis" - todos sao iguais para todos, nao precisa listar
- Badge redundante

## Detalhes tecnicos

**Arquivo editado**: `src/components/ProfileSettings.tsx`

- Linhas 935-961: Remover secao "Uso do Plano" (barras de progresso)
- Linhas 963-998: Remover secao "Recursos Disponiveis" (grid de checks)
- Linhas 1024-1062: Remover card "Manutencao do Sistema" inteiro
- Limpar imports nao utilizados (`Bug`, `RefreshCw`, `Progress`, etc.) e hooks (`useFeatureLimits`) se ficarem sem uso

**Resultado**: Pagina de perfil limpa, sem informacoes tecnicas ou confusas para o usuario.
