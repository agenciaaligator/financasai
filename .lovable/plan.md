

# Adicionar seletor de idiomas na Landing Page

## O que sera feito

Adicionar o componente `LanguageSelector` (ja existente em `src/components/LanguageSelector.tsx`) no header da landing page, ao lado dos botoes de navegacao.

## Alteracao

**Arquivo:** `src/pages/Index.tsx`

- Importar `LanguageSelector`
- Adicionar o componente no header, entre os links de navegacao e o botao "Entrar":
  - No desktop: visivel ao lado dos links
  - No mobile (Sheet menu): visivel dentro do menu lateral
- Nenhum componente novo sera criado

## Detalhes tecnicos

No `<nav>` do header, inserir `<LanguageSelector />` em dois pontos:
1. Na area desktop (`hidden md:flex`), antes do botao "Entrar"
2. Dentro do `<SheetContent>` do menu mobile, antes do botao "Entrar"

