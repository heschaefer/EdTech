import { base, en, Faker, pt_BR } from '@faker-js/faker';
import type { NivelIdioma, Prisma, PrismaClient, StatusCandidatura, TipoExperiencia } from '@prisma/client';
import { gerarCnpj, gerarCpf, mensagemEncerrada, mensagemEtapa, mensagemSelecionado } from '@vagas/contracts';
import { CifraService } from '../common/cripto/cifra.service';
import { hashSenha } from '../common/cripto/senha';
import { dataCivil, fimDoDia } from '../domain/prazo';
import { credenciaisAdmin, limparBanco, seedBase } from './base';
import { CONTAS_DEMO, CULTURA, CURSOS, EMPRESAS, FACULDADES, processoSeletivo, SENHA_DEMO, VAGAS, type CursoDef, type VagaDef } from './demo-dados';

/**
 * Seed de demonstração (seção 10.1): simula a plataforma em uso há alguns semestres.
 * Determinístico (Faker com semente fixa) e com datas relativas ao instante em que roda.
 */
export const SEMENTE_DEMO = 2026;

const H = 3600_000;
const DIA = 24 * H;
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

type Desfecho = 'processo' | 'nao_selecionado' | 'selecionado' | 'removida' | 'inativo' | 'auto';
type AlunoDemo = {
  chave: string;
  id: string;
  usuarioId: string;
  nome: string;
  curso: CursoDef;
  semestre: number;
  inativoEm?: Date;
  inativadoPor?: string;
};
type Plano = { aluno: string; vaga: string; desfecho: Desfecho; etapa?: number; ultimoHa?: number };

/** Candidaturas das contas de demonstração (seção 10.1, "O que mostrar na aula"). */
const PLANO_FIXO: Plano[] = [
  { aluno: 'ana', vaga: 'backend', desfecho: 'processo', etapa: 1, ultimoHa: 1 },
  { aluno: 'ana', vaga: 'dados', desfecho: 'processo', etapa: 0, ultimoHa: 3 },
  { aluno: 'ana', vaga: 'produto', desfecho: 'processo', etapa: 2, ultimoHa: 2 },
  { aluno: 'ana', vaga: 'qa', desfecho: 'selecionado' },
  { aluno: 'bruno', vaga: 'backend', desfecho: 'removida' },
  { aluno: 'bruno', vaga: 'qa', desfecho: 'nao_selecionado' },
  { aluno: 'bruno', vaga: 'aprendizti', desfecho: 'auto' },
  { aluno: 'bruno', vaga: 'frontend', desfecho: 'processo', etapa: 0 },
  { aluno: 'carla', vaga: 'backend', desfecho: 'inativo' },
  { aluno: 'direito-desligado', vaga: 'empresarial', desfecho: 'inativo' },
];

const HABILIDADES: Record<string, string[]> = {
  Tecnologia: ['TypeScript', 'JavaScript', 'Python', 'Java', 'SQL', 'React', 'Node.js', 'Git', 'Docker', 'Linux', 'Testes automatizados', 'APIs REST'],
  Direito: ['Pesquisa jurisprudencial', 'Redação jurídica', 'Processo eletrônico', 'Contratos', 'Direito societário', 'Pacote Office'],
  Administração: ['Excel avançado', 'Power BI', 'Gestão de projetos', 'Atendimento ao cliente', 'Rotinas de RH', 'Indicadores de desempenho'],
  'Contabilidade e Finanças': ['Excel avançado', 'Conciliação bancária', 'SPED', 'Apuração de impostos', 'Sistemas ERP', 'Análise de balanços'],
  Saúde: ['Sinais vitais', 'Acolhimento', 'Prontuário eletrônico', 'Biossegurança', 'Primeiros socorros'],
};
const COMPORTAMENTAIS = ['Comunicação', 'Trabalho em equipe', 'Organização', 'Proatividade', 'Pensamento crítico', 'Adaptabilidade', 'Liderança'];
const OBJETIVOS: Record<string, string[]> = {
  Tecnologia: ['Estágio em desenvolvimento de software', 'Estágio em dados e análise', 'Desenvolvedor(a) back-end júnior', 'Estágio em qualidade de software'],
  Direito: ['Estágio em escritório de advocacia', 'Estágio em direito empresarial', 'Estágio em contencioso cível'],
  Administração: ['Estágio em gestão administrativa', 'Estágio em recursos humanos', 'Estágio em planejamento financeiro'],
  'Contabilidade e Finanças': ['Estágio em contabilidade', 'Trainee na área fiscal', 'Estágio em controladoria'],
  Saúde: ['Estágio em enfermagem hospitalar', 'Estágio em atenção básica'],
};
const EXPERIENCIAS: Record<string, { tipo: TipoExperiencia; organizacao: string; cargo: string; descricao: string }[]> = {
  Tecnologia: [
    { tipo: 'MONITORIA', organizacao: 'Universidade Horizonte', cargo: 'Monitor(a) de Algoritmos', descricao: 'Plantões de dúvidas e correção de listas de exercícios.' },
    { tipo: 'EMPRESA_JUNIOR', organizacao: 'Horizonte Jr. Tecnologia', cargo: 'Desenvolvedor(a)', descricao: 'Desenvolvimento de sites para pequenos negócios da região.' },
    { tipo: 'INICIACAO_CIENTIFICA', organizacao: 'Laboratório de Sistemas Inteligentes', cargo: 'Bolsista de iniciação científica', descricao: 'Classificação de imagens com redes neurais.' },
    { tipo: 'FREELANCE', organizacao: 'Projetos independentes', cargo: 'Desenvolvedor(a) web', descricao: 'Landing pages e lojas virtuais.' },
  ],
  Direito: [
    { tipo: 'VOLUNTARIADO', organizacao: 'Núcleo de Prática Jurídica', cargo: 'Voluntário(a)', descricao: 'Atendimento à comunidade e triagem de casos.' },
    { tipo: 'MONITORIA', organizacao: 'Universidade Horizonte', cargo: 'Monitor(a) de Direito Civil', descricao: 'Apoio a alunos dos primeiros semestres.' },
  ],
  Administração: [
    { tipo: 'EMPREGO', organizacao: 'Supermercado Bom Preço', cargo: 'Operador(a) de caixa', descricao: 'Atendimento e fechamento de caixa.' },
    { tipo: 'EMPRESA_JUNIOR', organizacao: 'Vale Jr. Consultoria', cargo: 'Consultor(a)', descricao: 'Diagnóstico de processos em pequenas empresas.' },
  ],
  'Contabilidade e Finanças': [
    { tipo: 'JOVEM_APRENDIZ', organizacao: 'Cooperativa de Crédito Serra', cargo: 'Jovem aprendiz', descricao: 'Apoio ao atendimento e conferência de documentos.' },
    { tipo: 'VOLUNTARIADO', organizacao: 'Núcleo de Apoio Fiscal', cargo: 'Voluntário(a)', descricao: 'Orientação sobre declaração de imposto de renda.' },
  ],
  Saúde: [{ tipo: 'VOLUNTARIADO', organizacao: 'Unidade Básica de Saúde Centro', cargo: 'Voluntário(a)', descricao: 'Apoio em campanhas de vacinação.' }],
};
const CURSOS_LIVRES = [
  { nome: 'Inglês para negócios', instituicao: 'Escola Global', cargaHoraria: 60 },
  { nome: 'Excel do básico ao avançado', instituicao: 'Fundação Bradesco', cargaHoraria: 30 },
  { nome: 'Comunicação não violenta', instituicao: 'Senac', cargaHoraria: 20 },
  { nome: 'Introdução à LGPD', instituicao: 'Escola Virtual Gov', cargaHoraria: 10 },
];
const CIDADE: Record<string, [string, string]> = { horizonte: ['Porto Alegre', 'RS'], valedosul: ['Caxias do Sul', 'RS'], aurora: ['Florianópolis', 'SC'] };

export async function seedDemo(prisma: PrismaClient, { agora = new Date(), reset = false }: { agora?: Date; reset?: boolean } = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('O seed de demonstração não roda com NODE_ENV=production.');
  if (reset) await limparBanco(prisma);
  await seedBase(prisma);
  if (await prisma.usuario.findUnique({ where: { email: CONTAS_DEMO.faculdade } })) {
    throw new Error('O banco já tem os dados de demonstração. Rode com --reset para apagar e recriar.');
  }

  const f = new Faker({ locale: [pt_BR, en, base] });
  f.seed(SEMENTE_DEMO);
  const cifra = new CifraService();
  const senhaHash = await hashSenha(SENHA_DEMO);
  const dia = (n: number, hora = 10) => new Date(fimDoDia(dataCivil(new Date(agora.getTime() + n * DIA))).getTime() - (23 - hora) * H - 59 * 60_000 - 59_000);
  const antesDeAgora = (d: Date) => new Date(Math.min(d.getTime(), agora.getTime() - 30 * 60_000));
  const entre = (a: Date, b: Date) => new Date(a.getTime() + f.number.float({ min: 0, max: 1 }) * Math.max(0, b.getTime() - a.getTime()));
  const digitos = (n: number) => f.string.numeric({ length: n, allowLeadingZeros: true });
  const cpfs = new Set<string>();
  const novoCpf = () => {
    let cpf = gerarCpf(digitos(9));
    while (cpfs.has(cpf) || /^(\d)\1{10}$/.test(cpf)) cpf = gerarCpf(digitos(9));
    cpfs.add(cpf);
    return cpf;
  };
  const novoCnpj = () => gerarCnpj(digitos(8) + '0001');
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: credenciaisAdmin().email } });
  const areas = new Map((await prisma.areaFormacao.findMany()).map((a) => [a.nome, a.id]));
  const area = (nome: string) => areas.get(nome) ?? (() => { throw new Error(`Área ${nome} não existe no catálogo`); })();
  const notificacoes: { usuarioId: string; tipo: string; titulo: string; mensagem: string; link: string; criadaEm: Date }[] = [];
  const auditoria: { usuarioId: string | null; acao: string; entidade: string; entidadeId: string; dados?: object; criadoEm: Date }[] = [];

  // ---------- Faculdades, cursos, grade e turmas ----------
  const faculdades = new Map<string, { id: string; usuarioId: string; dominio: string }>();
  for (const fd of FACULDADES) {
    const u = await prisma.usuario.create({
      data: { email: fd.email, senhaHash, papel: 'FACULDADE', status: fd.ativa ? 'ATIVO' : 'INATIVO', emailVerificadoEm: dia(-400), criadoEm: dia(-400) },
    });
    const fac = await prisma.faculdade.create({
      data: { usuarioId: u.id, cnpj: novoCnpj(), razaoSocial: fd.razaoSocial, nomeFantasia: fd.nomeFantasia, telefone: fd.telefone, email: fd.email, ativa: fd.ativa, dominios: { create: { dominio: fd.dominio } } },
    });
    faculdades.set(fd.chave, { id: fac.id, usuarioId: u.id, dominio: fd.dominio });
    auditoria.push({ usuarioId: admin.id, acao: 'ADMIN_CRIOU_FACULDADE', entidade: 'Faculdade', entidadeId: fac.id, criadoEm: dia(-400) });
    if (!fd.ativa) auditoria.push({ usuarioId: admin.id, acao: 'ADMIN_INATIVOU_FACULDADE', entidade: 'Faculdade', entidadeId: fac.id, dados: { alunosInativados: 4 }, criadoEm: dia(-20, 15) });
  }

  const cursos = new Map<string, { id: string; turmas: { id: string; ano: number; periodo: number }[] }>();
  for (const c of CURSOS) {
    const curso = await prisma.curso.create({
      data: {
        faculdadeId: faculdades.get(c.faculdade)!.id,
        areaId: area(c.area),
        nome: c.nome,
        duracaoAnos: c.duracao,
        ementa: c.ementa,
        semestres: {
          create: Array.from({ length: c.duracao * 2 }, (_, i) => ({
            ano: Math.floor(i / 2) + 1,
            periodo: (i % 2) + 1,
            ordem: i + 1,
            aulas: {
              create: c.disciplinas.slice(i * 2, i * 2 + 2).map((nome, j) => ({
                nome,
                ordem: j + 1,
                ementa: `Fundamentos e prática de ${nome.toLowerCase()}, com atividades aplicadas e avaliação por projeto.`,
              })),
            },
          })),
        },
      },
    });
    const turmas = [];
    for (let ano = 2022; ano <= 2025; ano++) {
      for (const periodo of [1, 2]) turmas.push({ ...(await prisma.turma.create({ data: { cursoId: curso.id, anoIngresso: ano, periodoIngresso: periodo } })), ano, periodo });
    }
    cursos.set(c.chave, { id: curso.id, turmas });
  }

  // ---------- Empresas ----------
  const empresas = new Map<string, { id: string; usuarioId: string; nome: string }>();
  for (const e of EMPRESAS) {
    const criadaEm = dia(e.aprovacao === 'APROVADA' ? -200 : -6);
    const u = await prisma.usuario.create({ data: { email: e.email, senhaHash, papel: 'EMPRESA', status: 'ATIVO', emailVerificadoEm: criadaEm, criadoEm: criadaEm } });
    const emp = await prisma.empresa.create({
      data: {
        usuarioId: u.id,
        cnpj: novoCnpj(),
        razaoSocial: e.razaoSocial,
        nomeFantasia: e.nomeFantasia,
        telefone: e.telefone,
        email: e.email,
        ramoAtuacao: e.ramo,
        ...e.endereco,
        aprovacao: e.aprovacao,
        aprovacaoMotivo: e.motivo ?? null,
        aprovadaEm: e.aprovacao === 'APROVADA' ? new Date(criadaEm.getTime() + DIA) : null,
      },
    });
    empresas.set(e.chave, { id: emp.id, usuarioId: u.id, nome: e.nomeFantasia });
    if (e.aprovacao === 'APROVADA') {
      auditoria.push({ usuarioId: admin.id, acao: 'ADMIN_APROVOU_EMPRESA', entidade: 'Empresa', entidadeId: emp.id, criadoEm: new Date(criadaEm.getTime() + DIA) });
      notificacoes.push({ usuarioId: u.id, tipo: 'EMPRESA_APROVADA', titulo: 'Cadastro aprovado', mensagem: `O cadastro da ${e.nomeFantasia} foi aprovado. Você já pode publicar vagas.`, link: '/empresa/vagas', criadaEm: new Date(criadaEm.getTime() + DIA) });
    }
    if (e.aprovacao === 'REPROVADA') {
      auditoria.push({ usuarioId: admin.id, acao: 'ADMIN_REPROVOU_EMPRESA', entidade: 'Empresa', entidadeId: emp.id, dados: { motivo: e.motivo! }, criadoEm: dia(-4) });
      notificacoes.push({ usuarioId: u.id, tipo: 'EMPRESA_REPROVADA', titulo: 'Cadastro reprovado', mensagem: `O cadastro da ${e.nomeFantasia} foi reprovado. Motivo: ${e.motivo} Corrija o perfil e peça uma nova análise.`, link: '/empresa/perfil', criadaEm: dia(-4) });
    }
  }

  // ---------- Alunos e currículos ----------
  const periodoAtual = (() => {
    const [ano, mes] = dataCivil(agora).split('-').map(Number);
    return ano * 2 + (mes >= 7 ? 2 : 1);
  })();
  const alunos: AlunoDemo[] = [];
  const emails = new Set<string>();
  const NOMEADOS: Record<string, { nome: string; email: string; turma: [number, number]; semestre: number }> = {
    ana: { nome: 'Ana Souza', email: CONTAS_DEMO.alunaAtiva, turma: [2024, 1], semestre: 5 },
    bruno: { nome: 'Bruno Lima', email: CONTAS_DEMO.alunoHistorico, turma: [2024, 2], semestre: 4 },
    carla: { nome: 'Carla Mendes', email: CONTAS_DEMO.alunaDesligada, turma: [2023, 2], semestre: 6 },
    diego: { nome: 'Diego Alves', email: CONTAS_DEMO.alunoNovo, turma: [2025, 2], semestre: 1 },
  };
  const ordemNomeados: Record<string, string[]> = { computacao: ['ana', 'carla'], engsoftware: ['bruno'], administracao: ['diego'] };

  for (const c of CURSOS) {
    const fac = faculdades.get(c.faculdade)!;
    const { id: cursoId, turmas } = cursos.get(c.chave)!;
    for (let i = 0; i < c.alunos; i++) {
      const fixo = ordemNomeados[c.chave]?.[i];
      const def = fixo ? NOMEADOS[fixo] : undefined;
      const primeiro = f.person.firstName();
      const ultimo = f.person.lastName();
      const nome = def?.nome ?? `${primeiro} ${ultimo}`;
      let email = def?.email ?? `${semAcento(primeiro)}.${semAcento(ultimo)}@${fac.dominio}`;
      for (let n = 2; emails.has(email); n++) email = `${semAcento(primeiro)}.${semAcento(ultimo)}${n}@${fac.dominio}`;
      emails.add(email);
      const turma = def ? turmas.find((t) => t.ano === def.turma[0] && t.periodo === def.turma[1])! : f.helpers.arrayElement(turmas);
      const semestre = def?.semestre ?? Math.min(c.duracao * 2, Math.max(1, periodoAtual - (turma.ano * 2 + turma.periodo) + 1));
      const chave = fixo ?? (c.chave === 'direito' && i === c.alunos - 1 ? 'direito-desligado' : `${c.chave}-${i}`);
      const desligado = fixo === 'carla' || chave === 'direito-desligado';
      const inativo = desligado || c.faculdade === 'aurora';
      const cadastroEm = fixo === 'diego' ? dia(-1, 19) : dia(-f.number.int({ min: 90, max: 400 }));
      const cpf = novoCpf();

      const u = await prisma.usuario.create({
        data: { email, senhaHash, papel: 'ALUNO', status: inativo ? 'INATIVO' : 'ATIVO', emailVerificadoEm: cadastroEm, criadoEm: cadastroEm },
      });
      const aluno = await prisma.aluno.create({
        data: {
          usuarioId: u.id,
          nome,
          cpfHash: cifra.hmac(cpf),
          cpfCifrado: cifra.cifrar(cpf),
          telefone: `${f.helpers.arrayElement(['51', '54', '48'])}9${digitos(8)}`,
          faculdadeId: fac.id,
          cursoId,
          turmaId: turma.id,
          semestreAtual: semestre,
          motivoInativacao: inativo ? (desligado ? 'DESLIGADO_PELA_FACULDADE' : 'FACULDADE_INATIVA') : null,
          termosVersao: '2026-11',
          termosAceitosEm: cadastroEm,
        },
      });
      const inativoEm = fixo === 'carla' ? dia(-10, 14) : chave === 'direito-desligado' ? dia(-6, 11) : c.faculdade === 'aurora' ? dia(-20, 15) : undefined;
      const inativadoPor = desligado ? fac.usuarioId : inativo ? admin.id : undefined;
      alunos.push({ chave, id: aluno.id, usuarioId: u.id, nome, curso: c, semestre, inativoEm, inativadoPor });
      if (desligado) {
        auditoria.push({ usuarioId: fac.usuarioId, acao: 'FACULDADE_DESLIGOU_ALUNO', entidade: 'Aluno', entidadeId: aluno.id, dados: { motivo: fixo === 'carla' ? 'Transferência para outra instituição' : 'Matrícula trancada' }, criadoEm: inativoEm! });
      }

      // Currículo completo (o aluno novo chega com o currículo vazio).
      if (fixo === 'diego') continue;
      const [cidade, uf] = CIDADE[c.faculdade];
      const slug = `${semAcento(nome.split(' ')[0])}-${semAcento(nome.split(' ').at(-1)!)}`;
      const exps = f.helpers.arrayElements(EXPERIENCIAS[c.area], { min: 1, max: 2 });
      await prisma.curriculo.create({
        data: {
          alunoId: aluno.id,
          objetivo: f.helpers.arrayElement(OBJETIVOS[c.area]),
          resumo: `Estudante de ${c.nome} no ${semestre}º semestre na ${FACULDADES.find((x) => x.chave === c.faculdade)!.nomeFantasia}. ${f.helpers.arrayElement([
            'Gosto de aprender fazendo e de trabalhar em equipe.',
            'Busco a primeira experiência na área para aplicar o que aprendo em aula.',
            'Tenho facilidade com organização e prazos.',
            'Interesse em projetos com impacto social.',
          ])}`,
          cidade,
          uf,
          links: [
            { tipo: 'LINKEDIN', url: `https://www.linkedin.com/in/${slug}` },
            ...(c.area === 'Tecnologia' ? [{ tipo: 'GITHUB', url: `https://github.com/${slug}` }] : []),
          ],
          habilidadesTecnicas: f.helpers.arrayElements(HABILIDADES[c.area], { min: 3, max: 5 }),
          habilidadesComportamentais: f.helpers.arrayElements(COMPORTAMENTAIS, { min: 2, max: 3 }),
          disponibilidade: f.helpers.arrayElements(['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'], { min: 1, max: 2 }).join(','),
          informacoesAdicionais: f.helpers.arrayElement([null, 'CNH categoria B.', 'Disponibilidade para viagens.', 'Menção honrosa na olimpíada de matemática.']),
          formacoes: {
            create: [{ nivel: 'ENSINO_MEDIO', curso: 'Ensino médio', instituicao: `Escola Estadual ${f.person.lastName()}`, inicio: new Date(`${turma.ano - 3}-02-01`), conclusao: new Date(`${turma.ano - 1}-12-15`), situacao: 'CONCLUIDO' }],
          },
          experiencias: {
            create: exps.map((e, k) => ({ ...e, inicio: new Date(`${turma.ano + k}-03-01`), fim: k === exps.length - 1 && f.datatype.boolean() ? null : new Date(`${turma.ano + k}-12-01`) })),
          },
          cursos: { create: f.helpers.arrayElements(CURSOS_LIVRES, { min: 1, max: 2 }).map((x) => ({ ...x, conclusao: new Date(`${turma.ano}-07-15`) })) },
          idiomas: {
            create: [
              { idioma: 'Inglês', nivel: f.helpers.arrayElement<NivelIdioma>(['BASICO', 'INTERMEDIARIO', 'AVANCADO', 'FLUENTE']) },
              ...(f.datatype.boolean() ? [{ idioma: 'Espanhol', nivel: f.helpers.arrayElement<NivelIdioma>(['BASICO', 'INTERMEDIARIO']) }] : []),
            ],
          },
          projetos: {
            create: [{ titulo: `Projeto integrador de ${c.disciplinas[Math.min(semestre * 2 - 1, c.disciplinas.length - 1)]}`, descricao: 'Trabalho em grupo com entrega para um cliente real da comunidade.', link: c.area === 'Tecnologia' ? `https://github.com/${slug}/projeto-integrador` : null }],
          },
        },
      });
    }
  }

  // ---------- Vagas ----------
  type VagaCriada = VagaDef & { id: string; publicadaEm: Date; prazo: Date; encerradaEm: Date | null; fimJanela: Date; etapaIds: { id: string; nome: string }[]; empresaUsuarioId: string; empresaNome: string };
  const vagas: VagaCriada[] = [];
  for (const v of VAGAS) {
    const emp = empresas.get(v.empresa)!;
    const publicadaEm = dia(-v.publicadaHa, 9);
    const prazo = fimDoDia(dataCivil(new Date(agora.getTime() + v.prazoEm * DIA)));
    const encerradaEm = v.status === 'ENCERRADA_MANUAL' ? dia(v.prazoEm - 2, 16) : v.status === 'ENCERRADA_AUTOMATICA' ? new Date(prazo.getTime() + 72 * H + 5 * 60_000) : null;
    const status = v.status.startsWith('ENCERRADA') ? 'ENCERRADA' : v.status;
    const presencial = v.modalidade !== 'REMOTO';
    const empDef = EMPRESAS.find((e) => e.chave === v.empresa)!;
    const criada = await prisma.vaga.create({
      data: {
        empresaId: emp.id,
        funcao: v.funcao,
        tipo: v.tipo,
        modalidade: v.modalidade,
        atividades: v.atividades,
        requisitos: v.requisitos,
        salarioMin: v.salario?.[0] ?? null,
        salarioMax: v.salario?.[1] ?? null,
        beneficios: v.beneficios,
        processoSeletivo: processoSeletivo(v.etapas),
        cultura: CULTURA[v.empresa],
        cidade: presencial ? empDef.endereco.cidade : null,
        uf: presencial ? empDef.endereco.uf : null,
        semestreMinimo: v.semestreMinimo ?? null,
        status: status as 'ABERTA' | 'PAUSADA' | 'PRAZO_EXPIRADO' | 'ENCERRADA',
        prazo,
        encerradaEm,
        motivoEncerramento: v.status === 'ENCERRADA_MANUAL' ? 'MANUAL' : v.status === 'ENCERRADA_AUTOMATICA' ? 'AUTOMATICO' : null,
        criadaEm: publicadaEm,
        areas: { create: v.areas.map((a) => ({ areaId: area(a) })) },
        etapas: { create: v.etapas.map((nome, i) => ({ nome, ordem: i + 1 })) },
      },
      include: { etapas: { orderBy: { ordem: 'asc' } } },
    });
    const fimJanela = antesDeAgora(encerradaEm ?? (v.status === 'PRAZO_EXPIRADO' ? prazo : v.status === 'PAUSADA' ? dia(-5, 11) : agora));
    vagas.push({ ...v, id: criada.id, publicadaEm, prazo, encerradaEm, fimJanela, etapaIds: criada.etapas, empresaUsuarioId: emp.usuarioId, empresaNome: emp.nome });

    if (v.status === 'PAUSADA') auditoria.push({ usuarioId: emp.usuarioId, acao: 'EMPRESA_PAUSOU_VAGA', entidade: 'Vaga', entidadeId: criada.id, dados: { de: 'ABERTA', para: 'PAUSADA' }, criadoEm: dia(-5, 11) });
    if (v.status === 'PRAZO_EXPIRADO') {
      const em = new Date(prazo.getTime() + 5 * 60_000);
      auditoria.push({ usuarioId: null, acao: 'SISTEMA_EXPIROU_VAGA', entidade: 'Vaga', entidadeId: criada.id, dados: { para: 'PRAZO_EXPIRADO' }, criadoEm: em });
      notificacoes.push({
        usuarioId: emp.usuarioId,
        tipo: 'PRAZO_VENCIDO',
        titulo: `Prazo vencido: ${v.funcao}`,
        mensagem: `O prazo da vaga ${v.funcao} venceu e ela saiu da listagem. Prorrogue o prazo ou encerre a vaga com a devolutiva aos candidatos. Sem nenhuma ação, ela será encerrada automaticamente 72 h após o prazo.`,
        link: `/empresa/vagas/${criada.id}`,
        criadaEm: em,
      });
    }
    if (v.status === 'ENCERRADA_AUTOMATICA') {
      auditoria.push({ usuarioId: null, acao: 'SISTEMA_ENCERROU_VAGA', entidade: 'Vaga', entidadeId: criada.id, dados: { de: 'PRAZO_EXPIRADO', para: 'ENCERRADA' }, criadoEm: encerradaEm! });
      notificacoes.push({ usuarioId: emp.usuarioId, tipo: 'VAGA_ENCERRADA_AUTOMATICAMENTE', titulo: `Vaga encerrada automaticamente: ${v.funcao}`, mensagem: `A vaga ${v.funcao} foi encerrada 72 h após o prazo, sem prorrogação.`, link: `/empresa/vagas/${criada.id}`, criadaEm: encerradaEm! });
    }
    if (v.status === 'ENCERRADA_MANUAL') auditoria.push({ usuarioId: emp.usuarioId, acao: 'EMPRESA_ENCERROU_VAGA', entidade: 'Vaga', entidadeId: criada.id, dados: { para: 'ENCERRADA' }, criadoEm: encerradaEm! });
  }

  // ---------- Plano de candidaturas ----------
  const porChave = new Map(alunos.map((a) => [a.chave, a]));
  const plano: Plano[] = [...PLANO_FIXO];
  for (const v of vagas) {
    const ja = new Set(plano.filter((p) => p.vaga === v.chave).map((p) => p.aluno));
    const elegiveis = f.helpers.shuffle(
      alunos.filter(
        (a) =>
          !ja.has(a.chave) &&
          !['diego', 'carla', 'direito-desligado'].includes(a.chave) &&
          v.areas.includes(a.curso.area) &&
          a.semestre >= (v.semestreMinimo ?? 0) &&
          // Inativado só aparece em vaga publicada antes da inativação.
          (!a.inativoEm || v.publicadaEm.getTime() < a.inativoEm.getTime() - 2 * DIA),
      ),
    );
    let selecionou = plano.some((p) => p.vaga === v.chave && p.desfecho === 'selecionado');
    for (const a of elegiveis.slice(0, Math.max(0, v.candidatos - ja.size))) {
      const r = f.number.float({ min: 0, max: 1 });
      let desfecho: Desfecho;
      if (a.inativoEm) desfecho = 'inativo';
      else if (v.status === 'ENCERRADA_AUTOMATICA') desfecho = r < 0.15 ? 'removida' : 'auto';
      else if (v.status === 'ENCERRADA_MANUAL') desfecho = !selecionou ? ((selecionou = true), 'selecionado') : r < 0.15 ? 'removida' : 'nao_selecionado';
      else desfecho = r < 0.65 ? 'processo' : r < 0.82 ? 'nao_selecionado' : 'removida';
      plano.push({ aluno: a.chave, vaga: v.chave, desfecho, etapa: Math.min(v.etapas.length - 1, Math.floor(f.number.float({ min: 0, max: 1 }) ** 1.5 * v.etapas.length)) });
    }
  }

  // ---------- Candidaturas, linha do tempo e notificações ----------
  const vagaPorChave = new Map(vagas.map((v) => [v.chave, v]));
  for (const p of plano) {
    const a = porChave.get(p.aluno)!;
    const v = vagaPorChave.get(p.vaga)!;
    const etapas = v.etapaIds;
    // Até onde a candidatura anda: fim da janela da vaga, desligamento do aluno ou "últimos dias" das contas de demo.
    const limite = antesDeAgora(new Date(Math.min(v.fimJanela.getTime(), a.inativoEm?.getTime() ?? Infinity, p.ultimoHa ? agora.getTime() - p.ultimoHa * DIA : Infinity)));
    const inicio = entre(new Date(v.publicadaEm.getTime() + 2 * H), new Date(v.publicadaEm.getTime() + 0.5 * (limite.getTime() - v.publicadaEm.getTime())));
    const passos =
      p.desfecho === 'processo' ? (p.etapa ?? 0) : p.desfecho === 'selecionado' ? etapas.length - 1 : Math.min(etapas.length - 1, f.number.int({ min: 0, max: Math.max(0, etapas.length - 2) }));
    const final = ['nao_selecionado', 'selecionado', 'removida', 'inativo', 'auto'].includes(p.desfecho) ? 1 : 0;
    const quando = Array.from({ length: passos + final }, (_, k) => new Date(inicio.getTime() + ((k + 1) / (passos + final)) * (limite.getTime() - inicio.getTime())));
    if (p.desfecho === 'processo' && p.ultimoHa) quando[quando.length - 1] = limite;
    const fimDoFluxo = v.encerradaEm && ['selecionado', 'auto'].includes(p.desfecho) ? v.encerradaEm : v.encerradaEm && p.desfecho === 'nao_selecionado' && v.status === 'ENCERRADA_MANUAL' ? v.encerradaEm : null;
    if (final && fimDoFluxo) quando[quando.length - 1] = fimDoFluxo;
    if (p.desfecho === 'inativo') quando[quando.length - 1] = a.inativoEm!;

    const etapaFinal = etapas[passos];
    const status: StatusCandidatura =
      p.desfecho === 'processo' ? 'EM_PROCESSO' : p.desfecho === 'selecionado' ? 'SELECIONADO' : p.desfecho === 'nao_selecionado' || p.desfecho === 'auto' ? 'NAO_SELECIONADO' : 'CANCELADA';
    const atualizadaEm = quando.at(-1) ?? inicio;
    const eventos = [
      { tipo: 'CRIADA', deStatus: null, paraStatus: 'EM_PROCESSO' as const, etapaNome: etapas[0].nome, autorId: a.usuarioId, criadoEm: inicio },
      ...Array.from({ length: passos }, (_, k) => ({ tipo: 'ETAPA_ALTERADA', deStatus: 'EM_PROCESSO' as const, paraStatus: 'EM_PROCESSO' as const, etapaNome: etapas[k + 1].nome, autorId: v.empresaUsuarioId, criadoEm: quando[k] })),
      ...(final
        ? [{
            tipo: status === 'CANCELADA' ? 'CANCELADA' : status,
            deStatus: 'EM_PROCESSO' as const,
            paraStatus: status,
            etapaNome: etapaFinal.nome,
            autorId: p.desfecho === 'removida' ? a.usuarioId : p.desfecho === 'inativo' ? a.inativadoPor! : p.desfecho === 'auto' ? null : v.empresaUsuarioId,
            criadoEm: quando.at(-1)!,
          }]
        : []),
    ];
    const c = await prisma.candidatura.create({
      data: {
        alunoId: a.id,
        vagaId: v.id,
        status,
        etapaAtualId: etapaFinal.id,
        motivoCancelamento: p.desfecho === 'removida' ? 'ALUNO_REMOVEU' : p.desfecho === 'inativo' ? 'ALUNO_INATIVO' : null,
        criadaEm: inicio,
        atualizadaEm,
        eventos: { create: eventos },
      },
    });

    const linkAluno = `/aluno/candidaturas/${c.id}`;
    notificacoes.push({ usuarioId: v.empresaUsuarioId, tipo: 'NOVA_CANDIDATURA', titulo: 'Nova candidatura', mensagem: `${a.nome} se candidatou à vaga ${v.funcao}.`, link: `/empresa/vagas/${v.id}/candidatos`, criadaEm: inicio });
    for (let k = 0; k < passos; k++) {
      notificacoes.push({ usuarioId: a.usuarioId, tipo: 'ETAPA_ALTERADA', titulo: `Sua candidatura avançou: ${etapas[k + 1].nome}`, mensagem: mensagemEtapa(v.funcao, v.empresaNome, etapas[k + 1].nome), link: linkAluno, criadaEm: quando[k] });
    }
    const fim = quando.at(-1)!;
    if (p.desfecho === 'selecionado') notificacoes.push({ usuarioId: a.usuarioId, tipo: 'SELECIONADO', titulo: `Você foi selecionado(a): ${v.funcao}`, mensagem: mensagemSelecionado(v.funcao, v.empresaNome), link: linkAluno, criadaEm: fim });
    if (p.desfecho === 'nao_selecionado') {
      const noEncerramento = v.status === 'ENCERRADA_MANUAL';
      notificacoes.push({ usuarioId: a.usuarioId, tipo: 'NAO_SELECIONADO', titulo: `${noEncerramento ? 'Vaga encerrada' : 'Candidatura encerrada'}: ${v.funcao}`, mensagem: mensagemEncerrada(v.funcao, v.empresaNome), link: linkAluno, criadaEm: fim });
    }
    if (p.desfecho === 'auto') notificacoes.push({ usuarioId: a.usuarioId, tipo: 'VAGA_ENCERRADA_AUTOMATICAMENTE', titulo: `Vaga encerrada: ${v.funcao}`, mensagem: mensagemEncerrada(v.funcao, v.empresaNome), link: linkAluno, criadaEm: fim });
    if (p.desfecho === 'inativo') {
      notificacoes.push({ usuarioId: v.empresaUsuarioId, tipo: 'CANDIDATO_INATIVO', titulo: 'Candidatura cancelada', mensagem: `${a.nome} não está mais ativo(a) na faculdade; a candidatura para ${v.funcao} foi cancelada.`, link: `/empresa/vagas/${v.id}/candidatos`, criadaEm: fim });
    }
    // EMP-09: a empresa abriu o perfil de quem avançou de etapa.
    if (passos > 0 && p.desfecho !== 'inativo') auditoria.push({ usuarioId: v.empresaUsuarioId, acao: 'EMPRESA_VIU_PERFIL', entidade: 'Candidatura', entidadeId: c.id, dados: { alunoId: a.id }, criadoEm: new Date(quando[0].getTime() - H) });
  }

  // Notificações antigas já lidas; as dos últimos 3 dias ficam no sino. Os e-mails contam como enviados (nada vai ao Mailpit).
  await prisma.notificacao.createMany({
    data: notificacoes.map((n) => ({ ...n, lidaEm: n.criadaEm.getTime() < agora.getTime() - 3 * DIA ? new Date(n.criadaEm.getTime() + 2 * H) : null, emailEnviadoEm: n.criadaEm })),
  });
  await prisma.auditLog.createMany({ data: auditoria.map((x) => ({ ...x, dados: x.dados as Prisma.InputJsonValue | undefined })) });

  return {
    faculdades: FACULDADES.length,
    cursos: CURSOS.length,
    empresas: EMPRESAS.length,
    vagas: vagas.length,
    alunos: alunos.length,
    candidaturas: plano.length,
    notificacoes: notificacoes.length,
  };
}
