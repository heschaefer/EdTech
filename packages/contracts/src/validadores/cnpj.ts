import { somenteDigitos, todosIguais } from './digitos';

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, ...PESOS_1];

const dv = (base: string, pesos: number[]) => {
  const soma = [...base].reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

/** RN-20: 14 dígitos e verificadores válidos. */
export function cnpjValido(entrada: string): boolean {
  const cnpj = somenteDigitos(entrada);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;
  return dv(cnpj.slice(0, 12), PESOS_1) === Number(cnpj[12]) && dv(cnpj.slice(0, 13), PESOS_2) === Number(cnpj[13]);
}

export const normalizarCnpj = somenteDigitos;

/** Gera um CNPJ válido a partir de 12 dígitos-base (seeds e testes). */
export function gerarCnpj(base12: string): string {
  const base = somenteDigitos(base12).padStart(12, '0').slice(0, 12);
  const d1 = dv(base, PESOS_1);
  const d2 = dv(base + d1, PESOS_2);
  return `${base}${d1}${d2}`;
}
