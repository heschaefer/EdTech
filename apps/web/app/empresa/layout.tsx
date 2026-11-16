'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Aviso } from '@/components/aviso';
import { Painel, useMe } from '@/components/painel';

const LINKS = [
  { href: '/empresa/vagas', rotulo: 'Vagas' },
  { href: '/empresa/perfil', rotulo: 'Perfil' },
];

/** D20 / EMP-01: até a aprovação, a empresa vê o aviso "Cadastro em análise"; reprovada, vê o motivo. */
export default function LayoutEmpresa({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  return (
    <Painel titulo="Empresa" links={LINKS}>
      {me?.aprovacao === 'PENDENTE' && (
        <div className="mb-6">
          <Aviso tipo="info">Cadastro em análise. Você já pode completar o perfil; a publicação de vagas é liberada depois da aprovação do administrador.</Aviso>
        </div>
      )}
      {me?.aprovacao === 'REPROVADA' && (
        <div className="mb-6">
          <Aviso tipo="erro">
            Cadastro reprovado. Motivo: {me.aprovacaoMotivo}.{' '}
            <Link href="/empresa/perfil" className="underline">Corrija o perfil e peça uma nova análise</Link>.
          </Aviso>
        </div>
      )}
      {children}
    </Painel>
  );
}
