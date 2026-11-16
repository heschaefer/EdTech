import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { Public } from '../common/decorators';
import { PrazosService } from '../modules/ciclo/prazos.service';
import { OutboxService } from '../modules/notificacoes/outbox.service';
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
  constructor(
    private readonly testing: TestingService,
    private readonly outbox: OutboxService,
    private readonly prazos: PrazosService,
  ) {}

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

  /** Roda um job na hora; com `vagaId`, só para essa vaga, sem afetar testes paralelos (seção 9). */
  @Post('jobs/:nome')
  @HttpCode(200)
  async job(@Param('nome') nome: string, @Body() body: { vagaId?: string }) {
    const job = z.enum(JOBS).parse(nome);
    if (job === 'enviar-emails') return { processados: await this.outbox.processar() };
    const vagaId = z.string().uuid().optional().parse(body?.vagaId ?? undefined);
    return { processados: await this.prazos.rodar(job, vagaId) };
  }
}
