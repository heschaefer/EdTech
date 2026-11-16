import type { VinculoInput } from '@vagas/contracts';
import { erroDeCampo } from '../../common/problema';
import { semestreValido, totalSemestres } from '../../domain/cursos';
import type { Tx } from '../../prisma/prisma.service';

/**
 * RN-05: curso ativo e turma (ativa) da própria faculdade; semestre entre 1 e duração × 2.
 * O curso ou a turma atuais do aluno continuam aceitos mesmo se inativados depois (FAC-03, RN-25).
 */
export async function validarVinculo(tx: Tx, faculdadeId: string, v: VinculoInput, atual?: { cursoId: string; turmaId: string }) {
  const curso = await tx.curso.findFirst({ where: { id: v.cursoId, faculdadeId } });
  if (!curso || (!curso.ativo && curso.id !== atual?.cursoId)) throw erroDeCampo('cursoId', 'Escolha um curso ativo da sua faculdade');
  const turma = await tx.turma.findFirst({ where: { id: v.turmaId, cursoId: curso.id } });
  if (!turma || (!turma.ativa && turma.id !== atual?.turmaId)) throw erroDeCampo('turmaId', 'Escolha uma turma do curso selecionado');
  if (!semestreValido(v.semestreAtual, curso.duracaoAnos)) {
    throw erroDeCampo('semestreAtual', `O semestre vai de 1 a ${totalSemestres(curso.duracaoAnos)} neste curso`);
  }
  return curso;
}

/** Cursos ativos com turmas ativas, para o cadastro (ALU-01) e a troca de faculdade (ALU-12). */
export function opcoesDeVinculo(tx: Tx, faculdadeId: string) {
  return tx.curso.findMany({
    where: { faculdadeId, ativo: true },
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      duracaoAnos: true,
      turmas: { where: { ativa: true }, orderBy: [{ anoIngresso: 'desc' }, { periodoIngresso: 'desc' }], select: { id: true, anoIngresso: true, periodoIngresso: true } },
    },
  });
}

/** RN-01: faculdade ATIVA dona do domínio do e-mail (igualdade exata, minúsculas). */
export async function faculdadeDoDominio(tx: Tx, dominio: string) {
  const d = await tx.dominioFaculdade.findUnique({ where: { dominio }, select: { faculdade: { select: { id: true, nomeFantasia: true, ativa: true } } } });
  return d?.faculdade.ativa ? d.faculdade : null;
}
