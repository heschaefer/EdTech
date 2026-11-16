import { atualizarVagaSchema, cadastroEmpresaSchema, criarVagaSchema, filtroVagasSchema } from '../index';

const AREA = '7d0f5a5e-8a43-4d3a-9d8a-1b2c3d4e5f60';
const vaga = {
  funcao: 'Estágio em desenvolvimento',
  tipo: 'ESTAGIO',
  modalidade: 'REMOTO',
  areaIds: [AREA],
  atividades: 'APIs',
  requisitos: 'Lógica',
  salario: { aCombinar: false, min: 1800, max: 2200 },
  beneficios: 'VR',
  processoSeletivo: 'Triagem e entrevista',
  cultura: 'Colaborativa',
  etapas: [{ nome: 'Triagem' }, { nome: 'Entrevista' }],
  prazo: '2026-12-20',
};
const campos = (r: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join('.'));

describe('Schemas de vaga', () => {
  it('EMP-03 aceita a vaga completa', () => {
    expect(criarVagaSchema.safeParse(vaga).success).toBe(true);
  });

  it('EMP-03 exige ao menos uma área e uma etapa', () => {
    expect(campos(criarVagaSchema.safeParse({ ...vaga, areaIds: [], etapas: [] }))).toEqual(['areaIds', 'etapas']);
  });

  it('EMP-03 cidade e UF obrigatórias para presencial ou híbrida', () => {
    expect(campos(criarVagaSchema.safeParse({ ...vaga, modalidade: 'HIBRIDO' }))).toEqual(['cidade', 'uf']);
    expect(criarVagaSchema.safeParse({ ...vaga, modalidade: 'PRESENCIAL', cidade: 'São Paulo', uf: 'SP' }).success).toBe(true);
  });

  it('EMP-03 salário em faixa válida ou a combinar', () => {
    expect(campos(criarVagaSchema.safeParse({ ...vaga, salario: { aCombinar: false, min: 3000, max: 2000 } }))).toEqual(['salario.max']);
    expect(campos(criarVagaSchema.safeParse({ ...vaga, salario: { aCombinar: false } }))).toEqual(['salario.min']);
    expect(criarVagaSchema.safeParse({ ...vaga, salario: { aCombinar: true } }).success).toBe(true);
  });

  it('EMP-03 D22 semestre mínimo opcional', () => {
    expect(criarVagaSchema.parse({ ...vaga, semestreMinimo: '' }).semestreMinimo).toBeNull();
    expect(criarVagaSchema.parse({ ...vaga, semestreMinimo: '4' }).semestreMinimo).toBe(4);
  });

  it('EMP-04 edição exige a versão (controle otimista) e não muda o prazo', () => {
    expect(campos(atualizarVagaSchema.safeParse({ funcao: 'x' }))).toEqual(['versao']);
    expect(atualizarVagaSchema.safeParse({ versao: 1, prazo: '2026-12-30' }).success).toBe(false);
  });

  it('ALU-05 filtros: publicação recente só 7, 15 ou 30 dias; ordem padrão "recentes"', () => {
    expect(filtroVagasSchema.parse({}).ordem).toBe('recentes');
    expect(filtroVagasSchema.safeParse({ dias: '15' }).success).toBe(true);
    expect(filtroVagasSchema.safeParse({ dias: '10' }).success).toBe(false);
  });
});

describe('Cadastro de empresa', () => {
  const empresa = {
    razaoSocial: 'Nuvem Azul Tecnologia LTDA',
    nomeFantasia: 'Nuvem Azul',
    cnpj: '11.222.333/0001-81',
    telefone: '(11) 3333-4444',
    email: 'RH@nuvemazul.com.br',
    senha: 'Xq9#mVt2!pL',
    confirmacao: 'Xq9#mVt2!pL',
    ramoAtuacao: 'Tecnologia',
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
  };

  it('EMP-01 D6 endereço completo obrigatório; complemento opcional', () => {
    const d = cadastroEmpresaSchema.parse({ ...empresa, complemento: '' });
    expect(d).toMatchObject({ cep: '01310100', cnpj: '11222333000181', email: 'rh@nuvemazul.com.br' });
    const { bairro: _, ...semBairro } = empresa;
    expect(campos(cadastroEmpresaSchema.safeParse(semBairro))).toEqual(['bairro']);
  });

  it('EMP-01 RN-20 CNPJ com dígitos inválidos dá erro no campo', () => {
    expect(campos(cadastroEmpresaSchema.safeParse({ ...empresa, cnpj: '11.222.333/0001-82' }))).toEqual(['cnpj']);
  });
});
