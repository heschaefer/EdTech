import { gerarCpf } from '../validadores/cpf';
import { cadastroAlunoSchema, curriculoSchema, statusAlunoSchema } from '../index';

const base = {
  nome: 'Ana Souza',
  cpf: '529.982.247-25',
  email: 'Ana.Souza@aluno.uhorizonte.edu.br',
  telefone: '(11) 99999-8888',
  senha: 'Xq9#mVt2!pL',
  confirmacao: 'Xq9#mVt2!pL',
  cursoId: '7d0f5a5e-8a43-4d3a-9d8a-1b2c3d4e5f60',
  turmaId: '7d0f5a5e-8a43-4d3a-9d8a-1b2c3d4e5f61',
  semestreAtual: 3,
  aceiteTermos: true,
};

const campos = (r: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join('.'));

describe('Cadastro do aluno', () => {
  it('ALU-01 aceita o cadastro completo e normaliza CPF e e-mail; currículo é opcional', () => {
    const d = cadastroAlunoSchema.parse(base);
    expect(d.cpf).toBe('52998224725');
    expect(d.email).toBe('ana.souza@aluno.uhorizonte.edu.br');
    expect(d.curriculo).toBeUndefined();
  });

  it('ALU-01 RN-02 CPF inválido dá erro no campo cpf', () => {
    expect(campos(cadastroAlunoSchema.safeParse({ ...base, cpf: '111.111.111-11' }))).toEqual(['cpf']);
    expect(cadastroAlunoSchema.safeParse({ ...base, cpf: gerarCpf('123456789') }).success).toBe(true);
  });

  it('ALU-01 RN-04 senha fora da política, com o e-mail ou sem confirmação igual', () => {
    expect(campos(cadastroAlunoSchema.safeParse({ ...base, senha: 'Ana.souza1!', confirmacao: 'Ana.souza1!' }))).toContain('senha');
    expect(campos(cadastroAlunoSchema.safeParse({ ...base, confirmacao: 'outra' }))).toEqual(['confirmacao']);
  });

  it('ALU-01 aceite dos termos é obrigatório', () => {
    expect(campos(cadastroAlunoSchema.safeParse({ ...base, aceiteTermos: false }))).toEqual(['aceiteTermos']);
  });
});

describe('Currículo (D16)', () => {
  it('ALU-04 aceita currículo vazio com listas padrão', () => {
    expect(curriculoSchema.parse({})).toMatchObject({ links: [], experiencias: [], idiomas: [] });
  });

  it('ALU-04 limita objetivo a 200 e resumo a 1 000 caracteres', () => {
    expect(campos(curriculoSchema.safeParse({ objetivo: 'x'.repeat(201), resumo: 'x'.repeat(1001) }))).toEqual(['objetivo', 'resumo']);
  });

  it('ALU-04 links só http(s); recusa javascript:', () => {
    expect(curriculoSchema.safeParse({ links: [{ tipo: 'GITHUB', url: 'https://github.com/ana' }] }).success).toBe(true);
    expect(curriculoSchema.safeParse({ links: [{ tipo: 'OUTRO', url: 'javascript:alert(1)' }] }).success).toBe(false);
  });

  it('ALU-04 experiência sem fim é atual; fim antes do início é recusado', () => {
    const exp = { tipo: 'ESTAGIO', organizacao: 'Nuvem Azul', cargo: 'Estagiária', inicio: '2025-02-01' };
    expect(curriculoSchema.parse({ experiencias: [{ ...exp, fim: '' }] }).experiencias[0].fim).toBeUndefined();
    expect(campos(curriculoSchema.safeParse({ experiencias: [{ ...exp, fim: '2024-12-01' }] }))).toEqual(['experiencias.0.fim']);
  });

  it('ALU-04 D16 não tem campos de foto, idade, estado civil, gênero, RG ou CPF', () => {
    for (const campo of ['foto', 'dataNascimento', 'estadoCivil', 'genero', 'rg', 'cpf']) {
      expect(curriculoSchema.safeParse({ [campo]: 'x' }).success).toBe(false);
    }
  });
});

describe('Status do aluno', () => {
  it('FAC-06 desligar exige motivo; reativar não', () => {
    expect(statusAlunoSchema.safeParse({ status: 'INATIVO' }).success).toBe(false);
    expect(statusAlunoSchema.safeParse({ status: 'INATIVO', motivo: 'Trancou a matrícula' }).success).toBe(true);
    expect(statusAlunoSchema.safeParse({ status: 'ATIVO' }).success).toBe(true);
  });
});
