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

### D-006 — Vercel conectada pelo usuário
- **Decisão:** a Vercel foi ligada ao repositório pelo painel, com as variáveis já configuradas. Não criar outro projeto nem rodar `vercel link`.

## Fase 2

### D-007 — Testes de banco sem Docker (PGlite)
- **Contexto:** Docker não está disponível na máquina, então `supabase start` não roda.
- **Decisão:** as migrations são aplicadas num Postgres real em WebAssembly (PGlite, Postgres 18) com um esboço mínimo dos esquemas `auth`, `storage` e `realtime`. Os testes rodam em `npm test` e no CI. Isso **não substitui** o teste no banco real, feito por `npm run test:rls` pela API pública.

### D-008 — Crédito do convidado desnormalizado em `guests`
- **Decisão:** `guests.church_id/group_id/member_id` guardam o crédito do primeiro cadastro, copiado do snapshot em `guest_referrals`. O cliente não pode alterar essas colunas (permissão por coluna); só RPCs auditadas.
- **Motivo:** políticas RLS simples e rápidas, sem `join` a cada linha.

### D-009 — Quem concede perfis
- **Decisão:** o Admin concede qualquer perfil. O Gestor de Igreja concede Gestor, Responsável de Grupo e Leitor **da própria igreja**; **não** concede Admin nem Recepção, porque a Recepção tem escopo em todas as igrejas.
- **Motivo:** menor privilégio; evita que um gestor amplie o próprio alcance.

### D-010 — Check-in também pelo Gestor de Igreja
- **Decisão:** Admin, Recepção e Gestor de Igreja operam o check-in. Na busca, o telefone aparece mascarado para todos.

### D-011 — Recepção e Leitor sem `select` direto em convidados
- **Decisão:** esses perfis não têm política de leitura em `guests`. A Recepção usa RPCs de check-in que já devolvem o telefone mascarado; o Leitor usa RPCs de números agregados.
- **Motivo:** a RLS é por linha e não mascara colunas; negar a tabela inteira é a forma segura.

### D-012 — Escritas sensíveis só por RPC
- **Decisão:** `attendances`, `guest_referrals`, `guest_consents`, `duplicate_reviews`, `goal_snapshots`, `member_group_history` e a inserção em `guests` não têm política de escrita para `authenticated`. São gravadas por funções `security definer` que validam o escopo.

### D-013 — Primeiro administrador
- **Decisão:** `public.bootstrap_polo_admin(email)` só pode ser executada pelo dono do banco (SQL Editor ou Supabase CLI), nunca pela API. O usuário é criado antes no painel do Auth. Assim nenhuma chave secreta passa pelo repositório.

### D-014 — Marcador de ambiente DEV
- **Decisão:** `app_settings.environment = 'dev'` é gravado apenas no projeto DEV (`npm run db:marcar-dev`, que confere o project ref). O seed de demonstração e o preparo dos testes de RLS abortam sem esse marcador, protegendo a produção.

### D-015 — Senha
- **Decisão:** mínimo de 8 caracteres com letras e números (validado no frontend e em `supabase/config.toml`).

### D-016 — Igreja nunca é excluída
- **Decisão:** não há política de delete em `churches`, e um gatilho impede a exclusão física mesmo pelo dono do banco.
