#!/usr/bin/env node
/**
 * Teste de carga das listagens (Fase 7): vagas do aluno (ALU-05) e candidatos da empresa (EMP-08).
 * Roda contra a stack de teste (docker-compose.test.yml), passando pelo proxy do Next como um navegador,
 * com guards, CSRF e rate limit ligados. Cria o volume por /__test__/carga.
 *
 *   node scripts/carga.mjs [--vagas 1000] [--candidatos 500] [--requisicoes 1000] [--concorrencia 20] [--meta-p95 300]
 *
 * Sai com código 1 se algum cenário passar da meta de p95 ou tiver erro.
 */
import { performance } from 'node:perf_hooks';

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? Number(process.argv[i + 1]) : padrao;
};
const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const API = `${BASE}/api/v1`;
const VAGAS = arg('vagas', 1000);
const CANDIDATOS = arg('candidatos', 500);
const REQUISICOES = arg('requisicoes', 1000);
const CONCORRENCIA = arg('concorrencia', 20);
const META_P95 = arg('meta-p95', 300);
const AQUECIMENTO = 50;

async function login({ email, senha }) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) });
  if (r.status !== 200) throw new Error(`login de ${email} falhou: ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

const percentil = (ordenadas, p) => ordenadas[Math.min(ordenadas.length - 1, Math.ceil((p / 100) * ordenadas.length) - 1)];

async function cenario(nome, caminho, sessoes) {
  const medir = async (total) => {
    const tempos = [];
    let erros = 0;
    let proxima = 0;
    const inicio = performance.now();
    await Promise.all(
      Array.from({ length: CONCORRENCIA }, async (_, w) => {
        while (proxima < total) {
          proxima++;
          const t0 = performance.now();
          const r = await fetch(API + caminho, { headers: { Cookie: sessoes[w % sessoes.length], Accept: 'application/json' } });
          await r.arrayBuffer();
          tempos.push(performance.now() - t0);
          if (r.status !== 200) erros++;
        }
      }),
    );
    return { tempos: tempos.sort((a, b) => a - b), erros, duracao: (performance.now() - inicio) / 1000 };
  };
  await medir(AQUECIMENTO);
  const { tempos, erros, duracao } = await medir(REQUISICOES);
  const p95 = percentil(tempos, 95);
  return {
    cenario: nome,
    req: tempos.length,
    'p50 ms': Math.round(percentil(tempos, 50)),
    'p95 ms': Math.round(p95),
    'p99 ms': Math.round(percentil(tempos, 99)),
    'máx ms': Math.round(tempos.at(-1)),
    'req/s': Math.round(tempos.length / duracao),
    erros,
    meta: p95 <= META_P95 && erros === 0 ? 'ok' : 'FALHOU',
  };
}

const r = await fetch(`${API}/__test__/carga`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vagas: VAGAS, candidatos: CANDIDATOS }) });
if (!r.ok) throw new Error(`/__test__/carga respondeu ${r.status}: suba a stack de teste (docker-compose.test.yml)`);
const dados = await r.json();
const alunos = await Promise.all(dados.alunos.map(login));
const empresa = [await login(dados.empresa)];

const volume = async (cookie, caminho) => (await (await fetch(API + caminho, { headers: { Cookie: cookie } })).json()).meta.total;
console.log(`Volume: ${await volume(alunos[0], '/vagas')} vagas visíveis ao aluno; ${await volume(empresa[0], `/empresa/vagas/${dados.vagaId}/candidaturas`)} candidatos na vaga.`);
console.log(`${REQUISICOES} requisições por cenário, ${CONCORRENCIA} simultâneas (após ${AQUECIMENTO} de aquecimento); meta: p95 ≤ ${META_P95} ms e nenhum erro.\n`);

const resultados = [];
resultados.push(await cenario('ALU-05 vagas (padrão)', '/vagas', alunos));
resultados.push(await cenario('ALU-05 vagas (filtros + prazo)', '/vagas?q=carga&tipo=ESTAGIO&salarioMin=2000&ordem=prazo&page=3', alunos));
resultados.push(await cenario('EMP-08 candidatos (padrão)', `/empresa/vagas/${dados.vagaId}/candidaturas`, empresa));
resultados.push(await cenario('EMP-08 candidatos (filtros)', `/empresa/vagas/${dados.vagaId}/candidaturas?status=EM_PROCESSO&semestreMin=3&semestreMax=6&ordem=recentes&page=3`, empresa));
console.table(resultados);
if (resultados.some((x) => x.meta !== 'ok')) process.exitCode = 1;
