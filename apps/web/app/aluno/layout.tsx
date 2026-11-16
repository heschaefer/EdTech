'use client';

import type { ReactNode } from 'react';
import { Painel, useMe } from '@/components/painel';

const LINKS = [
  { href: '/aluno/vagas', rotulo: 'Vagas' },
  { href: '/aluno/candidaturas', rotulo: 'Candidaturas' },
  { href: '/aluno/perfil', rotulo: 'Perfil' },
  { href: '/aluno/curriculo', rotulo: 'Currículo' },
  { href: '/aluno/privacidade', rotulo: 'Privacidade' },
];
const LINKS_INATIVO = [
  { href: '/aluno/trocar-faculdade', rotulo: 'Trocar de faculdade' },
  { href: '/aluno/candidaturas', rotulo: 'Histórico' },
  { href: '/aluno/privacidade', rotulo: 'Privacidade' },
];

export default function LayoutAluno({ children }: { children: ReactNode }) {
  // RN-22: aluno inativo só vê a troca de faculdade e o histórico (e os direitos de titular, seção 8.4).
  const { data: me } = useMe();
  return (
    <Painel titulo="Aluno" links={me?.status === 'INATIVO' ? LINKS_INATIVO : LINKS}>
      {children}
    </Painel>
  );
}
