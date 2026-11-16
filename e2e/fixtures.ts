import { test as base, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { authenticator } from 'otplib';
import { dadosEmpresa } from './helpers';

const API = '/api/v1';
type Conta = { id: string; email: string; senha: string };
export type Cenario = {
  aluno: Conta & { nome: string; cpf: string };
  empresa: Conta;
  faculdade: Conta & { dominio: string };
  curso: { id: string; nome: string };
  turma: { id: string };
  vaga: { id: string; funcao: string; prazo: string };
  candidaturaId?: string;
};
type Job = 'expirar-prazos' | 'lembrete' | 'encerrar-automatico' | 'enviar-emails';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export class TestApi {
  constructor(private readonly request: APIRequestContext) {}

  async cenario(opcoes: { areaCurso?: string; areasVaga?: string[]; comCandidatura?: boolean; semestreMinimo?: number } = {}) {
    const res = await this.request.post(`${API}/__test__/cenarios`, { data: opcoes });
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as Cenario;
  }

  /** Admin único por teste, com o próprio segredo TOTP. */
  async admin() {
    const res = await this.request.post(`${API}/__test__/admins`);
    expect(res.ok()).toBeTruthy();
    const a = (await res.json()) as { email: string; senha: string; totpSecret: string };
    return { ...a, codigo: () => authenticator.generate(a.totpSecret) };
  }

  /** EMP-01: empresa cadastrada e com e-mail verificado, aguardando aprovação (ADM-04). */
  async empresaPendente() {
    const dados = dadosEmpresa();
    const res = await this.request.post(`${API}/auth/empresas`, { data: dados });
    expect(res.status()).toBe(201);
    const email = await this.ultimoEmailPara(dados.email, { assunto: /Confirme seu e-mail/ });
    const token = new URLSearchParams((await this.linkDoEmail(email.ID)).split('?')[1]).get('token');
    expect((await this.request.post(`${API}/auth/verificar-email`, { data: { token } })).ok()).toBeTruthy();
    return dados;
  }

  async moverPrazo(vagaId: string, prazo: Date) {
    await this.request.post(`${API}/__test__/vagas/${vagaId}/prazo`, { data: { prazo: prazo.toISOString() } });
  }

  async rodarJob(nome: Job, vagaId?: string) {
    const res = await this.request.post(`${API}/__test__/jobs/${nome}`, { data: { vagaId } });
    expect(res.ok()).toBeTruthy();
  }

  /** Último e-mail recebido no Mailpit para o endereço, esperando o worker entregar. */
  async ultimoEmailPara(email: string, { assunto }: { assunto?: RegExp } = {}) {
    let mensagem: { ID: string; Subject: string } | undefined;
    await expect
      .poll(async () => {
        const res = await this.request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${email}"` } });
        const { messages } = await res.json();
        mensagem = (messages as { ID: string; Subject: string }[]).find((m) => !assunto || assunto.test(m.Subject));
        return !!mensagem;
      }, { timeout: 15_000 })
      .toBe(true);
    return mensagem!;
  }

  /** Link (verificação, convite, redefinição) do corpo do e-mail. */
  async linkDoEmail(id: string) {
    const res = await this.request.get(`${MAILPIT}/api/v1/message/${id}`);
    const { Text } = await res.json();
    const url = /(https?:\/\/\S+token=[\w-]+)/.exec(Text)?.[1];
    expect(url).toBeTruthy();
    return new URL(url!).pathname + new URL(url!).search;
  }
}

/** Mensagem de erro da tela (o Next tem um route announcer com role=alert vazio). */
export const alerta = (page: Page, texto: string | RegExp) => page.getByRole('alert').filter({ hasText: texto });

export async function semViolacoesGraves(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** Sessão só de API (outro contexto, cookies próprios), para um segundo ator agir durante o teste. */
export type SessaoApi = {
  get: (url: string) => Promise<APIResponse>;
  post: (url: string, data?: object) => Promise<APIResponse>;
  patch: (url: string, data?: object) => Promise<APIResponse>;
  put: (url: string, data?: object) => Promise<APIResponse>;
  delete: (url: string) => Promise<APIResponse>;
};

type Fixtures = {
  api: TestApi;
  entrarComo: (conta: { email: string; senha: string; totp?: string }) => Promise<void>;
  sessao: (conta: { email: string; senha: string }) => Promise<SessaoApi>;
};

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    await use(new TestApi(request));
  },
  sessao: async ({ playwright, baseURL }, use) => {
    const contextos: APIRequestContext[] = [];
    await use(async ({ email, senha }) => {
      const ctx = await playwright.request.newContext({ baseURL });
      contextos.push(ctx);
      expect((await ctx.post(`${API}/auth/login`, { data: { email, senha } })).status()).toBe(200);
      const csrf = (await ctx.storageState()).cookies.find((c) => c.name === 'csrf')!.value;
      const headers = { 'X-CSRF-Token': csrf };
      return {
        get: (url) => ctx.get(API + url),
        post: (url, data) => ctx.post(API + url, { data, headers }),
        patch: (url, data) => ctx.patch(API + url, { data, headers }),
        put: (url, data) => ctx.put(API + url, { data, headers }),
        delete: (url) => ctx.delete(API + url, { headers }),
      };
    });
    await Promise.all(contextos.map((c) => c.dispose()));
  },
  entrarComo: async ({ page }, use) => {
    await use(async ({ email, senha, totp }) => {
      // page.request divide os cookies com o navegador: a página já abre logada
      const res = await page.request.post(`${API}/auth/login`, { data: { email, senha, ...(totp ? { totp } : {}) } });
      expect(res.status()).toBe(200);
    });
  },
});

export { expect };
