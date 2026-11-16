import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** Healthcheck para o Docker Compose e o CI. */
@Public()
@Controller('saude')
export class SaudeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async saude() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}

@Module({ controllers: [SaudeController] })
export class SaudeModule {}
