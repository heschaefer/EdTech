export type Etapa = { id: string; nome: string; ordem: number };

export type Vaga = {
  id: string;
  funcao: string;
  tipo: string;
  modalidade: string;
  atividades: string;
  requisitos: string;
  salario: { aCombinar: boolean; min: number | null; max: number | null };
  beneficios: string;
  processoSeletivo: string;
  cultura: string;
  cidade: string | null;
  uf: string | null;
  semestreMinimo: number | null;
  status: 'ABERTA' | 'PAUSADA' | 'PRAZO_EXPIRADO' | 'ENCERRADA';
  prazo: string;
  versao: number;
  criadaEm: string;
  areas: { id: string; nome: string }[];
  etapas: Etapa[];
  encerradaEm?: string | null;
  motivoEncerramento?: 'MANUAL' | 'AUTOMATICO' | null;
  totalCandidatos?: number;
  jaTeveCandidatura?: boolean;
};
