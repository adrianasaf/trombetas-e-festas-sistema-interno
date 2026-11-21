# Registro de decisões

Decisões tomadas onde a especificação era omissa ou ambígua. Formato: contexto → decisão → motivo.

## Fase 1

### D-001 — Componentes shadcn/ui escritos no repositório
- **Contexto:** o `shadcn init` é interativo e muda de formato entre versões.
- **Decisão:** os componentes seguem o padrão shadcn/ui (Radix + `cva` + `cn`), versionados em `src/components/ui`, com `components.json` presente para usar `npx shadcn add` no futuro.
- **Motivo:** o shadcn/ui é, por definição, código copiado para o projeto; assim o resultado é reproduzível.

### D-002 — DDD padrão 83 na normalização de telefone
- **Contexto:** muitos usuários digitam o número sem DDD.
- **Decisão:** números com 8 ou 9 dígitos recebem o DDD 83 (Paraíba, onde ficam as 11 igrejas). Celular precisa começar com 9; fixo, com 2 a 5. Números inválidos são rejeitados com mensagem.
- **Motivo:** coerente com a região do Polo e evita duplicidades por formatos diferentes do mesmo número.

### D-003 — Versões da stack
- **Decisão:** React 19, Vite 7, TypeScript 5.9, Tailwind 4, Vitest 3, ESLint 9, Node 22 no CI.
- **Motivo:** versões estáveis e suportadas; Tailwind 4 dispensa `tailwind.config.js` (tema em CSS).

### D-004 — Cabeçalhos de segurança na Vercel
- **Decisão:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` restritiva em `vercel.json`.
- **Motivo:** menor superfície de ataque sem custo; o sistema não precisa ser embutido em outros sites.

### D-005 — Nomes de perfis no código
- **Decisão:** `polo_admin`, `church_manager`, `group_leader`, `reception`, `reader` (enum `app_role` no banco), com rótulos em português na interface.
