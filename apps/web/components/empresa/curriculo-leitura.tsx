import { ROTULOS } from '@vagas/contracts';
import { Cartao } from '@vagas/ui';
import type { ReactNode } from 'react';
import type { CurriculoApi } from '@/components/aluno/editor-curriculo';
import { formatarData } from '@/lib/formatar';

type Curriculo = CurriculoApi['curriculo'];

const rotulo = <T extends Record<string, string>>(mapa: T, chave: string) => mapa[chave as keyof T] ?? chave;
const mesAno = (d: string | null) => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : null);

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

/** EMP-09 / D4: currículo atual do candidato, só leitura e como texto puro (seção 8.3). */
export function CurriculoLeitura({ curriculo: c, graduacao }: { curriculo: Curriculo; graduacao: CurriculoApi['graduacaoAtual'] }) {
  const vazio = !c.objetivo && !c.resumo && !c.experiencias.length && !c.formacoes.length && !c.habilidadesTecnicas.length && !c.projetos.length;
  return (
    <Cartao className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">Currículo</h2>
      {c.objetivo && <Secao titulo="Objetivo profissional"><p className="text-sm">{c.objetivo}</p></Secao>}
      {c.resumo && <Secao titulo="Resumo"><p className="whitespace-pre-line text-sm">{c.resumo}</p></Secao>}
      {(c.cidade || c.links.length > 0) && (
        <Secao titulo="Localização e links">
          {c.cidade && <p className="text-sm">{c.cidade}{c.uf ? `/${c.uf}` : ''}</p>}
          <ul className="text-sm">
            {c.links.map((l) => (
              <li key={l.url}>{rotulo(ROTULOS.link, l.tipo)}: <a className="text-indigo-700 underline" href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.url}</a></li>
            ))}
          </ul>
        </Secao>
      )}
      <Secao titulo="Formação acadêmica">
        <ul className="flex flex-col gap-1 text-sm">
          <li>{graduacao.curso} · {graduacao.faculdade} · {graduacao.semestre}º semestre · previsão de conclusão {graduacao.previsaoConclusao.periodo}º sem./{graduacao.previsaoConclusao.ano}</li>
          {c.formacoes.map((f, i) => (
            <li key={i}>{rotulo(ROTULOS.nivelFormacao, f.nivel)}: {f.curso} · {f.instituicao} ({rotulo(ROTULOS.situacaoFormacao, f.situacao)})</li>
          ))}
        </ul>
      </Secao>
      {c.experiencias.length > 0 && (
        <Secao titulo="Experiência">
          <ul className="flex flex-col gap-3 text-sm">
            {c.experiencias.map((e, i) => (
              <li key={i}>
                <p className="font-medium">{e.cargo} · {e.organizacao}</p>
                <p className="text-slate-600">{rotulo(ROTULOS.experiencia, e.tipo)} · {mesAno(e.inicio)} a {mesAno(e.fim) ?? 'atual'}</p>
                {e.descricao && <p className="whitespace-pre-line">{e.descricao}</p>}
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {c.cursos.length > 0 && (
        <Secao titulo="Cursos e certificações">
          <ul className="text-sm">
            {c.cursos.map((x, i) => (
              <li key={i}>{x.nome} · {x.instituicao}{x.cargaHoraria ? ` · ${x.cargaHoraria} h` : ''}{x.conclusao ? ` · ${formatarData(x.conclusao + 'T12:00:00Z')}` : ''}</li>
            ))}
          </ul>
        </Secao>
      )}
      {c.idiomas.length > 0 && (
        <Secao titulo="Idiomas">
          <p className="text-sm">{c.idiomas.map((x) => `${x.idioma} (${rotulo(ROTULOS.idioma, x.nivel).toLowerCase()})`).join(', ')}</p>
        </Secao>
      )}
      {(c.habilidadesTecnicas.length > 0 || c.habilidadesComportamentais.length > 0) && (
        <Secao titulo="Habilidades">
          <ul aria-label="Habilidades" className="flex flex-wrap gap-2 text-xs">
            {[...c.habilidadesTecnicas, ...c.habilidadesComportamentais].map((h) => <li key={h} className="rounded-full bg-slate-100 px-2 py-0.5">{h}</li>)}
          </ul>
        </Secao>
      )}
      {c.projetos.length > 0 && (
        <Secao titulo="Projetos">
          <ul className="flex flex-col gap-2 text-sm">
            {c.projetos.map((p, i) => (
              <li key={i}>
                <p className="font-medium">{p.titulo}</p>
                <p className="whitespace-pre-line">{p.descricao}</p>
                {p.link && <a className="text-indigo-700 underline" href={p.link} target="_blank" rel="noopener noreferrer nofollow">{p.link}</a>}
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {(c.disponibilidade.length > 0 || c.informacoesAdicionais) && (
        <Secao titulo="Informações adicionais">
          {c.disponibilidade.length > 0 && <p className="text-sm">Disponibilidade: {c.disponibilidade.map((d) => rotulo(ROTULOS.disponibilidade, d)).join(', ')}</p>}
          {c.informacoesAdicionais && <p className="whitespace-pre-line text-sm">{c.informacoesAdicionais}</p>}
        </Secao>
      )}
      {vazio && <p className="text-sm text-slate-500">O candidato ainda não preencheu o currículo além dos dados do cadastro.</p>}
    </Cartao>
  );
}
