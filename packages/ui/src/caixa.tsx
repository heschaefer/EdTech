import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { ErrosCampo, temErro } from './erros-campo';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { rotulo: ReactNode; erro?: string | string[] };

export const Caixa = forwardRef<HTMLInputElement, Props>(function Caixa({ rotulo, erro, id, ...props }, ref) {
  const gerado = useId();
  const campoId = id ?? gerado;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <input
          ref={ref}
          id={campoId}
          type="checkbox"
          aria-invalid={temErro(erro) || undefined}
          aria-describedby={temErro(erro) ? `${campoId}-erro` : undefined}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          {...props}
        />
        <label htmlFor={campoId} className="text-sm text-slate-800">
          {rotulo}
        </label>
      </div>
      <ErrosCampo id={campoId} erro={erro} />
    </div>
  );
});
