import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CLASSE_CONTROLE, ErrosCampo, temErro } from './erros-campo';

type Props = SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string; erro?: string | string[]; children: ReactNode };

export const Selecao = forwardRef<HTMLSelectElement, Props>(function Selecao({ rotulo, erro, id, className = '', children, ...props }, ref) {
  const gerado = useId();
  const campoId = id ?? gerado;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campoId} className="text-sm font-medium text-slate-800">
        {rotulo}
      </label>
      <select
        ref={ref}
        id={campoId}
        aria-invalid={temErro(erro) || undefined}
        aria-describedby={temErro(erro) ? `${campoId}-erro` : undefined}
        className={`${CLASSE_CONTROLE} ${className}`}
        {...props}
      >
        {children}
      </select>
      <ErrosCampo id={campoId} erro={erro} />
    </div>
  );
});
