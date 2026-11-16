import { Global, Module } from '@nestjs/common';
import { ManutencaoService } from './manutencao.service';

@Global()
@Module({ providers: [ManutencaoService], exports: [ManutencaoService] })
export class ManutencaoModule {}
