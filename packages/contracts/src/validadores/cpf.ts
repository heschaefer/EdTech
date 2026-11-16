import { somenteDigitos, todosIguais } from './digitos';

/** RN-02: 11 dígitos, verificadores válidos e sem sequência repetida. */
export function cpfValido(entrada: string): boolean {
  const cpf = somenteDigitos(entrada);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(cpf.slice(0, 9), 10);
  const d2 = dv(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

export const normalizarCpf = somenteDigitos;

/** Exibição mascarada (seção 8.4): ***.456.789-** */
export function mascararCpf(entrada: string): string {
  const cpf = somenteDigitos(entrada);
  if (cpf.length !== 11) return '***.***.***-**';
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

/** Gera um CPF válido a partir de 9 dígitos-base (útil em seeds e testes). */
export function gerarCpf(base9: string): string {
  const base = somenteDigitos(base9).padStart(9, '0').slice(0, 9);
  const dv = (b: string, peso: number) => {
    const soma = [...b].reduce((acc, d, i) => acc + Number(d) * (peso - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(base, 10);
  const d2 = dv(base + d1, 11);
  return `${base}${d1}${d2}`;
}
