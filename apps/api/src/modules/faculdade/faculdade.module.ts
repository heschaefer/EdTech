import { Module } from '@nestjs/common';
import { CursosService } from './cursos.service';
import { FaculdadeController } from './faculdade.controller';
import { FaculdadeAtualService } from './faculdade-atual.service';
import { GradeService } from './grade.service';
import { PerfilFaculdadeService } from './perfil.service';
import { TurmasService } from './turmas.service';

@Module({
  controllers: [FaculdadeController],
  providers: [FaculdadeAtualService, PerfilFaculdadeService, CursosService, GradeService, TurmasService],
})
export class FaculdadeModule {}
