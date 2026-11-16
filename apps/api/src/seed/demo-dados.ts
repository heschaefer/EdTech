/** Conteúdo fixo do seed de demonstração (seção 10.1). Tudo fictício. */

export const SENHA_DEMO = 'Demo@2026!';

export const CONTAS_DEMO = {
  faculdade: 'contato@uhorizonte.edu.br',
  empresa: 'rh@nuvemazul.com.br',
  empresaPendente: 'contato@faisca.com.br',
  alunaAtiva: 'ana.souza@aluno.uhorizonte.edu.br',
  alunoHistorico: 'bruno.lima@aluno.uhorizonte.edu.br',
  alunaDesligada: 'carla.mendes@aluno.uhorizonte.edu.br',
  alunoNovo: 'diego.alves@aluno.valedosul.edu.br',
} as const;

export type FaculdadeDef = { chave: 'horizonte' | 'valedosul' | 'aurora'; razaoSocial: string; nomeFantasia: string; email: string; telefone: string; dominio: string; ativa: boolean };

export const FACULDADES: FaculdadeDef[] = [
  { chave: 'horizonte', razaoSocial: 'Associação Educacional Horizonte', nomeFantasia: 'Universidade Horizonte', email: CONTAS_DEMO.faculdade, telefone: '5133221100', dominio: 'aluno.uhorizonte.edu.br', ativa: true },
  { chave: 'valedosul', razaoSocial: 'Sociedade de Ensino Vale do Sul Ltda', nomeFantasia: 'Faculdade Vale do Sul', email: 'contato@valedosul.edu.br', telefone: '5432104455', dominio: 'aluno.valedosul.edu.br', ativa: true },
  { chave: 'aurora', razaoSocial: 'Instituto Educacional Aurora S/A', nomeFantasia: 'Instituto Aurora', email: 'contato@institutoaurora.edu.br', telefone: '4833557788', dominio: 'aluno.institutoaurora.edu.br', ativa: false },
];

export type CursoDef = {
  chave: string;
  faculdade: FaculdadeDef['chave'];
  nome: string;
  area: string;
  duracao: number;
  ementa: string;
  /** Duas aulas por semestre, na ordem da grade. */
  disciplinas: string[];
  alunos: number;
};

export const CURSOS: CursoDef[] = [
  {
    chave: 'computacao',
    faculdade: 'horizonte',
    nome: 'Ciência da Computação',
    area: 'Tecnologia',
    duracao: 4,
    ementa: 'Formação em fundamentos da computação, desenvolvimento de software, dados e sistemas distribuídos, com projetos práticos desde o primeiro semestre.',
    disciplinas: [
      'Algoritmos e Programação', 'Matemática Discreta', 'Estruturas de Dados', 'Cálculo', 'Programação Orientada a Objetos', 'Arquitetura de Computadores',
      'Banco de Dados', 'Sistemas Operacionais', 'Redes de Computadores', 'Engenharia de Software', 'Desenvolvimento Web', 'Inteligência Artificial',
      'Computação em Nuvem', 'Segurança da Informação', 'Trabalho de Conclusão I', 'Trabalho de Conclusão II',
    ],
    alunos: 10,
  },
  {
    chave: 'engsoftware',
    faculdade: 'horizonte',
    nome: 'Engenharia de Software',
    area: 'Tecnologia',
    duracao: 4,
    ementa: 'Processo de desenvolvimento de software de ponta a ponta: requisitos, arquitetura, qualidade, DevOps e gestão de produtos digitais.',
    disciplinas: [
      'Fundamentos de Programação', 'Introdução à Engenharia de Software', 'Programação Orientada a Objetos', 'Requisitos de Software', 'Banco de Dados', 'Interação Humano-Computador',
      'Arquitetura de Software', 'Testes e Qualidade', 'Desenvolvimento Mobile', 'Métodos Ágeis', 'DevOps e Integração Contínua', 'Gestão de Produtos Digitais',
      'Segurança de Aplicações', 'Empreendedorismo em Software', 'Projeto Integrador', 'Trabalho de Conclusão',
    ],
    alunos: 7,
  },
  {
    chave: 'direito',
    faculdade: 'horizonte',
    nome: 'Direito',
    area: 'Direito',
    duracao: 5,
    ementa: 'Formação jurídica com base humanística, prática processual e núcleo de prática jurídica com atendimento à comunidade.',
    disciplinas: [
      'Introdução ao Estudo do Direito', 'Teoria Geral do Estado', 'Direito Civil: Parte Geral', 'Direito Constitucional I', 'Direito Civil: Obrigações', 'Direito Penal I',
      'Direito Constitucional II', 'Direito Processual Civil I', 'Direito Empresarial', 'Direito do Trabalho', 'Direito Processual Civil II', 'Direito Tributário',
      'Direito Administrativo', 'Direito Processual Penal', 'Direito do Consumidor', 'Prática Jurídica Civil', 'Direito Ambiental', 'Prática Jurídica Penal',
      'Ética Profissional', 'Trabalho de Conclusão',
    ],
    alunos: 7,
  },
  {
    chave: 'administracao',
    faculdade: 'valedosul',
    nome: 'Administração',
    area: 'Administração',
    duracao: 4,
    ementa: 'Gestão de organizações com ênfase em finanças, pessoas, marketing e operações, com estudos de caso de empresas da região.',
    disciplinas: [
      'Teoria Geral da Administração', 'Matemática Aplicada', 'Contabilidade Básica', 'Economia', 'Gestão de Pessoas', 'Estatística',
      'Marketing', 'Matemática Financeira', 'Administração Financeira', 'Logística', 'Gestão de Projetos', 'Planejamento Estratégico',
      'Empreendedorismo', 'Gestão da Qualidade', 'Estágio Supervisionado', 'Trabalho de Conclusão',
    ],
    alunos: 6,
  },
  {
    chave: 'contabeis',
    faculdade: 'valedosul',
    nome: 'Ciências Contábeis',
    area: 'Contabilidade e Finanças',
    duracao: 4,
    ementa: 'Contabilidade societária, tributária e de custos, auditoria e análise de demonstrações, com laboratório de sistemas contábeis.',
    disciplinas: [
      'Contabilidade Introdutória', 'Matemática Financeira', 'Contabilidade Intermediária', 'Direito Empresarial', 'Contabilidade de Custos', 'Estatística Aplicada',
      'Contabilidade Tributária', 'Análise das Demonstrações', 'Auditoria', 'Perícia Contábil', 'Contabilidade Pública', 'Controladoria',
      'Laboratório Contábil', 'Ética e Legislação Profissional', 'Estágio Supervisionado', 'Trabalho de Conclusão',
    ],
    alunos: 6,
  },
  {
    chave: 'enfermagem',
    faculdade: 'aurora',
    nome: 'Enfermagem',
    area: 'Saúde',
    duracao: 5,
    ementa: 'Cuidado integral à saúde nas redes pública e privada, com estágios em unidades básicas e hospitais conveniados.',
    disciplinas: [
      'Anatomia Humana', 'Biologia Celular', 'Fisiologia', 'Bioquímica', 'Microbiologia', 'Semiologia', 'Farmacologia', 'Saúde Coletiva',
      'Enfermagem em Saúde do Adulto', 'Enfermagem em Saúde da Mulher', 'Enfermagem Pediátrica', 'Saúde Mental', 'Urgência e Emergência', 'Gestão em Enfermagem',
      'Enfermagem em UTI', 'Epidemiologia', 'Estágio em Atenção Básica', 'Estágio Hospitalar', 'Ética em Enfermagem', 'Trabalho de Conclusão',
    ],
    alunos: 4,
  },
];

export type EmpresaDef = {
  chave: 'nuvemazul' | 'andradelopes' | 'prisma' | 'bemviver' | 'faisca' | 'rotacerta';
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  ramo: string;
  endereco: { cep: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string };
  aprovacao: 'APROVADA' | 'PENDENTE' | 'REPROVADA';
  motivo?: string;
};

export const EMPRESAS: EmpresaDef[] = [
  {
    chave: 'nuvemazul', razaoSocial: 'Nuvem Azul Tecnologia Ltda', nomeFantasia: 'Nuvem Azul', email: CONTAS_DEMO.empresa, telefone: '5130214400', ramo: 'Tecnologia da informação',
    endereco: { cep: '90010000', logradouro: 'Rua dos Andradas', numero: '1200', bairro: 'Centro Histórico', cidade: 'Porto Alegre', uf: 'RS' }, aprovacao: 'APROVADA',
  },
  {
    chave: 'andradelopes', razaoSocial: 'Andrade & Lopes Sociedade de Advogados', nomeFantasia: 'Andrade & Lopes Advogados', email: 'contato@andradelopes.adv.br', telefone: '5132270011', ramo: 'Serviços jurídicos',
    endereco: { cep: '90035001', logradouro: 'Avenida Independência', numero: '550', bairro: 'Independência', cidade: 'Porto Alegre', uf: 'RS' }, aprovacao: 'APROVADA',
  },
  {
    chave: 'prisma', razaoSocial: 'Prisma Contabilidade e Consultoria Ltda', nomeFantasia: 'Prisma Contabilidade', email: 'rh@prismacontabil.com.br', telefone: '5430261234', ramo: 'Contabilidade e consultoria',
    endereco: { cep: '95010000', logradouro: 'Rua Sinimbu', numero: '1880', bairro: 'Centro', cidade: 'Caxias do Sul', uf: 'RS' }, aprovacao: 'APROVADA',
  },
  {
    chave: 'bemviver', razaoSocial: 'Clínica Bem Viver Serviços Médicos Ltda', nomeFantasia: 'Clínica Bem Viver', email: 'gente@clinicabemviver.com.br', telefone: '4830287766', ramo: 'Saúde',
    endereco: { cep: '88010400', logradouro: 'Rua Felipe Schmidt', numero: '300', bairro: 'Centro', cidade: 'Florianópolis', uf: 'SC' }, aprovacao: 'APROVADA',
  },
  {
    chave: 'faisca', razaoSocial: 'Faísca Energia Solar Ltda', nomeFantasia: 'Faísca Energia', email: CONTAS_DEMO.empresaPendente, telefone: '5130009988', ramo: 'Energia',
    endereco: { cep: '90480000', logradouro: 'Avenida Carlos Gomes', numero: '700', bairro: 'Auxiliadora', cidade: 'Porto Alegre', uf: 'RS' }, aprovacao: 'PENDENTE',
  },
  {
    chave: 'rotacerta', razaoSocial: 'Rota Certa Transportes Ltda', nomeFantasia: 'Rota Certa Logística', email: 'contato@rotacerta.com.br', telefone: '5133401200', ramo: 'Logística',
    endereco: { cep: '92010000', logradouro: 'Avenida Guilherme Schell', numero: '4100', bairro: 'Centro', cidade: 'Canoas', uf: 'RS' }, aprovacao: 'REPROVADA',
    motivo: 'A razão social informada não confere com a do CNPJ. Corrija o cadastro e peça uma nova análise.',
  },
];

export type StatusDemo = 'ABERTA' | 'PAUSADA' | 'PRAZO_EXPIRADO' | 'ENCERRADA_MANUAL' | 'ENCERRADA_AUTOMATICA';

export type VagaDef = {
  chave: string;
  empresa: EmpresaDef['chave'];
  funcao: string;
  tipo: 'ESTAGIO' | 'JOVEM_APRENDIZ' | 'TRAINEE' | 'CLT' | 'PJ' | 'TEMPORARIO';
  modalidade: 'PRESENCIAL' | 'HIBRIDO' | 'REMOTO';
  areas: string[];
  status: StatusDemo;
  /** Dias desde a publicação. */
  publicadaHa: number;
  /** Prazo relativo a hoje (data civil de Brasília); negativo = no passado. */
  prazoEm: number;
  semestreMinimo?: number;
  salario: [number, number] | null;
  etapas: string[];
  atividades: string;
  requisitos: string;
  beneficios: string;
  candidatos: number;
};

const PROCESSO = (etapas: string[]) => `Processo em ${etapas.length} etapas: ${etapas.join(', ')}. Retornamos a todos os candidatos pela plataforma.`;
export const processoSeletivo = PROCESSO;

export const VAGAS: VagaDef[] = [
  {
    chave: 'backend', empresa: 'nuvemazul', funcao: 'Estágio em Desenvolvimento Back-end', tipo: 'ESTAGIO', modalidade: 'HIBRIDO', areas: ['Tecnologia'], status: 'ABERTA',
    publicadaHa: 40, prazoEm: 25, salario: [1800, 2200], etapas: ['Triagem', 'Entrevista técnica', 'Teste prático', 'Entrevista final'],
    atividades: 'Desenvolver e manter APIs em Node.js e TypeScript, escrever testes automatizados e participar das revisões de código do time.',
    requisitos: 'Cursando Computação ou áreas afins; lógica de programação e noções de banco de dados relacional. Git é um diferencial.',
    beneficios: 'Vale-refeição, auxílio home office, plano de saúde e horário flexível.', candidatos: 10,
  },
  {
    chave: 'dados', empresa: 'nuvemazul', funcao: 'Estágio em Engenharia de Dados', tipo: 'ESTAGIO', modalidade: 'REMOTO', areas: ['Tecnologia'], status: 'ABERTA',
    publicadaHa: 18, prazoEm: 20, semestreMinimo: 5, salario: [2000, 2400], etapas: ['Triagem', 'Desafio de SQL', 'Entrevista'],
    atividades: 'Construir pipelines de dados, modelar tabelas analíticas e apoiar o time de produto com consultas e painéis.',
    requisitos: 'A partir do 5º semestre; SQL intermediário e Python básico.', beneficios: 'Vale-refeição, auxílio home office e cursos pagos.', candidatos: 5,
  },
  {
    chave: 'frontend', empresa: 'nuvemazul', funcao: 'Desenvolvedor(a) Front-end Júnior', tipo: 'CLT', modalidade: 'HIBRIDO', areas: ['Tecnologia'], status: 'ABERTA',
    publicadaHa: 25, prazoEm: 1, salario: [4200, 5200], etapas: ['Triagem', 'Entrevista técnica', 'Conversa com a liderança'],
    atividades: 'Implementar telas em React com acessibilidade, integrar com APIs REST e colaborar com o design.',
    requisitos: 'Experiência com HTML, CSS e JavaScript; React é um diferencial.', beneficios: 'Plano de saúde e odontológico, vale-alimentação e PLR.', candidatos: 6,
  },
  {
    chave: 'suporte', empresa: 'nuvemazul', funcao: 'Estágio em Suporte de TI', tipo: 'ESTAGIO', modalidade: 'PRESENCIAL', areas: ['Tecnologia'], status: 'PAUSADA',
    publicadaHa: 30, prazoEm: 15, salario: [1500, 1500], etapas: ['Triagem', 'Entrevista'],
    atividades: 'Atender chamados internos, configurar estações de trabalho e documentar soluções na base de conhecimento.',
    requisitos: 'Interesse por infraestrutura e boa comunicação.', beneficios: 'Vale-transporte e vale-refeição.', candidatos: 4,
  },
  {
    chave: 'produto', empresa: 'nuvemazul', funcao: 'Trainee em Gestão de Produto', tipo: 'TRAINEE', modalidade: 'HIBRIDO', areas: ['Tecnologia', 'Administração'], status: 'PRAZO_EXPIRADO',
    publicadaHa: 45, prazoEm: -1, salario: [3500, 3500], etapas: ['Triagem', 'Dinâmica em grupo', 'Estudo de caso', 'Painel final'],
    atividades: 'Apoiar a descoberta de produto, acompanhar métricas e conduzir entrevistas com clientes.',
    requisitos: 'Formação prevista até o próximo ano; visão analítica e boa escrita.', beneficios: 'Plano de saúde, PLR e programa de mentoria.', candidatos: 6,
  },
  {
    chave: 'qa', empresa: 'nuvemazul', funcao: 'Estágio em Qualidade de Software', tipo: 'ESTAGIO', modalidade: 'REMOTO', areas: ['Tecnologia'], status: 'ENCERRADA_MANUAL',
    publicadaHa: 70, prazoEm: -10, salario: [1700, 2000], etapas: ['Triagem', 'Teste prático', 'Entrevista'],
    atividades: 'Planejar e executar testes, automatizar cenários com Playwright e reportar defeitos.',
    requisitos: 'Atenção a detalhes e noções de programação.', beneficios: 'Auxílio home office e vale-refeição.', candidatos: 6,
  },
  {
    chave: 'aprendizti', empresa: 'nuvemazul', funcao: 'Jovem Aprendiz em TI', tipo: 'JOVEM_APRENDIZ', modalidade: 'PRESENCIAL', areas: ['Tecnologia'], status: 'ENCERRADA_AUTOMATICA',
    publicadaHa: 90, prazoEm: -30, salario: [1100, 1100], etapas: ['Triagem', 'Entrevista'],
    atividades: 'Apoiar o time de infraestrutura e aprender rotinas de suporte e redes.',
    requisitos: 'Entre 18 e 24 anos, cursando graduação.', beneficios: 'Vale-transporte e vale-refeição.', candidatos: 5,
  },
  {
    chave: 'empresarial', empresa: 'andradelopes', funcao: 'Estágio em Direito Empresarial', tipo: 'ESTAGIO', modalidade: 'PRESENCIAL', areas: ['Direito'], status: 'ABERTA',
    publicadaHa: 20, prazoEm: 18, salario: [1600, 1900], etapas: ['Análise de currículo', 'Prova escrita', 'Entrevista com sócio'],
    atividades: 'Pesquisa de jurisprudência, minutas de contratos societários e acompanhamento de assembleias.',
    requisitos: 'Cursando Direito; boa redação e interesse por societário.', beneficios: 'Vale-refeição e auxílio para cursos.', candidatos: 6,
  },
  {
    chave: 'contencioso', empresa: 'andradelopes', funcao: 'Estágio em Contencioso Cível', tipo: 'ESTAGIO', modalidade: 'HIBRIDO', areas: ['Direito'], status: 'ABERTA',
    publicadaHa: 10, prazoEm: 30, salario: [1500, 1800], etapas: ['Análise de currículo', 'Entrevista'],
    atividades: 'Acompanhamento processual, petições simples e controle de prazos.',
    requisitos: 'Cursando Direito; organização e domínio do pacote Office.', beneficios: 'Vale-transporte e vale-refeição.', candidatos: 4,
  },
  {
    chave: 'contabil', empresa: 'prisma', funcao: 'Estágio em Contabilidade', tipo: 'ESTAGIO', modalidade: 'PRESENCIAL', areas: ['Contabilidade e Finanças'], status: 'ABERTA',
    publicadaHa: 15, prazoEm: 22, salario: [1400, 1700], etapas: ['Triagem', 'Prova técnica', 'Entrevista'],
    atividades: 'Conciliações bancárias, lançamentos contábeis e apoio no fechamento mensal de clientes.',
    requisitos: 'Cursando Ciências Contábeis; Excel intermediário.', beneficios: 'Vale-refeição e plano odontológico.', candidatos: 6,
  },
  {
    chave: 'administrativo', empresa: 'prisma', funcao: 'Jovem Aprendiz Administrativo', tipo: 'JOVEM_APRENDIZ', modalidade: 'PRESENCIAL', areas: ['Administração'], status: 'ABERTA',
    publicadaHa: 12, prazoEm: 16, salario: [1100, 1100], etapas: ['Triagem', 'Entrevista'],
    atividades: 'Arquivo, atendimento telefônico e apoio às rotinas de departamento pessoal.',
    requisitos: 'Entre 18 e 24 anos, cursando graduação.', beneficios: 'Vale-transporte.', candidatos: 5,
  },
  {
    chave: 'fiscal', empresa: 'prisma', funcao: 'Trainee em Área Fiscal', tipo: 'TRAINEE', modalidade: 'HIBRIDO', areas: ['Contabilidade e Finanças'], status: 'ENCERRADA_MANUAL',
    publicadaHa: 60, prazoEm: -8, salario: [3000, 3000], etapas: ['Triagem', 'Prova técnica', 'Entrevista final'],
    atividades: 'Apuração de tributos, obrigações acessórias e atendimento a clientes.',
    requisitos: 'Últimos semestres de Ciências Contábeis.', beneficios: 'Plano de saúde e bônus anual.', candidatos: 4,
  },
  {
    chave: 'enfermagem', empresa: 'bemviver', funcao: 'Estágio em Enfermagem', tipo: 'ESTAGIO', modalidade: 'PRESENCIAL', areas: ['Saúde'], status: 'ABERTA',
    publicadaHa: 50, prazoEm: 12, salario: [1300, 1300], etapas: ['Triagem', 'Entrevista', 'Avaliação prática'],
    atividades: 'Apoio à equipe de enfermagem no acolhimento, sinais vitais e organização de prontuários.',
    requisitos: 'Cursando Enfermagem.', beneficios: 'Vale-refeição e uniforme.', candidatos: 4,
  },
  {
    chave: 'recepcao', empresa: 'bemviver', funcao: 'Recepcionista (temporário)', tipo: 'TEMPORARIO', modalidade: 'PRESENCIAL', areas: ['Administração'], status: 'ABERTA',
    publicadaHa: 8, prazoEm: 10, salario: [1900, 1900], etapas: ['Triagem', 'Entrevista'],
    atividades: 'Recepção de pacientes, agendamentos e confirmação de consultas por telefone.',
    requisitos: 'Boa comunicação e disponibilidade no turno da tarde.', beneficios: 'Vale-transporte e vale-refeição.', candidatos: 3,
  },
  {
    chave: 'gestaosaude', empresa: 'bemviver', funcao: 'Estágio em Gestão Hospitalar', tipo: 'ESTAGIO', modalidade: 'HIBRIDO', areas: ['Administração', 'Saúde'], status: 'ABERTA',
    publicadaHa: 5, prazoEm: 28, salario: null, etapas: ['Triagem', 'Entrevista'],
    atividades: 'Indicadores de atendimento, controle de estoque de insumos e apoio a projetos de melhoria.',
    requisitos: 'Cursando Administração ou áreas da saúde.', beneficios: 'Vale-refeição.', candidatos: 3,
  },
];

export const CULTURA: Record<EmpresaDef['chave'], string> = {
  nuvemazul: 'Times pequenos e autônomos, feedback frequente e aprendizado contínuo.',
  andradelopes: 'Escritório de porte médio, com proximidade entre sócios e estagiários.',
  prisma: 'Ambiente colaborativo, foco em precisão e no relacionamento com o cliente.',
  bemviver: 'Cuidado humanizado com o paciente e com quem trabalha aqui.',
  faisca: 'Energia limpa e espírito de startup.',
  rotacerta: 'Operação logística ágil.',
};
