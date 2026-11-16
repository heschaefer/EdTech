import { cpfValido, gerarCpf, mascararCpf } from './cpf';

describe('CPF', () => {
  it('RN-02 aceita CPF com verificadores válidos, com ou sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('RN-02 recusa dígitos verificadores inválidos', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
  });

  it('RN-02 recusa sequências repetidas e tamanho errado', () => {
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('000.000.000-00')).toBe(false);
    expect(cpfValido('1234567890')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });

  it('RN-02 gerarCpf produz CPFs válidos', () => {
    for (const base of ['123456789', '987654321', '000000001', '529982247']) {
      expect(cpfValido(gerarCpf(base))).toBe(true);
    }
    expect(gerarCpf('529982247')).toBe('52998224725');
  });

  it('8.4 exibe o CPF mascarado', () => {
    expect(mascararCpf('123.456.789-09')).toBe('***.456.789-**');
    expect(mascararCpf('x')).toBe('***.***.***-**');
  });
});
