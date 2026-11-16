import { SENHAS_COMUNS } from '../dados/senhas-comuns';

export type RequisitoSenha =
  | 'TAMANHO'
  | 'MAIUSCULA'
  | 'MINUSCULA'
  | 'NUMERO'
  | 'ESPECIAL'
  | 'CONTEM_EMAIL'
  | 'SENHA_COMUM';

export const MENSAGENS_SENHA: Record<RequisitoSenha, string> = {
  TAMANHO: 'Entre 8 e 128 caracteres',
  MAIUSCULA: 'Ao menos 1 letra maiúscula',
  MINUSCULA: 'Ao menos 1 letra minúscula',
  NUMERO: 'Ao menos 1 número',
  ESPECIAL: 'Ao menos 1 caractere especial',
  CONTEM_EMAIL: 'Não pode conter a parte do e-mail antes do @',
  SENHA_COMUM: 'Senha muito comum',
};

/** RN-04: devolve a lista de requisitos NÃO atendidos (vazia = senha aceita). */
export function requisitosSenhaNaoAtendidos(senha: string, email?: string): RequisitoSenha[] {
  const falhas: RequisitoSenha[] = [];
  if (senha.length < 8 || senha.length > 128) falhas.push('TAMANHO');
  if (!/\p{Lu}/u.test(senha)) falhas.push('MAIUSCULA');
  if (!/\p{Ll}/u.test(senha)) falhas.push('MINUSCULA');
  if (!/\d/.test(senha)) falhas.push('NUMERO');
  if (!/[^\p{L}\p{N}]/u.test(senha)) falhas.push('ESPECIAL');
  const local = email?.split('@')[0]?.trim().toLowerCase();
  if (local && local.length >= 3 && senha.toLowerCase().includes(local)) falhas.push('CONTEM_EMAIL');
  if (SENHAS_COMUNS.has(senha.toLowerCase())) falhas.push('SENHA_COMUM');
  return falhas;
}
