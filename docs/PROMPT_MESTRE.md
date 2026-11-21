# PROMPT MESTRE v2 — SISTEMA DE GESTÃO TROMBETAS E FESTAS
### Igreja Cristã Maranata — Polo Torre

Atue como engenheiro de software sênior, arquiteto de sistemas, especialista em UX/UI, PostgreSQL, segurança e desenvolvimento full-stack.

Sua missão é **projetar, programar, testar e deixar pronto para implantação** um sistema web real (frontend + backend + banco + autenticação + permissões + CRUD + cálculos automáticos + tempo real). Não entregue protótipo, layout estático nem dados simulados apresentados como funcionalidade pronta.

Trabalhe no repositório GitHub do projeto. Analise o que já existe antes de começar, preserve o que funciona e faça commits pequenos e descritivos ao final de cada fase.

---

## 0. PARÂMETROS DO PROJETO

| Item | Definição |
|---|---|
| Repositório | GitHub — `adrianasaf/trombetas-e-festas-sistema-interno` (branch `main`, publicada automaticamente na Vercel a cada push) |
| Frontend | React + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| Hospedagem | Vercel (frontend) |
| E-mail transacional | SMTP próprio (Brevo, Resend ou similar) configurado no Supabase Auth — o SMTP padrão do Supabase só envia para membros da equipe do projeto e não serve para produção |
| Volume esperado | ~3.000 convidados, 11 igrejas, centenas de membros, dezenas de usuários simultâneos no check-in |
| Idioma | Português brasileiro em 100% da interface, mensagens e e-mails |
| Fuso horário | America/Fortaleza (UTC−3) — armazenar em `timestamptz`, exibir no fuso local |

**Ambientes:** dois projetos Supabase separados — `dev` (com dados fictícios, exibindo uma faixa visível "AMBIENTE DE DEMONSTRAÇÃO") e `prod` (sem dados fictícios, nunca rodar seed nele).

**Credenciais:** nunca inventar. Nunca colocar `service_role` no frontend. Criar `.env.example` com todas as variáveis e explicar onde obter cada uma. Se algo depender de credencial externa, implemente a estrutura e documente exatamente o que configurar.

---

## 1. OBJETIVO

Plataforma centralizada para a coordenação do Polo Torre acompanhar igrejas, grupos de assistência, membros, convidados, confirmações, transporte, presença presencial e participação online no evento Trombetas e Festas.

Metas padrão (configuráveis pelo administrador, por edição do evento):
- Cada membro convida **pelo menos 3 pessoas**.
- Cada membro tem **pelo menos 1 convidado presente presencialmente**.

Metas calculadas automaticamente e consolidadas por **membro → grupo → igreja → Polo**.

---

## 2. EDIÇÕES DO EVENTO (multievento)

O evento se repete. Criar a tabela `events` (nome, ano, data/hora, local, link da transmissão, logomarca, metas, data de corte, status: `planejamento | ativo | encerrado`).

- Convidados, convites, presenças, transporte e metas pertencem a um `event_id`.
- Igrejas, grupos, membros e usuários são cadastros permanentes (não pertencem a uma edição).
- Apenas **um evento ativo** por vez; o seletor de evento fica no topo para consultar edições anteriores (somente leitura quando `encerrado`).

---

## 3. IDENTIDADE VISUAL

- Azul-marinho (principal), dourado (destaques), branco e tons claros (fundos).
- Elementos gráficos discretos ligados ao tema (trombetas, festa), sem poluir.
- **Não inventar logomarca oficial.** Área administrativa para upload da logo (Supabase Storage, bucket público somente leitura para a logo; PNG/SVG/JPG até 2 MB). Até o upload, exibir apenas o nome do evento em tipografia.
- Totalmente responsivo; **mobile-first** nas telas de check-in e cadastro de convidado.
- Botões grandes (alvo mínimo 44 px), alto contraste, fonte legível para pessoas sem familiaridade com tecnologia.

---

## 4. AUTENTICAÇÃO E SEGURANÇA

- Login por e-mail e senha (Supabase Auth). **Sem cadastro público**: usuários entram somente por convite (e-mail de convite enviado pelo Admin do Polo ou pelo Gestor de Igreja, dentro do seu escopo).
- Recuperação de senha por e-mail (depende do SMTP próprio).
- Sessão com expiração e logout em todos os dispositivos.
- Senha mínima de 8 caracteres.
- Proteção de rotas no frontend **e** RLS em todas as tabelas no banco. Esconder botão não é controle de acesso.
- Registro de auditoria das operações sensíveis (ver seção 15).

### Perfis

| Perfil | Escopo | Pode |
|---|---|---|
| **Administrador do Polo** | Todas as igrejas | Tudo, incluindo metas, eventos, configurações, usuários, revisão de duplicidades, exclusão |
| **Gestor de Igreja** | Sua(s) igreja(s) | CRUD de grupos, membros, convidados e transporte da igreja; convidar usuários da própria igreja (exceto Admin); desmarcar presença; revisar duplicidades da igreja; ver telefones completos |
| **Responsável de Grupo** | Seu(s) grupo(s) | CRUD de membros e convidados do grupo; ver telefones completos dos convidados do grupo |
| **Recepção** | Evento ativo, todas as igrejas | Buscar convidado, marcar presença, cadastro rápido de convidado na chegada. **Não** desmarca presença, **não** vê lista de telefones (telefone mascarado) |
| **Leitor** | Igreja(s) atribuída(s) ou Polo | Dashboards e relatórios agregados. **Sem** dados pessoais (nomes e telefones de convidados ocultos) |

Um usuário pode ter mais de uma atribuição (`role_assignments`: usuário + perfil + igreja/grupo opcional). O escopo é a união das atribuições.

Implementar as checagens em funções SQL `security definer` reutilizáveis (ex.: `has_church_access(church_id)`, `has_group_access(group_id)`, `is_polo_admin()`) usadas pelas políticas RLS.

---

## 5. IGREJAS

Cadastrar inicialmente (seed de produção, não fictício):

1. ICM Manaíra
2. ICM Geisel
3. ICM Torre
4. ICM Bessa
5. ICM Cabedelo
6. ICM Cristo 1
7. ICM Cristo 2
8. ICM Sapé
9. ICM Solânea
10. ICM Cruz do Espírito Santo
11. ICM Castelo Branco

Campos: nome, cidade, endereço (opcional), ativo/inativo. Criar/editar: somente Admin do Polo. Nunca excluir fisicamente uma igreja com histórico — apenas inativar.

---

## 6. GRUPOS DE ASSISTÊNCIA

Campos: nome, igreja (obrigatória, única), responsável (texto + vínculo opcional com usuário), responsável auxiliar (opcional), situação ativo/inativo.

- Quantidade ilimitada por igreja. Nome único dentro da igreja.
- Inativar grupo não apaga histórico.

---

## 7. MEMBROS

Campos: nome completo, igreja, grupo de assistência (o grupo determina a igreja — validar consistência), telefone (opcional), situação ativo/inativo, data de entrada e data de inativação.

- Ficha individual com: meta de convites, meta de presença, convidados cadastrados, convidados presentes, indicador visual de meta cumprida.
- Na ficha, **5 linhas iniciais** para cadastro rápido de convidados, com botão "adicionar mais".
- Transferência de grupo: registrar histórico em `member_group_history` (grupo anterior, novo grupo, data). Os convites já feitos continuam contando para o grupo de origem (ver seção 10).

---

## 8. CONVIDADOS

### Vínculo
Todo convidado é cadastrado **a partir de um membro**. Igreja e grupo **não são digitados**: são copiados do membro no momento do cadastro e gravados como snapshot em `guest_referrals` (`member_id`, `church_id`, `group_id`, `created_at`). Assim, trocas posteriores de grupo não alteram resultados passados.

### Campos
| Campo | Obrigatório | Valores |
|---|---|---|
| Nome completo | Sim | — |
| Telefone | Sim, exceto Criança/Adolescente (usa o telefone do responsável) | normalizado para E.164 (`+5583...`) |
| Categoria | Sim | Homem, Mulher, Criança, Adolescente, Jovem masculino, Jovem feminino |
| Marcação especial | Não | Autoridade, Pastor de outra igreja (checkboxes independentes da categoria) |
| Modalidade | Sim | Presencial, Online, Indefinido |
| Transporte | Sim se modalidade ≠ Online | Meios próprios, Precisa de transporte, Indefinido |
| Situação do convite | Sim | Não contatado, Convidado, Confirmou presença, Não poderá comparecer |
| Observações | **Não** | texto livre, até 500 caracteres |
| Responsável legal | Sim para Criança/Adolescente | nome e telefone |
| Consentimento | Sim | ver seção 14 |

Regras:
- Se modalidade = Online, ocultar e zerar o transporte.
- "Confirmou presença" + modalidade Online = confirmou participação online (não entra em métricas presenciais).

### Duplicidades
- Normalizar o telefone e comparar **telefone + similaridade de nome** (extensão `pg_trgm`).
- Telefone igual **não bloqueia** o cadastro (famílias compartilham número). Ele marca o registro como "possível duplicidade" e o envia para a fila de revisão.
- Fila de revisão (Gestor da igreja ou Admin): **mesclar** (mantém um registro, preserva histórico, mantém o crédito do primeiro convite) ou **marcar como pessoas diferentes**.
- **Regra de crédito:** se dois membros cadastrarem a mesma pessoa, o crédito do convite e da presença fica com o **primeiro cadastro** (por `created_at`). O revisor pode reatribuir manualmente, com justificativa auditada.
- Um convidado nunca conta duas vezes em nenhuma estatística.

---

## 9. TRANSPORTE

Módulo para convidados com "Precisa de transporte" (somente modalidade presencial ou indefinida).

Colunas: nome, telefone (conforme permissão), igreja, grupo, membro responsável, situação do transporte, responsável pelo transporte (texto), ponto de embarque (opcional), observações.

Situações: Pendente → Transporte organizado → Concluído.

Filtros: igreja, grupo, situação. Exportação CSV respeitando permissões.

---

## 10. MOTOR DE METAS

### Fórmulas
- **Meta de convites** = membros ativos × meta por membro (padrão 3)
- **Meta presencial** = membros ativos × meta por membro (padrão 1)
- **% convites** = convidados únicos cadastrados ÷ meta de convites × 100
- **% presença** = convidados únicos com check-in presencial ÷ meta presencial × 100

Exemplos para validar nos testes: 20 membros → 60/20; 30 → 90/30; 50 → 150/50.

### Regra de competência
- Cada evento tem uma **data de corte** configurável pelo Admin.
- **Antes da data de corte:** a meta usa os membros ativos ao vivo.
- **Na data de corte:** gravar um snapshot (`goal_snapshots`: event_id, member_id, group_id, church_id, ativo). A partir daí, a meta usa o snapshot. Membros inativados depois do corte continuam na meta e mantêm seus resultados; membros novos depois do corte entram com meta zero, mas seus convites contam.
- Inativar ou transferir membro **nunca apaga** convites nem presenças.
- Convites contam para igreja e grupo do snapshot em `guest_referrals`.

### Indicadores adicionais (por grupo, igreja e Polo)
- Membros com ≥ 3 convidados / membros abaixo da meta.
- Membros com ≥ 1 convidado presente / membros abaixo da meta de presença.
- Convidados que precisam de transporte.
- Convidados que confirmaram presença.
- Participações online (confirmadas e registradas).

### Implementação
Cálculos no banco (views ou funções SQL), nunca no frontend. Usar views agregadas por nível; avaliar materialized view apenas se a performance exigir — com ~3.000 convidados, views comuns com índices bastam.

---

## 11. CHECK-IN E PRESENÇA

Função mais crítica do sistema. Precisa ser rápida no celular.

### Tela de check-in rápido
- Campo único de busca (nome ou telefone, com debounce, resultado em < 1 s).
- Resultado com nome, igreja, grupo, membro que convidou, telefone **mascarado** `(83) 9****-1234`.
- Botão grande **"COMPARECEU AO EVENTO ✓"** → um toque marca a presença.
- Feedback visual e sonoro opcional de sucesso; aviso claro se já estava marcado ("Presença já registrada às 19:42 por Fulano").

### Cadastro na chegada (walk-in)
Se o convidado não for encontrado: botão "Cadastrar e marcar presença" com formulário mínimo (nome, telefone ou responsável, categoria, **membro que convidou** — busca por nome do membro; se ninguém, opção "Sem membro identificado", que entra nos totais do Polo e da igreja, mas não em metas individuais).

### Regras
- Tabela `attendances`: `event_id`, `guest_id`, `type` (`presencial | online`), `checked_in_at`, `checked_in_by`, `revoked_at`, `revoked_by`, `revoke_reason`.
- **Índice único parcial** para impedir duas presenças ativas do mesmo tipo: `unique (event_id, guest_id, type) where revoked_at is null`.
- Marcar presença é uma RPC atômica que trata condição de corrida (dois recepcionistas marcando ao mesmo tempo → um sucesso, outro recebe "já registrada").
- Desmarcar: somente Gestor de Igreja ou Admin, com motivo obrigatório. Nunca apaga a linha (soft revoke) — o histórico permanece.
- Na ficha do convidado, exibir o destaque **[ ] COMPARECEU AO EVENTO?** com data/hora e usuário do check-in.

### Online
- Registrado em `attendances` com `type = 'online'`, **nunca somado** à presença presencial.
- A participação online é **autodeclarada** (informada pelo membro ou gestor); os relatórios devem indicar isso.
- Se o convidado tiver presença presencial e online, conta só como presencial nos totais de alcance e aparece nas duas listas.

### Conectividade
Implementar **retentativa automática** com fila local (IndexedDB) caso a internet caia no momento do toque, sincronizando quando a conexão voltar e exibindo o contador "X check-ins aguardando envio". A sincronização usa a mesma RPC idempotente. Não implementar modo offline completo de busca nesta versão — documentar como pendência.

---

## 12. TEMPO REAL

- Usar Supabase Realtime (Broadcast ou `postgres_changes`) **apenas como sinal de "algo mudou"**; ao receber o sinal, o frontend recarrega os agregados via RPC (com debounce de ~2 s para não sobrecarregar durante o pico do check-in).
- Não transmitir linhas de convidados com dados pessoais pelo canal de tempo real.
- Dashboard, painel da igreja, painel do grupo e tela de check-in atualizam sem recarregar a página.

---

## 13. DASHBOARDS

### Dashboard geral do Polo
Cartões: igrejas, grupos, membros ativos, meta de convites, convidados cadastrados, % convites, meta presencial, presenças presenciais, % presença, participações online, convidados que precisam de transporte.

Gráficos: convites por igreja; presença presencial por igreja; desempenho dos grupos; evolução diária de convites e presenças (a partir de `created_at` / `checked_in_at`); categorias dos convidados; presencial × online.

Ranking de igrejas e de grupos por % de meta, **sempre mostrando os números absolutos** ao lado (ex.: 82% — 246/300).

### Painel da igreja
Nome, grupos, membros, metas, convidados, presenças, online, situação do transporte, percentuais. Lista de grupos clicável.

### Painel do grupo
Nome, responsável, nº de membros, metas, convidados, presenças, membros que cumpriram a meta, membros que precisam melhorar. Tabela de desempenho por membro (convidados/3, presentes/1, status com cor).

Todos os painéis respeitam o escopo de permissão do usuário.

---

## 14. LGPD E PROTEÇÃO DE DADOS

O sistema trata dados pessoais, inclusive de crianças e adolescentes.

- **Base legal:** consentimento do convidado registrado no cadastro (checkbox obrigatório "O convidado autorizou o uso do nome e telefone para contato sobre o evento", gravando data, hora e usuário). Para Criança/Adolescente, o consentimento é do **responsável legal** (art. 14 da LGPD), com nome e telefone do responsável.
- **Menor privilégio:** cada perfil só vê o que a tabela da seção 4 permite.
- **Telefones:** mascarados para Recepção e Leitor. Exportação CSV com telefone apenas para Gestor de Igreja (sua igreja) e Admin, e cada exportação é auditada.
- **Retenção:** após o evento ser encerrado, o Admin pode executar a **anonimização** dos convidados após um prazo configurável (padrão 180 dias): nome e telefone substituídos, estatísticas preservadas. Documentar a política na tela de Configurações.
- **Direito do titular:** função para o Admin localizar e excluir/anonimizar os dados de um convidado a pedido.
- **Credenciais:** somente variáveis de ambiente; nunca no repositório.
- Página "Política de privacidade" simples acessível no rodapé.

---

## 15. AUDITORIA

Tabela `audit_logs` (usuário, ação, tabela, registro, dados antes/depois em JSONB, data/hora, IP quando disponível) alimentada por **triggers** no banco para: convidados, presenças (marcar/desmarcar), mescla de duplicidades, reatribuição de crédito, alteração de metas, alteração de permissões, exportações e anonimização.

Somente Admin vê a auditoria completa; Gestor vê a da sua igreja.

---

## 16. RELATÓRIOS

Filtros: Polo, igreja, grupo, membro, categoria, marcação especial, situação do convite, transporte, presença, online.

Saídas: tela, **CSV** (UTF-8 com BOM para abrir corretamente no Excel), **versão para impressão** (CSS de impressão) e **PDF** (via impressão do navegador ou biblioteca no cliente).

**Relatório final do evento:** total de membros, convidados únicos, presenças presenciais, participações online, convidados que precisaram de transporte, % de alcance das metas, desempenho de cada igreja e de cada grupo.

---

## 17. TELAS

Menu lateral (recolhível no celular, em gaveta), exibindo apenas os itens permitidos ao perfil:

1. Dashboard geral
2. Igrejas
3. Grupos de assistência
4. Membros
5. Convidados
6. Check-in
7. Transporte
8. Relatórios
9. Duplicidades (revisão)
10. Usuários e permissões
11. Configurações (evento, metas, data de corte, logo, retenção)
12. Auditoria

Também: login, recuperação de senha, redefinição de senha, aceite de convite, detalhes da igreja, detalhes do grupo, ficha do membro, ficha do convidado, política de privacidade, página 403/404.

UX: mensagens de confirmação, alertas de erro em português claro, estados de carregamento (skeleton), estados vazios com orientação ("Nenhum convidado ainda — cadastre o primeiro").

---

## 18. BANCO DE DADOS

Tabelas (mínimo): `events`, `churches`, `assistance_groups`, `members`, `member_group_history`, `guests`, `guest_referrals`, `guest_consents`, `duplicate_reviews`, `attendances`, `transport_requests`, `goal_snapshots`, `profiles`, `role_assignments`, `audit_logs`, `event_settings`.

Requisitos:
- Chaves estrangeiras, `not null` e `check` constraints coerentes com as regras acima.
- Enums do Postgres para categorias, modalidade, transporte, situação e perfis.
- Índices em todas as FKs, em `guests(phone_normalized)` e índice trigram em `guests(full_name)`.
- RLS habilitado em **todas** as tabelas, com políticas para select/insert/update/delete.
- Migrations versionadas em `supabase/migrations/` (Supabase CLI). Seed de produção (11 igrejas) separado do seed de demonstração.
- Tipos TypeScript gerados a partir do banco (`supabase gen types`).

---

## 19. TESTES (obrigatórios antes de declarar concluído)

1. Login, convite de usuário, recuperação e redefinição de senha.
2. Seed das 11 igrejas.
3. CRUD de grupos e membros, incluindo transferência de grupo.
4. Cadastro de convidados, inclusive Criança com responsável legal.
5. Detecção de duplicidade, mescla e regra de crédito do primeiro cadastro.
6. Cálculo das metas (20/30/50 membros) e comportamento antes/depois da data de corte.
7. Check-in, bloqueio de presença duplicada e corrida concorrente.
8. Desmarcação com histórico; Recepção impedida de desmarcar.
9. Online separado do presencial.
10. Atualização em tempo real entre duas sessões abertas.
11. **Testes de RLS**: usuário de uma igreja não lê nem altera dados de outra (testar via API, não só pela interface); Leitor não vê telefones; Recepção vê telefone mascarado.
12. Exportação CSV e impressão.
13. Layout em 360 px, tablet e desktop.
14. Teste de carga simples: 3.000 convidados fictícios no ambiente dev, busca de check-in < 1 s.

Ferramentas: Vitest (lógica), testes SQL para RLS (pgTAP ou scripts com usuários de teste), Playwright para fluxos principais (login, cadastro, check-in).

Entregar `TESTES.md` com o que foi testado, como e o resultado real — sem declarar como aprovado o que não foi executado.

---

## 20. FASES DE EXECUÇÃO

Ao final de cada fase: rodar os testes da fase, commitar e registrar no `CHANGELOG.md`.

1. Estrutura do projeto, repositório, CI básico (lint + typecheck + testes no GitHub Actions).
2. Banco, migrations, RLS, auth e perfis.
3. Igrejas, grupos e membros.
4. Convidados, consentimento e duplicidades.
5. Motor de metas e snapshots.
6. Check-in, walk-in, fila de retentativa e tempo real.
7. Dashboards.
8. Transporte e relatórios.
9. LGPD (anonimização, auditoria), revisão de segurança e bateria completa de testes.
10. Preparação para implantação (Vercel + Supabase prod + SMTP + domínio).

Se faltar informação, adote a solução mais segura e coerente, **documente a decisão em `DECISOES.md`** e siga em frente sem interromper desnecessariamente.

---

## 21. ENTREGA FINAL

- Aplicação funcional publicada (ou pronta para publicar, com passo a passo).
- Código-fonte organizado no GitHub.
- Migrations e seeds.
- `README.md` com:
  - configuração do Supabase (criar projeto, rodar migrations, configurar Auth, SMTP próprio, URLs de redirecionamento, Storage);
  - execução local;
  - publicação na Vercel (variáveis de ambiente, domínio);
  - criação do primeiro Administrador do Polo.
- `.env.example`.
- `TESTES.md`, `DECISOES.md`, `CHANGELOG.md`.
- Lista de funcionalidades **implementadas** × **pendentes**, honesta.

---

## 22. OBSERVAÇÃO SOBRE O PLANO SUPABASE

Para ~3.000 convidados o plano Free comporta o volume de dados (500 MB de banco). Porém projetos Free **pausam após 7 dias sem atividade** e não têm backup automático. Documentar no README:
- usar o plano Pro durante o período ativo da campanha e do evento, **ou**
- manter o Free com rotina de backup manual (`pg_dump`) e verificar que o projeto está ativo antes do dia do evento.

---

**COMECE AGORA.** Analise o repositório, apresente em poucas linhas a arquitetura e a estrutura de pastas, e então execute a Fase 1 de verdade, criando arquivos, banco e funcionalidades.
