# Sistema de Gestão Trombetas e Festas

Igreja Cristã Maranata — Polo Torre. Especificação: [docs/PROMPT_MESTRE.md](docs/PROMPT_MESTRE.md).

Stack: React + TypeScript + Vite + Tailwind (frontend na Vercel) e Supabase (Postgres, Auth, Realtime,
Storage, Edge Functions). Regras do projeto: [CLAUDE.md](CLAUDE.md). Situação das fases:
[docs/PROGRESSO.md](docs/PROGRESSO.md). Testes executados: [docs/TESTES.md](docs/TESTES.md).
Decisões: [docs/DECISOES.md](docs/DECISOES.md).

---

## 1. Execução local

Pré-requisito: Node 22 ou mais recente.

```bash
npm install
cp .env.example .env.local   # preencha com os dados do projeto Supabase (seção 2)
npm run dev                  # http://localhost:5173
```

| Comando | O que faz |
|---|---|
| `npm run lint` / `npm run typecheck` / `npm run build` | Verificações do CI |
| `npm test` | Testes unitários e de banco (Postgres local em WebAssembly, sem Docker) |
| `npm run test:rls` | Testes de permissão **no banco real** (somente DEV) |
| `npm run test:carga` | Mede a busca do check-in (somente DEV) |
| `npm run seed:demo` / `npm run seed:demo -- --limpar` | Cria/remove dados fictícios (**somente DEV**) |
| `npm run db:types` | Regenera `src/lib/database.types.ts` |

### Variáveis de ambiente (`.env.example`)

| Variável | Onde obter |
|---|---|
| `VITE_SUPABASE_URL` | Supabase › Project Settings › API › Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase › Project Settings › API Keys › chave **anon/publishable** |
| `VITE_APP_ENV` | `dev` (mostra a faixa "AMBIENTE DE DEMONSTRAÇÃO") ou `prod` |

**Nunca** coloque a chave `service_role`/`secret` em variáveis `VITE_*`, no repositório ou no frontend.
Ela é usada só pela Edge Function, onde o próprio Supabase a injeta.

---

## 2. Configuração do Supabase

Use **dois projetos**: `dev` (aceita dados fictícios) e `prod` (nunca rodar seed fictício).
Para produção, prefira a região **South America (São Paulo)**: a latência cai bastante.

1. **Criar o projeto** no painel do Supabase e anotar a senha do banco.
2. **Vincular e aplicar as migrations** (cria tabelas, RLS, funções, as 11 igrejas e o bucket da logo):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push --remote
   ```
3. **Publicar a Edge Function de convite:**
   ```bash
   npx supabase functions deploy convidar-usuario --use-api
   ```
4. **Configurar o Auth.** Edite `site_url` e `additional_redirect_urls` em `supabase/config.toml` com o
   domínio do projeto e rode `npx supabase config push`. Isso também aplica: cadastro público desligado,
   senha mínima de 8 caracteres com letras e números, e confirmação de troca de senha. Ou, pelo painel,
   em Authentication:
   - **URL Configuration:** Site URL = endereço publicado; Redirect URLs = `https://SEU-DOMINIO/**`.
   - **Sign In / Providers › Email:** desligar "Allow new users to sign up".
5. **SMTP próprio (obrigatório para produção).** O SMTP padrão do Supabase só entrega para membros da
   equipe do projeto, então convites e recuperação de senha não chegam aos usuários. Em
   Authentication › Emails › SMTP Settings, informe host, porta, usuário e senha de um provedor
   (Brevo, Resend etc.) e um remetente com domínio verificado. Opcional: traduzir os modelos de e-mail
   (Convite e Redefinir senha) para português.
6. **Storage:** o bucket `logos` é criado pela migration (público, só leitura; upload apenas pelo Admin).
7. **Somente no DEV:** `npm run db:marcar-dev`. Esse marcador libera o seed de demonstração e os testes
   de permissão; sem ele, os dois se recusam a rodar.

### Plano do Supabase

O plano Free comporta o volume (~3.000 convidados), mas **pausa após 7 dias sem uso** e não tem backup
automático. Use o plano **Pro** durante a campanha e o evento, **ou** mantenha o Free com backup manual
(`npx supabase db dump --remote -f backup.sql`) e confirme que o projeto está ativo antes do evento.
A proteção contra senhas vazadas (Auth) também exige o plano Pro.

---

## 3. Primeiro Administrador do Polo

1. Supabase › Authentication › Users › **Add user** › *Send invitation* (ou *Create new user* com
   *Auto Confirm User*) com o e-mail da pessoa.
2. Com o projeto vinculado (seção 2), rode:
   ```bash
   npm run admin:criar -- pessoa@exemplo.com
   ```
   A função só pode ser executada pelo dono do banco, nunca pela API pública.
3. A pessoa entra em `/login`. Os demais usuários são convidados pela tela **Usuários e permissões**.

Depois, em **Configurações**, o Admin cria a edição do evento, define as metas e a data de corte e a
marca como **Ativa**. O cadastro de convidados e o check-in dependem de uma edição ativa.

---

## 4. Publicação na Vercel

O repositório já está ligado a um projeto na Vercel: cada push na `main` publica.

1. Em Settings › Environment Variables, defina `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e
   `VITE_APP_ENV` (`prod` no projeto de produção).
2. Domínio próprio: Settings › Domains. Depois, inclua o domínio no Site URL e nas Redirect URLs do
   Supabase (seção 2, passo 4).
3. `vercel.json` já traz o redirecionamento da SPA e os cabeçalhos de segurança (CSP, HSTS e outros).

---

## 5. Funcionalidades

**Implementadas e testadas** (detalhes e resultados em [docs/TESTES.md](docs/TESTES.md)): login,
recuperação/redefinição de senha e aceite de convite; 5 perfis com RLS em todas as tabelas; igrejas,
grupos, membros e transferências com histórico; convidados com consentimento (responsável legal para
menores), detecção e mescla de duplicidades com crédito do primeiro cadastro; motor de metas com data de
corte e snapshot automático; check-in atômico, cadastro na chegada, desmarcação auditada, online
separado, fila offline e tempo real; dashboards do Polo, da igreja e do grupo; transporte; relatórios com
CSV, impressão e PDF; auditoria; seed de demonstração; teste de carga.

**Pendentes:** testes E2E com Playwright (escritos em `e2e/`, não executados); validação da
anonimização LGPD no DEV; verificação visual das telas logadas em 360 px/tablet/desktop; envio real de
e-mails (depende de SMTP próprio); modo offline completo da busca (fora do escopo desta versão).
