import { aceitaCandidatura, filtroVagasVisiveis, vagaVisivel, type AlunoParaVisibilidade, type VagaParaVisibilidade } from './visibilidade';

const AGORA = new Date('2026-11-16T13:00:00Z');
const vaga = (o: Partial<VagaParaVisibilidade> = {}): VagaParaVisibilidade => ({
  status: 'ABERTA',
  excluidaEm: null,
  prazo: new Date('2026-12-01T02:59:59Z'),
  semestreMinimo: null,
  areaIds: ['tec'],
  empresa: { ativa: true, aprovacao: 'APROVADA' },
  ...o,
});
const aluno = (o: Partial<AlunoParaVisibilidade> = {}): AlunoParaVisibilidade => ({
  status: 'ATIVO',
  areaCursoId: 'tec',
  semestreAtual: 3,
  ...o,
});

describe('Visibilidade da vaga (RN-08)', () => {
  it('ALU-05 RN-08 aluno ativo vê vaga aberta da sua área', () => {
    expect(vagaVisivel(vaga(), aluno())).toBe(true);
  });

  it('ALU-05 RN-08 vaga de outra área não aparece', () => {
    expect(vagaVisivel(vaga({ areaIds: ['dir'] }), aluno())).toBe(false);
  });

  it('ALU-05 RN-08 respeita o semestre mínimo quando existe (D22)', () => {
    expect(vagaVisivel(vaga({ semestreMinimo: 4 }), aluno({ semestreAtual: 3 }))).toBe(false);
    expect(vagaVisivel(vaga({ semestreMinimo: 3 }), aluno({ semestreAtual: 3 }))).toBe(true);
  });

  it('RN-08 RN-16 vaga pausada, expirada, encerrada ou excluída não aparece', () => {
    for (const status of ['PAUSADA', 'PRAZO_EXPIRADO', 'ENCERRADA'] as const) expect(vagaVisivel(vaga({ status }), aluno())).toBe(false);
    expect(vagaVisivel(vaga({ excluidaEm: AGORA }), aluno())).toBe(false);
  });

  it('RN-08 RN-26 empresa inativa ou não aprovada esconde a vaga', () => {
    expect(vagaVisivel(vaga({ empresa: { ativa: false, aprovacao: 'APROVADA' } }), aluno())).toBe(false);
    expect(vagaVisivel(vaga({ empresa: { ativa: true, aprovacao: 'PENDENTE' } }), aluno())).toBe(false);
  });

  it('RN-22 aluno INATIVO não vê vagas', () => {
    expect(vagaVisivel(vaga(), aluno({ status: 'INATIVO' }))).toBe(false);
    expect(filtroVagasVisiveis(aluno({ status: 'INATIVO' }), AGORA)).toEqual({ id: { in: [] } });
  });

  it('ALU-07 RN-12 prazo vencido bloqueia candidatura mesmo antes do job', () => {
    expect(aceitaCandidatura(vaga(), aluno(), AGORA)).toBe(true);
    expect(aceitaCandidatura(vaga({ prazo: new Date('2026-11-16T12:00:00Z') }), aluno(), AGORA)).toBe(false);
  });

  it('ALU-05 o filtro Prisma traduz a mesma regra', () => {
    expect(filtroVagasVisiveis(aluno(), AGORA)).toMatchObject({
      status: 'ABERTA',
      excluidaEm: null,
      areas: { some: { areaId: 'tec' } },
      OR: [{ semestreMinimo: null }, { semestreMinimo: { lte: 3 } }],
    });
  });
});
