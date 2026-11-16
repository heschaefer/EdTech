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

/** CNPJ com dígitos válidos, inventado. */
export function cnpjValido() {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('') + '0001';
  const dv = (b: string, pesos: number[]) => {
    const r = [...b].reduce((s, d, i) => s + Number(d) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = dv(base, p1);
  return `${base}${d1}${dv(base + d1, [6, ...p1])}`;
}

export const SENHA_PADRAO = 'Xq9#mVt2!pL';

export function dadosEmpresa() {
  const s = sufixo();
  return {
    razaoSocial: `Faísca ${s} LTDA`,
    nomeFantasia: `Faísca ${s}`,
    cnpj: cnpjValido(),
    telefone: '1133334444',
    email: `contato@faisca${s}.com.br`,
    senha: SENHA_PADRAO,
    confirmacao: SENHA_PADRAO,
    ramoAtuacao: 'Energia',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
  };
}

export const diasAFrente = (dias: number) => new Date(Date.now() + dias * 24 * 3600_000).toISOString().slice(0, 10);
