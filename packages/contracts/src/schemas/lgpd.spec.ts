import { excluirContaSchema, filtroAuditoriaSchema } from '../index';

describe('Schemas de LGPD (seção 8.4)', () => {
  it('LGPD exclusão exige senha e a palavra EXCLUIR', () => {
    expect(excluirContaSchema.safeParse({ senha: 'x', confirmacao: 'EXCLUIR' }).success).toBe(true);
    expect(excluirContaSchema.safeParse({ senha: 'x', confirmacao: 'excluir' }).success).toBe(false);
    expect(excluirContaSchema.safeParse({ senha: '', confirmacao: 'EXCLUIR' }).success).toBe(false);
    expect(excluirContaSchema.safeParse({ senha: 'x', confirmacao: 'EXCLUIR', extra: 1 }).success).toBe(false);
  });

  it('LGPD filtro da auditoria com 50 por página', () => {
    expect(filtroAuditoriaSchema.parse({ acao: 'EMPRESA_VIU_PERFIL' })).toEqual({ acao: 'EMPRESA_VIU_PERFIL', page: 1, pageSize: 50 });
  });
});
