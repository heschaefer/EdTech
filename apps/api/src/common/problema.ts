import { HttpException, HttpStatus } from '@nestjs/common';

type ErroCampo = { campo: string; mensagem: string };

/** Exceção que vira problem+json (seção 9). */
export class Problema extends HttpException {
  constructor(
    status: number,
    readonly titulo: string,
    readonly detalhe?: string,
    readonly erros?: ErroCampo[],
    readonly extras?: Record<string, unknown>,
    readonly tipo?: string,
  ) {
    super(titulo, status);
  }
}

export const naoEncontrado = (detalhe = 'Recurso não encontrado') =>
  new Problema(HttpStatus.NOT_FOUND, 'Não encontrado', detalhe);

export const conflito = (detalhe: string, extras?: Record<string, unknown>) =>
  new Problema(HttpStatus.CONFLICT, 'Conflito', detalhe, undefined, extras);

export const regraDeNegocio = (detalhe: string, erros?: ErroCampo[]) =>
  new Problema(HttpStatus.UNPROCESSABLE_ENTITY, 'Regra de negócio', detalhe, erros);

export const erroDeCampo = (campo: string, mensagem: string, status = HttpStatus.UNPROCESSABLE_ENTITY) =>
  new Problema(status, 'Dados inválidos', mensagem, [{ campo, mensagem }]);

export const naoAutenticado = (detalhe = 'Sessão inválida ou expirada', extras?: Record<string, unknown>, tipo?: string) =>
  new Problema(HttpStatus.UNAUTHORIZED, 'Não autenticado', detalhe, undefined, extras, tipo);

export const proibido = (detalhe = 'Acesso negado') => new Problema(HttpStatus.FORBIDDEN, 'Proibido', detalhe);
