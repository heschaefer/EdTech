import { z } from 'zod';

// Espelho dos enums do Prisma (seção 7), para o front não depender do client do banco.
export const Papel = z.enum(['ALUNO', 'FACULDADE', 'EMPRESA', 'ADMIN']);
export type Papel = z.infer<typeof Papel>;

export const StatusUsuario = z.enum(['PENDENTE_VERIFICACAO', 'ATIVO', 'INATIVO', 'BLOQUEADO']);
export type StatusUsuario = z.infer<typeof StatusUsuario>;

export const TipoVaga = z.enum(['ESTAGIO', 'JOVEM_APRENDIZ', 'TRAINEE', 'CLT', 'PJ', 'TEMPORARIO']);
export type TipoVaga = z.infer<typeof TipoVaga>;

export const Modalidade = z.enum(['PRESENCIAL', 'HIBRIDO', 'REMOTO']);
export type Modalidade = z.infer<typeof Modalidade>;

export const StatusVaga = z.enum(['ABERTA', 'PAUSADA', 'PRAZO_EXPIRADO', 'ENCERRADA']);
export type StatusVaga = z.infer<typeof StatusVaga>;

export const StatusCandidatura = z.enum(['EM_PROCESSO', 'SELECIONADO', 'NAO_SELECIONADO', 'CANCELADA']);
export type StatusCandidatura = z.infer<typeof StatusCandidatura>;

export const StatusAprovacao = z.enum(['PENDENTE', 'APROVADA', 'REPROVADA']);
export type StatusAprovacao = z.infer<typeof StatusAprovacao>;

/** Painel inicial de cada papel (AUTH-01). */
export const PAINEL_POR_PAPEL: Record<Papel, string> = {
  ALUNO: '/aluno',
  FACULDADE: '/faculdade',
  EMPRESA: '/empresa',
  ADMIN: '/admin',
};
