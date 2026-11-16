import { dominioDoEmail, dominioValido, normalizarEmail, PROVEDORES_PUBLICOS } from './email';

describe('E-mail e domínio', () => {
  it('RN-21 normaliza e-mail em minúsculas', () => {
    expect(normalizarEmail('  Ana.Souza@Aluno.UHorizonte.edu.br ')).toBe('ana.souza@aluno.uhorizonte.edu.br');
  });

  it('RN-01 extrai o domínio em minúsculas', () => {
    expect(dominioDoEmail('X@Aluno.UniFoo.edu.br')).toBe('aluno.unifoo.edu.br');
    expect(dominioDoEmail('semarroba')).toBe('');
  });

  it('ADM-01 reconhece provedores públicos e domínios inválidos', () => {
    expect(PROVEDORES_PUBLICOS.has('gmail.com')).toBe(true);
    expect(dominioValido('aluno.unifoo.edu.br')).toBe(true);
    expect(dominioValido('sem_ponto')).toBe(false);
  });
});
