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
| 5 a 7 | Pendentes. Candidaturas, central de notificações, encerramento e jobs de prazo |

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
pnpm dev                                # API :3001, web :3000
pnpm --filter api dev:worker            # worker de e-mails (outro terminal)
```

Ou tudo em contêineres: `pnpm chaves:gerar && docker compose up --build`.

- Site: http://localhost:3000
- Caixa de e-mails (Mailpit): http://localhost:8025
- Documentação OpenAPI (fora de produção): http://localhost:3001/api/docs

### Conta de demonstração

| Papel | E-mail | Senha | 2FA |
| --- | --- | --- | --- |
| Admin | admin@vagas.local | `Demo@2026!` | Segredo TOTP `KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD` (cadastre num app autenticador) |

Esses valores só existem no seed e neste README. Em produção, `ADMIN_EMAIL`, `ADMIN_SENHA` e `ADMIN_TOTP_SECRET` são obrigatórios. As demais contas da seção 10.1 chegam com o seed de demonstração (Fase 7).

## Testes

| Comando | O que roda |
| --- | --- |
| `pnpm test` | Unitários (Jest). `src/domain` exige ≥ 90% de linhas |
| `pnpm test:int` | Integração: Jest + Supertest + Testcontainers (sobe Postgres e Redis sozinho) |
| `pnpm test:e2e` | Playwright contra a stack em modo teste (veja abaixo) |
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
- **E-mails:** templates HTML simples por enquanto; a migração para React Email (seção 10) fica pendente.
- **spec:check:** lê os títulos dos testes direto dos arquivos (`it`, `test`, `describe`), sem precisar rodar as suítes.
