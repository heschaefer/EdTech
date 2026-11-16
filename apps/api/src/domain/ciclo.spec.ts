import { deveEncerrarAutomatico, deveExpirar, deveLembrar, encerramentoAutomaticoEm, planoEncerramento } from './ciclo';
import { RegraViolada } from './erros';

const H = 3600_000;
const prazo = new Date('2026-11-10T02:59:59Z');
const depois = (horas: number) => new Date(prazo.getTime() + horas * H);
const vaga = (status: 'ABERTA' | 'PAUSADA' | 'PRAZO_EXPIRADO' | 'ENCERRADA', extra: object = {}) => ({ status, prazo, lembreteEnviadoEm: null, ...extra });

describe('Ciclo de vida da vaga (seção 10, jobs)', () => {
  it('JOB-01 RN-12 expira vaga ABERTA ou PAUSADA no instante do prazo, não antes', () => {
    expect(deveExpirar(vaga('ABERTA'), depois(-0.001))).toBe(false);
    expect(deveExpirar(vaga('ABERTA'), prazo)).toBe(true);
    expect(deveExpirar(vaga('PAUSADA'), depois(1))).toBe(true);
    expect(deveExpirar(vaga('PRAZO_EXPIRADO'), depois(1))).toBe(false);
    expect(deveExpirar(vaga('ENCERRADA'), depois(1))).toBe(false);
    expect(deveExpirar(vaga('ABERTA', { excluidaEm: prazo }), depois(1))).toBe(false);
  });

  it('JOB-03 EMP-12 lembrete 48 h após o prazo, uma única vez, e não depois das 72 h', () => {
    expect(deveLembrar(vaga('PRAZO_EXPIRADO'), depois(47))).toBe(false);
    expect(deveLembrar(vaga('PRAZO_EXPIRADO'), depois(48))).toBe(true);
    expect(deveLembrar(vaga('PRAZO_EXPIRADO', { lembreteEnviadoEm: depois(48) }), depois(50))).toBe(false);
    expect(deveLembrar(vaga('PRAZO_EXPIRADO'), depois(72))).toBe(false);
    expect(deveLembrar(vaga('ABERTA'), depois(50))).toBe(false);
  });

  it('JOB-02 RN-13 encerra automaticamente só PRAZO_EXPIRADO com 72 h de prazo vencido', () => {
    expect(deveEncerrarAutomatico(vaga('PRAZO_EXPIRADO'), depois(71.9))).toBe(false);
    expect(deveEncerrarAutomatico(vaga('PRAZO_EXPIRADO'), depois(72))).toBe(true);
    expect(deveEncerrarAutomatico(vaga('ABERTA'), depois(100))).toBe(false);
    expect(encerramentoAutomaticoEm(prazo).toISOString()).toBe('2026-11-13T02:59:59.000Z');
  });

  it('EMP-11 RN-14 selecionados viram SELECIONADO e os demais em processo NAO_SELECIONADO', () => {
    expect(planoEncerramento(['a', 'b', 'c'], ['b'])).toEqual({ selecionados: ['b'], naoSelecionados: ['a', 'c'] });
    expect(planoEncerramento(['a', 'b'], [])).toEqual({ selecionados: [], naoSelecionados: ['a', 'b'] });
    expect(planoEncerramento(['a', 'b'], ['a', 'a', 'b'])).toEqual({ selecionados: ['a', 'b'], naoSelecionados: [] });
    expect(planoEncerramento([], [])).toEqual({ selecionados: [], naoSelecionados: [] });
  });

  it('EMP-11 selecionar quem não está em processo é recusado', () => {
    expect(() => planoEncerramento(['a'], ['x'])).toThrow(RegraViolada);
  });
});
