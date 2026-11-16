import { Injectable } from '@nestjs/common';
import { gerarCnpj, gerarCpf } from '@vagas/contracts';
import { randomInt, randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import { ClockService } from '../common/clock.service';
import { CifraService } from '../common/cripto/cifra.service';
import { hashSenha } from '../common/cripto/senha';
import { fimDoDia, dataCivil, somarHoras } from '../domain/prazo';
import { PrismaService } from '../prisma/prisma.service';
import { limparBanco, seedBase } from '../seed/base';

export const SENHA_TESTE = 'Teste@2026!x';

export type OpcoesCenario = { areaCurso?: string; areasVaga?: string[]; comCandidatura?: boolean; semestreMinimo?: number };

const digitos = (n: number) => Array.from({ length: n }, () => randomInt(10)).join('');

/** Rotas /__test__ (seção 9): só existem com NODE_ENV=test e ENABLE_TEST_ROUTES=true. */
@Injectable()
export class TestingService {
  private hashSenhaTeste?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly cifra: CifraService,
  ) {}

  async reset() {
    await limparBanco(this.prisma);
    await seedBase(this.prisma);
  }

  private senha() {
    return (this.hashSenhaTeste ??= hashSenha(SENHA_TESTE));
  }

  private area(nome: string) {
    return this.prisma.areaFormacao.upsert({ where: { nome }, update: {}, create: { nome } });
  }

  /** Cria faculdade, curso, aluno, empresa e vaga já verificados, com dados únicos (seção 11.1). */
  async cenario(op: OpcoesCenario = {}) {
    const sufixo = randomUUID().slice(0, 8);
    const agora = this.clock.agora();
    const senhaHash = await this.senha();
    const areaCurso = await this.area(op.areaCurso ?? 'Tecnologia');
    const areasVaga = await Promise.all((op.areasVaga ?? [areaCurso.nome]).map((n) => this.area(n)));

    const dominio = `aluno.t${sufixo}.edu.br`;
    const usuarioFac = await this.prisma.usuario.create({
      data: { email: `contato@t${sufixo}.edu.br`, senhaHash, papel: 'FACULDADE', status: 'ATIVO', emailVerificadoEm: agora },
    });
    const faculdade = await this.prisma.faculdade.create({
      data: {
        usuarioId: usuarioFac.id,
        cnpj: gerarCnpj(digitos(8) + '0001'),
        razaoSocial: `Faculdade Teste ${sufixo} LTDA`,
        nomeFantasia: `Faculdade Teste ${sufixo}`,
        telefone: '1133334444',
        email: usuarioFac.email,
        dominios: { create: { dominio } },
      },
    });
    const curso = await this.prisma.curso.create({
      data: {
        faculdadeId: faculdade.id,
        areaId: areaCurso.id,
        nome: `Curso ${areaCurso.nome} ${sufixo}`,
        duracaoAnos: 4,
        ementa: 'Ementa de teste',
        semestres: { create: Array.from({ length: 8 }, (_, i) => ({ ano: Math.floor(i / 2) + 1, periodo: (i % 2) + 1, ordem: i + 1 })) },
      },
    });
    const turma = await this.prisma.turma.create({ data: { cursoId: curso.id, anoIngresso: 2025, periodoIngresso: 1 } });

    const cpf = gerarCpf(digitos(9));
    const nomeAluno = `Aluno Teste ${sufixo}`;
    const usuarioAluno = await this.prisma.usuario.create({
      data: { email: `aluno.${sufixo}@${dominio}`, senhaHash, papel: 'ALUNO', status: 'ATIVO', emailVerificadoEm: agora },
    });
    const aluno = await this.prisma.aluno.create({
      data: {
        usuarioId: usuarioAluno.id,
        nome: nomeAluno,
        cpfHash: this.cifra.hmac(cpf),
        cpfCifrado: this.cifra.cifrar(cpf),
        telefone: '11999998888',
        faculdadeId: faculdade.id,
        cursoId: curso.id,
        turmaId: turma.id,
        semestreAtual: 3,
        termosVersao: '1',
        termosAceitosEm: agora,
      },
    });

    const usuarioEmp = await this.prisma.usuario.create({
      data: { email: `rh@e${sufixo}.com.br`, senhaHash, papel: 'EMPRESA', status: 'ATIVO', emailVerificadoEm: agora },
    });
    const empresa = await this.prisma.empresa.create({
      data: {
        usuarioId: usuarioEmp.id,
        cnpj: gerarCnpj(digitos(8) + '0001'),
        razaoSocial: `Empresa Teste ${sufixo} LTDA`,
        nomeFantasia: `Empresa Teste ${sufixo}`,
        telefone: '1144445555',
        email: usuarioEmp.email,
        ramoAtuacao: 'Tecnologia',
        cep: '01310100',
        logradouro: 'Avenida Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        uf: 'SP',
        aprovacao: 'APROVADA',
        aprovadaEm: agora,
      },
    });

    const prazo = fimDoDia(dataCivil(somarHoras(agora, 30 * 24)));
    const funcao = `Estágio em ${areasVaga[0].nome} ${sufixo}`;
    const vaga = await this.prisma.vaga.create({
      data: {
        empresaId: empresa.id,
        funcao,
        tipo: 'ESTAGIO',
        modalidade: 'REMOTO',
        atividades: 'Atividades de teste',
        requisitos: 'Requisitos de teste',
        beneficios: 'Vale-refeição',
        processoSeletivo: 'Triagem e entrevista',
        cultura: 'Cultura de teste',
        semestreMinimo: op.semestreMinimo ?? null,
        prazo,
        areas: { create: areasVaga.map((a) => ({ areaId: a.id })) },
        etapas: { create: [{ nome: 'Inscrição recebida', ordem: 1 }, { nome: 'Entrevista', ordem: 2 }] },
      },
      include: { etapas: { orderBy: { ordem: 'asc' } } },
    });

    let candidaturaId: string | undefined;
    if (op.comCandidatura) {
      const c = await this.prisma.candidatura.create({
        data: {
          alunoId: aluno.id,
          vagaId: vaga.id,
          etapaAtualId: vaga.etapas[0].id,
          eventos: { create: { tipo: 'CRIADA', paraStatus: 'EM_PROCESSO', etapaNome: vaga.etapas[0].nome, autorId: usuarioAluno.id } },
        },
      });
      candidaturaId = c.id;
    }

    return {
      aluno: { id: aluno.id, usuarioId: usuarioAluno.id, email: usuarioAluno.email, senha: SENHA_TESTE, nome: nomeAluno, cpf },
      empresa: { id: empresa.id, usuarioId: usuarioEmp.id, email: usuarioEmp.email, senha: SENHA_TESTE },
      faculdade: { id: faculdade.id, usuarioId: usuarioFac.id, email: usuarioFac.email, senha: SENHA_TESTE, dominio },
      curso: { id: curso.id, nome: curso.nome },
      turma: { id: turma.id },
      vaga: { id: vaga.id, funcao, prazo: prazo.toISOString() },
      candidaturaId,
    };
  }

  /** Admin exclusivo do teste (isola o rate limit de login e permite rodar em paralelo). */
  async criarAdmin() {
    const totpSecret = authenticator.generateSecret();
    const email = `admin.${randomUUID().slice(0, 8)}@vagas.local`;
    await this.prisma.usuario.create({
      data: {
        email,
        senhaHash: await this.senha(),
        papel: 'ADMIN',
        status: 'ATIVO',
        emailVerificadoEm: this.clock.agora(),
        totpSecretCifrado: this.cifra.cifrar(totpSecret),
      },
    });
    return { email, senha: SENHA_TESTE, totpSecret };
  }

  /**
   * Volume para o teste de carga (Fase 7): `vagas` vagas abertas na área Tecnologia e `candidatos`
   * alunos candidatados à vaga do cenário. Inserção em lote; só existe no ambiente de teste.
   */
  async carga({ vagas, candidatos }: { vagas: number; candidatos: number }) {
    const c = await this.cenario({ areaCurso: 'Tecnologia', comCandidatura: true });
    const agora = this.clock.agora();
    const senhaHash = await this.senha();
    const area = await this.area('Tecnologia');
    const vaga = await this.prisma.vaga.findUniqueOrThrow({ where: { id: c.vaga.id }, include: { etapas: { orderBy: { ordem: 'asc' } } } });
    const aluno = await this.prisma.aluno.findUniqueOrThrow({ where: { id: c.aluno.id } });
    const sufixo = randomUUID().slice(0, 8);

    const novas = await this.prisma.vaga.createManyAndReturn({
      data: Array.from({ length: vagas }, (_, i) => ({
        empresaId: vaga.empresaId,
        funcao: `${i % 3 === 0 ? 'Estágio' : 'Analista'} carga ${sufixo} ${i}`,
        tipo: i % 3 === 0 ? ('ESTAGIO' as const) : ('CLT' as const),
        modalidade: i % 2 ? ('REMOTO' as const) : ('HIBRIDO' as const),
        cidade: i % 2 ? null : 'São Paulo',
        uf: i % 2 ? null : 'SP',
        atividades: 'Atividades',
        requisitos: 'Requisitos',
        beneficios: 'Benefícios',
        processoSeletivo: 'Processo',
        cultura: 'Cultura',
        salarioMin: 1500 + (i % 20) * 100,
        salarioMax: 2500 + (i % 20) * 100,
        prazo: vaga.prazo,
        criadaEm: new Date(agora.getTime() - (i % 60) * 24 * 3600_000),
      })),
      select: { id: true },
    });
    await this.prisma.vagaArea.createMany({ data: novas.map((v) => ({ vagaId: v.id, areaId: area.id })) });
    await this.prisma.etapaSelecao.createMany({ data: novas.flatMap((v) => [{ vagaId: v.id, nome: 'Triagem', ordem: 1 }, { vagaId: v.id, nome: 'Entrevista', ordem: 2 }]) });

    const usuarios = await this.prisma.usuario.createManyAndReturn({
      data: Array.from({ length: candidatos }, (_, i) => ({ email: `carga.${sufixo}.${i}@${c.faculdade.dominio}`, senhaHash, papel: 'ALUNO' as const, status: 'ATIVO' as const, emailVerificadoEm: agora })),
      select: { id: true, email: true },
    });
    const alunos = await this.prisma.aluno.createManyAndReturn({
      data: usuarios.map((u, i) => {
        const cpf = gerarCpf(digitos(9));
        return {
          usuarioId: u.id,
          nome: `Candidato Carga ${i}`,
          cpfHash: this.cifra.hmac(`${cpf}-${u.id}`),
          cpfCifrado: this.cifra.cifrar(cpf),
          telefone: '11999990000',
          faculdadeId: aluno.faculdadeId,
          cursoId: aluno.cursoId,
          turmaId: aluno.turmaId,
          semestreAtual: (i % 8) + 1,
          termosVersao: '1',
          termosAceitosEm: agora,
        };
      }),
      select: { id: true },
    });
    const candidaturas = await this.prisma.candidatura.createManyAndReturn({
      data: alunos.map((a, i) => ({
        alunoId: a.id,
        vagaId: vaga.id,
        etapaAtualId: vaga.etapas[i % vaga.etapas.length].id,
        status: i % 10 === 0 ? ('NAO_SELECIONADO' as const) : ('EM_PROCESSO' as const),
        criadaEm: new Date(agora.getTime() - i * 60_000),
      })),
      select: { id: true },
    });
    await this.prisma.candidaturaEvento.createMany({ data: candidaturas.map((x) => ({ candidaturaId: x.id, tipo: 'CRIADA', paraStatus: 'EM_PROCESSO' as const, criadoEm: agora })) });

    return { aluno: c.aluno, empresa: c.empresa, vagaId: vaga.id, alunos: usuarios.slice(0, 20).map((u) => ({ email: u.email, senha: SENHA_TESTE })) };
  }

  async moverPrazo(vagaId: string, prazo: Date) {
    await this.prisma.vaga.update({ where: { id: vagaId }, data: { prazo } });
  }
}
