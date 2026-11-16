import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { conflito, naoEncontrado } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

type Ator = { id: string; ip?: string };
type Filtro = { aprovacao?: 'PENDENTE' | 'APROVADA' | 'REPROVADA'; ativa?: 'true' | 'false'; q?: string; page: number; pageSize: number };

const INCLUIR = {
  usuario: { select: { email: true, status: true, emailVerificadoEm: true } },
  _count: { select: { vagas: { where: { excluidaEm: null } } } },
} satisfies Prisma.EmpresaInclude;

type EmpresaListada = Prisma.EmpresaGetPayload<{ include: typeof INCLUIR }>;
const apresentar = ({ usuario, _count, usuarioId: _, ...e }: EmpresaListada) => ({
  ...e,
  emailLogin: usuario.email,
  emailVerificado: !!usuario.emailVerificadoEm,
  totalVagas: _count.vagas,
});

@Injectable()
export class AdminEmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly auditoria: AuditoriaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /** ADM-05 (e ADM-04 com aprovacao=PENDENTE: só quem já verificou o e-mail aguarda análise). */
  async listar(f: Filtro) {
    const digitos = f.q?.replace(/\D/g, '');
    const where: Prisma.EmpresaWhereInput = {
      ...(f.aprovacao ? { aprovacao: f.aprovacao } : {}),
      ...(f.aprovacao === 'PENDENTE' ? { usuario: { emailVerificadoEm: { not: null } } } : {}),
      ...(f.ativa ? { ativa: f.ativa === 'true' } : {}),
      ...(f.q
        ? {
            OR: [
              { nomeFantasia: { contains: f.q, mode: 'insensitive' } },
              { razaoSocial: { contains: f.q, mode: 'insensitive' } },
              { email: { contains: f.q.toLowerCase() } },
              ...(digitos && digitos.length >= 3 ? [{ cnpj: { contains: digitos } }] : []),
            ],
          }
        : {}),
    };
    const [total, empresas] = await this.prisma.$transaction([
      this.prisma.empresa.count({ where }),
      this.prisma.empresa.findMany({ where, include: INCLUIR, orderBy: { nomeFantasia: 'asc' }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    ]);
    return { data: empresas.map(apresentar), meta: { page: f.page, pageSize: f.pageSize, total } };
  }

  async obter(id: string) {
    const e = await this.prisma.empresa.findUnique({ where: { id }, include: INCLUIR });
    if (!e) throw naoEncontrado('Empresa não encontrada');
    return apresentar(e);
  }

  /** ADM-04: aprova empresa com e-mail verificado; ela recebe o resultado in-app e por e-mail (D20). */
  async aprovar(id: string, ator: Ator) {
    const e = await this.obter(id);
    if (!e.emailVerificado) throw conflito('A empresa ainda não verificou o e-mail.');
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.empresa.updateMany({
        where: { id, aprovacao: 'PENDENTE' },
        data: { aprovacao: 'APROVADA', aprovadaEm: this.clock.agora(), aprovacaoMotivo: null },
      });
      if (!count) throw conflito('Esta empresa não está aguardando análise.');
      await this.notificacoes.criar(
        { usuarioId: (await tx.empresa.findUniqueOrThrow({ where: { id } })).usuarioId, tipo: 'EMPRESA_APROVADA', titulo: 'Cadastro aprovado', mensagem: `O cadastro da ${e.nomeFantasia} foi aprovado. Você já pode publicar vagas.`, link: '/empresa/vagas' },
        tx,
      );
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_APROVOU_EMPRESA', entidade: 'Empresa', entidadeId: id, ip: ator.ip }, tx);
    });
    return this.obter(id);
  }

  /** ADM-04: reprova com motivo; a empresa pode corrigir e pedir nova análise (RN-26). */
  async reprovar(id: string, motivo: string, ator: Ator) {
    const e = await this.obter(id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.empresa.updateMany({ where: { id, aprovacao: 'PENDENTE' }, data: { aprovacao: 'REPROVADA', aprovacaoMotivo: motivo } });
      if (!count) throw conflito('Esta empresa não está aguardando análise.');
      await this.notificacoes.criar(
        { usuarioId: (await tx.empresa.findUniqueOrThrow({ where: { id } })).usuarioId, tipo: 'EMPRESA_REPROVADA', titulo: 'Cadastro reprovado', mensagem: `O cadastro da ${e.nomeFantasia} foi reprovado. Motivo: ${motivo}. Corrija o perfil e peça uma nova análise.`, link: '/empresa/perfil' },
        tx,
      );
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_REPROVOU_EMPRESA', entidade: 'Empresa', entidadeId: id, ip: ator.ip, dados: { motivo } }, tx);
    });
    return this.obter(id);
  }

  /** ADM-05: inativar bloqueia o login e pausa todas as vagas abertas; reativar libera o login (as vagas seguem pausadas). */
  async alterarAtiva(id: string, ativa: boolean, ator: Ator) {
    const e = await this.prisma.empresa.findUnique({ where: { id }, include: { usuario: true } });
    if (!e) throw naoEncontrado('Empresa não encontrada');
    if (e.ativa === ativa) return this.obter(id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.empresa.updateMany({ where: { id, ativa: !ativa }, data: { ativa } });
      if (!count) return;
      if (!ativa) {
        await tx.usuario.update({ where: { id: e.usuarioId }, data: { status: 'INATIVO' } });
        await tx.refreshToken.updateMany({ where: { usuarioId: e.usuarioId, revogadoEm: null }, data: { revogadoEm: this.clock.agora() } });
        const pausadas = await tx.vaga.updateMany({ where: { empresaId: id, status: 'ABERTA', excluidaEm: null }, data: { status: 'PAUSADA', versao: { increment: 1 } } });
        await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_INATIVOU_EMPRESA', entidade: 'Empresa', entidadeId: id, ip: ator.ip, dados: { vagasPausadas: pausadas.count } }, tx);
      } else {
        await tx.usuario.update({ where: { id: e.usuarioId }, data: { status: e.usuario.emailVerificadoEm ? 'ATIVO' : 'PENDENTE_VERIFICACAO' } });
        await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_REATIVOU_EMPRESA', entidade: 'Empresa', entidadeId: id, ip: ator.ip }, tx);
      }
    });
    return this.obter(id);
  }
}
