import { Suspense } from 'react';
import { FormLogin } from '@/components/publico/form-login';

export const metadata = { title: 'Entrar · Vagas Universitárias' };

export default function PaginaLogin() {
  return (
    <Suspense>
      <FormLogin />
    </Suspense>
  );
}
