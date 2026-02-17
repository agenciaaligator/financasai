

# Padronizacao de Nomenclaturas de Roles e Status

## Situacao Atual

O sistema possui inconsistencias entre o que existe de fato e o que o codigo exibe:

| Elemento | O que existe no banco | O que o codigo mostra |
|----------|----------------------|----------------------|
| Enum `app_role` | `admin`, `premium`, `free`, `trial` | Referencia todos os 4 |
| Roles em uso (user_roles) | Apenas `admin` e `premium` | Mostra "Gratuito", "Trial" como opcoes |
| Planos ativos (subscription_plans) | Apenas "Premium" | Referencia "free", "trial" em filtros |
| Estrategia comercial | Sem plano gratuito, sem trial | Admin exibe cards de "Trial Users", dropdown com "Gratuito" |

## O que precisa mudar

### 1. Admin Panel - UsersManagement.tsx

**Dropdown de roles**: Remover opcao "Gratuito" (free). As opcoes devem ser apenas:
- **Premium** - usuario com assinatura ativa
- **Admin** - administrador do sistema

Um usuario sem assinatura nao tem role atribuida - ele simplesmente e redirecionado para a pagina de pagamento. Nao faz sentido "definir" alguem como "free" manualmente.

**Coluna Status**: Simplificar os badges:
- `admin` -> "Admin" (vermelho)
- `premium` -> "Premium" (verde)
- Sem role / sem assinatura -> "Sem assinatura" (cinza)

Remover badge e logica de "trial" e "free" como categorias visuais distintas.

### 2. Admin Panel - AdminStats.tsx

**Remover card "Usuarios Trial"** - nao existe trial.

**Renomear cards**:
- "Total de Usuarios" (manter)
- "Assinantes Premium" (manter, renomear se necessario)
- "Receita Mensal" (manter)
- Substituir card Trial por "Sem Assinatura" (usuarios sem role premium/admin)

**Distribuicao de Usuarios**: Remover linha "Trial", manter apenas:
- "Sem assinatura" (count)
- "Premium" (count)

### 3. Admin Panel - SubscriptionsManagement.tsx

Ja esta correto (filtra planos `free`). Apenas garantir que nao exiba referencia a trial.

### 4. Locales

Atualizar chaves `admin.*` nos 5 arquivos de locale:
- Remover/ajustar chaves `admin.trial`, `admin.trialUsers`, `admin.free`
- Renomear `admin.free` para algo como `admin.noSubscription` (ja existe)
- Remover `admin.trialActivated`, `admin.trialActivateError` etc.

### 5. Funcao handleActivateTrial

Remover a funcao `handleActivateTrial` do `UsersManagement.tsx` e o estado `activatingTrial` - trial nao existe mais.

## Arquivos a alterar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/admin/UsersManagement.tsx` | Remover opcao "free" do dropdown, remover trial, simplificar badges |
| `src/components/admin/AdminStats.tsx` | Remover card Trial, ajustar distribuicao |
| `src/locales/pt-BR.json` | Ajustar chaves admin |
| `src/locales/en-US.json` | Ajustar chaves admin |
| `src/locales/es-ES.json` | Ajustar chaves admin |
| `src/locales/pt-PT.json` | Ajustar chaves admin |
| `src/locales/it-IT.json` | Ajustar chaves admin |

## O que NAO sera alterado

- O enum `app_role` no banco (manter `free` e `trial` para compatibilidade, mas nao exibir na UI)
- A tabela `subscription_plans` (ja esta correta com apenas Premium)
- Edge functions e webhooks (ja protegem admin/master corretamente)
- Nenhuma nova dependencia

