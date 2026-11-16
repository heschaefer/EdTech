#!/usr/bin/env node
/**
 * Rastreabilidade (seção 11.5): todo ID de história/requisito de docs/spec.md precisa aparecer
 * no título de ao menos um teste (Jest unitário/integração ou Playwright).
 *
 * Os títulos são lidos estaticamente dos arquivos de teste (it/test/describe e it.each),
 * o que dispensa rodar as suítes. Uso:
 *   node scripts/spec-check.mjs              → falha se faltar algum ID
 *   node scripts/spec-check.mjs --relatorio  → só lista cobertos e pendentes (sai com 0)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const PADRAO_ID = /\b(AUTH|ALU|FAC|EMP|ADM|JOB|SEG)-\d{2}\b/g;
const ARQUIVO_TESTE = /\.(spec|int-spec|test)\.tsx?$/;
const IGNORAR = new Set(['node_modules', 'dist', '.next', '.turbo', 'coverage', '.git']);

const spec = readFileSync(join(RAIZ, 'docs/spec.md'), 'utf8');
const ids = [...new Set(spec.match(PADRAO_ID))].sort();

function* arquivos(dir) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) yield* arquivos(caminho);
    else if (ARQUIVO_TESTE.test(nome)) yield caminho;
  }
}

// Títulos: primeiro argumento string de it(, test(, describe(, it.each(...)(, test.describe(
const TITULO = /\b(?:it|test|describe)(?:\.(?:each\([^)]*\)|describe|only|skip|serial|parallel))*\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gs;

const cobertura = new Map(ids.map((id) => [id, new Set()]));
for (const arquivo of arquivos(RAIZ)) {
  const texto = readFileSync(arquivo, 'utf8');
  for (const [, , titulo] of texto.matchAll(TITULO)) {
    for (const id of titulo.match(PADRAO_ID) ?? []) cobertura.get(id)?.add(relative(RAIZ, arquivo));
  }
}

const pendentes = ids.filter((id) => cobertura.get(id).size === 0);
const cobertos = ids.length - pendentes.length;
console.log(`spec:check — ${cobertos}/${ids.length} IDs da spec com teste.`);

if (process.argv.includes('--relatorio')) {
  for (const id of ids) {
    const onde = [...cobertura.get(id)];
    console.log(`${onde.length ? '✔' : '✘'} ${id}${onde.length ? `  (${onde.join(', ')})` : ''}`);
  }
  process.exit(0);
}

if (pendentes.length) {
  console.error(`IDs sem teste: ${pendentes.join(', ')}`);
  process.exit(1);
}
