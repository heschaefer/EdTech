import * as argon2 from 'argon2';

/** Seção 8.1: argon2id, 19 MiB, 2 iterações, paralelismo 1. */
const OPCOES = { type: argon2.argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 } as const;

export const hashSenha = (senha: string) => argon2.hash(senha, OPCOES);

export async function senhaConfere(hash: string | null | undefined, senha: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, senha);
  } catch {
    return false;
  }
}

/** Hash fixo para gastar o mesmo tempo quando o e-mail não existe (evita enumeração por tempo). */
let hashFicticio: Promise<string> | undefined;
export const hashParaComparacaoCega = () => (hashFicticio ??= hashSenha('senha-ficticia-para-tempo-constante'));
