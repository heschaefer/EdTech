/** RN-21: e-mail comparado sempre em minúsculas. */
export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

/** RN-01: domínio = parte após o @, em minúsculas. */
export const dominioDoEmail = (email: string): string => normalizarEmail(email).split('@')[1] ?? '';

/** ADM-01: domínios de provedores públicos não podem ser domínio estudantil. */
export const PROVEDORES_PUBLICOS: ReadonlySet<string> = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.com.br', 'hotmail.com', 'hotmail.com.br',
  'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.br', 'ymail.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com', 'globomail.com',
  'protonmail.com', 'proton.me', 'zoho.com', 'gmx.com', 'mail.com', 'yandex.com',
]);

const REGEX_DOMINIO = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export const dominioValido = (dominio: string): boolean => REGEX_DOMINIO.test(dominio);
