

# Ajustes para Publicacao - Dona Wilma

## 1. SEO e Meta Tags

Atualizar `index.html` com:
- Title: "Dona Wilma - Seu Assessor Pessoal de Financas e Compromissos"
- Description otimizada em portugues
- og:title, og:description, og:url, og:locale (pt_BR)
- Canonical URL apontando para financasai.lovable.app
- JSON-LD structured data basico (SoftwareApplication)
- Remover referencia a "Agente Financeiro" do title e meta tags

Criar `public/sitemap.xml` com as rotas publicas.

## 2. Textos da Landing Page

- **Secao de planos**: Remover o subtitulo "Comece gratuitamente e faca upgrade quando precisar" (nao ha plano gratuito). Trocar por algo como "Tudo que voce precisa em um unico plano".
- **FAQ**: Atualizar a pergunta "Existe um periodo de teste gratuito?" - remover mencao a "plano Gratuito sem limite de tempo". Substituir por informacao sobre o trial ou simplesmente remover a pergunta.
- **PlansSection**: Manter como esta (card unico Premium). Sem alteracoes.

## 3. Imagens da Landing Page

Substituir as 8 imagens em `public/images/landing/` por ilustracoes geradas por IA que representem visualmente cada topico:

| Topico | Arquivo | Descricao da ilustracao |
|--------|---------|------------------------|
| Financeiro | whatsapp-financeiro.png | Celular com conversa WhatsApp sobre financas, icones de dinheiro |
| Compromissos | whatsapp-compromissos.png | Calendario com notificacoes e celular mostrando lembretes |
| Registros | whatsapp-registros.png | Pessoa usando celular para falar com assistente IA |
| Painel | dashboard-painel.png | Tela com graficos, barras e relatorios financeiros |
| Compartilhamento | compartilhamento.png | Grupo de pessoas/familia conectadas compartilhando dados |
| Categorias | categorias.png | Pastas coloridas organizando itens por categoria |
| Lembretes | lembretes.png | Sino de notificacao com celular e mensagens de alerta |
| Google Calendar | google-calendar-integration.png | Dois calendarios sincronizando com setas de conexao |

As imagens serao geradas com estilo flat/moderno em tons que combinem com o tema do app.

## 4. Hero da Landing Page

Substituir o icone gigante de Calendar (48x48) no hero por uma ilustracao mais atrativa, como uma composicao visual mostrando celular + dashboard + WhatsApp.

## Detalhes Tecnicos

### Arquivos a modificar:
- `index.html` - Meta tags SEO, JSON-LD
- `src/pages/Index.tsx` - Subtitulo da secao de planos
- `src/components/FAQSection.tsx` - Remover/atualizar pergunta sobre plano gratuito
- `public/sitemap.xml` - Criar novo

### Arquivos de imagem a substituir (8 + 1 hero):
- Todas em `public/images/landing/`

### Nenhuma funcionalidade existente sera alterada
- Checkout, rotas, autenticacao e dashboard permanecem intactos
