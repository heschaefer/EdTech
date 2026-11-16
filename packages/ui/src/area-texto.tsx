import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { CLASSE_CONTROLE, ErrosCampo, temErro } from './erros-campo';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string; erro?: string | string[] };

export const AreaTexto = forwardRef<HTMLTextAreaElement, Props>(function AreaTexto({ rotulo, erro, id, className = '', rows = 4, ...props }, ref) {
  const gerado = useId();
  const campoId = id ?? gerado;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campoId} className="text-sm font-medium text-slate-800">
        {rotulo}
      </label>
      <textarea
        ref={ref}
        id={campoId}
        rows={rows}
        aria-invalid={temErro(erro) || undefined}
        aria-describedby={temErro(erro) ? `${campoId}-erro` : undefined}
        className={`${CLASSE_CONTROLE} ${className}`}
        {...props}
      />
      <ErrosCampo id={campoId} erro={erro} />
    </div>
  );
});
