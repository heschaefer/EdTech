import { Module } from '@nestjs/common';
import { AdminAreasService } from './admin-areas.service';
import { AdminEmpresasService } from './admin-empresas.service';
import { AdminController } from './admin.controller';
import { AdminFaculdadesService } from './admin-faculdades.service';

@Module({ controllers: [AdminController], providers: [AdminFaculdadesService, AdminAreasService, AdminEmpresasService] })
export class AdminModule {}
