# Revisão de segurança · OWASP ASVS 4.0.3 nível 1

Revisão da Fase 7 (seção 12 da spec), feita sobre o código em 16/11/2026. Cada item verificado aponta a evidência: um teste automatizado (o ID está no título) ou o arquivo onde a proteção vive. Os achados corrigidos nesta revisão estão na seção 2; o que ficou como risco aceito ou recomendação, na seção 3.

## 1. Situação por capítulo

| Capítulo | Situação | Evidência |
| --- | --- | --- |
| V2 Autenticação | ✅ com 1 divergência (3.1) | argon2id (`common/cripto/senha.ts`); lista de 10 mil senhas comuns (RN-04); bloqueio após 5 falhas e rate limit (SEG-05, SEG-06); mensagem genérica e tempo constante no login (AUTH-01); 2FA TOTP do admin; reset de uso único em 1 h que revoga as sessões (AUTH-04); aviso por e-mail de senha alterada (corrigido, 2.4) |
| V3 Sessão | ✅ | Cookies `httpOnly`, `Secure` (padrão `COOKIE_SECURE=true`) e `SameSite`; refresh opaco rotativo com detecção de reuso (SEG-03); JWT RS256 com algoritmo fixo (SEG-10); logout revoga (AUTH-03); troca de senha e exclusão de conta exigem a senha atual |
| V4 Controle de acesso | ✅ | Guards globais de sessão, papel e CSRF; posse por consulta filtrada, com 404 para recurso alheio (SEG-02); matriz completa das 86 rotas da API (74 com papéis, 10 públicas, 2 de sessão) × 4 papéis × anônimo, com teste de inventário que falha se surgir rota não classificada (SEG-01, corrigido, 2.2); CSRF double submit (SEG-04) |
| V5 Validação e codificação | ✅ | Zod estrito em toda entrada (chaves desconhecidas recusadas); só SQL parametrizado (lint proíbe `$queryRawUnsafe`); React escapa a saída e não há `dangerouslySetInnerHTML`; e-mails escapam o texto do usuário; destino do login só interno (corrigido, 2.1) |
| V7 Erros e logs | ✅ | problem+json sem stack trace; `request-id` em toda resposta; logs sem senha, token ou CPF; erros do body-parser viram 4xx (corrigido, 2.3) |
| V8 Proteção de dados | ✅ | CPF cifrado (AES-256-GCM) com índice cego; CPF nunca vai para a empresa (SEG-09); `Cache-Control: no-store` em toda resposta da API (corrigido, 2.3); exportação e exclusão com anonimização (seção 8.4, `test/lgpd.int-spec.ts`); auditoria de acesso a perfil, mudanças de status e ações de admin |
| V9 Comunicação | ⚠️ ambiente | HSTS enviado pela API e pelo web (SEG-07). A demo roda em HTTP local (D25); TLS fica a cargo do proxy de um deploy real |
| V10 Código malicioso / V14 Dependências | ✅ com exceções (3.2) | `pnpm audit --audit-level high` limpo; 6 advisories altas corrigidas nesta revisão (2.5) |
| V11 Lógica de negócio | ✅ | Transições por UPDATE condicional (seção 6); corridas cobertas em teste (RN-09, JOB-02, EMP-11); rate limit por rota |
| V12 Arquivos | — | Não há upload (fora do escopo do MVP) |
| V13 API | ✅ | Só JSON, corpo limitado a 100 kB (corrigido, 2.3); sem CORS (mesma origem pelo proxy do Next); métodos restritos por rota |
| V14 Configuração | ✅ | helmet na API, CSP com nonce no web, `X-Content-Type-Options`, `frame-ancestors 'none'`, `Referrer-Policy` (SEG-07); Swagger desligado em produção; `/__test__` só em teste (SEG-08) |

## 2. Achados corrigidos nesta revisão

| # | ASVS | Achado | Correção | Teste |
| --- | --- | --- | --- | --- |
| 2.1 | 5.1.5 | **Open redirect no login.** `?next=/\evil.com` passava pela checagem (`//` era recusado, `/\` não) e o navegador normaliza para `//evil.com` | `destinoInterno()` em `packages/contracts` recusa `//`, barra invertida e caracteres de controle | `destino.spec.ts`, `e2e/specs/seguranca/redirecionamento.spec.ts` |
| 2.2 | 4.1.x | A matriz SEG-01 cobria 35 rotas; rota nova podia nascer sem teste de acesso | Matriz com as 86 rotas da API e teste de inventário (lê as rotas registradas no Express) que falha nos dois sentidos | `seguranca.int-spec.ts` (SEG-01) |
| 2.3 | 8.2.1, 7.4.1, 13.1.x | Respostas da API sem cabeçalho anti-cache; corpo acima do limite virava **500** | `Cache-Control: no-store` e `Pragma: no-cache` em toda resposta; limite de 100 kB explícito; erros do body-parser mapeados para 400/413/415 | SEG-07 |
| 2.4 | 2.2.3 | Mudança de senha não avisava o titular | E-mail "Sua senha foi alterada" após redefinir (AUTH-04) e trocar (ALU-02) | AUTH-04, ALU-02 |
| 2.5 | 14.2.1 | 9 vulnerabilidades altas no `pnpm audit` (bloqueiam o merge pela seção 11.6) | nodemailer 7 → 10.6 (4 advisories); postcss do Next forçado para ≥ 8.5.18 por override (2); as 3 restantes viraram exceções justificadas (3.2) | `pnpm audit --audit-level high` |
| 2.6 | 8.3.x (LGPD) | Conta anonimizada continuaria acessível com o access token ainda válido (15 min) | O guard recusa conta anonimizada na hora | `lgpd.int-spec.ts` |

## 3. Riscos aceitos e recomendações

### 3.1 Divergência da spec

- **Tamanho mínimo da senha (ASVS 2.1.1 e 2.1.9).** O ASVS pede no mínimo 12 caracteres e desaconselha regras de composição; a RN-04 fixa 8 caracteres com maiúscula, minúscula, número e símbolo. A política não foi alterada: pela seção 1 da spec, mudar uma regra começa pela spec. **Recomendação:** passar a RN-04 para 12 caracteres sem regras de composição, mantendo a lista de senhas comuns.

### 3.2 Exceções no `pnpm audit` (`package.json` → `pnpm.auditConfig.ignoreGhsas`)

| Advisory | Pacote | Por que não é explorável aqui | Saída definitiva |
| --- | --- | --- | --- |
| GHSA-qxc2-j82w-r537 | `@faker-js/faker` 9 | Só no seed de demonstração (devDependency); `helpers.fake` não é usado e nunca recebe entrada externa | Faker 10 é só ESM; migrar quando o Jest da API rodar em ESM |
| GHSA-ggr8-5vv4-36mx | `deepmerge-ts` 7 | Só no CLI do Prisma (`prisma generate`/`migrate`), mesclando a configuração do próprio projeto | Prisma 7 |
| GHSA-mrhx-c7xc-m3w5 | `zod` 3 | DoS por coleção gigante; o corpo JSON é limitado a 100 kB e toda lista dos schemas tem `.max()` | Migrar para Zod 4 (`nestjs-zod` já suporta) |

### 3.3 Recomendações para um deploy real (fora do escopo da demo local)

- **Expor só o web.** A API confia em um proxy (`trust proxy 1`) para obter o IP real. No compose de desenvolvimento a porta 3001 fica aberta para o Swagger; se ela ficar acessível num deploy, um `X-Forwarded-For` forjado contorna os limites por IP (os limites por e-mail e o bloqueio da conta continuam valendo). O compose de teste já expõe só o web.
- **TLS** no proxy de entrada, com os cookies `Secure` (já é o padrão).
- **Token na URL:** os links de e-mail levam o token em `?token=`, inevitável num link. O front o envia à API no corpo, e o `Referrer-Policy` evita o vazamento. A exceção é `GET /alunos/me/troca-faculdade?token=` (ALU-12): pode virar `POST` numa próxima versão.
- **Pentest:** os ataques do nível 1 estão automatizados acima (IDOR, CSRF, reuso de refresh, JWT adulterado, `alg: none`, força bruta, open redirect, enumeração, cabeçalhos). Um pentest externo antes da apresentação continua recomendado; esta revisão não o substitui.
