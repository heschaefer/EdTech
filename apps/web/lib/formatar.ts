export const formatarCpf = (v: string) =>
  v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

export const formatarTelefone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

export const nomeTurma = (t: { anoIngresso: number; periodoIngresso: number }) => `${t.anoIngresso}/${t.periodoIngresso}`;

/** Lista de etiquetas digitadas separadas por vírgula. */
export const etiquetas = (texto: string) => [...new Set(texto.split(',').map((s) => s.trim()).filter(Boolean))];
