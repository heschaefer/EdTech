import { Injectable } from '@nestjs/common';
import type { AtualizarFaculdadeInput } from '@vagas/contracts';
import { naoEncontrado } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';

/** FAC-02: dados cadastrais; CNPJ e domínios aparecem só para leitura. */
@Injectable()
export class PerfilFaculdadeService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(faculdadeId: string) {
    const f = await this.prisma.faculdade.findUnique({
      where: { id: faculdadeId },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        nomeFantasia: true,
        telefone: true,
        email: true,
        dominios: { select: { dominio: true }, orderBy: { dominio: 'asc' } },
        usuario: { select: { email: true } },
      },
    });
    if (!f) throw naoEncontrado();
    const { dominios, usuario, ...dados } = f;
    return { ...dados, dominios: dominios.map((d) => d.dominio), emailLogin: usuario.email };
  }

  async atualizar(faculdadeId: string, dados: AtualizarFaculdadeInput) {
    await this.prisma.faculdade.update({ where: { id: faculdadeId }, data: dados });
    return this.obter(faculdadeId);
  }
}
