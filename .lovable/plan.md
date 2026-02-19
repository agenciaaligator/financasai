

# Correcao: Erro de telefone duplicado no cadastro

## Causa raiz

O trigger `handle_new_user_simple()` insere o `phone_number` no perfil do novo usuario. A tabela `profiles` tem uma constraint `UNIQUE` na coluna `phone_number`. Quando alguem tenta se cadastrar com um numero que ja existe em outra conta, o Supabase retorna erro 500 ("Database error saving new user"), e o frontend exibe a mensagem generica "Nao foi possivel completar a acao".

Erro exato nos logs:
```
duplicate key value violates unique constraint "profiles_phone_number_key" (SQLSTATE 23505)
```

## Solucao (2 alteracoes)

### 1. Register.tsx - Detectar erro de telefone duplicado

Adicionar tratamento especifico no bloco `catch` para identificar quando o erro e causado por `phone_number` duplicado e exibir uma mensagem clara ao usuario:

- Verificar se a mensagem de erro contem "profiles_phone_number_key" ou "phone_number"
- Exibir toast: "Este numero de WhatsApp ja esta vinculado a outra conta"
- Permitir que o usuario corrija o numero ou deixe em branco

### 2. Trigger handle_new_user_simple() - Tratar phone duplicado com graciosidade

Alterar o trigger no banco de dados para que, em caso de `phone_number` duplicado, o perfil seja criado SEM o numero de telefone ao inves de falhar completamente. O usuario podera adicionar o numero depois pelo painel.

Alteracao no SQL do trigger:
- Tentar inserir com phone_number
- Se falhar por constraint de unicidade, inserir novamente sem o phone_number
- Isso evita que o signup inteiro falhe por causa de um campo opcional

### Resumo dos arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Register.tsx` | Adicionar deteccao de erro de telefone duplicado no catch com mensagem especifica |
| Migration SQL | Alterar trigger `handle_new_user_simple` para lidar com phone_number duplicado sem falhar |

### Traducoes necessarias

Adicionar nos 5 arquivos de locale (`pt-BR.json`, `pt-PT.json`, `en-US.json`, `es-ES.json`, `it-IT.json`):
- `register.phoneDuplicate`: titulo do erro
- `register.phoneDuplicateDesc`: descricao do erro

### Resultado esperado

- Se o numero ja existir: o usuario ve uma mensagem clara pedindo para usar outro numero ou deixar em branco
- O trigger do banco nunca mais falha por telefone duplicado (cria o perfil sem o numero)
- O signup continua funcionando normalmente para todos os outros cenarios

