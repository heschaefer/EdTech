import { DynamicModule, Module, OnApplicationShutdown } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ZodValidationPipe } from 'nestjs-zod';
import { rotasDeTesteAtivas } from './config/env';
import { ProblemFilter } from './common/filters/problem.filter';
import { CsrfGuard } from './common/guards/csrf.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LimiteGuard, limitePadrao } from './common/guards/limite.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { conexaoRedis } from './modules/email/redis';
import { AdminModule } from './modules/admin/admin.module';
import { FaculdadeModule } from './modules/faculdade/faculdade.module';
import { ManutencaoModule } from './modules/manutencao/manutencao.module';
import { OutboxModule } from './modules/notificacoes/outbox.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { VagasModule } from './modules/vagas/vagas.module';
import { CandidaturasModule } from './modules/candidaturas/candidaturas.module';
import { CicloModule } from './modules/ciclo/ciclo.module';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module';
import { AlunosModule } from './modules/alunos/alunos.module';
import { AreasModule } from './modules/areas/areas.controller';
import { SaudeModule } from './modules/saude.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CompartilhadoModule } from './modules/compartilhado.module';
import { EmailModule } from './modules/email/email.module';
import { InfraModule } from './prisma/prisma.module';
import { TestingModule } from './testing/testing.module';

@Module({})
export class AppModule implements OnApplicationShutdown {
  private static redisLimites?: ReturnType<typeof conexaoRedis>;

  static registrar(): DynamicModule {
    const redis = (AppModule.redisLimites = conexaoRedis());
    return {
      module: AppModule,
      imports: [
        InfraModule,
        EmailModule,
        CompartilhadoModule,
        ThrottlerModule.forRoot({
          // Padrão (seção 8.3): 100/min por usuário; rotas sensíveis sobrescrevem com @Limite().
          throttlers: [{ name: 'default', limit: limitePadrao, ttl: 60_000 }],
          storage: new ThrottlerStorageRedisService(redis),
        }),
        SaudeModule,
        AuthModule,
        AlunosModule,
        AreasModule,
        AdminModule,
        FaculdadeModule,
        ManutencaoModule,
        OutboxModule,
        EmpresasModule,
        VagasModule,
        CandidaturasModule,
        CicloModule,
        NotificacoesModule,
        // Seção 8.3 / SEG-08: o módulo /__test__ só existe em NODE_ENV=test com ENABLE_TEST_ROUTES=true.
        ...(rotasDeTesteAtivas() ? [TestingModule] : []),
      ],
      providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: ProblemFilter },
        // Ordem importa: sessão → papel → CSRF → rate limit (que usa o usuário da sessão).
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: LimiteGuard },
      ],
    };
  }

  async onApplicationShutdown() {
    await AppModule.redisLimites?.quit().catch(() => undefined);
  }
}
