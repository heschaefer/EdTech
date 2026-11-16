import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { env } from './config/env';
import { requestId } from './common/request-id.middleware';

/** Configura a aplicação HTTP; usado pelo main.ts e pelos testes de integração. */
export function configurarApp(app: NestExpressApplication) {
  app.set('trust proxy', 1); // atrás do rewrite do Next: IP real vem do X-Forwarded-For
  app.disable('x-powered-by');
  app.setGlobalPrefix('api/v1');
  app.use(requestId);
  app.use(helmet()); // SEG-07
  app.use(cookieParser());
  app.enableShutdownHooks();

  if (env().NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Vagas Universitárias').setVersion('1').build());
    SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(doc));
  }
  return app;
}

export async function criarApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.registrar(), { bufferLogs: false });
  return configurarApp(app);
}
