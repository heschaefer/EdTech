import { Injectable } from '@nestjs/common';
import type { FiltroVagas } from '@vagas/contracts';
import type { Prisma } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { naoEncontrado } from '../../common/problema';
import { aceitaCandidatura, filtroVagasVisiveis, vagaVisivel, type AlunoParaVisibilidade } from '../../domain/visibilidade';
import { PrismaService } from '../../prisma/prisma.service';
import { apresentarVaga, INCLUIR_VAGA } from './apresentacao';

const EMPRESA_PUBLICA = { select: { nomeFantasia: true, ramoAtuacao: true, cidade: true, uf: true, ativa: true, aprovacao: true } } as const;

@Injectable()
export class VagasAlunoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** Dados do aluno usados pela RN-08 (também na candidatura, ALU-07). */
  async contexto(usuarioId: string): Promise<AlunoParaVisibilidade & { alunoId: string }> {
    const a = await this.prisma.aluno.findUnique({
      where: { usuarioId },
      select: { id: true, semestreAtual: true, curso: { select: { areaId: true } }, usuario: { select: { status: true } } },
    });
    if (!a) throw naoEncontrado();
    return { alunoId: a.id, status: a.usuario.status, areaCursoId: a.curso.areaId, semestreAtual: a.semestreAtual };
  }

  /** ALU-05: só vagas visíveis pela RN-08, com filtros, ordenação e 20 por página. */
  async listar(usuarioId: string, f: FiltroVagas) {
    const aluno = await this.contexto(usuarioId);
    const agora = this.clock.agora();
    const filtros: Prisma.VagaWhereInput[] = [filtroVagasVisiveis(aluno, agora)];
    if (f.q) filtros.push({ OR: [{ funcao: { contains: f.q, mode: 'insensitive' } }, { empresa: { nomeFantasia: { contains: f.q, mode: 'insensitive' } } }] });
    if (f.tipo) filtros.push({ tipo: f.tipo });
    if (f.modalidade) filtros.push({ modalidade: f.modalidade });
    if (f.uf) filtros.push({ uf: f.uf });
    if (f.cidade) filtros.push({ cidade: { contains: f.cidade, mode: 'insensitive' } });
    if (f.salarioMin) filtros.push({ OR: [{ salarioMax: { gte: f.salarioMin } }, { salarioMax: null, salarioMin: { gte: f.salarioMin } }] });
    if (f.dias) filtros.push({ criadaEm: { gte: new Date(agora.getTime() - f.dias * 24 * 3600_000) } });
    const where: Prisma.VagaWhereInput = { AND: filtros };

    const [total, vagas] = await this.prisma.$transaction([
      this.prisma.vaga.count({ where }),
      this.prisma.vaga.findMany({
        where,
        orderBy: f.ordem === 'prazo' ? [{ prazo: 'asc' }, { criadaEm: 'desc' }] : [{ criadaEm: 'desc' }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        include: {
          ...INCLUIR_VAGA,
          empresa: EMPRESA_PUBLICA,
          candidaturas: { where: { alunoId: aluno.alunoId, status: { not: 'CANCELADA' } }, select: { id: true } },
        },
      }),
    ]);
    return {
      data: vagas.map(({ candidaturas, empresa, ...v }) => {
        const { atividades: _a, requisitos: _r, beneficios: _b, processoSeletivo: _p, cultura: _c, versao: _v, ...resumo } = apresentarVaga(v);
        return { ...resumo, empresa: { nomeFantasia: empresa.nomeFantasia }, candidatado: candidaturas.length > 0 };
      }),
      meta: { page: f.page, pageSize: f.pageSize, total },
    };
  }

  /** ALU-06: fora da área ou não ABERTA → 404, salvo se ele tem candidatura nela (somente leitura). */
  async obter(usuarioId: string, id: string) {
    const aluno = await this.contexto(usuarioId);
    const agora = this.clock.agora();
    const v = await this.prisma.vaga.findFirst({ where: { id, excluidaEm: null }, include: { ...INCLUIR_VAGA, empresa: EMPRESA_PUBLICA } });
    if (!v) throw naoEncontrado('Vaga não encontrada');
    const candidatura = await this.prisma.candidatura.findUnique({
      where: { alunoId_vagaId: { alunoId: aluno.alunoId, vagaId: id } },
      select: { id: true, status: true },
    });
    const regra = { ...v, areaIds: v.areas.map((a) => a.area.id), empresa: v.empresa };
    const visivel = vagaVisivel(regra, aluno);
    if (!visivel && !candidatura) throw naoEncontrado('Vaga não encontrada');

    const { empresa, ...vaga } = v;
    const { versao: _v, ...publica } = apresentarVaga(vaga);
    return {
      ...publica,
      empresa: { nomeFantasia: empresa.nomeFantasia, ramoAtuacao: empresa.ramoAtuacao, cidade: empresa.cidade, uf: empresa.uf },
      somenteLeitura: !visivel,
      candidatura,
      // RN-09 / RN-10: aceita nova candidatura (ou reativa a cancelada) só em vaga visível com prazo aberto.
      podeCandidatar: aceitaCandidatura(regra, aluno, agora) && (!candidatura || candidatura.status === 'CANCELADA'),
    };
  }
}
