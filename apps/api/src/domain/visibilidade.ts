import type { StatusAprovacao, StatusUsuario, StatusVaga } from '@vagas/contracts';

export type VagaParaVisibilidade = {
  status: StatusVaga;
  excluidaEm: Date | null;
  prazo: Date;
  semestreMinimo: number | null;
  areaIds: string[];
  empresa: { ativa: boolean; aprovacao: StatusAprovacao };
};

export type AlunoParaVisibilidade = {
  status: StatusUsuario;
  areaCursoId: string;
  semestreAtual: number;
};

/**
 * RN-08: vaga ABERTA + empresa ativa e aprovada + aluno ATIVO + área do curso entre as áreas
 * da vaga + semestre do aluno ≥ semestre mínimo, quando houver. Vaga excluída nunca aparece.
 */
export function vagaVisivel(vaga: VagaParaVisibilidade, aluno: AlunoParaVisibilidade): boolean {
  return (
    vaga.status === 'ABERTA' &&
    vaga.excluidaEm === null &&
    vaga.empresa.ativa &&
    vaga.empresa.aprovacao === 'APROVADA' &&
    aluno.status === 'ATIVO' &&
    vaga.areaIds.includes(aluno.areaCursoId) &&
    (vaga.semestreMinimo == null || aluno.semestreAtual >= vaga.semestreMinimo)
  );
}

/**
 * RN-09 + RN-12: só nasce candidatura em vaga visível e com prazo ainda não vencido
 * (o JOB-01 roda a cada 5 min; até lá o prazo já bloqueia).
 */
export function aceitaCandidatura(vaga: VagaParaVisibilidade, aluno: AlunoParaVisibilidade, agora: Date): boolean {
  return vagaVisivel(vaga, aluno) && vaga.prazo.getTime() > agora.getTime();
}

/** Mesma regra RN-08 como filtro Prisma, para a listagem (ALU-05). */
export function filtroVagasVisiveis(aluno: AlunoParaVisibilidade, agora: Date) {
  if (aluno.status !== 'ATIVO') return { id: { in: [] as string[] } };
  return {
    status: 'ABERTA' as const,
    excluidaEm: null,
    prazo: { gt: agora },
    empresa: { ativa: true, aprovacao: 'APROVADA' as const },
    areas: { some: { areaId: aluno.areaCursoId } },
    OR: [{ semestreMinimo: null }, { semestreMinimo: { lte: aluno.semestreAtual } }],
  };
}
