# Vagas Universitárias

Plataforma que conecta alunos de faculdades clientes a vagas de empresas, mostrando a cada aluno só as vagas da área do seu curso. O desenvolvimento segue **Spec-Driven Development**: a fonte de verdade é [docs/spec.md](docs/spec.md), e todo teste começa pelo ID da história ou do requisito (ex.: `AUTH-01`, `SEG-03`).

Stack: NestJS + Prisma (PostgreSQL) · Next.js 15 + Tailwind v4 · BullMQ (Redis) · Mailpit · Jest, Supertest, Testcontainers, Playwright. Monorepo pnpm + Turborepo.

## Situação por fase (seção 12 da spec)

| Fase | Situação |
| --- | --- |
| 0 · Fundação | ✅ Monorepo, Docker Compose (dev e teste), schema Prisma e 1ª migração, seed base, CI, `ClockService`, problem+json, helmet, `/__test__`, `spec:check` |
| 1 · Autenticação e admin | ✅ AUTH-01 a AUTH-05, CSRF, rate limit, bloqueio, 2FA TOTP do admin, guards de papel, middleware do Next, ADM-01 a ADM-03, FAC-01 (aceite do convite), SEG-01 (parcial) e SEG-03 a SEG-08, SEG-10 |
| 2 · Faculdade | ✅ FAC-02 (dados cadastrais), FAC-03 (cursos com geração de semestres), FAC-04 (grade de aulas), FAC-05 (turmas) |
| 3 · Aluno | ✅ ALU-01 (cadastro em 3 passos, CPF cifrado), ALU-02 a ALU-04 (perfil, senha, vínculo, currículo), FAC-06 (lista e desligamento), ALU-12 (troca de faculdade), RN-03 (limpeza de cadastros não verificados no worker) |
| 4 · Empresa e vagas | ✅ EMP-01 e EMP-02 (cadastro com ViaCEP e perfil), ADM-04 e ADM-05 (aprovação e gestão de empresas), EMP-03 a EMP-07 (criar, editar com versão, pausar, excluir, prorrogar), ALU-05 e ALU-06 (lista com filtros na URL e detalhe). Adiantado da Fase 6: o outbox que envia por e-mail cada notificação in-app (RN-23) |
| 5 · Candidaturas | ✅ ALU-07 e ALU-08 (candidatar-se, remover e reinscrever-se), ALU-09 e ALU-10 (em andamento, histórico e linha do tempo), EMP-08 a EMP-10 (lista de candidatos com contagem por etapa, perfil com currículo e auditoria, mover etapa, não selecionar), SEG-02 e SEG-09 |
| 6 · Ciclo de vida e notificações | ✅ ALU-11 (sino e central de notificações, com e-mail de cada evento pelo outbox), EMP-11 (encerramento com escolha dos selecionados e tela de resumo), JOB-01 a JOB-03 e EMP-12 (vencimento, lembrete e encerramento automático no worker a cada 5 min, com os atalhos "Prorrogar" e "Encerrar") |
| 7 · Endurecimento | ✅ LGPD (exportação em JSON, exclusão com anonimização, trilha de auditoria para o admin), revisão OWASP ASVS nível 1 ([docs/seguranca.md](docs/seguranca.md)), seed de demonstração da seção 10.1 e teste de carga das listagens ([docs/carga.md](docs/carga.md)) |

`pnpm spec:pendentes` lista quais IDs da spec ainda não têm teste.

## Requisitos

- Node 22 e pnpm 9 (`corepack enable`)
- Docker com Compose

## Rodando localmente

```bash
pnpm install
pnpm chaves:gerar                       # cria .env com as chaves RSA (JWT) e de cifra
docker compose up -d postgres redis mailpit
pnpm --filter @vagas/contracts build
pnpm db:migrate                         # aplica as migrações
pnpm db:seed                            # admin + áreas de formação
pnpm db:seed:demo --reset               # opcional: dados da seção 10.1 (apaga tudo antes)
pnpm dev                                # API :3001, web :3000
pnpm --filter api dev:worker            # worker: e-mails e jobs de prazo (outro terminal)
```

Ou tudo em contêineres: `pnpm chaves:gerar && docker compose up --build`.

- Site: http://localhost:3000
- Caixa de e-mails (Mailpit): http://localhost:8025
- Documentação OpenAPI (fora de produção): http://localhost:3001/api/docs

### Contas de demonstração

O admin vem do seed base; as demais, de `pnpm db:seed:demo --reset` (seção 10.1). Todas usam a senha `Demo@2026!`.

| Papel | E-mail | O que mostrar |
| --- | --- | --- |
| Admin | admin@vagas.local · 2FA: segredo TOTP `KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD` (cadastre num app autenticador) | Aprovar a empresa pendente, faculdade inativa, áreas, auditoria |
| Faculdade | contato@uhorizonte.edu.br | Cursos com grade e turmas, alunos, desligar um aluno ao vivo |
| Empresa | rh@nuvemazul.com.br | Vagas em todos os estados, candidatos por etapa, encerrar com devolutiva |
| Empresa pendente | contato@faisca.com.br | "Cadastro em análise" e bloqueio de publicação |
| Aluna ativa | ana.souza@aluno.uhorizonte.edu.br | Vagas da área, candidaturas em etapas diferentes, uma seleção, notificações |
| Aluno com histórico | bruno.lima@aluno.uhorizonte.edu.br | Histórico com candidatura cancelada e não selecionada |
| Aluna desligada | carla.mendes@aluno.uhorizonte.edu.br | Acesso restrito; a empresa vê "Aluno inativo" |
| Aluno novo | diego.alves@aluno.valedosul.edu.br | Primeiro acesso com currículo vazio |

Esses valores só existem nos seeds e neste README. Em produção, `ADMIN_EMAIL`, `ADMIN_SENHA` e `ADMIN_TOTP_SECRET` são obrigatórios, e o seed de demonstração se recusa a rodar.

## Testes

| Comando | O que roda |
| --- | --- |
| `pnpm test` | Unitários (Jest). `src/domain` exige ≥ 90% de linhas |
| `pnpm test:int` | Integração: Jest + Supertest + Testcontainers (sobe Postgres e Redis sozinho) |
| `pnpm test:e2e` | Playwright contra a stack em modo teste (veja abaixo) |
| `pnpm carga` | Teste de carga das listagens contra a stack em modo teste ([docs/carga.md](docs/carga.md)) |
| `pnpm spec:check` | Falha se algum ID da spec não aparece em título de teste |

E2E, como no CI:

```bash
docker compose stop mailpit   # libera a porta 8025, se a stack de dev estiver de pé
docker compose -f docker-compose.test.yml up -d --build --wait
pnpm --filter e2e exec playwright install chromium
pnpm test:e2e
docker compose -f docker-compose.test.yml down -v
```

## Estrutura

```text
apps/api      NestJS: src/domain (regras puras), src/modules, src/common (guards, filtros, Clock), src/testing (/__test__)
apps/web      Next.js: app/(publico), app/admin, app/aluno, app/empresa, app/faculdade, middleware.ts
packages/contracts  Schemas Zod, enums e validadores (CPF, CNPJ, senha) compartilhados por front e API
packages/ui   Componentes Tailwind
e2e           Playwright: fixtures, specs, helpers do Mailpit
docs/spec.md  A spec (lida pelo spec:check)
docs/seguranca.md  Revisão OWASP ASVS nível 1 (Fase 7)
docs/carga.md  Metas e resultados do teste de carga (Fase 7)
scripts/carga.mjs  Teste de carga das listagens
```

## Decisões de implementação que a spec não fixa

- **Status sempre do banco:** o `JwtAuthGuard` relê o status do usuário a cada requisição, então desligar um aluno ou inativar uma faculdade vale na hora, sem esperar os 15 min do access token.
- **Prazo na candidatura:** além da RN-08, a listagem e a candidatura exigem `prazo > agora` (RN-12), para a vaga não aceitar inscrição no intervalo de até 5 min antes do JOB-01 rodar.
- **Login:** conta bloqueada e e-mail não verificado respondem 401 com `type` próprio (`conta-bloqueada`, `email-nao-verificado`) só depois da senha correta, no caso do e-mail não verificado; e-mail inexistente e senha errada têm a mesma mensagem e o mesmo tempo de resposta.
- **TOTP:** aceita o código do passo anterior ou seguinte (±30 s).
- **Rotas extras:** `DELETE /admin/areas/:id` (ADM-03 fala em excluir área sem uso); `GET /alunos/me/vinculo/opcoes` (cursos e turmas da própria faculdade para o ALU-03); `GET /alunos/me/troca-faculdade?token=` e `POST /alunos/me/troca-faculdade/confirmar` (as duas metades do ALU-12: ler o pedido e confirmar com o vínculo novo); `POST /__test__/admins` (admin único por teste E2E). A lista de faculdades do admin aceita `?q=` (nome, CNPJ ou domínio). As rotas `/__test__` ficam fora do rate limit.
- **Rate limit no E2E:** `RATE_LIMIT_FATOR` (padrão 1) multiplica só os limites por IP; o compose de teste usa 100 porque todos os testes saem do mesmo IP. Os limites por e-mail (login, esqueci a senha) não mudam, e o SEG-05 continua valendo.
- **Troca de faculdade (ALU-12):** exige e-mail de **outra** faculdade cliente, para um aluno desligado não se reativar com outro e-mail da mesma faculdade. Ao confirmar, o e-mail de login passa a ser o novo.
- **Desligamento (FAC-06):** o motivo vai para a auditoria (`FACULDADE_DESLIGOU_ALUNO`). Reativar não restaura as candidaturas canceladas.
- **Nova análise da empresa (RN-26):** `POST /empresa/me/solicitar-analise` volta o cadastro reprovado para "aguardando análise".
- **Prazo da vaga:** só muda pela prorrogação (EMP-07); o `PATCH` da vaga não aceita `prazo`. Toda ação na vaga (editar, pausar, reativar, prorrogar) incrementa a `versao`.
- **Inativar empresa (ADM-05):** bloqueia o login e pausa as vagas abertas; reativar libera o login, e as vagas ficam pausadas até a empresa reativá-las.
- **Filtro de salário (ALU-05):** compara com o máximo da faixa (ou o mínimo, se só ele existir); vagas "a combinar" saem do resultado quando o filtro está ativo.
- **Selo "Candidatado":** aparece para candidatura em qualquer status, menos cancelada.
- **Disponibilidade no currículo:** manhã, tarde, noite e integral como múltipla escolha, gravadas separadas por vírgula no campo de texto do schema.
- **Candidatura repetida (ALU-07):** `POST /vagas/:id/candidaturas` responde 201 quando cria ou reativa e 200 com a mesma candidatura quando ela já está em processo (duplo clique), sem nova notificação. A linha da vaga fica travada (`SELECT … FOR SHARE`) durante a transação, então pausar, encerrar ou expirar esperam a inscrição terminar. Vaga fora da área, abaixo do semestre mínimo ou de empresa inativa responde 404; vaga pausada, vencida ou encerrada, 409.
- **Candidatura finalizada:** selecionado ou não selecionado não volta a EM_PROCESSO por nova candidatura (409); só a cancelada é reativada (RN-10).
- **Lista de candidatos (EMP-08):** além de `{ data, meta }`, devolve `etapas` (em processo por etapa), `porStatus` e `opcoes` (cursos e faculdades dos candidatos, para os filtros). O candidato "Aluno inativo" vem só com o nome. Ordem padrão: candidatura mais antiga primeiro (`?ordem=recentes` inverte).
- **Perfil do candidato (EMP-09):** cada leitura grava `EMPRESA_VIU_PERFIL` na auditoria. Quem não foi selecionado continua com o perfil visível à empresa (RN-19 só esconde a cancelada).
- **Mover etapa (EMP-10):** pode avançar ou voltar; mover para a etapa atual responde 422. Mover e não selecionar valem com a vaga aberta, pausada ou com prazo expirado. A notificação do não selecionado usa a mensagem genérica da seção 5.
- **Remover candidatura (ALU-08):** a empresa não é notificada; o candidato só some da lista dela.
- **Encerramento (EMP-11):** `POST /empresa/vagas/:id/encerrar` recebe ids de **candidatura** em `selecionados`; id que não está em processo nesta vaga responde 422 sem mudar nada. A resposta traz `resultado: { selecionados, naoSelecionados }`. Candidaturas canceladas (inclusive "Aluno inativo") não recebem devolutiva. O botão "Encerrar vaga" aparece para qualquer vaga não encerrada; "Excluir" continua só para vaga sem candidaturas (D10).
- **Concorrência no encerramento:** a vaga muda para ENCERRADA com UPDATE condicional e as candidaturas em processo são travadas (`FOR UPDATE`) antes da devolutiva; o JOB-02 usa a mesma rotina. Assim job e empresa nunca aplicam duas ações e nenhum aluno é avisado duas vezes; "não selecionar" ou "mover etapa" simultâneos recebem 409.
- **Jobs de prazo:** o worker roda os três a cada 5 min, na ordem expirar → lembrete → encerrar. O lembrete (JOB-03) só sai entre 48 h e 72 h após o prazo: se o job atrasou além das 72 h, a vaga encerra direto. Prorrogar zera o lembrete.
- **Notificações (ALU-11):** `GET /notificacoes` devolve também `naoLidas`; `GET /notificacoes/nao-lidas` é a contagem leve que o sino consulta a cada 30 s. A central fica em `/{papel}/notificacoes` para os quatro papéis, e o aluno inativo também a acessa. "Abrir" (e os atalhos) marcam a notificação como lida. Marcar de novo mantém a data da primeira leitura.
- **Atalhos do EMP-12:** as notificações de prazo vencido e de lembrete levam a `/empresa/vagas/:id#prorrogar` (foco no campo do novo prazo) e a `/empresa/vagas/:id/encerrar`.
- **Tabelas no celular:** a região com rolagem horizontal é focável (`role="region"`, `tabIndex=0`), exigência do axe (`scrollable-region-focusable`).
- **Exclusão de conta (seção 8.4):** `POST /alunos/me/exclusao { senha, confirmacao: "EXCLUIR" }` (5 tentativas a cada 15 min). Anonimiza nome, e-mail, telefone e CPF (que ficam livres para um novo cadastro), apaga currículo, sessões, tokens e notificações e cancela as candidaturas em processo. As finalizadas ficam só para agregados: a empresa vê "Titular removido", sem perfil, e a faculdade deixa de ver o registro. O acesso cai na hora, mesmo com o access token ainda válido.
- **Exportação (seção 8.4):** `GET /alunos/me/dados` devolve um JSON com cadastro (CPF mascarado, como a seção 8.2 manda mostrar ao próprio aluno), vínculo, currículo, candidaturas com eventos, notificações e quais empresas abriram o perfil. Exportar e excluir valem também para o aluno inativo, na página "Privacidade".
- **Auditoria:** além do acesso a perfil e das ações de admin, vão para o `AuditLog` as mudanças de status de vaga (empresa e jobs, estes com autor nulo) e de conta (desligamento, troca de faculdade, exclusão). Mudanças de candidatura ficam no `CandidaturaEvento` (RN-18). O IP vem do contexto da requisição. O admin consulta tudo em `GET /admin/auditoria`.
- **Seed de demonstração:** Faker com semente fixa e datas relativas ao dia em que roda. As notificações nascem com o e-mail marcado como enviado, para não lotar o Mailpit. O Instituto Aurora tem o curso de Enfermagem, cujos alunos foram inativados com a faculdade (RN-27).
- **Imagem da API:** Debian slim em vez de Alpine; o teste de carga mostrou o motor do Prisma travado no `malloc` da musl ([docs/carga.md](docs/carga.md)).
- **Exceções do audit:** três advisories altas aceitas com justificativa (`pnpm.auditConfig.ignoreGhsas`, ver [docs/seguranca.md](docs/seguranca.md)).
- **E-mails:** templates HTML simples por enquanto; a migração para React Email (seção 10) fica pendente.
- **spec:check:** lê os títulos dos testes direto dos arquivos (`it`, `test`, `describe`), sem precisar rodar as suítes.
