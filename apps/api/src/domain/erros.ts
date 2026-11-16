/** Erros de domínio: puros, sem Nest. A camada HTTP os traduz (409/422). */
export class TransicaoInvalida extends Error {
  constructor(
    readonly entidade: 'vaga' | 'candidatura',
    readonly acao: string,
    readonly de: string,
  ) {
    super(`Transição inválida: ${entidade} em ${de} não aceita "${acao}"`);
  }
}

export class RegraViolada extends Error {}
