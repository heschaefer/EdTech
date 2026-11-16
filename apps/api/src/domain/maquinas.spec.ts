import { TransicaoInvalida } from './erros';
import { origensCandidatura, origensVaga, transicaoCandidatura, transicaoVaga } from './maquinas';

describe('Máquina de estados da vaga (seção 6)', () => {
  it('EMP-05 pausar só de ABERTA e reativar só de PAUSADA', () => {
    expect(transicaoVaga('pausar', 'ABERTA')).toBe('PAUSADA');
    expect(transicaoVaga('reativar', 'PAUSADA')).toBe('ABERTA');
    expect(() => transicaoVaga('pausar', 'PAUSADA')).toThrow(TransicaoInvalida);
    expect(() => transicaoVaga('reativar', 'ENCERRADA')).toThrow(TransicaoInvalida);
  });

  it('JOB-01 expira ABERTA ou PAUSADA', () => {
    expect(transicaoVaga('expirar', 'ABERTA')).toBe('PRAZO_EXPIRADO');
    expect(transicaoVaga('expirar', 'PAUSADA')).toBe('PRAZO_EXPIRADO');
    expect(() => transicaoVaga('expirar', 'ENCERRADA')).toThrow(TransicaoInvalida);
  });

  it('EMP-07 prorrogar vaga expirada volta para ABERTA; aberta ou pausada mantém o status', () => {
    expect(transicaoVaga('prorrogarExpirada', 'PRAZO_EXPIRADO')).toBe('ABERTA');
    expect(transicaoVaga('prorrogar', 'PAUSADA')).toBe('PAUSADA');
    expect(() => transicaoVaga('prorrogar', 'ENCERRADA')).toThrow(TransicaoInvalida);
  });

  it('EMP-11 JOB-02 encerrar manual de qualquer não encerrada; automático só de PRAZO_EXPIRADO', () => {
    for (const s of ['ABERTA', 'PAUSADA', 'PRAZO_EXPIRADO'] as const) expect(transicaoVaga('encerrar', s)).toBe('ENCERRADA');
    expect(() => transicaoVaga('encerrar', 'ENCERRADA')).toThrow(TransicaoInvalida);
    expect(() => transicaoVaga('encerrarAutomatico', 'ABERTA')).toThrow(TransicaoInvalida);
    expect(origensVaga('encerrarAutomatico')).toEqual(['PRAZO_EXPIRADO']);
  });

  it('EMP-04 editar é permitido enquanto a vaga não está ENCERRADA', () => {
    expect(transicaoVaga('editar', 'PRAZO_EXPIRADO')).toBe('PRAZO_EXPIRADO');
    expect(() => transicaoVaga('editar', 'ENCERRADA')).toThrow(TransicaoInvalida);
  });
});

describe('Máquina de estados da candidatura (seção 6)', () => {
  it('ALU-08 RN-10 só EM_PROCESSO é cancelada e só CANCELADA volta a EM_PROCESSO', () => {
    expect(transicaoCandidatura('cancelar', 'EM_PROCESSO')).toBe('CANCELADA');
    expect(transicaoCandidatura('reativar', 'CANCELADA')).toBe('EM_PROCESSO');
    expect(() => transicaoCandidatura('cancelar', 'SELECIONADO')).toThrow(TransicaoInvalida);
    expect(() => transicaoCandidatura('reativar', 'NAO_SELECIONADO')).toThrow(TransicaoInvalida);
  });

  it('EMP-10 RN-15 mover etapa e não selecionar só em EM_PROCESSO', () => {
    expect(transicaoCandidatura('moverEtapa', 'EM_PROCESSO')).toBe('EM_PROCESSO');
    expect(transicaoCandidatura('naoSelecionar', 'EM_PROCESSO')).toBe('NAO_SELECIONADO');
    expect(() => transicaoCandidatura('moverEtapa', 'CANCELADA')).toThrow(TransicaoInvalida);
  });

  it('EMP-11 RN-14 selecionar só em EM_PROCESSO', () => {
    expect(transicaoCandidatura('selecionar', 'EM_PROCESSO')).toBe('SELECIONADO');
    expect(origensCandidatura('selecionar')).toEqual(['EM_PROCESSO']);
    expect(() => transicaoCandidatura('selecionar', 'NAO_SELECIONADO')).toThrow(/candidatura em NAO_SELECIONADO/);
  });
});
