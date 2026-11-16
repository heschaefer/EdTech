'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormVaga } from '@/components/empresa/form-vaga';

/** EMP-03 */
export default function NovaVaga() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      <Link href="/empresa/vagas" className="text-sm text-indigo-700 hover:underline">← Vagas</Link>
      <h1 className="text-2xl font-semibold">Nova vaga</h1>
      <FormVaga aoSalvar={(v) => router.push(`/empresa/vagas/${v.id}?publicada=1`)} />
    </div>
  );
}
