import { Global, Module } from '@nestjs/common';
import { CadastroEmpresaController, EmpresaController } from './empresas.controller';
import { EmpresasService } from './empresas.service';

@Global()
@Module({ controllers: [CadastroEmpresaController, EmpresaController], providers: [EmpresasService], exports: [EmpresasService] })
export class EmpresasModule {}
