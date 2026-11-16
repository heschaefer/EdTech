import { Global, Module } from '@nestjs/common';
import { AlunosController, CadastroAlunoController } from './alunos.controller';
import { AlunosService } from './alunos.service';
import { CurriculoService } from './curriculo.service';
import { InativacaoAlunosService } from './inativacao.service';
import { LgpdService } from './lgpd.service';

@Global()
@Module({
  controllers: [CadastroAlunoController, AlunosController],
  providers: [InativacaoAlunosService, AlunosService, CurriculoService, LgpdService],
  exports: [InativacaoAlunosService, CurriculoService],
})
export class AlunosModule {}
