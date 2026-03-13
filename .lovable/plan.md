

## Criar Seção de Contato Dedicada

### Problema
Atualmente, clicar em "Contato" no header/footer scrolla até o footer (`id="contato"`), o que é estranho e pouco profissional.

### Solução
Criar uma seção de contato dedicada acima do footer com cards bonitos para WhatsApp e Email.

### Mudanças em `src/pages/Index.tsx`

1. **Nova seção `id="contato"`** entre o FAQ e o Footer:
   - Background `bg-muted/30` para diferenciar
   - Título centralizado com `section-line` (padrão das outras seções)
   - Dois cards glass (`glass-card`) lado a lado em grid `md:grid-cols-2`:
     - **Card WhatsApp**: ícone verde do WhatsApp, número do agente, botão "Conversar no WhatsApp" que abre `https://wa.me/NUMERO`
     - **Card Email**: ícone de email, endereço `contato@donawilma.com.br`, botão "Enviar Email" que abre `mailto:`
   - Cada card com hover elevado, ícone grande centralizado, texto descritivo

2. **Footer**: remover `id="contato"` do `<footer>` (fica só como footer sem âncora)

3. **Traduções**: Adicionar chaves em `pt-BR.json` (e nos outros locales) para título, subtítulo e labels dos cards de contato

### Mudanças nos locales (`pt-BR.json`, `en-US.json`, `es-ES.json`, `it-IT.json`, `pt-PT.json`)
Adicionar:
```json
"contactSection": {
  "title": "Entre em contato",
  "subtitle": "Tire suas dúvidas ou fale com a gente",
  "whatsappTitle": "WhatsApp",
  "whatsappDesc": "Fale diretamente com a Dona Wilma",
  "whatsappButton": "Conversar no WhatsApp",
  "emailTitle": "E-mail",
  "emailDesc": "Envie sua mensagem",
  "emailButton": "Enviar E-mail"
}
```

### Páginas legais (`Terms.tsx`, `Privacy.tsx`)
Atualizar os links de "Contato" no header/footer para apontar para `/#contato` (já devem estar assim).

