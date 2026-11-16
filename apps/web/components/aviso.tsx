import type { ReactNode } from 'react';

const estilos = {
  sucesso: 'bg-green-50 text-green-800 ring-green-200',
  erro: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
};

/** Mensagens com papel acessível: `status` para sucesso/info, `alert` para erro. */
export function Aviso({ tipo = 'info', children }: { tipo?: keyof typeof estilos; children: ReactNode }) {
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-md p-3 text-sm ring-1 ${estilos[tipo]}`}>
      {children}
    </div>
  );
}
