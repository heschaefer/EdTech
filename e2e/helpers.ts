/** CPF com dígitos válidos, inventado (seção 10.1). */
export function cpfValido() {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  const dv = (b: string, peso: number) => {
    const r = ([...b].reduce((s, d, i) => s + Number(d) * (peso - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base, 10);
  return `${base}${d1}${dv(base + d1, 11)}`;
}

export const sufixo = () => Math.random().toString(36).slice(2, 8);
