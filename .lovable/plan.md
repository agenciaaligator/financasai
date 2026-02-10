

# Suporte a idioma via URL para campanhas de marketing

## O que sera feito

Configurar o `i18next-browser-languagedetector` para reconhecer o parametro `lang` na URL, permitindo links como:

- `https://financasai.lovable.app/?lang=en-US` (ingles)
- `https://financasai.lovable.app/?lang=es-ES` (espanhol)
- `https://financasai.lovable.app/?lang=it-IT` (italiano)

## Como funciona

O detector de idioma do i18next suporta multiplas fontes de deteccao com ordem de prioridade. Basta configurar `querystring` como primeira opcao, e o parametro da URL tera prioridade sobre o idioma salvo no navegador.

## Alteracao

**Arquivo:** `src/i18n.ts`

Adicionar a configuracao `detection` no `init()` do i18n com:

- `order`: define a prioridade -- querystring primeiro, depois localStorage, depois navegador
- `lookupQuerystring`: define o nome do parametro na URL (sera `lang`)
- `caches`: manter localStorage para persistir a escolha do usuario

## Exemplos de uso em campanhas

| Publico        | URL                                            |
|----------------|------------------------------------------------|
| EUA/UK         | `financasai.lovable.app/?lang=en-US`           |
| Espanha/Latam  | `financasai.lovable.app/?lang=es-ES`           |
| Italia         | `financasai.lovable.app/?lang=it-IT`           |
| Portugal       | `financasai.lovable.app/?lang=pt-PT`           |
| Brasil         | `financasai.lovable.app/` (default)            |

## Detalhes tecnicos

A unica mudanca e adicionar o objeto `detection` na configuracao do i18n:

```text
detection: {
  order: ['querystring', 'localStorage', 'navigator'],
  lookupQuerystring: 'lang',
  caches: ['localStorage'],
}
```

Nenhum outro arquivo precisa ser alterado. O componente `LanguageFlagSelector` continuara funcionando normalmente -- se o usuario trocar o idioma manualmente, isso sera salvo no localStorage e prevalecera nas proximas visitas.

