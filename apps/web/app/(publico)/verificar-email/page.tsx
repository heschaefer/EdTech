import { Suspense } from 'react';
import { ConsumirLink } from '@/components/publico/consumir-link';

export const metadata = { title: 'Verificar e-mail · Vagas Universitárias' };

export default function PaginaVerificarEmail() {
  return (
    <Suspense>
      <ConsumirLink />
    </Suspense>
  );
}
