import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, criarApp } from './util';

describe('Segurança: rotas de teste', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp({ ENABLE_TEST_ROUTES: 'false' });
  });
  afterAll(() => app.close());

  it('SEG-08 /__test__ não existe sem NODE_ENV=test e ENABLE_TEST_ROUTES=true', async () => {
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(404);
    await request(app.getHttpServer()).post(`${API}/__test__/cenarios`).send({}).expect(404);
  });
});
