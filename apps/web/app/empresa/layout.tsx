'use client';

import type { ReactNode } from 'react';
import { Painel } from '@/components/painel';

const LINKS = [{ href: '/empresa/vagas', rotulo: 'Vagas' }, { href: '/empresa/perfil', rotulo: 'Perfil' }];

export default function LayoutEmpresa({ children }: { children: ReactNode }) {
  return (
    <Painel titulo="Empresa" links={LINKS}>
      {children}
    </Painel>
  );
}
