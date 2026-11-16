'use client';

import { Campo, Selecao } from '@vagas/ui';
import { useState } from 'react';
import type { FieldErrors, FieldValues, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { UFS } from '@vagas/contracts';
import { formatarCep } from '@/lib/formatar';
import { buscarCep } from '@/lib/viacep';

export type Endereco = { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; uf: string };

/** D6 / EMP-01: endereço completo; o CEP preenche o resto via ViaCEP. */
/** O formulário que usa precisa ter os campos de `Endereco`. */
export function CamposEndereco<T extends FieldValues>({ register, setValue, errors }: { register: UseFormRegister<T>; setValue: UseFormSetValue<T>; errors: FieldErrors<T> }) {
  const reg = register as unknown as UseFormRegister<Endereco>;
  const set = setValue as unknown as UseFormSetValue<Endereco>;
  const err = errors as FieldErrors<Endereco>;
  const [aviso, setAviso] = useState('');

  const aoSairDoCep = async (cep: string) => {
    setAviso('');
    if (cep.replace(/\D/g, '').length !== 8) return;
    const e = await buscarCep(cep);
    if (!e) return setAviso('CEP não encontrado; preencha o endereço manualmente.');
    for (const campo of ['logradouro', 'bairro', 'cidade', 'uf'] as const) if (e[campo]) set(campo, e[campo], { shouldValidate: true });
  };

  return (
    <>
      <div>
        <Campo
          rotulo="CEP"
          inputMode="numeric"
          {...reg('cep', { onChange: (e) => set('cep', formatarCep(e.target.value)), onBlur: (e) => aoSairDoCep(e.target.value) })}
          erro={err.cep?.message}
        />
        {aviso && <p className="mt-1 text-sm text-slate-600">{aviso}</p>}
      </div>
      <Campo rotulo="Logradouro" {...reg('logradouro')} erro={err.logradouro?.message} />
      <Campo rotulo="Número" {...reg('numero')} erro={err.numero?.message} />
      <Campo rotulo="Complemento (opcional)" {...reg('complemento')} erro={err.complemento?.message} />
      <Campo rotulo="Bairro" {...reg('bairro')} erro={err.bairro?.message} />
      <Campo rotulo="Cidade" {...reg('cidade')} erro={err.cidade?.message} />
      <Selecao rotulo="UF" {...reg('uf')} erro={err.uf?.message}>
        <option value="">—</option>
        {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
      </Selecao>
    </>
  );
}
