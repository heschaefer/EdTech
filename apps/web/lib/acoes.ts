'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ErroApi } from './api';

export type Mensagem = { tipo: 'sucesso' | 'erro'; texto: string } | null;

export const mensagemDeErro = (e: unknown) =>
  e instanceof ErroApi ? (e.problema.errors?.[0]?.mensagem ?? e.message) : 'Não foi possível concluir. Tente novamente.';

/** Executa uma chamada à API, mostra o resultado e invalida as consultas afetadas. */
export function useAcao(...chaves: QueryKey[]) {
  const qc = useQueryClient();
  const [mensagem, setMensagem] = useState<Mensagem>(null);

  const executar = useCallback(
    /** `aoConcluir` roda antes do aviso de sucesso (ex.: limpar o formulário), e a lista já vem atualizada. */
    async (fn: () => Promise<unknown>, sucesso: string, aoConcluir?: () => void) => {
      try {
        await fn();
        aoConcluir?.();
        await Promise.all(chaves.map((queryKey) => qc.invalidateQueries({ queryKey })));
        setMensagem({ tipo: 'sucesso', texto: sucesso });
        return true;
      } catch (e) {
        setMensagem({ tipo: 'erro', texto: mensagemDeErro(e) });
        return false;
      }
    },
    [qc, JSON.stringify(chaves)],
  );

  return { mensagem, setMensagem, executar };
}
