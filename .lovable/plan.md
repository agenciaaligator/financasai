

# Seletor de idiomas com bandeirinhas -- padronizado nos headers

## O que sera feito

Criar um novo componente `LanguageFlagSelector` com visual de bandeira + codigo do pais + seta (como na imagem de referencia), e usa-lo **somente nos headers** de todo o site.

## Design do componente

O seletor tera o estilo da imagem: um botao compacto mostrando a bandeira do idioma ativo + sigla (ex: "BR", "PT", "EN", "ES", "IT") + seta para cima/baixo. Ao clicar, abre um popover/dropdown com as 5 opcoes, cada uma com bandeira + nome. O idioma default e pt-BR (bandeira do Brasil).

As bandeiras serao emoji flags (sem necessidade de imagens externas).

## Alteracoes

### 1. Novo componente: `src/components/LanguageFlagSelector.tsx`

- Botao com: emoji flag do idioma ativo + sigla + icone ChevronDown
- Popover com lista das 5 opcoes (bandeira + nome completo)
- Ao selecionar, chama `i18n.changeLanguage(code)` e salva no localStorage
- Visual compacto, fundo sutil, borda arredondada

### 2. Atualizar `src/pages/Index.tsx` (Landing Page)

- Substituir `LanguageSelector` por `LanguageFlagSelector` nos dois pontos (desktop e mobile)

### 3. Atualizar `src/components/dashboard/DashboardHeader.tsx`

- Substituir `LanguageSelector` por `LanguageFlagSelector` nos dois modos (minimal e full)

### 4. Atualizar `src/components/admin/AdminPanel.tsx`

- Adicionar `LanguageFlagSelector` no header do painel admin, ao lado do titulo

### 5. Remover de `src/components/ProfileSettings.tsx`

- Remover o card "Idioma" inteiro (Card com Globe + LanguageSelector)
- Remover import de `LanguageSelector` e `Globe`

## O que NAO muda

- O componente original `LanguageSelector` continua existindo no codigo (pode ser removido futuramente)
- Nenhuma logica de i18n muda
- Nenhum locale file muda

