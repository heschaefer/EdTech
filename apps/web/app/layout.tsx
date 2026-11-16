import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Provedores } from '@/components/provedores';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vagas Universitárias',
  description: 'Vagas de estágio e emprego para alunos das faculdades parceiras',
};

/**
 * Ler o nonce torna todas as páginas dinâmicas: o Next aplica o nonce da CSP (gerado no
 * middleware) aos próprios scripts; página estática não teria nonce e seria bloqueada.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  await headers();
  return (
    <html lang="pt-BR">
      <body>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
