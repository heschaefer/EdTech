import { Global, Module } from '@nestjs/common';
import { EncerramentoService } from './encerramento.service';
import { PrazosService } from './prazos.service';

/** Ciclo de vida da vaga: encerramento com devolutiva (EMP-11) e jobs de prazo (JOB-01 a JOB-03). Usado pela API e pelo worker. */
@Global()
@Module({ providers: [EncerramentoService, PrazosService], exports: [EncerramentoService, PrazosService] })
export class CicloModule {}
