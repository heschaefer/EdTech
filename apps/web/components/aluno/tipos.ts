export type TurmaOpcao = { id: string; anoIngresso: number; periodoIngresso: number };
export type CursoOpcao = { id: string; nome: string; duracaoAnos: number; turmas: TurmaOpcao[] };
export type OpcoesFaculdade = { faculdade: { id: string; nome: string }; cursos: CursoOpcao[] };

export type MeAluno = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  status: string;
  motivoInativacao: string | null;
  faculdade: { id: string; nome: string };
  curso: { id: string; nome: string; duracaoAnos: number; ativo: boolean; area: string };
  turma: TurmaOpcao;
  semestreAtual: number;
};
