'use client';

import type { ReactNode } from 'react';
import { Painel } from '@/components/painel';

const LINKS = [{ href: '/faculdade/cursos', rotulo: 'Cursos' }, { href: '/faculdade/alunos', rotulo: 'Alunos' }, { href: '/faculdade/perfil', rotulo: 'Perfil' }];

export default function LayoutFaculdade({ children }: { children: ReactNode }) {
  return (
    <Painel titulo="Faculdade" links={LINKS}>
      {children}
    </Painel>
  );
}
