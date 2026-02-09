

# Regenerar 9 Imagens da Landing Page

As imagens geradas anteriormente nao foram substituidas corretamente ou ficaram genericas demais. Vou regera-las com prompts mais detalhados e humanizados, conectando cada imagem diretamente ao seu tema.

## Imagens a Gerar (9 total)

Todas serao geradas com o modelo de IA de imagens (Nano banana pro para maior qualidade) e salvas diretamente nos arquivos em `public/images/landing/`.

| # | Arquivo | Prompt detalhado |
|---|---------|-----------------|
| 1 | hero-illustration.png | Uma mulher sorridente usando o celular, com elementos visuais flutuando ao redor: graficos financeiros, icone do WhatsApp, calendario, notas de dinheiro. Estilo moderno e clean, cores vibrantes em tons de roxo e verde, fundo claro. Ilustracao digital realista. |
| 2 | whatsapp-financeiro.png | Maos segurando um celular com tela do WhatsApp aberta, mostrando uma conversa com mensagens como "gastei 50 no mercado". Icones de moedas e graficos ao redor. Estilo clean e moderno, pessoa real usando o app no dia a dia. |
| 3 | whatsapp-compromissos.png | Pessoa olhando para o celular com calendario e notificacoes na tela, relogio e lembretes visuais ao redor. Ambiente de escritorio aconchegante. Estilo fotografico moderno com elementos graficos sobrepostos. |
| 4 | whatsapp-registros.png | Pessoa sorridente sentada no sofa enviando mensagem de voz no celular, com icones de microfone e texto aparecendo na tela. Ambiente caseiro e confortavel. Estilo moderno e acolhedor. |
| 5 | dashboard-painel.png | Tela de computador/tablet mostrando um dashboard financeiro com graficos de barras coloridos, pizza charts e numeros. Mesa organizada com cafe ao lado. Estilo clean e profissional. |
| 6 | compartilhamento.png | Familia reunida (mae, pai, filha) cada um com celular, conectados por linhas visuais. Ambiente domestico acolhedor. Icones de compartilhamento e conexao. Estilo moderno e familiar. |
| 7 | categorias.png | Tela de celular mostrando lista de categorias coloridas (alimentacao, transporte, saude, lazer) com icones representativos. Organizacao visual clara e atrativa. Estilo flat design moderno. |
| 8 | lembretes.png | Pessoa recebendo notificacao no celular com icone de sino, expressao de "lembrei!", com calendario e relogio ao fundo. Momento de dia a dia. Estilo moderno e humanizado. |
| 9 | google-calendar-integration.png | Dois dispositivos lado a lado (celular com WhatsApp e tablet com Google Calendar) com setas de sincronizacao entre eles, mostrando os mesmos eventos. Estilo clean e tecnologico. |

## Detalhes Tecnicos

- Modelo: `google/gemini-3-pro-image-preview` (maior qualidade)
- Resolucao: 1024x1024 ou 1024x768 (landscape para melhor encaixe nos cards)
- Formato: PNG
- As imagens serao salvas diretamente nos caminhos existentes em `public/images/landing/`
- Nenhum codigo sera alterado, apenas os assets visuais

