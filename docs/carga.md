# Teste de carga das listagens

Fase 7 (seção 12 da spec): "teste de carga das listagens de vagas e candidatos, com metas a definir". Este documento registra as metas, como medir e o que a medição mudou no projeto.

## Metas

Definidas antes da primeira medição, para a demonstração local (D25):

| Listagem | Volume | Carga | Meta |
| --- | --- | --- | --- |
| Vagas do aluno (ALU-05), sem filtro e com filtros + ordenação por prazo | ~1 000 vagas visíveis à área do aluno | 20 requisições simultâneas, sem pausa, 1 000 por cenário | p95 ≤ 300 ms e nenhum erro |
| Candidatos da vaga (EMP-08), sem filtro e com filtros de status, semestre e ordenação | ~500 candidatos na vaga | idem | idem |

Vinte requisições simultâneas sem pausa equivalem, com folga, a algumas centenas de pessoas navegando (cada uma abre uma listagem a cada poucos segundos), bem acima de uma turma inteira usando a demo ao mesmo tempo.

## Como rodar

```bash
docker compose stop mailpit
docker compose -f docker-compose.test.yml up -d --build --wait
curl -X POST http://localhost:3000/api/v1/__test__/reset   # volume previsível
pnpm carga                                                   # node scripts/carga.mjs
```

O script cria o volume por `POST /__test__/carga` (rota que só existe no ambiente de teste), abre 20 sessões de aluno e 1 de empresa, aquece com 50 requisições e mede cada cenário pelo proxy do Next, como um navegador, com guards, CSRF e rate limit ligados. Sai com código 1 se algum cenário passar da meta. Opções: `--vagas`, `--candidatos`, `--requisicoes`, `--concorrencia`, `--meta-p95`.

## Resultado (notebook de desenvolvimento, WSL2, 12 núcleos, tudo no Docker)

| Cenário | Antes: p95 · req/s | Depois: p95 · req/s |
| --- | --- | --- |
| ALU-05 vagas (padrão) | 403 ms · 68 | 113–224 ms · 123–225 |
| ALU-05 vagas (filtros + prazo) | 514 ms · 45 | 199–225 ms · 119–133 |
| EMP-08 candidatos (padrão) | 379 ms · 62 | 163–189 ms · 137–154 |
| EMP-08 candidatos (filtros) | 415 ms · 57 | 164–174 ms · 146–150 |

Nenhum erro em nenhuma rodada. "Depois" mostra a faixa de três rodadas, cada uma com o banco recém-resetado.

## O que a medição mudou

1. **Imagem da API e do worker em Debian slim (glibc), não Alpine.** Durante a carga, o motor de consultas do Prisma (Rust, multithread) ocupava cerca de 7 núcleos, com muito tempo em kernel, enquanto o Postgres e o proxy ficavam folgados. O `malloc` da musl (Alpine) disputa trava sob muitas threads. Só a troca da imagem dobrou a vazão: 45–68 → 119–146 req/s.
2. **A listagem de vagas deixou de buscar os textos longos** (atividades, requisitos, benefícios, processo e cultura, até 5 000 caracteres cada), que eram lidos e descartados. Agora há um `select` só com os campos do resumo (`SELECAO_RESUMO_VAGA`).
3. **Contagem e página em paralelo, sem transação**, nas duas listagens: menos idas e voltas (BEGIN/COMMIT) e consultas em conexões diferentes.

Testado e descartado: o `relationJoins` do Prisma piorou a listagem de vagas (~150 contra ~207 req/s numa medição local); o tamanho do pool de conexões (5, 10 ou 40) não mudou o resultado além do ruído.

## Limites desta medição

- Tudo roda na mesma máquina (gerador de carga, proxy, API, Postgres e Redis), então os números valem como comparação, não como capacidade de produção.
- O volume (~1 000 vagas, ~500 candidatos numa vaga) cobre bem a demo. Com dezenas de milhares de vagas, a ordenação por `criadaEm` e a busca por texto (`contains`, sem índice) pediriam índices novos (por exemplo `pg_trgm` para a busca).
