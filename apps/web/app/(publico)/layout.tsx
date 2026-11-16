import type { ReactNode } from 'react';

export default function LayoutPublico({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <p className="mb-6 text-center text-lg font-semibold text-indigo-700">Vagas Universitárias</p>
        {children}
      </div>
    </main>
  );
}
