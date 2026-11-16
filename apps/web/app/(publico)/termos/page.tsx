import { Cartao } from '@vagas/ui';
import { VERSAO_TERMOS } from '@vagas/contracts';

export const metadata = { title: 'Termos de uso e privacidade · Vagas Universitárias' };

/** 8.4: aceite com versão e data no cadastro. Texto de demonstração. */
export default function Termos() {
  return (
    <Cartao className="prose prose-sm max-w-none">
      <h1 className="text-xl font-semibold">Termos de uso e política de privacidade</h1>
      <p className="text-sm text-slate-500">Versão {VERSAO_TERMOS}</p>
      <h2 className="mt-4 font-semibold">Que dados usamos</h2>
      <p>Nome, CPF, e-mail institucional, telefone, vínculo acadêmico (faculdade, curso, turma e semestre) e o currículo que você preencher.</p>
      <h2 className="mt-4 font-semibold">Com quem compartilhamos</h2>
      <p>
        Empresas só veem seus dados quando você se candidata a uma vaga delas: nome, e-mail, telefone, faculdade, curso, turma, semestre e
        currículo. O CPF nunca é mostrado a empresas. Se a candidatura for cancelada, a empresa perde o acesso ao seu perfil.
      </p>
      <h2 className="mt-4 font-semibold">Como protegemos</h2>
      <p>O CPF é guardado cifrado. Senhas são guardadas com hash. Os acessos de empresas ao seu perfil ficam registrados.</p>
      <h2 className="mt-4 font-semibold">Seus direitos</h2>
      <p>Você pode exportar seus dados e pedir a exclusão da conta, que anonimiza os dados pessoais.</p>
      <h2 className="mt-4 font-semibold">O que não pedimos</h2>
      <p>Foto, data de nascimento, estado civil, gênero e RG não fazem parte do currículo.</p>
    </Cartao>
  );
}
