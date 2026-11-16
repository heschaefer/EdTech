import { Module } from '@nestjs/common';
import { VagasAlunoController, VagasEmpresaController } from './vagas.controller';
import { VagasAlunoService } from './vagas-aluno.service';
import { VagasEmpresaService } from './vagas-empresa.service';

@Module({
  controllers: [VagasEmpresaController, VagasAlunoController],
  providers: [VagasEmpresaService, VagasAlunoService],
  exports: [VagasAlunoService],
})
export class VagasModule {}
