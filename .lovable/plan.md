
## Relatório de Auditoria UX/Usabilidade - Dona Wilma

### Metodologia
Revisão completa do código-fonte cobrindo todos os 8 fluxos do checklist. Análise estática de lógica, segurança, acessibilidade, responsividade e consistência de UX.

---

### FLUXO 1: LANDING PAGE → REGISTRO

**Problemas encontrados:**

1. **[MÉDIO] LoginForm hardcoded em português** - `LoginForm.tsx` tem textos como "Entrar", "Esqueci minha senha", "Email ou senha incorretos", "Ainda não tem uma conta?" sem usar o sistema i18n (`t()`). Inconsistente com o resto da app que usa tradução.
   - Linhas afetadas: 77-79, 94, 130-131, 137-138, 145-146, 155, 164-165, 183, 185, 191-192, 200
   - **Impacto**: Usuários de outros idiomas veem metade da interface traduzida e metade em português

2. **[BAIXO] Social proof estático** - Hero mostra "+500 usuários ativos" hardcoded (Index.tsx L186). Não é dinâmico.

3. **[MÉDIO] Login modal no mobile** - O botão "Login" no nav está `hidden sm:flex` (L90), mas no mobile menu lateral (Sheet) o botão "Entrar" existe. Funciona, mas a UX é confusa — o botão desktop some mas reaparece no drawer.

4. **[BAIXO] Animated background performance** - O `animated-bg` é `position: fixed` com CSS animation. Em dispositivos fracos pode causar jank durante scroll. Sem `will-change` ou `transform: translateZ(0)` para GPU acceleration.

---

### FLUXO 2: REGISTRO → PAGAMENTO

**Problemas encontrados:**

5. **[CRÍTICO] `getCurrencyFromLocale` não reconhece variantes** - Se `i18n.language` retornar apenas "pt" (sem o sufixo "-BR"), `getCurrencyFromLocale` cai no fallback "BRL". Para "en" sem "-US", cai em BRL também. O i18next `languageDetector` pode retornar formatos curtos.
   - **Impacto**: Usuário inglês pode ver preços em BRL e ser cobrado na moeda errada

6. **[MÉDIO] Register.tsx não valida formato de email robusto** - Apenas `type="email"` do HTML5, sem validação Zod como existe em `validations.ts`. O `profileSchema` existe mas não é usado no registro.

7. **[BAIXO] Phone input no Register vs Welcome inconsistente** - Register usa `PhoneInput` (react-phone-number-input) com formato internacional. Welcome usa `<Input type="tel">` com `onChange` que remove não-dígitos. Formatos incompatíveis podem causar problemas na validação do WhatsApp.

---

### FLUXO 3: EMAIL → VERIFICAÇÃO → LOGIN

**Problemas encontrados:**

8. **[MÉDIO] AuthCallback não trata `trialing` como acesso ativo corretamente** - L33 faz `in('status', ['active', 'trialing'])` mas o projeto declaradamente não tem trial/free tier. Se um usuário chega no callback sem subscription (ex: pagamento pendente), é redirecionado para `/choose-plan` — correto, mas sem mensagem explicativa.

9. **[BAIXO] Email confirmation banner efêmero** - `came_from_email_confirmation` no sessionStorage é lido e removido imediatamente no LoginForm useEffect. Se o usuário recarregar a página antes de ver, perde o feedback.

---

### FLUXO 4: BOAS-VINDAS → WHATSAPP

**Problemas encontrados:**

10. **[ALTO] Welcome.tsx — títulos hardcoded em português** - L271 "Parabéns, {name}!", L274 "Sua conta Dona Wilma está quase pronta", L288 "Conecte seu WhatsApp", L291 "É aqui que a mágica acontece!", L407 "💡 Como usar no WhatsApp", L413-414 "Despesas" / "Gastei 50 no mercado" — todos sem `t()`.
    - **Impacto**: Onboarding completamente em português para usuários de outros idiomas

11. **[MÉDIO] Phone validation fraca no Welcome** - L62 valida apenas `phoneNumber.length < 10`. Não valida formato brasileiro (DDD + 9 dígitos) nem formato internacional. Um número com 10 dígitos aleatórios passa.

12. **[BAIXO] Resend code não implementado** - Na etapa `code`, há botão "Voltar" mas não "Reenviar código". Usuário precisa voltar ao step anterior e re-submeter o número.

---

### FLUXO 5: DASHBOARD → FUNCIONALIDADES

**Problemas encontrados:**

13. **[MÉDIO] Navigate dentro de render sem useEffect** - `ProtectedDashboard` (Index.tsx L436-438) chama `navigate('/set-password')` diretamente no corpo do render. React deveria fazer isso dentro de um useEffect ou retornar `<Navigate>`. Pode causar warnings em React strict mode.

14. **[BAIXO] Dashboard scroll-to-top em cada tab** - `FinancialDashboard.tsx` L46-48 faz `window.scrollTo` em todo `currentTab` change, inclusive na carga inicial. Comportamento correto mas pode ser jarring em mobile se o usuário voltou de uma tab com scroll.

---

### FLUXO 6: WHATSAPP → PROCESSAMENTO

15. **[INFO] Edge functions adequadas** - `whatsapp-agent` e `whatsapp-webhook` existem e tratam text/audio/image. Não é possível testar processamento real via code review estático.

---

### FLUXO 7: EDGE CASES E ERROS

**Problemas encontrados:**

16. **[ALTO] `useSubscriptionGuard` - erro silencioso** - L133-136: Se o `check()` async falha com exceção, o estado fica com `loading: false` mas `canAccessDashboard` permanece `false` (default). Usuário com subscription ativa mas erro de rede temporário é bloqueado sem mensagem de erro.
    - **Impacto**: Falso bloqueio de acesso

17. **[MÉDIO] Logout limpa sessionStorage ANTES de signOut** - `useAuth.ts` L160-161: `localStorage.clear()` e `sessionStorage.clear()` são chamados ANTES de `supabase.auth.signOut()`. Se o signOut falhar, o token foi destruído localmente mas pode estar válido no servidor. Depois na L194, `sessionStorage.setItem('force_logout')` é chamado — mas o sessionStorage acabou de ser limpo e será destruído novamente.

18. **[BAIXO] `dangerouslySetInnerHTML` em chart.tsx** - Usado apenas para CSS theme injection (não user content). Seguro, mas deveria usar `<style>` component ou CSS modules.

19. **[MÉDIO] `trialing` no `useSubscriptionGuard`** - L95 não trata `status === 'trialing'`. Se por algum motivo um usuário tiver status trialing, `subscriptionStatus` fica `inactive` e é bloqueado.

---

### FLUXO 8: CONFIGURAÇÕES E CONTA

20. **[BAIXO] ProfileSettings complexo** - 923 linhas em um único componente. Dificulta manutenção mas não é bug de UX.

---

### SEGURANÇA

21. **[OK] Admin via server-side** - `useUserRole` usa `supabase.rpc('get_user_role')` (SECURITY DEFINER function). Não usa localStorage/sessionStorage para admin check. Correto.

22. **[OK] RLS adequado** - `has_role` function é SECURITY DEFINER com `search_path = public`. Seguro.

23. **[OK] Sem XSS** - Nenhum `dangerouslySetInnerHTML` com user content. React escapa por padrão.

24. **[OK] Inputs validados** - `validations.ts` tem schemas Zod para transações, categorias e perfil com regex e limites.

---

### ACESSIBILIDADE

25. **[MÉDIO] Labels hardcoded** - LoginForm labels ("Email", "Senha") não usam i18n.

26. **[BAIXO] Contrast na landing** - Textos `text-white/50` e `text-white/40` no PlansSection dark background podem não atingir ratio 4.5:1 WCAG AA.

27. **[BAIXO] Keyboard navigation** - Landing page nav links usam `<a href="#section">` (correto) mas o login modal não tem `role="dialog"` explícito (shadcn Dialog usa Radix que tem, mas o custom modal no Index.tsx L121-138 é um div manual sem aria).

---

### RESUMO PRIORITIZADO

| # | Severidade | Problema | Arquivo |
|---|-----------|----------|---------|
| 5 | CRÍTICO | Locale currency fallback pode cobrar moeda errada | `pricing.ts` |
| 16 | ALTO | Subscription guard falha silenciosa bloqueia acesso | `useSubscriptionGuard.ts` |
| 10 | ALTO | Welcome.tsx hardcoded em português (onboarding) | `Welcome.tsx` |
| 1 | MÉDIO | LoginForm hardcoded em português | `LoginForm.tsx` |
| 13 | MÉDIO | navigate() no render body | `Index.tsx` |
| 19 | MÉDIO | trialing não tratado no guard | `useSubscriptionGuard.ts` |
| 11 | MÉDIO | Validação de telefone fraca no Welcome | `Welcome.tsx` |
| 6 | MÉDIO | Sem validação Zod no Register | `Register.tsx` |
| 17 | MÉDIO | Logout limpa storage antes do signOut | `useAuth.ts` |
| 7 | BAIXO | Phone input inconsistente Register vs Welcome | Multiple |
| 12 | BAIXO | Sem opção reenviar código WhatsApp | `Welcome.tsx` |
| 27 | BAIXO | Login modal sem aria-modal | `Index.tsx` |

---

### PLANO DE CORREÇÃO

**Batch 1 — Crítico/Alto (deploy blocker):**
1. **Fix `getCurrencyFromLocale`**: Normalizar locale antes do lookup (ex: "pt" → "pt-BR", "en" → "en-US")
2. **Fix `useSubscriptionGuard` error handling**: No catch, manter `loading: true` ou mostrar retry UI em vez de bloquear silenciosamente
3. **i18n Welcome.tsx**: Mover todos os textos hardcoded para os arquivos de tradução

**Batch 2 — Médio:**
4. **i18n LoginForm.tsx**: Substituir strings hardcoded por `t()` calls
5. **Fix navigate no render**: Converter `ProtectedDashboard` para usar `<Navigate>` ou useEffect
6. **Adicionar `trialing` ao guard**: Tratar como `active`
7. **Validação telefone Welcome**: Usar regex mais robusta ou react-phone-number-input
8. **Reordenar logout**: Chamar signOut primeiro, depois limpar storage

**Batch 3 — Baixo:**
9. Adicionar botão "Reenviar código" no Welcome
10. Fix acessibilidade do login modal (aria-modal, role)
11. Verificar contrast ratios no PlansSection
12. Adicionar `will-change: transform` ao animated-bg
