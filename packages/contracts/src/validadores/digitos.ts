export const somenteDigitos = (valor: string): string => (valor ?? '').replace(/\D/g, '');

export const todosIguais = (digitos: string): boolean => /^(\d)\1*$/.test(digitos);
