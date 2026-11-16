import { z } from 'zod';
import { StatusCandidatura } from '../enums';
import { uuid } from './comum';

export const ROTULOS_CANDIDATURA = {
  status: { EM_PROCESSO: 'Em processo', SELECIONADO: 'Selecionado', NAO_SELECIONADO: 'Não selecionado', CANCELADA: 'Cancelada' },
  evento: {
    CRIADA: 'Candidatura enviada',
    REATIVADA: 'Candidatura reenviada',
    ETAPA_ALTERADA: 'Mudança de etapa',
    CANCELADA: 'Candidatura cancelada',
    SELECIONADO: 'Selecionado',
    NAO_SELECIONADO: 'Não selecionado',
  },
} as const;

const pagina = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

/** ALU-09 (aba "Em andamento") e ALU-10 (aba "Histórico", com filtro por status). */
export const filtroCandidaturasAlunoSchema = z
  .object({
    aba: z.enum(['andamento', 'historico']).default('andamento'),
    status: z.enum(['SELECIONADO', 'NAO_SELECIONADO', 'CANCELADA']).optional(),
    ...pagina,
  })
  .strict();
export type FiltroCandidaturasAluno = z.infer<typeof filtroCandidaturasAlunoSchema>;

const semestre = z.coerce.number().int().min(1).max(12);

/** EMP-08: filtros por curso, faixa de semestre, faculdade, etapa e status; ordenação por data de candidatura. */
export const filtroCandidatosSchema = z
  .object({
    cursoId: uuid.optional(),
    faculdadeId: uuid.optional(),
    etapaId: uuid.optional(),
    semestreMin: semestre.optional(),
    semestreMax: semestre.optional(),
    status: StatusCandidatura.optional(),
    ordem: z.enum(['recentes', 'antigas']).default('antigas'),
    ...pagina,
  })
  .strict()
  .refine((f) => f.semestreMin == null || f.semestreMax == null || f.semestreMin <= f.semestreMax, {
    path: ['semestreMax'],
    message: 'O semestre final não pode ser menor que o inicial',
  });
export type FiltroCandidatos = z.infer<typeof filtroCandidatosSchema>;

/** EMP-10 */
export const moverEtapaSchema = z.object({ etapaId: uuid }).strict();
export type MoverEtapaInput = z.infer<typeof moverEtapaSchema>;
