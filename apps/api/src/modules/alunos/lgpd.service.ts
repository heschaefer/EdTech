import { Injectable } from '@nestjs/common';
import { mascararCpf, NOME_TITULAR_REMOVIDO } from '@vagas/contracts';
import { randomBytes } from 'node:crypto';
import { ClockService } from '../../common/clock.service';
import { CifraService } from '../../common/cripto/cifra.service';
import { senhaConfere } from '../../common/cripto/senha';
import { erroDeCampo, naoEncontrado } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CurriculoService } from './curriculo.service';

/**
 * Seção 8.4 · direitos do titular. O aluno exporta tudo o que a plataforma guarda sobre ele (JSON)
 * e pode pedir a exclusão, que anonimiza os dados pessoais e mantém só o que serve a agregados
 * (curso, semestre, status das candidaturas e datas).
 */
@Injectable()
export class LgpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly cifra: CifraService,
    private readonly curriculos: CurriculoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async exportar(usuarioId: string) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { usuarioId },
      include: {
        usuario: { select: { email: true, status: true, criadoEm: true, emailVerificadoEm: true } },
        faculdade: { select: { nomeFantasia: true } },
        curso: { select: { nome: true } },
        turma: { select: { anoIngresso: true, periodoIngresso: true } },
      },
    });
    if (!aluno) throw naoEncontrado();
    const [{ curriculo }, candidaturas, notificacoes, acessos] = await Promise.all([
      this.curriculos.obter(aluno.id),
      this.prisma.candidatura.findMany({
        where: { alunoId: aluno.id },
        orderBy: { criadaEm: 'asc' },
        include: {
          etapaAtual: { select: { nome: true } },
          vaga: { select: { funcao: true, empresa: { select: { nomeFantasia: true } } } },
          eventos: { orderBy: { criadoEm: 'asc' }, select: { tipo: true, deStatus: true, paraStatus: true, etapaNome: true, criadoEm: true } },
        },
      }),
      this.prisma.notificacao.findMany({
        where: { usuarioId },
        orderBy: { criadaEm: 'asc' },
        select: { titulo: true, mensagem: true, criadaEm: true, lidaEm: true, emailEnviadoEm: true },
      }),
      // Transparência: quais empresas abriram o perfil do titular (EMP-09) e quando.
      this.prisma.auditLog.findMany({
        where: { acao: 'EMPRESA_VIU_PERFIL', dados: { path: ['alunoId'], equals: aluno.id } },
        orderBy: { criadoEm: 'asc' },
        select: { usuarioId: true, criadoEm: true },
      }),
    ]);
    const empresas = await this.prisma.empresa.findMany({
      where: { usuarioId: { in: [...new Set(acessos.map((a) => a.usuarioId!).filter(Boolean))] } },
      select: { usuarioId: true, nomeFantasia: true },
    });
    const nomeEmpresa = new Map(empresas.map((e) => [e.usuarioId, e.nomeFantasia]));

    await this.auditoria.registrar({ usuarioId, acao: 'ALUNO_EXPORTOU_DADOS', entidade: 'Aluno', entidadeId: aluno.id });
    return {
      geradoEm: this.clock.agora(),
      titular: {
        nome: aluno.nome,
        email: aluno.usuario.email,
        telefone: aluno.telefone,
        // Seção 8.2: o próprio aluno vê o CPF mascarado; o arquivo exportado segue a mesma regra.
        cpf: mascararCpf(this.cifra.decifrar(aluno.cpfCifrado)),
        situacao: aluno.usuario.status,
        contaCriadaEm: aluno.usuario.criadoEm,
        emailVerificadoEm: aluno.usuario.emailVerificadoEm,
        termos: { versao: aluno.termosVersao, aceitosEm: aluno.termosAceitosEm },
      },
      vinculo: {
        faculdade: aluno.faculdade.nomeFantasia,
        curso: aluno.curso.nome,
        turma: `${aluno.turma.anoIngresso}/${aluno.turma.periodoIngresso}`,
        semestreAtual: aluno.semestreAtual,
      },
      curriculo,
      candidaturas: candidaturas.map((c) => ({
        vaga: c.vaga.funcao,
        empresa: c.vaga.empresa.nomeFantasia,
        status: c.status,
        etapaAtual: c.etapaAtual?.nome ?? null,
        criadaEm: c.criadaEm,
        atualizadaEm: c.atualizadaEm,
        eventos: c.eventos,
      })),
      notificacoes,
      acessosAoPerfil: acessos.map((a) => ({ empresa: nomeEmpresa.get(a.usuarioId!) ?? 'Empresa', em: a.criadoEm })),
    };
  }

  /**
   * Exclusão a pedido do titular: candidaturas em processo são canceladas, currículo, sessões,
   * tokens e notificações são apagados, e nome, e-mail, telefone e CPF são substituídos. O CPF e o
   * e-mail ficam livres para um novo cadastro. O que resta (curso, semestre, status) serve só a agregados.
   */
  async excluir(usuarioId: string, senha: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, include: { aluno: { select: { id: true } } } });
    if (!usuario.aluno) throw naoEncontrado();
    if (!(await senhaConfere(usuario.senhaHash, senha))) throw erroDeCampo('senha', 'Senha incorreta');
    const alunoId = usuario.aluno.id;
    const agora = this.clock.agora();
    const marca = randomBytes(8).toString('hex');

    await this.prisma.$transaction(async (tx) => {
      const emProcesso = await tx.candidatura.findMany({ where: { alunoId, status: 'EM_PROCESSO' }, select: { id: true } });
      if (emProcesso.length) {
        await tx.candidatura.updateMany({
          where: { id: { in: emProcesso.map((c) => c.id) }, status: 'EM_PROCESSO' },
          data: { status: 'CANCELADA', motivoCancelamento: 'ALUNO_REMOVEU', atualizadaEm: agora },
        });
        await tx.candidaturaEvento.createMany({
          data: emProcesso.map((c) => ({ candidaturaId: c.id, tipo: 'CANCELADA', deStatus: 'EM_PROCESSO' as const, paraStatus: 'CANCELADA' as const, autorId: usuarioId, criadoEm: agora })),
        });
      }
      await tx.curriculo.deleteMany({ where: { alunoId } }); // itens caem em cascata
      await tx.refreshToken.deleteMany({ where: { usuarioId } });
      await tx.tokenEmail.deleteMany({ where: { usuarioId } });
      await tx.notificacao.deleteMany({ where: { usuarioId } });
      await tx.aluno.update({
        where: { id: alunoId },
        data: {
          nome: NOME_TITULAR_REMOVIDO,
          telefone: '',
          cpfHash: `anonimizado:${marca}`,
          cpfCifrado: '',
          motivoInativacao: null,
          anonimizadoEm: agora,
        },
      });
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { email: `removido.${marca}@anonimizado.invalid`, senhaHash: null, totpSecretCifrado: null, status: 'INATIVO', falhasLogin: 0, bloqueadoAte: null },
      });
      await this.auditoria.registrar({ usuarioId, acao: 'ALUNO_EXCLUIU_CONTA', entidade: 'Aluno', entidadeId: alunoId, dados: { candidaturasCanceladas: emProcesso.length } }, tx);
    });
  }
}
