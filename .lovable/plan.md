

# Correcao: WhatsApp validado mas frontend mostra erro

## Causa raiz

A edge function `validate-code` ja cria a sessao no `whatsapp_sessions` com sucesso (confirmado nos logs). Porem, o frontend em `Welcome.tsx` (linhas 165-174) tenta fazer um `upsert` redundante na mesma tabela com `onConflict: 'user_id'`. Como nao existe constraint UNIQUE na coluna `user_id` da tabela `whatsapp_sessions`, o Postgres rejeita o upsert. O erro cai no bloco `catch` (linha 188) que exibe "codigo invalido ou expirado" — mensagem completamente errada, ja que o codigo foi validado com sucesso.

## Correcao

### Arquivo: `src/pages/Welcome.tsx` (linhas 152-197)

Remover o `upsert` redundante em `whatsapp_sessions` (a edge function ja fez isso). Manter apenas o `update` no `profiles` para salvar o telefone. Separar os erros para que falhas no update do perfil nao mostrem "codigo invalido".

Codigo corrigido do `handleVerifyCode`:

```typescript
const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 4) {
      toast({
        title: t('welcome.invalidCode'),
        description: t('welcome.invalidCodeDesc'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: {
          action: 'validate-code',
          phone_number: phoneNumber,
          code: verificationCode,
          userId: user?.id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Codigo invalido ou expirado');

      // Sessao ja foi criada pela edge function - NAO fazer upsert aqui

      // Atualizar telefone no perfil (nao-bloqueante)
      supabase
        .from('profiles')
        .update({ phone_number: phoneNumber })
        .eq('user_id', user?.id)
        .then(({ error: profileError }) => {
          if (profileError) console.warn('[Welcome] Profile update error:', profileError);
        });

      toast({
        title: t('welcome.connectedSuccess'),
        description: t('welcome.connectedSuccessDesc'),
      });
      sessionStorage.removeItem('onboarding_completed');
      sessionStorage.removeItem('redirected_to_welcome');
      setStep('connected');
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: t('welcome.invalidCode'),
        description: error instanceof Error ? error.message : t('welcome.invalidCodeDesc'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
```

## Resumo da alteracao

| Arquivo | O que muda |
|---------|-----------|
| `src/pages/Welcome.tsx` | Remover upsert redundante em whatsapp_sessions (linhas 165-174). Converter update de profiles em operacao nao-bloqueante |

## Resultado esperado

1. Usuario digita codigo -> edge function valida e cria sessao
2. Frontend recebe sucesso -> atualiza perfil em background -> mostra "Conectado!"
3. Botao "Ir para o Dashboard" fica habilitado
4. Sem erro, sem mensagem errada
