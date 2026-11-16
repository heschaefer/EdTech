import { Global, Module } from '@nestjs/common';
import { InativacaoAlunosService } from './inativacao.service';

@Global()
@Module({ providers: [InativacaoAlunosService], exports: [InativacaoAlunosService] })
export class AlunosModule {}
