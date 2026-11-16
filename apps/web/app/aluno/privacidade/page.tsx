'use client';

import { Botao, Campo, Cartao } from '@vagas/ui';
import { useState } from 'react';
import { Aviso } from '@/components/aviso';
import { Dialogo } from '@/components/dialogo';
import { mensagemDeErro } from '@/lib/acoes';
import { api, ErroApi } from '@/lib/api';

/** Seção 8.4: direitos do titular — exportar os dados e pedir a exclusão (anonimização). */
export default function Privacidade() {
  const [baixando, setBaixando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function baixar() {
    setBaixando(true);
    setAviso(null);
    try {
      const dados = await api('/alunos/me/dados');
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
      setAviso({ tipo: 'sucesso', texto: 'Arquivo meus-dados.json gerado.' });
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) });
    } finally {
      setBaixando(false);
    }
  }

  async function excluir() {
    setEnviando(true);
    setErroExclusao(null);
    try {
      await api('/alunos/me/exclusao', { method: 'POST', corpo: { senha, confirmacao } });
      window.location.href = '/login?conta=excluida';
    } catch (e) {
      setErroExclusao(e instanceof ErroApi && e.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Privacidade e seus dados</h1>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Baixar meus dados</h2>
        <p className="text-sm text-slate-700">
          Um arquivo JSON com tudo o que a plataforma guarda sobre você: cadastro (CPF mascarado), vínculo acadêmico, currículo, candidaturas com a linha do tempo,
          notificações e quais empresas abriram o seu perfil.
        </p>
        <div>
          <Botao variante="secundario" disabled={baixando} onClick={baixar}>{baixando ? 'Gerando…' : 'Baixar meus dados'}</Botao>
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Excluir minha conta</h2>
        <p className="text-sm text-slate-700">
          Seus dados pessoais (nome, e-mail, telefone, CPF e currículo) são apagados ou anonimizados e você perde o acesso. Candidaturas em processo são canceladas;
          as finalizadas continuam só como números, sem identificar você. A ação não pode ser desfeita.
        </p>
        <div>
          <Botao variante="perigo" onClick={() => setExcluindo(true)}>Excluir minha conta</Botao>
        </div>
      </Cartao>

      {excluindo && (
        <Dialogo
          titulo="Excluir minha conta"
          rotuloConfirmar="Excluir definitivamente"
          variante="perigo"
          ocupado={enviando || !senha || confirmacao !== 'EXCLUIR'}
          aoFechar={() => (setExcluindo(false), setSenha(''), setConfirmacao(''), setErroExclusao(null))}
          aoConfirmar={excluir}
        >
          <div className="flex flex-col gap-3">
            <p>Confirme com a sua senha e digite EXCLUIR.</p>
            <Campo rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <Campo rotulo="Digite EXCLUIR para confirmar" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
            {erroExclusao && <Aviso tipo="erro">{erroExclusao}</Aviso>}
          </div>
        </Dialogo>
      )}
    </div>
  );
}
