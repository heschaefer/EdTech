import { Body, Controller, HttpCode, NotImplementedException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { Public } from '../common/decorators';
import { TestingService, type OpcoesCenario } from './testing.service';

const cenarioSchema = z
  .object({
    areaCurso: z.string().optional(),
    areasVaga: z.array(z.string()).optional(),
    comCandidatura: z.boolean().optional(),
    semestreMinimo: z.number().int().optional(),
  })
  .strict();

const JOBS = ['expirar-prazos', 'lembrete', 'encerrar-automatico', 'enviar-emails'] as const;

/** Fora do rate limit: são chamadas em massa pelos testes paralelos. */
@Public()
@SkipThrottle()
@Controller('__test__')
export class TestingController {
  constructor(private readonly testing: TestingService) {}

  @Post('reset')
  @HttpCode(204)
  reset() {
    return this.testing.reset();
  }

  @Post('cenarios')
  cenario(@Body() body: OpcoesCenario) {
    return this.testing.cenario(cenarioSchema.parse(body ?? {}));
  }

  @Post('admins')
  admin() {
    return this.testing.criarAdmin();
  }

  @Post('vagas/:id/prazo')
  @HttpCode(204)
  prazo(@Param('id', ParseUUIDPipe) id: string, @Body() body: { prazo: string }) {
    return this.testing.moverPrazo(id, z.coerce.date().parse(body?.prazo));
  }

  @Post('jobs/:nome')
  job(@Param('nome') nome: string) {
    z.enum(JOBS).parse(nome);
    // Os jobs de prazo e o outbox de e-mail entram na Fase 6.
    throw new NotImplementedException(`Job ${nome} ainda não implementado (Fase 6)`);
  }
}
