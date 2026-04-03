

## Trocar Avatar: Desenho → Foto Real da Dona Wilma

### O que será feito

1. **Renomear** o avatar atual (desenho) para `dona-wilma-avatar-desenho.jpg` como backup
2. **Copiar** a foto uploaded (`dona_wilma_influencer_800x1200-2.jpg`) para `src/assets/dona-wilma-avatar.jpg`
3. O import em `DashboardContent.tsx` não precisa mudar — continua apontando para `dona-wilma-avatar.jpg`
4. O `object-cover object-top` já aplicado no `AvatarImage` vai enquadrar o rosto corretamente

### Arquivo afetado

- `src/assets/dona-wilma-avatar-desenho.jpg` — backup do avatar antigo (renomear)
- `src/assets/dona-wilma-avatar.jpg` — substituir pela foto real uploaded

Nenhuma mudança de código necessária — apenas troca de asset.

