# Aplicar o nome aprovado sem gastar alteração mensal

Confirmado: o nome **"Dona Wilma by Aligator"** já foi aprovado pela Meta, mas ainda não foi **aplicado** ao número. A aplicação acontece em outra tela — não no botão "Editar" do campo "Nome de exibição". Fazer isso pela aba certa **não conta** como uma das 3 alterações mensais; ela já foi consumida quando você submeteu o nome para aprovação.

Nenhuma mudança no código Lovable/Supabase é necessária. Todo o procedimento é no painel da Meta.

## Passo a passo

1. **Não clique em "Editar"** no campo "Nome de exibição" — cada clique+submissão consome 1 das 3 alterações mensais, mesmo cancelando depois.

2. Abra a aba **"Verificação em duas etapas"** (topo da tela do número, ao lado de "Links da mensagem").

3. Nessa aba você verá o aviso mencionando o novo nome aprovado, junto com o formulário de **PIN de 6 dígitos**. É onde o número é **re-registrado na Cloud API** — esse registro é o que efetivamente aplica o nome novo ao número em produção.

4. Preencha:
   - **PIN**: o de 6 dígitos que você guardou.
   - Se pedir confirmar PIN, repita o mesmo valor.
   - Se aparecer opção "Ativar autenticação de dois fatores" e já estava ativada, mantenha ativada.

5. Clique em **Registrar** / **Confirmar** / **Salvar** (o rótulo varia por idioma da conta).

6. Aguarde ~30 segundos e volte na aba **Perfil**. O campo "Nome de exibição" deve passar a mostrar **"Dona Wilma by Aligator"** com selo "Aprovado". O banner verde do topo pode ser dispensado no X depois disso.

## Se der erro

- **"PIN incorreto"**: NÃO tente adivinhar. Cada erro conta e após 3 erros a Meta bloqueia re-registro por várias horas. Melhor: na própria aba "Verificação em duas etapas" existe "Redefinir PIN" — defina um novo, guarde, e use o novo no passo 4.
- **"Número já registrado"**: significa que já está aplicado; volte na aba Perfil e recarregue a página (F5).
- **"Nome não aprovado"**: raro, mas se aparecer, é sincronização da Meta — aguarde 5–10 min e tente de novo.

## Validação final

Depois que o campo "Nome de exibição" mostrar "Dona Wilma by Aligator":

- Peça para alguém (ou você de outro celular) enviar "oi" para o número — a resposta deve chegar normalmente (sem mudança no código, o token e o `PHONE_NUMBER_ID` continuam os mesmos).
- Nos próximos envios de template/mensagens da Dona Wilma, o cabeçalho da conversa passará a mostrar o novo nome nos aparelhos dos usuários (pode levar até 24h para propagar em conversas antigas já abertas).

## O que **não** fazer

- Não clicar em "Editar" no Nome de exibição (gastaria 1 das 2 alterações restantes).
- Não trocar o token do WhatsApp no Supabase — o token e o `PHONE_NUMBER_ID` não mudam com a troca de nome de exibição.
- Não mexer no webhook nem em nada do código deste projeto — nada aqui precisa ser tocado.

Me avise depois de aplicar se o campo "Nome de exibição" atualizou para "Dona Wilma by Aligator" ou se apareceu algum erro, que eu te oriento no próximo passo.
