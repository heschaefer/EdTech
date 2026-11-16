import { Suspense } from 'react';
import { FormDefinirSenha } from '@/components/publico/form-definir-senha';

export const metadata = { title: 'Primeiro acesso · Vagas Universitárias' };

/** FAC-01 */
export default function PaginaConvite() {
  return (
    <Suspense>
      <FormDefinirSenha titulo="Primeiro acesso da faculdade" rota="/auth/convite/aceitar" sucesso="Senha definida e conta ativada. Você já pode entrar." />
    </Suspense>
  );
}
