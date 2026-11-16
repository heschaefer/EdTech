export function ErrosCampo({ id, erro }: { id: string; erro?: string | string[] }) {
  const erros = erro ? (Array.isArray(erro) ? erro : [erro]) : [];
  if (!erros.length) return null;
  return (
    <ul id={`${id}-erro`} className="text-sm text-red-700">
      {erros.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

export const temErro = (erro?: string | string[]) => (Array.isArray(erro) ? erro.length > 0 : !!erro);

export const CLASSE_CONTROLE =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500';
