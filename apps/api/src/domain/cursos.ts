/** D13: semestres fixos em 2 por ano. */
export const SEMESTRES_POR_ANO = 2;

export type SemestreGerado = { ano: number; periodo: number; ordem: number };

/** FAC-03: o sistema gera os semestres a partir da duração (anos × 2). */
export function gerarSemestres(duracaoAnos: number): SemestreGerado[] {
  return Array.from({ length: duracaoAnos * SEMESTRES_POR_ANO }, (_, i) => ({
    ano: Math.floor(i / SEMESTRES_POR_ANO) + 1,
    periodo: (i % SEMESTRES_POR_ANO) + 1,
    ordem: i + 1,
  }));
}

export const totalSemestres = (duracaoAnos: number) => duracaoAnos * SEMESTRES_POR_ANO;

/**
 * FAC-03: reduzir a duração é bloqueado se houver aluno em semestre acima do novo limite.
 * `maiorSemestreAluno` é null quando o curso não tem alunos.
 */
export const reducaoPermitida = (novaDuracaoAnos: number, maiorSemestreAluno: number | null) =>
  maiorSemestreAluno === null || maiorSemestreAluno <= totalSemestres(novaDuracaoAnos);

/** RN-05: semestre do aluno entre 1 e duração × 2. */
export const semestreValido = (semestre: number, duracaoAnos: number) =>
  Number.isInteger(semestre) && semestre >= 1 && semestre <= totalSemestres(duracaoAnos);

/**
 * FAC-04: move um item para a nova posição (1-based) e devolve a lista reordenada,
 * com as ordens renumeradas de 1 a n sem buracos.
 */
export function reordenar<T extends { id: string }>(itens: T[], id: string, novaOrdem: number): (T & { ordem: number })[] {
  const lista = [...itens];
  const atual = lista.findIndex((i) => i.id === id);
  if (atual < 0) throw new Error(`Item ${id} não está na lista`);
  const [item] = lista.splice(atual, 1);
  const destino = Math.min(Math.max(novaOrdem, 1), lista.length + 1) - 1;
  lista.splice(destino, 0, item);
  return lista.map((i, idx) => ({ ...i, ordem: idx + 1 }));
}
