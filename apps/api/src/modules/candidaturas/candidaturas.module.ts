import { Module } from '@nestjs/common';
import { VagasModule } from '../vagas/vagas.module';
import { CandidaturasAlunoService } from './candidaturas-aluno.service';
import { CandidaturasEmpresaService } from './candidaturas-empresa.service';
import { CandidaturasAlunoController, CandidaturasEmpresaController } from './candidaturas.controller';

@Module({
  imports: [VagasModule],
  controllers: [CandidaturasAlunoController, CandidaturasEmpresaController],
  providers: [CandidaturasAlunoService, CandidaturasEmpresaService],
})
export class CandidaturasModule {}
