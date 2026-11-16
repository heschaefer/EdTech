import type { NextConfig } from 'next';
import path from 'node:path';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,
  transpilePackages: ['@vagas/ui'],
  // Seção 8: /api/* vai para a API pelo próprio Next, então os cookies são first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default config;
