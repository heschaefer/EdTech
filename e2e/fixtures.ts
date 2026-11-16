import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { authenticator } from 'otplib';

const API = '/api/v1';
type Conta = { id: string; email: string; senha: string };
export type Cenario = {
  aluno: Conta & { nome: string };
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

  async cenario(opcoes: { areaCurso?: string; areasVaga?: string[]; comCandidatura?: boolean } = {}) {
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

export const test = base.extend<{ api: TestApi; entrarComo: (conta: { email: string; senha: string; totp?: string }) => Promise<void> }>({
  api: async ({ request }, use) => {
    await use(new TestApi(request));
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
