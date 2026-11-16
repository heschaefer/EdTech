import { Injectable } from '@nestjs/common';

/**
 * Fonte única da hora atual (seção 10). Todo código lê daqui, nunca de `new Date()` direto,
 * para que os testes possam controlar o tempo.
 */
@Injectable()
export class ClockService {
  agora(): Date {
    return new Date();
  }
}

/** Relógio fixo, para testes unitários. */
export class RelogioFixo extends ClockService {
  constructor(private instante: Date) {
    super();
  }
  override agora(): Date {
    return new Date(this.instante.getTime());
  }
  definir(instante: Date) {
    this.instante = instante;
  }
}
