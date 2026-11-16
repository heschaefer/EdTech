import { dataCivil, dataHoraBrasilia, fimDoDia, prazoVencido, somarAnos, somarHoras, validarPrazo } from './prazo';

describe('Prazo da vaga', () => {
  it('RN-11 D15 o prazo vale até 23:59:59 de Brasília (02:59:59 UTC do dia seguinte)', () => {
    expect(fimDoDia('2026-12-10').toISOString()).toBe('2026-12-11T02:59:59.000Z');
  });

  it('RN-24 converte instante UTC para a data civil de Brasília', () => {
    expect(dataCivil(new Date('2026-12-11T02:30:00Z'))).toBe('2026-12-10');
    expect(dataCivil(new Date('2026-12-11T03:00:00Z'))).toBe('2026-12-11');
  });

  it('RN-11 recusa prazo no passado ou hoje já encerrado', () => {
    const agora = new Date('2026-11-16T13:00:00Z');
    expect(validarPrazo('2026-11-15', agora, agora)).toEqual({ ok: false, erro: 'PRAZO_PASSADO' });
    expect(validarPrazo('2026-11-16', agora, agora).ok).toBe(true); // hoje ainda vale até 23:59
  });

  it('RN-11 D21 recusa prazo a mais de 1 ano da publicação, inclusive em prorrogação', () => {
    const publicada = new Date('2026-01-10T15:00:00Z');
    const agora = new Date('2026-11-16T13:00:00Z');
    expect(validarPrazo('2027-01-10', publicada, agora).ok).toBe(true);
    expect(validarPrazo('2027-01-11', publicada, agora)).toEqual({ ok: false, erro: 'PRAZO_ALEM_DE_1_ANO' });
  });

  it('RN-11 ano bissexto: 29/02 + 1 ano vira 28/02', () => {
    expect(somarAnos('2028-02-29', 1)).toBe('2029-02-28');
    expect(somarAnos('2026-05-01', 1)).toBe('2027-05-01');
  });

  it('RN-12 prazo vencido quando agora passa do instante', () => {
    const prazo = fimDoDia('2026-11-16');
    expect(prazoVencido(prazo, new Date('2026-11-17T02:59:58Z'))).toBe(false);
    expect(prazoVencido(prazo, new Date('2026-11-17T03:00:00Z'))).toBe(true);
    expect(somarHoras(prazo, 72).getTime() - prazo.getTime()).toBe(72 * 3600_000);
  });

  it('RN-11 data mal formatada lança erro', () => {
    expect(() => fimDoDia('10/12/2026')).toThrow();
  });
});

describe('dataHoraBrasilia', () => {
  it('RN-24 exibe em America/Sao_Paulo', () => {
    expect(dataHoraBrasilia(new Date('2026-11-13T02:59:59Z'))).toBe('12/11/2026 às 23:59');
  });
});
