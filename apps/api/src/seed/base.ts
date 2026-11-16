import type { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import { CifraService } from '../common/cripto/cifra.service';
import { hashSenha } from '../common/cripto/senha';

/** Catálogo inicial de áreas de formação (D1); o admin mantém depois. */
export const AREAS_BASE = [
  'Administração',
  'Comunicação e Marketing',
  'Contabilidade e Finanças',
  'Design',
  'Direito',
  'Educação',
  'Engenharia',
  'Saúde',
  'Tecnologia',
];

/** Valores só de desenvolvimento/demonstração (README). Em produção vêm do ambiente. */
export const ADMIN_PADRAO = {
  email: 'admin@vagas.local',
  senha: 'Demo@2026!',
  totp: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
};

export function credenciaisAdmin() {
  const prod = process.env.NODE_ENV === 'production';
  const ler = (nome: string, padrao: string) => {
    const v = process.env[nome];
    if (!v && prod) throw new Error(`${nome} é obrigatório em produção`);
    return v ?? padrao;
  };
  return {
    email: ler('ADMIN_EMAIL', ADMIN_PADRAO.email).toLowerCase(),
    senha: ler('ADMIN_SENHA', ADMIN_PADRAO.senha),
    totp: ler('ADMIN_TOTP_SECRET', ADMIN_PADRAO.totp),
  };
}

/** Seed base (Fase 0): admin com 2FA TOTP e áreas de formação. Idempotente. */
export async function seedBase(prisma: PrismaClient) {
  for (const nome of AREAS_BASE) {
    await prisma.areaFormacao.upsert({ where: { nome }, update: {}, create: { nome } });
  }
  const admin = credenciaisAdmin();
  if (!authenticator.check(authenticator.generate(admin.totp), admin.totp)) throw new Error('ADMIN_TOTP_SECRET inválido');
  const cifra = new CifraService();
  await prisma.usuario.upsert({
    where: { email: admin.email },
    update: {},
    create: {
      email: admin.email,
      senhaHash: await hashSenha(admin.senha),
      papel: 'ADMIN',
      status: 'ATIVO',
      emailVerificadoEm: new Date(),
      totpSecretCifrado: cifra.cifrar(admin.totp),
    },
  });
}
