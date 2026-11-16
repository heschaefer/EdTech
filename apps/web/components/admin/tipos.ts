export type Faculdade = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  ativa: boolean;
  dominios: string[];
  conviteAceito: boolean;
  totalAlunos: number;
  totalCursos: number;
};

export type Area = { id: string; nome: string; ativa: boolean; totalCursos: number; totalVagas: number; emUso: boolean };

export const formatarCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
