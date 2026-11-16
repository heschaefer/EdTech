import { Module } from '@nestjs/common';
import { AdminAreasService } from './admin-areas.service';
import { AdminController } from './admin.controller';
import { AdminFaculdadesService } from './admin-faculdades.service';

@Module({ controllers: [AdminController], providers: [AdminFaculdadesService, AdminAreasService] })
export class AdminModule {}
