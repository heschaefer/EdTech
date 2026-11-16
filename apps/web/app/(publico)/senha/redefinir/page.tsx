import { Suspense } from 'react';
import { FormDefinirSenha } from '@/components/publico/form-definir-senha';

export const metadata = { title: 'Redefinir senha · Vagas Universitárias' };

export default function PaginaRedefinir() {
  return (
    <Suspense>
      <FormDefinirSenha titulo="Redefinir senha" rota="/auth/senha/redefinir" sucesso="Senha alterada. Por segurança, todas as sessões foram encerradas; entre de novo." />
    </Suspense>
  );
}
