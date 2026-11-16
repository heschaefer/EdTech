'use client';

import type { ReactNode } from 'react';
import { Painel } from '@/components/painel';

const LINKS = [
  { href: '/admin/faculdades', rotulo: 'Faculdades' },
  { href: '/admin/areas', rotulo: 'Áreas de formação' },
  { href: '/admin/empresas', rotulo: 'Empresas' },
];

export default function LayoutAdmin({ children }: { children: ReactNode }) {
  return (
    <Painel titulo="Admin" links={LINKS}>
      {children}
    </Painel>
  );
}
