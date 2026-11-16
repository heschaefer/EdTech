import { Global, Module } from '@nestjs/common';
import { ClockService } from '../common/clock.service';
import { CifraService } from '../common/cripto/cifra.service';
import { PrismaService } from './prisma.service';

/** Serviços de infraestrutura usados por todos os módulos. */
@Global()
@Module({
  providers: [PrismaService, ClockService, CifraService],
  exports: [PrismaService, ClockService, CifraService],
})
export class InfraModule {}
