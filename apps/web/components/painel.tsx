'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Me } from '@vagas/contracts';
import { api, sair } from '@/lib/api';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<Me & { aprovacao?: string; aprovacaoMotivo?: string }>('/me') });
}

/** Estrutura comum dos quatro painéis: cabeçalho, navegação e conteúdo. */
export function Painel({ titulo, links, children }: { titulo: string; links: { href: string; rotulo: string }[]; children: ReactNode }) {
  const caminho = usePathname();
  const { data: me } = useMe();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-indigo-700">Vagas Universitárias · {titulo}</span>
            <nav aria-label="Principal" className="flex flex-wrap gap-4 text-sm">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={caminho.startsWith(l.href) ? 'page' : undefined}
                  className="text-slate-600 hover:text-slate-900 aria-[current=page]:font-semibold aria-[current=page]:text-indigo-700"
                >
                  {l.rotulo}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {me && <span className="text-slate-600">{me.nome}</span>}
            <button onClick={sair} className="rounded-md px-3 py-1 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function EmConstrucao({ fase, oQue }: { fase: number; oQue: string }) {
  return (
    <section className="rounded-lg bg-white p-6 ring-1 ring-slate-200">
      <h1 className="text-xl font-semibold">Em construção</h1>
      <p className="mt-2 text-slate-600">
        {oQue} chega na Fase {fase} do plano de implementação.
      </p>
    </section>
  );
}
