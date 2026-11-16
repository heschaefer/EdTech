/** Testes de integração (seção 11): Jest + Supertest + Testcontainers (Postgres, Redis). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: 'test/.*\\.int-spec\\.ts$',
  moduleNameMapper: { '^@vagas/contracts$': '<rootDir>/../../packages/contracts/src' },
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  setupFiles: ['<rootDir>/test/env.ts'],
  testTimeout: 60_000,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts', '!src/worker.ts'],
  coverageDirectory: 'coverage-int',
};
