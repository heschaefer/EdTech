import { gerarSemestres, reducaoPermitida, reordenar, semestreValido, totalSemestres } from './cursos';

describe('Cursos e grade', () => {
  it('FAC-03 D13 gera 2 semestres por ano de duração', () => {
    expect(gerarSemestres(2)).toEqual([
      { ano: 1, periodo: 1, ordem: 1 },
      { ano: 1, periodo: 2, ordem: 2 },
      { ano: 2, periodo: 1, ordem: 3 },
      { ano: 2, periodo: 2, ordem: 4 },
    ]);
    expect(gerarSemestres(6)).toHaveLength(12);
    expect(totalSemestres(5)).toBe(10);
  });

  it('FAC-03 reduzir a duração é bloqueado se há aluno acima do novo limite', () => {
    expect(reducaoPermitida(3, null)).toBe(true);
    expect(reducaoPermitida(3, 6)).toBe(true);
    expect(reducaoPermitida(3, 7)).toBe(false);
  });

  it('RN-05 semestre do aluno entre 1 e duração × 2', () => {
    expect(semestreValido(1, 4)).toBe(true);
    expect(semestreValido(8, 4)).toBe(true);
    expect(semestreValido(9, 4)).toBe(false);
    expect(semestreValido(0, 4)).toBe(false);
    expect(semestreValido(1.5, 4)).toBe(false);
  });

  it('FAC-04 reordena aulas sem deixar buracos na ordem', () => {
    const aulas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(reordenar(aulas, 'c', 1).map((a) => `${a.id}${a.ordem}`)).toEqual(['c1', 'a2', 'b3']);
    expect(reordenar(aulas, 'a', 99).map((a) => `${a.id}${a.ordem}`)).toEqual(['b1', 'c2', 'a3']);
    expect(reordenar(aulas, 'b', 0).map((a) => a.id)).toEqual(['b', 'a', 'c']);
    expect(() => reordenar(aulas, 'x', 1)).toThrow();
  });
});
