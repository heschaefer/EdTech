import { empresaVeNaLista, empresaVePerfil, primeiraEtapa, rotuloEtapa } from './candidaturas';
import { origensCandidatura, STATUS_HISTORICO, transicaoCandidatura } from './maquinas';
import { TransicaoInvalida } from './erros';

describe('Candidaturas (regras de domínio)', () => {
  it('ALU-07 RN-10 nasce e renasce na primeira etapa, pela ordem', () => {
    const etapas = [{ id: 'b', ordem: 2 }, { id: 'a', ordem: 1 }, { id: 'c', ordem: 3 }];
    expect(primeiraEtapa(etapas).id).toBe('a');
    expect(() => primeiraEtapa([])).toThrow();
  });

  it('ALU-08 RN-10 só remove EM_PROCESSO; só CANCELADA volta a EM_PROCESSO', () => {
    expect(transicaoCandidatura('cancelar', 'EM_PROCESSO')).toBe('CANCELADA');
    for (const s of ['SELECIONADO', 'NAO_SELECIONADO', 'CANCELADA'] as const) expect(() => transicaoCandidatura('cancelar', s)).toThrow(TransicaoInvalida);
    expect(origensCandidatura('reativar')).toEqual(['CANCELADA']);
  });

  it('ALU-09 etapa atual como "nome · n de total"', () => {
    const etapas = [{ ordem: 1 }, { ordem: 2 }, { ordem: 4 }, { ordem: 5 }];
    expect(rotuloEtapa({ nome: 'Entrevista técnica', ordem: 2 }, etapas)).toBe('Entrevista técnica · 2 de 4');
    expect(rotuloEtapa({ nome: 'Teste', ordem: 4 }, etapas)).toBe('Teste · 3 de 4');
    expect(rotuloEtapa({ nome: 'Órfã', ordem: 9 }, etapas)).toBe('Órfã');
    expect(rotuloEtapa(null, etapas)).toBeNull();
  });

  it('ALU-10 o histórico reúne os status finais', () => {
    expect(STATUS_HISTORICO.sort()).toEqual(['CANCELADA', 'NAO_SELECIONADO', 'SELECIONADO']);
  });

  it('EMP-08 D17 a empresa lista não canceladas e as canceladas por desligamento', () => {
    expect(empresaVeNaLista({ status: 'EM_PROCESSO', motivoCancelamento: null })).toBe(true);
    expect(empresaVeNaLista({ status: 'NAO_SELECIONADO', motivoCancelamento: null })).toBe(true);
    expect(empresaVeNaLista({ status: 'CANCELADA', motivoCancelamento: 'ALUNO_INATIVO' })).toBe(true);
    expect(empresaVeNaLista({ status: 'CANCELADA', motivoCancelamento: 'ALUNO_REMOVEU' })).toBe(false);
  });

  it('EMP-09 RN-19 perfil só com candidatura não cancelada', () => {
    expect(empresaVePerfil({ status: 'SELECIONADO', motivoCancelamento: null })).toBe(true);
    expect(empresaVePerfil({ status: 'CANCELADA', motivoCancelamento: 'ALUNO_INATIVO' })).toBe(false);
  });

  it('EMP-10 RN-15 mover etapa e não selecionar só com candidatura EM_PROCESSO', () => {
    expect(transicaoCandidatura('moverEtapa', 'EM_PROCESSO')).toBe('EM_PROCESSO');
    expect(transicaoCandidatura('naoSelecionar', 'EM_PROCESSO')).toBe('NAO_SELECIONADO');
    expect(() => transicaoCandidatura('naoSelecionar', 'SELECIONADO')).toThrow(TransicaoInvalida);
    expect(() => transicaoCandidatura('moverEtapa', 'CANCELADA')).toThrow(TransicaoInvalida);
  });
});
