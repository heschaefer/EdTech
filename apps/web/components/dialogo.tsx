'use client';

import { Botao } from '@vagas/ui';
import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = {
  titulo: string;
  children: ReactNode;
  rotuloConfirmar?: string;
  variante?: 'primario' | 'perigo';
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoFechar: () => void;
};

/**
 * Confirmação modal com o <dialog> nativo: papel `dialog`, foco preso dentro e Esc fecha.
 * Montado só quando aberto.
 */
export function Dialogo({ titulo, children, rotuloConfirmar = 'Confirmar', variante = 'primario', ocupado, aoConfirmar, aoFechar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-white p-6 shadow-xl ring-1 ring-slate-200 backdrop:bg-slate-900/40"
    >
      <h2 id={tituloId} className="mb-2 text-lg font-semibold">{titulo}</h2>
      <div className="mb-5 text-sm text-slate-700">{children}</div>
      <div className="flex flex-wrap justify-end gap-2">
        <Botao type="button" variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="button" variante={variante} disabled={ocupado} onClick={aoConfirmar}>{rotuloConfirmar}</Botao>
      </div>
    </dialog>
  );
}
