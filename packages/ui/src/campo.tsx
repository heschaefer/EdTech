import { forwardRef, useId, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { rotulo: string; erro?: string | string[] };

/** Campo com rótulo acessível (getByLabel) e mensagens de erro ligadas por aria-describedby. */
export const Campo = forwardRef<HTMLInputElement, Props>(function Campo({ rotulo, erro, id, className = '', ...props }, ref) {
  const gerado = useId();
  const campoId = id ?? gerado;
  const erros = erro ? (Array.isArray(erro) ? erro : [erro]) : [];
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campoId} className="text-sm font-medium text-slate-800">
        {rotulo}
      </label>
      <input
        ref={ref}
        id={campoId}
        aria-invalid={erros.length > 0 || undefined}
        aria-describedby={erros.length ? `${campoId}-erro` : undefined}
        className={`rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500 ${className}`}
        {...props}
      />
      {erros.length > 0 && (
        <ul id={`${campoId}-erro`} className="text-sm text-red-700">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
});
