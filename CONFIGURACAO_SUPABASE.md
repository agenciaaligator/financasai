# 🔧 Configurações Necessárias no Supabase Dashboard

## ⚠️ IMPORTANTE: Configure estas opções no painel do Supabase para os emails funcionarem corretamente

### 📧 **1. Configurar Webhook para Emails Customizados**

1. **Acesse o Supabase Dashboard:**
   - Vá para: https://supabase.com/dashboard/project/fsamlnlabdjoqpiuhgex

2. **Navegue para Configurações de Email:**
   - Clique em `Authentication` no menu lateral
   - Clique na aba `Email Templates`

3. **Configure Custom SMTP/Webhook:**
   - Marque a opção `Enable custom SMTP`
   - **Webhook URL:** `https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/custom-auth-emails`
   - Ative para os tipos: `Signup` e `Recovery`

---

### 🌐 **2. Configurar URLs de Redirecionamento (CRÍTICO)**

1. **Acesse Authentication Settings:**
   - Vá para: `Authentication` > `URL Configuration`

2. **Site URL:**
   ```
   https://donawilma.lovable.app
   ```

3. **Redirect URLs (ADICIONAR TODAS):**
   ```
   https://donawilma.lovable.app/**
   https://donawilma.lovable.app/auth/callback
   https://donawilma.lovable.app/set-password
   ```

**⚠️ CONFIGURAÇÃO ESSENCIAL:**
- Sem estas URLs configuradas, o reset de senha não funcionará
- O Supabase precisa saber para onde direcionar após verificação
- A URL `/reset-password` é fundamental para o fluxo funcionar

---

### ✅ **3. Testar as Configurações**

Após configurar, teste:

1. **Teste de Cadastro:**
   - Crie uma nova conta
   - Verifique se o email chega em português
   - Clique no link e confirme se direciona corretamente

2. **Teste de Recuperação:**
   - Use "Esqueci minha senha"
   - Verifique se o email chega em português
   - Clique no link e confirme se abre a tela de reset

---

### 🎯 **Resultado Esperado**

✅ Emails em português com design personalizado
✅ Links funcionando corretamente
✅ Redirecionamentos para `donawilma.lovable.app`
✅ Menu mobile funcionando sem tela branca

---

### 🚨 **Solução de Problemas**

**Se os emails ainda estão em inglês:**
- Verifique se o webhook está configurado corretamente
- Confirme se a URL do webhook está correta
- Verifique se a edge function `custom-auth-emails` está ativa

**Se os links não funcionam:**
- Confirme as URLs de redirecionamento
- Verifique se o Site URL está correto
- Teste com uma nova conta para confirmar

**Se o menu mobile vai para tela branca:**
- O problema foi corrigido no código
- Recarregue a página para aplicar as alterações