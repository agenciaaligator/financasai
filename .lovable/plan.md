
# Correcao: Loop de Redirecionamento /set-password + UI do Telefone no /register

## Problemas Identificados

### Problema 1: Loop infinito no /set-password
**Causa raiz**: O perfil do admin (contato@aligator.com.br) tem `password_set = false` no banco, mesmo tendo senha definida. O fluxo e:
1. Usuario faz login com email/senha
2. `ProtectedDashboard` checa `useSubscriptionGuard` que ve `password_set = false`
3. Redireciona para `/set-password`
4. "Voltar ao Login" chama `navigate('/')` mas o usuario continua logado
5. Volta ao passo 2 = loop infinito

**Solucao (3 partes)**:

A) **Corrigir LoginForm**: Quando o usuario faz login com sucesso via senha, atualizar `password_set = true` automaticamente no profile. Se o usuario consegue fazer login com senha, ele ja TEM senha.

B) **Corrigir "Voltar ao Login" no ResetPassword**: Fazer logout (`supabase.auth.signOut()`) antes de navegar para `/`, quebrando o loop.

C) **Corrigir dado no banco**: Atualizar o profile existente do admin para `password_set = true` via migracao.

### Problema 2: Dropdown do telefone com overlay gigante
**Causa raiz**: O componente `PhoneInput` do `react-phone-number-input` usa um `<select>` nativo que, com os estilos atuais (opacity: 0, position: absolute), pode aparecer como um overlay branco grande em certos navegadores/temas escuros.

**Solucao**: Ajustar o CSS em `phone-input.css` para garantir que o `<select>` nativo tenha aparencia controlada e nao crie overlay visual.

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/auth/LoginForm.tsx` | Apos login com sucesso, atualizar `password_set = true` no profile |
| `src/pages/ResetPassword.tsx` | "Voltar ao Login" faz signOut antes de navegar |
| `src/components/ui/phone-input.css` | Corrigir z-index e aparencia do select nativo |
| Migracao SQL | Atualizar `password_set = true` para o admin existente |

---

## Detalhes Tecnicos

### LoginForm.tsx - Auto-correcao do password_set
```typescript
// Apos login com sucesso:
if (result && !result.error) {
  // Se logou com senha, garantir que password_set = true
  const { data: { user: loggedUser } } = await supabase.auth.getUser();
  if (loggedUser) {
    await supabase.from('profiles').update({ password_set: true }).eq('user_id', loggedUser.id);
  }
}
```

### ResetPassword.tsx - Botao "Voltar ao Login"
```typescript
<Button
  type="button"
  variant="ghost"
  onClick={async () => {
    await supabase.auth.signOut();
    navigate('/');
  }}
>
```

### phone-input.css - Correcao do overlay
Adicionar regras para limitar o tamanho visual do select e garantir que nao crie bloco branco visivel.

### Migracao SQL
```sql
UPDATE public.profiles 
SET password_set = true 
WHERE user_id = '2efec051-aa64-4f31-8c1b-c22ac51d7d7b';
```
