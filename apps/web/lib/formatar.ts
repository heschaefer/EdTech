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

/** RN-24: datas guardadas em UTC e exibidas em America/Sao_Paulo. */
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
export const formatarData = (iso: string | Date) => fmtData.format(new Date(iso));

/** Data civil (AAAA-MM-DD) de Brasília, para inputs type="date". */
export const dataCivilSP = (iso: string | Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export function formatarSalario(s: { aCombinar: boolean; min: number | null; max: number | null }) {
  if (s.aCombinar) return 'A combinar';
  if (s.min != null && s.max != null) return s.min === s.max ? moeda.format(s.min) : `${moeda.format(s.min)} a ${moeda.format(s.max)}`;
  return s.min != null ? `A partir de ${moeda.format(s.min)}` : `Até ${moeda.format(s.max!)}`;
}

export const formatarCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
export const formatarCnpj = (v: string) =>
  v.replace(/\D/g, '').slice(0, 14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2');

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatarDataHora = (iso: string | Date) => fmtDataHora.format(new Date(iso));
