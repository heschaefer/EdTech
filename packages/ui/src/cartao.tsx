import type { HTMLAttributes } from 'react';

export function Cartao({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200 ${className}`} {...props} />;
}
