

## Problema: Logo duplicado na tela de login (modal da landing)

Quando o usuário clica em "Entrar" na landing page, o `Index.tsx` abre um modal que renderiza `<LoginForm />`. O `LoginForm` contém seu próprio logo dentro do `CardHeader`. Como o modal da landing NÃO adiciona logo externo (diferente de `Login.tsx` que tem logo + subtítulo acima do form), o resultado visual é correto — **um único logo aparece**.

Porém, na página `/login` dedicada, o `Login.tsx` renderiza um logo (`h-12`) + subtítulo ACIMA do `<LoginForm />`, que por sua vez tem OUTRO logo (`h-10`) dentro do card. Isso causa **duplicação**.

### Correção

Remover o logo de dentro do `LoginForm.tsx` (linhas 71-73) e mantê-lo apenas nos wrappers (`Login.tsx` e `Index.tsx` modal). No modal da `Index.tsx`, adicionar o logo acima do `<LoginForm />`.

| Arquivo | Mudança |
|---------|---------|
| `src/components/auth/LoginForm.tsx` | Remover `<img src="/images/logo.png" ... />` do CardHeader (L71-73) |
| `src/pages/Index.tsx` | Adicionar logo acima do `<LoginForm />` dentro do modal (L133) |
| `src/pages/Login.tsx` | Já tem logo — nenhuma mudança necessária |

