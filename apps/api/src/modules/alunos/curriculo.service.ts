import { Injectable } from '@nestjs/common';
import type { CurriculoInput } from '@vagas/contracts';
import type { Prisma } from '@prisma/client';
import { naoEncontrado } from '../../common/problema';
import { previsaoConclusao } from '../../domain/cursos';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

const dataOuNull = (d?: string) => (d ? new Date(`${d}T00:00:00Z`) : null);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const INCLUIR = {
  formacoes: true,
  experiencias: { orderBy: { inicio: 'desc' as const } },
  cursos: true,
  idiomas: true,
  projetos: true,
} satisfies Prisma.CurriculoInclude;

/**
 * ALU-04: currículo padrão (D16). Nome, e-mail e telefone vêm do cadastro e a graduação atual
 * vem do vínculo; o resto é do aluno. A empresa sempre vê a versão atual (D4).
 */
@Injectable()
export class CurriculoService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(alunoId: string) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
      include: {
        usuario: { select: { email: true } },
        faculdade: { select: { nomeFantasia: true } },
        curso: { select: { nome: true, duracaoAnos: true } },
        turma: { select: { anoIngresso: true, periodoIngresso: true } },
        curriculo: { include: INCLUIR },
      },
    });
    if (!aluno) throw naoEncontrado();
    const c = aluno.curriculo;
    return {
      dadosPessoais: { nome: aluno.nome, email: aluno.usuario.email, telefone: aluno.telefone },
      graduacaoAtual: {
        faculdade: aluno.faculdade.nomeFantasia,
        curso: aluno.curso.nome,
        semestre: aluno.semestreAtual,
        previsaoConclusao: previsaoConclusao(aluno.turma.anoIngresso, aluno.turma.periodoIngresso, aluno.curso.duracaoAnos),
      },
      curriculo: {
        objetivo: c?.objetivo ?? null,
        resumo: c?.resumo ?? null,
        cidade: c?.cidade ?? null,
        uf: c?.uf ?? null,
        links: (c?.links as { tipo: string; url: string }[] | undefined) ?? [],
        habilidadesTecnicas: c?.habilidadesTecnicas ?? [],
        habilidadesComportamentais: c?.habilidadesComportamentais ?? [],
        disponibilidade: c?.disponibilidade ? c.disponibilidade.split(',') : [],
        informacoesAdicionais: c?.informacoesAdicionais ?? null,
        formacoes: (c?.formacoes ?? []).map(({ id: _, curriculoId: __, inicio, conclusao, ...f }) => ({ ...f, inicio: iso(inicio), conclusao: iso(conclusao) })),
        experiencias: (c?.experiencias ?? []).map(({ id: _, curriculoId: __, inicio, fim, ...e }) => ({ ...e, inicio: iso(inicio), fim: iso(fim) })),
        cursos: (c?.cursos ?? []).map(({ id: _, curriculoId: __, conclusao, ...x }) => ({ ...x, conclusao: iso(conclusao) })),
        idiomas: (c?.idiomas ?? []).map(({ id: _, curriculoId: __, ...i }) => i),
        projetos: (c?.projetos ?? []).map(({ id: _, curriculoId: __, ...p }) => p),
        atualizadoEm: c?.atualizadoEm ?? null,
      },
    };
  }

  /** Substitui o currículo inteiro (PUT). */
  async salvar(alunoId: string, dados: CurriculoInput, tx?: Tx) {
    const executar = async (t: Tx) => {
      const base = {
        objetivo: dados.objetivo ?? null,
        resumo: dados.resumo ?? null,
        cidade: dados.cidade ?? null,
        uf: dados.uf ?? null,
        links: dados.links,
        habilidadesTecnicas: dedup(dados.habilidadesTecnicas),
        habilidadesComportamentais: dedup(dados.habilidadesComportamentais),
        disponibilidade: dados.disponibilidade.length ? dedup(dados.disponibilidade).join(',') : null,
        informacoesAdicionais: dados.informacoesAdicionais ?? null,
      };
      const { id: curriculoId } = await t.curriculo.upsert({ where: { alunoId }, create: { alunoId, ...base }, update: base });
      await Promise.all([
        t.formacaoAcademica.deleteMany({ where: { curriculoId } }),
        t.experiencia.deleteMany({ where: { curriculoId } }),
        t.cursoComplementar.deleteMany({ where: { curriculoId } }),
        t.idioma.deleteMany({ where: { curriculoId } }),
        t.projeto.deleteMany({ where: { curriculoId } }),
      ]);
      await t.formacaoAcademica.createMany({ data: dados.formacoes.map((f) => ({ ...f, curriculoId, inicio: dataOuNull(f.inicio), conclusao: dataOuNull(f.conclusao) })) });
      await t.experiencia.createMany({
        data: dados.experiencias.map((e) => ({ ...e, curriculoId, inicio: new Date(`${e.inicio}T00:00:00Z`), fim: dataOuNull(e.fim), descricao: e.descricao ?? null })),
      });
      await t.cursoComplementar.createMany({
        data: dados.cursos.map((x) => ({ ...x, curriculoId, cargaHoraria: x.cargaHoraria ?? null, conclusao: dataOuNull(x.conclusao), certificadoUrl: x.certificadoUrl ?? null })),
      });
      await t.idioma.createMany({ data: dados.idiomas.map((i) => ({ ...i, curriculoId })) });
      await t.projeto.createMany({ data: dados.projetos.map((p) => ({ ...p, curriculoId, link: p.link ?? null })) });
    };
    if (tx) await executar(tx);
    else await this.prisma.$transaction(executar);
  }
}

const dedup = <T extends string>(lista: T[]) => [...new Set(lista.map((s) => s.trim() as T))];
