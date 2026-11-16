import { requisitosSenhaNaoAtendidos } from './senha';

describe('Política de senha', () => {
  it('RN-04 aceita senha que cumpre todos os requisitos', () => {
    expect(requisitosSenhaNaoAtendidos('Demo@2026!', 'ana.souza@aluno.uhorizonte.edu.br')).toEqual([]);
  });

  it('RN-04 lista cada requisito não atendido', () => {
    expect(requisitosSenhaNaoAtendidos('abc')).toEqual(
      expect.arrayContaining(['TAMANHO', 'MAIUSCULA', 'NUMERO', 'ESPECIAL']),
    );
    expect(requisitosSenhaNaoAtendidos('abc')).not.toContain('MINUSCULA');
    expect(requisitosSenhaNaoAtendidos('A'.repeat(129) + 'a1!')).toContain('TAMANHO');
  });

  it('RN-04 recusa senha que contém a parte do e-mail antes do @', () => {
    expect(requisitosSenhaNaoAtendidos('Joaosilva@123', 'JoaoSilva@unifoo.edu.br')).toContain('CONTEM_EMAIL');
  });

  it('RN-04 recusa senha da lista das mais comuns (sem diferenciar maiúsculas)', () => {
    expect(requisitosSenhaNaoAtendidos('Password')).toContain('SENHA_COMUM');
    expect(requisitosSenhaNaoAtendidos('Xq9#mVt2!pL')).not.toContain('SENHA_COMUM');
  });
});
