'use client';

import type { ReactNode } from 'react';
import { Painel } from '@/components/painel';

const LINKS = [{ href: '/aluno/vagas', rotulo: 'Vagas' }, { href: '/aluno/candidaturas', rotulo: 'Candidaturas' }, { href: '/aluno/perfil', rotulo: 'Perfil' }];

export default function LayoutAluno({ children }: { children: ReactNode }) {
  return (
    <Painel titulo="Aluno" links={LINKS}>
      {children}
    </Painel>
  );
}
