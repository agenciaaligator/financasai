## Diagnóstico

Pela URL do screenshot (`?tab=agenda&connected=true`) a conexão funcionou no backend — o callback do Google rodou, salvou os tokens e redirecionou corretamente. O que falhou foi só o **feedback visual**:

1. Você não viu o toast "Agenda conectada!" porque ele só dispara quando o componente `AgendaPage` está montado (a aba Agenda já aberta). Como você caiu na aba **Início** (Dashboard), o `useEffect` que lê `?connected=true` nunca rodou.
2. A barra inferior do mobile não tem botão "Agenda" visível (ela mostra Início, Salário, Contas, Metas) — então a aba Agenda fica "escondida" no menu lateral, dificultando confirmar visualmente que conectou.
3. O aviso "app em desenvolvimento" do Google é porque o OAuth Consent Screen está em modo **Testing** no Google Cloud — precisa publicar.

## Plano

### 1. Mostrar feedback de conexão em qualquer aba (Frontend)

Mover a leitura de `?connected=true` / `?error=...` do `AgendaPage` para um lugar que sempre roda quando o usuário aterrissa após o OAuth — o `FinancialDashboard`. Assim:

- Quando voltar do Google com `connected=true`, o toast aparece **e** a aba muda automaticamente para "agenda".
- Quando voltar com erro, o toast aparece mesmo se o user estiver em outra aba.
- O `AgendaPage` mantém a lógica como fallback (caso alguém abra a aba diretamente com a URL).

### 2. Adicionar atalho visível para a aba Agenda no mobile

Hoje o usuário precisa abrir o menu lateral para chegar na aba Agenda. Adicionar um pequeno botão/badge "Google Agenda conectada ✅" no Dashboard (aba Início) quando a conexão está ativa, com link para a aba Agenda — assim a confirmação é visível mesmo sem trocar de aba.

### 3. Passo-a-passo Google Cloud (sem código)

Junto com o plano, te entrego instruções claras (chat, sem mexer em código) para:
- Publicar o OAuth Consent Screen (sair de Testing → In production)
- Confirmar escopos sensíveis
- O que esperar (verificação só é exigida se você usar escopos restritos; os de Calendar `events` + `readonly` são "sensíveis" e podem exigir verificação se passar de 100 usuários — abaixo disso roda em produção sem verificação formal)

### 4. (Opcional) Domínio canônico

O callback redireciona sempre para `donawilma.com.br` (variável `SITE_URL` da edge function). Como você usou `financasai.lovable.app` no teste, o redirect te jogou no domínio errado. Se quiser que o redirect respeite o domínio de origem, posso fazer o `google-calendar-auth` passar a origem real dentro do `state` e o callback usar essa origem no redirect (com whitelist de domínios para segurança). **Marque "Outros" se quiser incluir esse item.**

## Detalhes técnicos

- `src/components/FinancialDashboard.tsx`: adicionar `useEffect` que lê `searchParams.get('connected')` e `searchParams.get('error')`, dispara o toast apropriado, força `setCurrentTab('agenda')` quando `connected=true`, e limpa os params.
- `src/components/dashboard/AgendaPage.tsx`: remover (ou simplificar) o `useEffect` redundante para evitar toast duplo.
- `src/components/dashboard/DashboardContent.tsx` (aba dashboard): adicionar uma faixa pequena "Google Agenda: conectada — ver compromissos" usando o hook `useGoogleCalendar` que já existe.
- Sem mudanças de banco. Sem mudanças nas edge functions (o backend já está OK).

## Instruções Google Cloud (vou enviar no chat após implementar)

```text
1. https://console.cloud.google.com → seu projeto
2. APIs & Services → OAuth consent screen
3. Publishing status: clicar em "PUBLISH APP"
4. Confirmar no popup ("Push to production")
5. App fica "In production" — o aviso "app em desenvolvimento" some
6. Verificação Google só é exigida se >100 usuários novos/dia OU
   se você adicionar escopos restritos (Drive completo, Gmail, etc).
   Calendar events + readonly = sensíveis, mas não exigem verificação
   abaixo desse volume.
```
