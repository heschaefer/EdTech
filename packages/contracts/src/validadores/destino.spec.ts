import { destinoInterno } from './destino';

describe('destinoInterno (open redirect, seção 8.3)', () => {
  it('SEG-ASVS aceita caminhos internos, com busca e âncora', () => {
    expect(destinoInterno('/aluno/vagas?tipo=CLT#x')).toBe('/aluno/vagas?tipo=CLT#x');
    expect(destinoInterno('/')).toBe('/');
  });

  it('SEG-ASVS recusa destinos externos ou ambíguos', () => {
    for (const ruim of ['https://evil.com', '//evil.com', '/\\evil.com', '/\\/evil.com', 'javascript:alert(1)', 'evil.com', '/\tevil', '', null, undefined, '/' + 'a'.repeat(600)]) {
      expect(destinoInterno(ruim as string)).toBeNull();
    }
  });
});
