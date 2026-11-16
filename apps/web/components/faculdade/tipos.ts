export type Area = { id: string; nome: string };

export type Curso = {
  id: string;
  nome: string;
  duracaoAnos: number;
  ementa: string;
  ativo: boolean;
  area: Area;
  totalAlunos: number;
  totalTurmas: number;
};

export type Aula = { id: string; nome: string; ementa: string; ordem: number };
export type Semestre = { id: string; ano: number; periodo: number; ordem: number; aulas: Aula[] };
export type Turma = { id: string; anoIngresso: number; periodoIngresso: number; ativa: boolean; totalAlunos: number };
