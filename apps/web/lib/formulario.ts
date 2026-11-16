import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ErroApi } from './api';

/** Leva os erros por campo do problem+json para o formulário; devolve a mensagem geral. */
export function aplicarErrosApi<T extends FieldValues>(erro: unknown, setError: UseFormSetError<T>): string {
  if (!(erro instanceof ErroApi)) return 'Não foi possível concluir. Tente novamente.';
  for (const [campo, mensagens] of Object.entries(erro.campos())) {
    setError(campo as Path<T>, { type: 'server', message: mensagens.join(' · ') });
  }
  return erro.problema.errors?.length ? '' : erro.message;
}
