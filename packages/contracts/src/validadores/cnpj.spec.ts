import { cnpjValido, gerarCnpj } from './cnpj';

describe('CNPJ', () => {
  it('RN-20 aceita CNPJ válido, com ou sem máscara', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000181')).toBe(true);
  });

  it('RN-20 recusa verificadores inválidos, repetidos e tamanho errado', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false);
  });

  it('RN-20 gerarCnpj produz CNPJs válidos', () => {
    expect(gerarCnpj('112223330001')).toBe('11222333000181');
    for (const base of ['000000000001', '123456780001', '987654320001']) {
      expect(cnpjValido(gerarCnpj(base))).toBe(true);
    }
  });
});
