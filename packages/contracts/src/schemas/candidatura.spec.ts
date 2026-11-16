import { filtroCandidatosSchema, filtroCandidaturasAlunoSchema, moverEtapaSchema } from '../index';

const ID = '7d0f5a5e-8a43-4d3a-9d8a-1b2c3d4e5f60';

describe('Schemas de candidatura', () => {
  it('ALU-09 a aba padrão é "Em andamento", 20 por página', () => {
    expect(filtroCandidaturasAlunoSchema.parse({})).toEqual({ aba: 'andamento', page: 1, pageSize: 20 });
  });

  it('ALU-10 o histórico filtra só pelos status finais', () => {
    expect(filtroCandidaturasAlunoSchema.parse({ aba: 'historico', status: 'CANCELADA' }).status).toBe('CANCELADA');
    expect(filtroCandidaturasAlunoSchema.safeParse({ aba: 'historico', status: 'EM_PROCESSO' }).success).toBe(false);
    expect(filtroCandidaturasAlunoSchema.safeParse({ aba: 'outra' }).success).toBe(false);
  });

  it('EMP-08 aceita os filtros da URL e ordena pela data de candidatura', () => {
    const f = filtroCandidatosSchema.parse({ cursoId: ID, semestreMin: '2', semestreMax: '6', status: 'EM_PROCESSO' });
    expect(f).toMatchObject({ cursoId: ID, semestreMin: 2, semestreMax: 6, status: 'EM_PROCESSO', ordem: 'antigas' });
    expect(filtroCandidatosSchema.safeParse({ ordem: 'nome' }).success).toBe(false);
  });

  it('EMP-08 faixa de semestre invertida e chave desconhecida são recusadas', () => {
    expect(filtroCandidatosSchema.safeParse({ semestreMin: 5, semestreMax: 2 }).success).toBe(false);
    expect(filtroCandidatosSchema.safeParse({ cpf: '1' }).success).toBe(false);
  });

  it('EMP-10 mover etapa exige o id da etapa', () => {
    expect(moverEtapaSchema.safeParse({ etapaId: ID }).success).toBe(true);
    expect(moverEtapaSchema.safeParse({ etapaId: 'x' }).success).toBe(false);
    expect(moverEtapaSchema.safeParse({}).success).toBe(false);
  });
});
