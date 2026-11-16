import { encerrarVagaSchema, filtroNotificacoesSchema } from '../index';

describe('Schemas de notificações e encerramento', () => {
  it('ALU-11 filtro de não lidas vem da URL como texto', () => {
    expect(filtroNotificacoesSchema.parse({ naoLidas: 'true' })).toEqual({ naoLidas: true, page: 1, pageSize: 20 });
    expect(filtroNotificacoesSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(filtroNotificacoesSchema.safeParse({ naoLidas: 'sim' }).success).toBe(false);
  });

  it('EMP-11 encerrar aceita zero ou mais selecionados', () => {
    expect(encerrarVagaSchema.parse({})).toEqual({ selecionados: [] });
    expect(encerrarVagaSchema.safeParse({ selecionados: ['x'] }).success).toBe(false);
    expect(encerrarVagaSchema.safeParse({ selecionados: [], motivo: 'x' }).success).toBe(false);
  });
});
