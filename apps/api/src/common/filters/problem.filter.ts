import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { Problema } from '../problema';

const TITULOS: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Proibido',
  404: 'Não encontrado',
  409: 'Conflito',
  422: 'Regra de negócio',
  413: 'Requisição grande demais',
  415: 'Tipo de conteúdo não suportado',
  429: 'Muitas requisições',
  500: 'Erro interno',
};

/** Converte qualquer erro em application/problem+json, sem stack trace (seção 8.3). */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erro');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const corpo = this.montar(exception);

    if (corpo.status >= 500) {
      this.logger.error(`[${req.headers['x-request-id'] ?? '-'}] ${(exception as Error)?.message}`, (exception as Error)?.stack);
    }
    res.status(corpo.status).type('application/problem+json').json(corpo);
  }

  private montar(e: unknown): Record<string, unknown> & { status: number } {
    const base = (status: number, extra: Record<string, unknown> = {}) => ({
      type: 'about:blank',
      title: TITULOS[status] ?? 'Erro',
      ...extra,
      status,
    });

    if (e instanceof Problema) {
      // Extras vêm antes: nunca sobrescrevem os campos padrão do problem+json (status, type…).
      return base(e.getStatus(), {
        ...(e.extras ?? {}),
        ...(e.tipo ? { type: e.tipo } : {}),
        title: e.titulo,
        ...(e.detalhe ? { detail: e.detalhe } : {}),
        ...(e.erros ? { errors: e.erros } : {}),
      });
    }
    if (e instanceof ZodValidationException) {
      return base(400, { detail: 'Dados inválidos', errors: errosZod(e.getZodError() as ZodError) });
    }
    if (e instanceof ZodError) {
      return base(400, { detail: 'Dados inválidos', errors: errosZod(e) });
    }
    if (e instanceof ThrottlerException) {
      return base(429, { detail: 'Limite de requisições atingido. Tente novamente em instantes.' });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return base(409, { detail: 'Registro duplicado' });
      if (e.code === 'P2025') return base(404, { detail: 'Recurso não encontrado' });
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const resp = e.getResponse();
      const detail = typeof resp === 'string' ? resp : (resp as { message?: unknown }).message;
      return base(status, typeof detail === 'string' ? { detail } : {});
    }
    // Erros do body-parser (antes do Nest): JSON malformado, corpo acima de 100 kB, charset inválido.
    const corpo = e as { type?: string } | null;
    if (corpo?.type === 'entity.parse.failed') return base(400, { detail: 'JSON inválido' });
    if (corpo?.type === 'entity.too.large') return base(413, { detail: 'O corpo da requisição passa do limite de 100 kB' });
    if (corpo?.type === 'charset.unsupported' || corpo?.type === 'encoding.unsupported') return base(415, { detail: 'Codificação não suportada' });
    return base(HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

function errosZod(err: ZodError) {
  return err.issues.flatMap((i) =>
    i.code === 'unrecognized_keys'
      ? i.keys.map((k) => ({ campo: [...i.path, k].join('.'), mensagem: 'Campo não permitido' }))
      : [{ campo: i.path.join('.') || '_', mensagem: i.message }],
  );
}
