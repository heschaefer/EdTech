import { env } from '../../config/env';

export type Email = { para: string; assunto: string; html: string; texto: string };

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Layout único dos e-mails (texto do usuário sempre escapado). */
export function montarEmail(para: string, assunto: string, paragrafos: string[], acao?: { rotulo: string; url: string }): Email {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 16px">${escapar(p)}</p>`).join('');
  const botao = acao
    ? `<p><a href="${escapar(acao.url)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${escapar(acao.rotulo)}</a></p>
       <p style="font-size:12px;color:#64748b">Se o botão não funcionar, copie este endereço: ${escapar(acao.url)}</p>`
    : '';
  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:system-ui,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
    <div style="max-width:560px;margin:auto;background:#fff;border-radius:8px;padding:24px">
    <h1 style="font-size:18px;margin:0 0 16px">${escapar(assunto)}</h1>${corpo}${botao}
    <p style="font-size:12px;color:#64748b;margin-top:24px">Vagas Universitárias · mensagem automática, não responda.</p></div></body></html>`;
  const texto = [...paragrafos, acao ? `${acao.rotulo}: ${acao.url}` : ''].filter(Boolean).join('\n\n');
  return { para, assunto, html, texto };
}

const link = (caminho: string, token: string) => `${env().WEB_URL}${caminho}?token=${encodeURIComponent(token)}`;

export const emailVerificacao = (para: string, token: string) =>
  montarEmail(para, 'Confirme seu e-mail', ['Clique no botão abaixo para confirmar seu e-mail. O link vale 24 horas e só pode ser usado uma vez.'], {
    rotulo: 'Confirmar e-mail',
    url: link('/verificar-email', token),
  });

export const emailRedefinicao = (para: string, token: string) =>
  montarEmail(para, 'Redefinição de senha', ['Recebemos um pedido para redefinir sua senha. O link vale 1 hora e só pode ser usado uma vez.', 'Se não foi você, ignore este e-mail.'], {
    rotulo: 'Redefinir senha',
    url: link('/senha/redefinir', token),
  });

export const emailConvite = (para: string, nomeFaculdade: string, token: string) =>
  montarEmail(para, 'Convite para a plataforma de vagas', [`A ${nomeFaculdade} foi cadastrada na plataforma.`, 'Defina a senha de acesso pelo botão abaixo. O convite vale 72 horas.'], {
    rotulo: 'Definir senha',
    url: link('/convite', token),
  });

export const emailBloqueio = (para: string) =>
  montarEmail(para, 'Sua conta foi bloqueada temporariamente', [
    'Detectamos 5 tentativas seguidas de login com senha errada. Por segurança, sua conta ficará bloqueada por 15 minutos.',
    'Se não foi você, recomendamos redefinir sua senha.',
  ]);

export const emailTrocaFaculdade = (para: string, token: string) =>
  montarEmail(para, 'Confirme seu novo e-mail institucional', ['Confirme o novo e-mail para concluir a troca de faculdade. O link vale 24 horas.'], {
    rotulo: 'Confirmar troca',
    url: link('/aluno/trocar-faculdade/confirmar', token),
  });

/** ASVS 2.2.3: aviso ao titular depois de qualquer mudança de senha. */
export const emailSenhaAlterada = (para: string) =>
  montarEmail(para, 'Sua senha foi alterada', [
    'A senha da sua conta na plataforma de vagas acabou de ser alterada, e as outras sessões foram encerradas.',
    'Se não foi você, use "Esqueci a senha" na tela de login para criar uma nova e avise o suporte.',
  ]);
