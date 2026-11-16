import { z } from 'zod';
import { cpfValido, normalizarCpf } from '../validadores/cpf';
import { emailSchema, refinarSenhaComEmail, senhaNovaSchema } from './auth';
import { telefoneSchema } from './admin';
import { textoCurto, uuid } from './comum';

/** Versão vigente dos termos de uso e da política de privacidade (8.4). */
export const VERSAO_TERMOS = '2026-11';

export const cpfSchema = z.string().transform(normalizarCpf).refine(cpfValido, 'CPF inválido');

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export const ufSchema = z.enum(UFS, { errorMap: () => ({ message: 'UF inválida' }) });

const semestre = z.coerce.number({ invalid_type_error: 'Informe o semestre' }).int().min(1, 'Informe o semestre').max(12);

/** RN-05: vínculo acadêmico (o limite do semestre depende da duração do curso, checado na API). */
export const vinculoSchema = z
  .object({ cursoId: uuid, turmaId: uuid, semestreAtual: semestre })
  .strict();
export type VinculoInput = z.infer<typeof vinculoSchema>;

/** ALU-01: os três passos do assistente num único envio; o currículo pode ser pulado. */
export const cadastroAlunoSchema = z
  .object({
    nome: textoCurto,
    cpf: cpfSchema,
    email: emailSchema,
    telefone: telefoneSchema,
    senha: senhaNovaSchema,
    confirmacao: z.string(),
    cursoId: uuid,
    turmaId: uuid,
    semestreAtual: semestre,
    aceiteTermos: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar os termos de uso e a política de privacidade' }) }),
    curriculo: z.lazy(() => curriculoSchema).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.senha !== d.confirmacao) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmacao'], message: 'As senhas não conferem' });
    refinarSenhaComEmail(d.senha, d.email, ctx);
  });
export type CadastroAlunoInput = z.infer<typeof cadastroAlunoSchema>;

/** ALU-02: CPF não é editável; e-mail só pela troca de faculdade (ALU-12). */
export const atualizarAlunoSchema = z.object({ nome: textoCurto.optional(), telefone: telefoneSchema.optional() }).strict();

export const trocarSenhaSchema = z
  .object({ senhaAtual: z.string().min(1, 'Informe a senha atual'), senha: senhaNovaSchema, confirmacao: z.string() })
  .strict()
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' });

/** ALU-12 */
export const pedirTrocaFaculdadeSchema = z.object({ email: emailSchema }).strict();
export const confirmarTrocaFaculdadeSchema = vinculoSchema.extend({ token: z.string().min(20).max(200) }).strict();

/** FAC-06 */
export const statusAlunoSchema = z
  .object({ status: z.enum(['ATIVO', 'INATIVO']), motivo: z.string().trim().max(500).optional() })
  .strict()
  .refine((d) => d.status === 'ATIVO' || (d.motivo?.length ?? 0) >= 3, { path: ['motivo'], message: 'Informe o motivo do desligamento' });
export type StatusAlunoInput = z.infer<typeof statusAlunoSchema>;

export const filtroAlunosSchema = z
  .object({
    cursoId: uuid.optional(),
    turmaId: uuid.optional(),
    semestre: z.coerce.number().int().min(1).max(12).optional(),
    status: z.enum(['ATIVO', 'INATIVO', 'PENDENTE_VERIFICACAO']).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// ---------------- Currículo (ALU-04 / D16) ----------------

/** Só http(s): evita `javascript:` e afins em links exibidos à empresa. */
export const urlSchema = z
  .string()
  .trim()
  .max(300)
  .url('URL inválida')
  .refine((u) => /^https?:\/\//i.test(u), 'Use um endereço http(s)');

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (AAAA-MM-DD)');
const opcional = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());

export const TIPOS_LINK = ['LINKEDIN', 'GITHUB', 'PORTFOLIO', 'LATTES', 'OUTRO'] as const;
export const NIVEIS_FORMACAO = ['ENSINO_MEDIO', 'TECNICO', 'GRADUACAO', 'POS_GRADUACAO'] as const;
export const SITUACOES_FORMACAO = ['CURSANDO', 'CONCLUIDO', 'TRANCADO'] as const;
export const TIPOS_EXPERIENCIA = [
  'EMPREGO', 'ESTAGIO', 'JOVEM_APRENDIZ', 'FREELANCE', 'VOLUNTARIADO', 'INICIACAO_CIENTIFICA', 'MONITORIA', 'EMPRESA_JUNIOR',
] as const;
export const NIVEIS_IDIOMA = ['BASICO', 'INTERMEDIARIO', 'AVANCADO', 'FLUENTE', 'NATIVO'] as const;
export const DISPONIBILIDADES = ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'] as const;

export const ROTULOS = {
  link: { LINKEDIN: 'LinkedIn', GITHUB: 'GitHub', PORTFOLIO: 'Portfólio', LATTES: 'Lattes', OUTRO: 'Outro' },
  nivelFormacao: { ENSINO_MEDIO: 'Ensino médio', TECNICO: 'Técnico', GRADUACAO: 'Graduação', POS_GRADUACAO: 'Pós-graduação' },
  situacaoFormacao: { CURSANDO: 'Cursando', CONCLUIDO: 'Concluído', TRANCADO: 'Trancado' },
  experiencia: {
    EMPREGO: 'Emprego', ESTAGIO: 'Estágio', JOVEM_APRENDIZ: 'Jovem aprendiz', FREELANCE: 'Freelance', VOLUNTARIADO: 'Voluntariado',
    INICIACAO_CIENTIFICA: 'Iniciação científica', MONITORIA: 'Monitoria', EMPRESA_JUNIOR: 'Empresa júnior',
  },
  idioma: { BASICO: 'Básico', INTERMEDIARIO: 'Intermediário', AVANCADO: 'Avançado', FLUENTE: 'Fluente', NATIVO: 'Nativo' },
  disponibilidade: { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', INTEGRAL: 'Integral' },
} as const;

const etiqueta = z.string().trim().min(1).max(50);

const formacaoSchema = z
  .object({
    nivel: z.enum(NIVEIS_FORMACAO),
    curso: textoCurto,
    instituicao: textoCurto,
    inicio: opcional(data),
    conclusao: opcional(data),
    situacao: z.enum(SITUACOES_FORMACAO),
  })
  .strict()
  .refine((f) => !f.inicio || !f.conclusao || f.conclusao >= f.inicio, { path: ['conclusao'], message: 'A conclusão não pode ser antes do início' });

const experienciaSchema = z
  .object({
    tipo: z.enum(TIPOS_EXPERIENCIA),
    organizacao: textoCurto,
    cargo: textoCurto,
    inicio: data,
    fim: opcional(data), // vazio = atual
    descricao: opcional(z.string().trim().max(2000)),
  })
  .strict()
  .refine((e) => !e.fim || e.fim >= e.inicio, { path: ['fim'], message: 'O fim não pode ser antes do início' });

const cursoComplementarSchema = z
  .object({
    nome: textoCurto,
    instituicao: textoCurto,
    cargaHoraria: opcional(z.coerce.number().int().min(1).max(10_000)),
    conclusao: opcional(data),
    certificadoUrl: opcional(urlSchema),
  })
  .strict();

const idiomaSchema = z.object({ idioma: z.string().trim().min(1).max(50), nivel: z.enum(NIVEIS_IDIOMA) }).strict();

const projetoSchema = z
  .object({ titulo: textoCurto, descricao: z.string().trim().min(1, 'Obrigatório').max(2000), link: opcional(urlSchema) })
  .strict();

/** D16: seções de um currículo padrão; sem foto, idade, estado civil, gênero, RG ou CPF. */
export const curriculoSchema = z
  .object({
    objetivo: opcional(z.string().trim().max(200, 'Até 200 caracteres')),
    resumo: opcional(z.string().trim().max(1000, 'Até 1 000 caracteres')),
    cidade: opcional(z.string().trim().max(100)),
    uf: opcional(ufSchema),
    links: z.array(z.object({ tipo: z.enum(TIPOS_LINK), url: urlSchema }).strict()).max(10).default([]),
    habilidadesTecnicas: z.array(etiqueta).max(30).default([]),
    habilidadesComportamentais: z.array(etiqueta).max(30).default([]),
    disponibilidade: z.array(z.enum(DISPONIBILIDADES)).max(4).default([]),
    informacoesAdicionais: opcional(z.string().trim().max(1000)),
    formacoes: z.array(formacaoSchema).max(10).default([]),
    experiencias: z.array(experienciaSchema).max(20).default([]),
    cursos: z.array(cursoComplementarSchema).max(30).default([]),
    idiomas: z.array(idiomaSchema).max(10).default([]),
    projetos: z.array(projetoSchema).max(20).default([]),
  })
  .strict();
export type CurriculoInput = z.infer<typeof curriculoSchema>;
