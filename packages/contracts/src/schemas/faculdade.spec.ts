import { atualizarAulaSchema, criarCursoSchema, criarTurmaSchema } from '../index';

const curso = { nome: 'Computação', areaId: '7d0f5a5e-8a43-4d3a-9d8a-1b2c3d4e5f60', duracaoAnos: 4, ementa: 'Ementa' };

describe('Schemas da faculdade', () => {
  it('FAC-03 duração do curso entre 1 e 6 anos inteiros', () => {
    expect(criarCursoSchema.safeParse(curso).success).toBe(true);
    for (const duracaoAnos of [0, 7, 2.5]) expect(criarCursoSchema.safeParse({ ...curso, duracaoAnos }).success).toBe(false);
  });

  it('FAC-03 RN-07 área de formação é obrigatória', () => {
    const { areaId: _, ...semArea } = curso;
    expect(criarCursoSchema.safeParse(semArea).success).toBe(false);
  });

  it('FAC-05 turma por ano e período (1 ou 2), período padrão 1', () => {
    expect(criarTurmaSchema.parse({ anoIngresso: 2025 })).toEqual({ anoIngresso: 2025, periodoIngresso: 1 });
    expect(criarTurmaSchema.safeParse({ anoIngresso: 2025, periodoIngresso: 3 }).success).toBe(false);
  });

  it('FAC-04 ordem da aula começa em 1', () => {
    expect(atualizarAulaSchema.safeParse({ ordem: 0 }).success).toBe(false);
  });
});
