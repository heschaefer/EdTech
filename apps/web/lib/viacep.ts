export type EnderecoViaCep = { logradouro: string; bairro: string; cidade: string; uf: string };

/** EMP-01: preenche o endereço pelo CEP; os campos continuam editáveis. */
export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.erro) return null;
    return { logradouro: d.logradouro ?? '', bairro: d.bairro ?? '', cidade: d.localidade ?? '', uf: d.uf ?? '' };
  } catch {
    return null;
  }
}
