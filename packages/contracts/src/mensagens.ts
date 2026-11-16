/** Mensagens padrão de devolutiva (seção 5). */
export const mensagemSelecionado = (funcao: string, empresa: string) =>
  `Parabéns! Você foi selecionado(a) para a vaga ${funcao} na ${empresa}. A empresa entrará em contato pelo seu e-mail ou telefone.`;

export const mensagemEncerrada = (funcao: string, empresa: string) =>
  `A vaga ${funcao} na ${empresa} foi encerrada. Obrigado pela sua candidatura e boa sorte nas próximas oportunidades.`;

export const mensagemEtapa = (funcao: string, empresa: string, etapa: string) =>
  `Sua candidatura para ${funcao} na ${empresa} avançou para a etapa ${etapa}.`;
