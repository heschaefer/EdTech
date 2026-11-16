import { HttpStatus, Injectable } from '@nestjs/common';
import type { CriarFaculdadeInput, Paginacao } from '@vagas/contracts';
import type { z } from 'zod';
import type { atualizarFaculdadeAdminSchema } from '@vagas/contracts';
import { ClockService } from '../../common/clock.service';
import { conflito, naoEncontrado, Problema, regraDeNegocio } from '../../common/problema';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { InativacaoAlunosService } from '../alunos/inativacao.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { TokensEmailService } from '../auth/tokens-email.service';
import { EmailService } from '../email/email.service';
import { emailConvite } from '../email/templates';

type Ator = { id: string; ip?: string };

const erroCampo = (campo: string, mensagem: string) =>
  new Problema(HttpStatus.UNPROCESSABLE_ENTITY, 'Dados inválidos', mensagem, [{ campo, mensagem }]);

const SELECT_FACULDADE = {
  id: true,
  cnpj: true,
  razaoSocial: true,
  nomeFantasia: true,
  telefone: true,
  email: true,
  ativa: true,
  dominios: { select: { dominio: true }, orderBy: { dominio: 'asc' as const } },
  usuario: { select: { status: true, senhaHash: true } },
  _count: { select: { alunos: true, cursos: true } },
};

@Injectable()
export class AdminFaculdadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly tokens: TokensEmailService,
    private readonly email: EmailService,
    private readonly auditoria: AuditoriaService,
    private readonly inativacao: InativacaoAlunosService,
  ) {}

  async listar({ page, pageSize }: Paginacao) {
    const [total, linhas] = await this.prisma.$transaction([
      this.prisma.faculdade.count(),
      this.prisma.faculdade.findMany({ select: SELECT_FACULDADE, orderBy: { nomeFantasia: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { data: linhas.map(apresentar), meta: { page, pageSize, total } };
  }

  async obter(id: string) {
    const f = await this.prisma.faculdade.findUnique({ where: { id }, select: SELECT_FACULDADE });
    if (!f) throw naoEncontrado();
    return apresentar(f);
  }

  /** ADM-01 */
  async criar(dados: CriarFaculdadeInput, ator: Ator) {
    const dominios = [...new Set(dados.dominios)];
    await this.validarUnicidade(dados.cnpj, dados.email, dominios);

    const { faculdade, token } = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({ data: { email: dados.email, papel: 'FACULDADE', status: 'PENDENTE_VERIFICACAO' } });
      const faculdade = await tx.faculdade.create({
        data: {
          usuarioId: usuario.id,
          cnpj: dados.cnpj,
          razaoSocial: dados.razaoSocial,
          nomeFantasia: dados.nomeFantasia,
          telefone: dados.telefone,
          email: dados.email,
          dominios: { create: dominios.map((dominio) => ({ dominio })) },
        },
        select: SELECT_FACULDADE,
      });
      const token = await this.tokens.emitir(usuario.id, 'CONVITE', undefined, tx);
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_CRIOU_FACULDADE', entidade: 'Faculdade', entidadeId: faculdade.id, ip: ator.ip }, tx);
      return { faculdade, token };
    });
    await this.email.enfileirar(emailConvite(dados.email, dados.nomeFantasia, token));
    return apresentar(faculdade);
  }

  private async validarUnicidade(cnpj: string, email: string, dominios: string[]) {
    // RN-20: CNPJ único entre empresas e faculdades.
    const [fac, emp, usuario, usados] = await Promise.all([
      this.prisma.faculdade.findUnique({ where: { cnpj } }),
      this.prisma.empresa.findUnique({ where: { cnpj } }),
      this.prisma.usuario.findUnique({ where: { email } }),
      this.prisma.dominioFaculdade.findMany({ where: { dominio: { in: dominios } } }),
    ]);
    if (fac || emp) throw erroCampo('cnpj', 'CNPJ já cadastrado');
    if (usuario) throw erroCampo('email', 'E-mail já cadastrado'); // RN-21
    if (usados.length) {
      const i = dominios.indexOf(usados[0].dominio);
      throw erroCampo(`dominios.${i}`, `Domínio ${usados[0].dominio} já pertence a outra faculdade`);
    }
  }

  /** ADM-02: dados e inativação/reativação (D19, RN-27). */
  async atualizar(id: string, dados: z.infer<typeof atualizarFaculdadeAdminSchema>, ator: Ator) {
    const atual = await this.prisma.faculdade.findUnique({ where: { id }, include: { usuario: true } });
    if (!atual) throw naoEncontrado();
    const { ativa, ...cadastro } = dados;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(cadastro).length) await tx.faculdade.update({ where: { id }, data: cadastro });
      if (ativa === false && atual.ativa) await this.inativar(tx, id, atual.usuarioId, ator);
      if (ativa === true && !atual.ativa) await this.reativar(tx, id, atual.usuarioId, !!atual.usuario.senhaHash, ator);
      if (Object.keys(cadastro).length) {
        await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_EDITOU_FACULDADE', entidade: 'Faculdade', entidadeId: id, ip: ator.ip, dados: cadastro }, tx);
      }
    });
    return this.obter(id);
  }

  private async inativar(tx: Tx, id: string, usuarioId: string, ator: Ator) {
    // UPDATE condicional: duas inativações simultâneas não duplicam efeitos.
    const { count } = await tx.faculdade.updateMany({ where: { id, ativa: true }, data: { ativa: false } });
    if (!count) return;
    await tx.usuario.update({ where: { id: usuarioId }, data: { status: 'INATIVO' } });
    await tx.refreshToken.updateMany({ where: { usuarioId, revogadoEm: null }, data: { revogadoEm: this.clock.agora() } });
    const alunos = await tx.aluno.findMany({ where: { faculdadeId: id, usuario: { status: 'ATIVO' } }, select: { id: true } });
    await this.inativacao.inativar(tx, alunos.map((a) => a.id), 'FACULDADE_INATIVA', ator.id);
    await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_INATIVOU_FACULDADE', entidade: 'Faculdade', entidadeId: id, ip: ator.ip, dados: { alunosInativados: alunos.length } }, tx);
  }

  private async reativar(tx: Tx, id: string, usuarioId: string, temSenha: boolean, ator: Ator) {
    const { count } = await tx.faculdade.updateMany({ where: { id, ativa: false }, data: { ativa: true } });
    if (!count) return;
    await tx.usuario.update({ where: { id: usuarioId }, data: { status: temSenha ? 'ATIVO' : 'PENDENTE_VERIFICACAO' } });
    await this.inativacao.reativarPorFaculdade(tx, id);
    await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_REATIVOU_FACULDADE', entidade: 'Faculdade', entidadeId: id, ip: ator.ip }, tx);
  }

  /** ADM-02 */
  async adicionarDominio(id: string, dominio: string, ator: Ator) {
    if (!(await this.prisma.faculdade.findUnique({ where: { id } }))) throw naoEncontrado();
    if (await this.prisma.dominioFaculdade.findUnique({ where: { dominio } })) throw erroCampo('dominio', 'Domínio já pertence a uma faculdade');
    await this.prisma.$transaction(async (tx) => {
      await tx.dominioFaculdade.create({ data: { faculdadeId: id, dominio } });
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_ADICIONOU_DOMINIO', entidade: 'Faculdade', entidadeId: id, ip: ator.ip, dados: { dominio } }, tx);
    });
    return this.obter(id);
  }

  async removerDominio(id: string, dominio: string, ator: Ator) {
    const dominios = await this.prisma.dominioFaculdade.findMany({ where: { faculdadeId: id } });
    if (!dominios.some((d) => d.dominio === dominio)) throw naoEncontrado('Domínio não encontrado nesta faculdade');
    if (dominios.length === 1) throw regraDeNegocio('A faculdade precisa de ao menos um domínio');
    await this.prisma.$transaction(async (tx) => {
      await tx.dominioFaculdade.delete({ where: { dominio } });
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_REMOVEU_DOMINIO', entidade: 'Faculdade', entidadeId: id, ip: ator.ip, dados: { dominio } }, tx);
    });
    return this.obter(id);
  }

  /** ADM-02 / RN-06: reenvia o convite enquanto a senha não foi definida. */
  async reenviarConvite(id: string, ator: Ator) {
    const f = await this.prisma.faculdade.findUnique({ where: { id }, include: { usuario: true } });
    if (!f) throw naoEncontrado();
    if (f.usuario.senhaHash) throw conflito('A faculdade já definiu a senha; use "Esqueci a senha".');
    if (!f.ativa) throw conflito('Faculdade inativa');
    const token = await this.prisma.$transaction(async (tx) => {
      const t = await this.tokens.emitir(f.usuarioId, 'CONVITE', undefined, tx);
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_REENVIOU_CONVITE', entidade: 'Faculdade', entidadeId: id, ip: ator.ip }, tx);
      return t;
    });
    await this.email.enfileirar(emailConvite(f.usuario.email, f.nomeFantasia, token));
  }
}

type LinhaFaculdade = {
  dominios: { dominio: string }[];
  usuario: { status: string; senhaHash: string | null };
  _count: { alunos: number; cursos: number };
} & Record<string, unknown>;

function apresentar({ dominios, usuario, _count, ...f }: LinhaFaculdade) {
  return {
    ...f,
    dominios: dominios.map((d) => d.dominio),
    conviteAceito: !!usuario.senhaHash,
    statusUsuario: usuario.status,
    totalAlunos: _count.alunos,
    totalCursos: _count.cursos,
  };
}
