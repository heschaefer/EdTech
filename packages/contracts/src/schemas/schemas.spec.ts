import { criarFaculdadeSchema, loginSchema, redefinirSenhaSchema } from '../index';

describe('Schemas Zod', () => {
  it('8.3 schemas estritos recusam chaves desconhecidas', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', senha: 'x', extra: 1 });
    expect(r.success).toBe(false);
  });

  it('RN-21 login normaliza o e-mail', () => {
    expect(loginSchema.parse({ email: 'A@B.COM', senha: 'x' }).email).toBe('a@b.com');
  });

  it('ADM-01 recusa domínio de provedor público e CNPJ inválido', () => {
    const r = criarFaculdadeSchema.safeParse({
      cnpj: '11222333000182',
      razaoSocial: 'Uni',
      nomeFantasia: 'Uni',
      telefone: '(11) 3333-4444',
      email: 'contato@uni.edu.br',
      dominios: ['gmail.com'],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path.join('.'));
      expect(campos).toEqual(expect.arrayContaining(['cnpj', 'dominios.0']));
    }
  });

  it('AUTH-04 redefinição exige confirmação igual e senha forte', () => {
    expect(redefinirSenhaSchema.safeParse({ token: 'x'.repeat(43), senha: 'Xq9#mVt2!pL', confirmacao: 'outra' }).success).toBe(false);
    expect(redefinirSenhaSchema.safeParse({ token: 'x'.repeat(43), senha: 'Xq9#mVt2!pL', confirmacao: 'Xq9#mVt2!pL' }).success).toBe(true);
  });
});
