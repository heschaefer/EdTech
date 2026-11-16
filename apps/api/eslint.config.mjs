import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Seção 8.3: só consultas Prisma parametrizadas
      'no-restricted-properties': [
        'error',
        { property: '$queryRawUnsafe', message: '$queryRawUnsafe é proibido (seção 8.3).' },
        { property: '$executeRawUnsafe', message: '$executeRawUnsafe é proibido (seção 8.3).' },
      ],
      // Seção 10: a hora vem sempre do ClockService
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Use ClockService.agora() em vez de new Date().',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Use ClockService.agora() em vez de Date.now().',
        },
      ],
    },
  },
  {
    files: ['src/common/clock.service.ts', 'src/seed/**/*.ts', 'prisma/**/*.ts', '**/*.spec.ts', 'test/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
