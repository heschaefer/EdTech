# Spec — Plataforma de Vagas Universitárias

NestJS + Next.js + Tailwind · Spec-Driven Development

## 1. Visão geral

A plataforma conecta alunos de faculdades clientes a vagas de empresas, mostrando a cada aluno só as vagas da área de formação do seu curso. A faculdade é criada pelo admin, porque o software é vendido a ela; empresas se cadastram sozinhas; alunos entram com o e-mail institucional verificado.

| Ator | Como entra | O que faz |
| --- | --- | --- |
| Admin (plataforma) | Usuário criado por seed, com 2FA TOTP | Cria faculdades e seus domínios, mantém o catálogo de áreas de formação, aprova empresas, inativa contas |
| Faculdade | Conta criada pelo admin; convite por e-mail para definir a senha | Cadastra cursos (área, duração, ementa), semestres, aulas e turmas; desliga e reativa alunos |
| Aluno | Autocadastro com e-mail de domínio de uma faculdade cliente, confirmado por link | Mantém perfil e currículo, vê vagas da sua área, candidata-se, acompanha etapas e histórico |
| Empresa | Autocadastro com CNPJ único, e-mail confirmado e aprovação manual do admin | Publica e gerencia vagas, avalia candidatos, encerra vagas com devolutiva |

**Escopo do MVP:** os quatro painéis acima, notificações in-app e por e-mail e os jobs de prazo de vaga. **Fora do escopo:** push e WhatsApp, upload de currículo em PDF, chat entre empresa e aluno, cobrança da licença da faculdade, relatórios de empregabilidade e app mobile nativo (o web é responsivo). Também não há integração com sistemas acadêmicos: é um sistema simples, pensado para demonstração em aula, rodando localmente com Docker Compose e Mailpit.

### Como esta spec guia o desenvolvimento

1. Todo comportamento nasce aqui como história com ID (ex.: ALU-07) e critérios Dado / Quando / Então.
2. Cada critério vira ao menos um teste, e o título do teste começa pelo ID.
3. Mudou uma regra: atualiza a spec, depois o teste (vermelho), depois o código (verde).
4. O CI falha se algum ID da spec não tiver teste (seção 11).
5. As decisões de produto ficam na seção 2; mudar uma delas começa por lá.

## 2. Decisões de produto

Todas as decisões abaixo foram confirmadas por você; mudar uma delas começa por aqui.

| # | Tema | Decisão |
| --- | --- | --- |
| D1 | Como a vaga sabe para quais cursos aparece | Catálogo global de áreas de formação (Tecnologia, Administração, Direito…), mantido pelo admin. A faculdade escolhe uma área por curso; a empresa escolhe uma ou mais áreas por vaga |
| D2 | Quem cria a faculdade | Só o admin; não existe autocadastro de faculdade |
| D3 | Prazo e devolutiva | A empresa define o prazo e pode prorrogá-lo. No vencimento ela é notificada; se não prorrogar nem encerrar em 3 dias, a vaga encerra sozinha e os alunos são avisados. Ao encerrar, quem não foi selecionado recebe mensagem genérica de encerramento |
| D4 | Currículo visto pela empresa | Sempre o atual |
| D5 | Aluno que sai da faculdade | A conta é inativada; se a nova faculdade for cliente, o aluno troca o e-mail e a conta volta a ficar ativa, com o histórico |
| D6 | Endereço da empresa | Completo e obrigatório |
| D7 | Tipos de vaga | Todos: estágio, jovem aprendiz, trainee, CLT, PJ e temporário |
| D8 | Avanço de semestre | Só manual, pelo próprio aluno |
| D9 | Canais de notificação | In-app e e-mail |
| D10 | Excluir vaga | Só se nunca teve candidatura; com candidaturas a ação é Encerrar, para preservar o histórico do aluno |
| D11 | "Em que ponto da seleção" | A empresa cadastra etapas ordenadas por vaga (ex.: Triagem, Entrevista, Teste); o aluno vê a etapa atual |
| D12 | Dados do aluno visíveis à empresa | Nome, e-mail, telefone, faculdade, curso, turma, semestre e currículo; nunca o CPF |
| D13 | Semestres por ano | Fixo em 2; o sistema gera os semestres a partir da duração |
| D14 | Logins por organização | Um usuário por empresa e um por faculdade |
| D15 | Fim do prazo | A data escolhida vale até 23:59 no horário de Brasília |
| D16 | Conteúdo do currículo | Campos de um currículo padrão, detalhados no ALU-04: contato, objetivo, resumo, formação acadêmica, experiências, cursos e certificações, idiomas, habilidades, projetos e informações adicionais. Sem foto, idade, estado civil ou documentos |
| D17 | Aluno desligado com candidaturas em andamento | As candidaturas EM\_PROCESSO são canceladas na hora; a empresa passa a ver o candidato marcado como "Aluno inativo" |
| D18 | Quem desliga o aluno | Só a faculdade, pelo painel; sem integração com sistema acadêmico |
| D19 | Faculdade inativada | Todos os alunos dela ficam inativos |
| D20 | Aprovação de empresa | Manual, pelo admin; sem aprovação a empresa não publica vagas; reprovada, pode corrigir e pedir nova análise |
| D21 | Limite do prazo | No máximo 1 ano após a publicação, contando as prorrogações |
| D22 | Requisitos da vaga | Semestre mínimo opcional; curso específico, não (vale só a área) |
| D23 | Visão da faculdade | Não vê candidaturas nem contratações dos seus alunos |
| D24 | Nível de rigor | Mantém tudo o que a spec define: CPF cifrado, 2FA do admin, worker separado, LGPD completa e revisão de segurança |
| D25 | Ambiente da demonstração | Local, com Docker Compose; todos os e-mails caem no Mailpit |
| D26 | Dados de demonstração | Seed que simula o sistema em uso, com contas prontas para a aula (seção 10.1) |

## 3. Glossário

| Termo | Significado nesta spec |
| --- | --- |
| Área de formação | Categoria genérica do catálogo global (Tecnologia, Direito…). Liga cursos a vagas |
| Ementa | Texto que diz o que o curso ou a aula proporciona (no pedido original: "emenda") |
| Turma | Grupo de alunos de um curso pelo ano (e período) de ingresso, ex.: Engenharia 2025/1 |
| Semestre atual | Número de 1 até duração × 2 que o próprio aluno informa e atualiza |
| Domínio institucional | Parte do e-mail após o @ (ex.: aluno.unifoo.edu.br) cadastrada pelo admin para uma faculdade |
| Vaga | Oportunidade publicada por uma empresa, de qualquer tipo de contrato |
| Prazo | Data-limite da vaga escolhida pela empresa; pode ser prorrogada |
| Pausar (inativar) | Tirar a vaga da listagem sem encerrá-la; candidaturas continuam |
| Encerrar | Fim definitivo da vaga, que dispara a devolutiva |
| Devolutiva | Notificação ao aluno do resultado: selecionado ou não selecionado |
| Candidatura | Vínculo aluno–vaga, com status e etapa atual |
| Etapa | Passo do processo seletivo cadastrado pela empresa para a vaga |
| Histórico | Todas as candidaturas do aluno, inclusive canceladas e de vagas encerradas |

## 4. Histórias de usuário e critérios de aceite

Cada história tem um ID estável usado nos testes. Os critérios seguem Dado / Quando / Então; as regras citadas (RN-xx) estão na seção 5.

### 4.1 Autenticação (todos os papéis)

**AUTH-01 · Login**

- Dado usuário ATIVO com credenciais válidas, quando entra, então recebe os cookies de sessão (seção 8) e vai para o painel do seu papel.
- Dado e-mail ou senha errados, então recebe 401 com a mensagem genérica "E-mail ou senha inválidos".
- Dado 5 falhas seguidas no mesmo e-mail, então a conta fica bloqueada por 15 min e o dono recebe e-mail de aviso.
- Dado usuário com e-mail não verificado, então o login é negado com a opção de reenviar o link.
- Dado aluno INATIVO, então ele só acessa "Trocar de faculdade" e o histórico (RN-22).

**AUTH-02 · Renovação de sessão**

- Dado access token expirado e refresh válido, quando a API responde 401, então o front chama o refresh uma única vez e repete a requisição original.
- Dado refresh token já usado, quando é apresentado de novo, então toda a família de tokens é revogada e o usuário volta ao login.

**AUTH-03 · Logout:** revoga o refresh token atual, limpa os cookies e redireciona para o login.

**AUTH-04 · Esqueci a senha**

- Quando pede a redefinição, então a resposta é sempre 202, exista ou não o e-mail.
- O link vale 1 h e uma única vez; ao redefinir, todas as sessões do usuário são revogadas.

**AUTH-05 · Verificação de e-mail:** o link vale 24 h e uma única vez; o reenvio é limitado a 3 por hora.

### 4.2 Aluno

**ALU-01 · Cadastro (assistente em 3 passos: dados pessoais, vínculo acadêmico, currículo)**

- Dado e-mail com domínio de faculdade ativa, quando o aluno sai do campo e-mail, então a faculdade aparece preenchida e bloqueada, e os cursos e turmas dela são carregados (RN-01).
- Dado domínio não cadastrado, então o cadastro para com "Sua faculdade ainda não usa a plataforma".
- Dado CPF com dígitos inválidos ou já usado, então o erro aparece no campo CPF (RN-02).
- Dado senha fora da política, então a tela lista cada requisito não atendido (RN-04).
- Campos obrigatórios: nome, CPF, e-mail, telefone, senha e confirmação, curso, turma, semestre atual e aceite dos termos. O passo do currículo pode ser pulado.
- Quando conclui, então a conta fica pendente e um link de verificação vai para o e-mail institucional (RN-03).

**ALU-02 · Editar dados pessoais**

- Pode editar nome e telefone. CPF não é editável; e-mail só pelo fluxo ALU-12.
- Trocar a senha exige a senha atual e revoga as outras sessões.

**ALU-03 · Editar vínculo acadêmico**

- Pode trocar curso (entre os ativos da sua faculdade), turma (do curso escolhido) e semestre (de 1 até duração × 2). A faculdade não muda por aqui (RN-05).
- Quando muda de curso, então as vagas visíveis mudam na hora; candidaturas existentes continuam.

**ALU-04 · Editar currículo**

- O currículo segue as seções de um curriculum vitae padrão (D16), na tabela abaixo. Todas são opcionais, exceto os dados que já vêm do cadastro; o que vem do cadastro não é digitado de novo.
- Quando salva, então a empresa já vê a nova versão nas candidaturas abertas (D4).

| Seção | Campos | Origem |
| --- | --- | --- |
| Dados pessoais e contato | Nome, e-mail institucional e telefone; cidade e UF; links (LinkedIn, GitHub, portfólio, Lattes) | Nome, e-mail e telefone vêm do cadastro |
| Objetivo profissional | Cargo ou área desejada, em uma frase (até 200 caracteres) | Aluno |
| Resumo (perfil profissional) | Perfil, interesses e diferenciais em poucas linhas (até 1 000 caracteres) | Aluno |
| Formação acadêmica | Graduação atual: faculdade, curso, semestre e previsão de conclusão. Outras formações: nível (ensino médio, técnico, graduação, pós), curso, instituição, início, conclusão e situação (cursando, concluído, trancado) | Graduação atual vem do vínculo; a previsão sai da turma + duração do curso |
| Experiência | Tipo (emprego, estágio, jovem aprendiz, freelance, voluntariado, iniciação científica, monitoria, empresa júnior), organização, cargo, início, fim ou "atual", atividades e resultados | Aluno |
| Cursos e certificações | Nome, instituição, carga horária, data de conclusão e link do certificado | Aluno |
| Idiomas | Idioma e nível (básico, intermediário, avançado, fluente, nativo) | Aluno |
| Habilidades | Técnicas (ferramentas, linguagens, softwares) e comportamentais (comunicação, liderança), como etiquetas | Aluno |
| Projetos | Título, descrição e link (TCC, projetos de disciplina, portfólio) | Aluno |
| Informações adicionais | Disponibilidade de horário (manhã, tarde, noite, integral), CNH, disponibilidade para viagem ou mudança, prêmios | Aluno |

O currículo não pede foto, data de nascimento, estado civil, gênero, RG nem CPF: esses dados não ajudam na seleção, abrem espaço para discriminação e aumentam o risco sob a LGPD.

**ALU-05 · Ver e filtrar vagas**

- Dado aluno ATIVO, então a lista mostra só vagas ABERTAS cujas áreas incluem a área do seu curso e cujo semestre mínimo, quando existe, ele já atingiu (RN-08).
- Filtros: texto (função ou empresa), tipo, modalidade, UF, cidade, salário mínimo e publicação recente (7, 15 ou 30 dias). Ordenação por mais recentes ou prazo mais próximo; 20 por página.
- Os filtros ficam na URL, então voltar ou compartilhar o link mantém o resultado.
- Vaga em que ele já está inscrito mostra o selo "Candidatado".

**ALU-06 · Detalhe da vaga**

- Mostra todos os campos da vaga e as etapas do processo seletivo.
- Dado vaga fora da sua área ou não ABERTA, então a resposta é 404, salvo se ele tem candidatura nela: aí abre em modo somente leitura.

**ALU-07 · Candidatar-se**

- Dado vaga ABERTA visível e sem candidatura ativa, quando confirma, então nasce uma candidatura EM\_PROCESSO na primeira etapa e a empresa é notificada.
- Dado duplo clique ou requisições paralelas, então existe uma única candidatura (RN-09).
- Dado vaga PAUSADA, com prazo expirado ou ENCERRADA, então recebe 409 "Esta vaga não aceita candidaturas".

**ALU-08 · Remover candidatura**

- Dado candidatura EM\_PROCESSO, quando confirma a remoção, então ela vira CANCELADA, a empresa deixa de ver o perfil e o item vai para o histórico (RN-10).
- Dado vaga ainda ABERTA, então ele pode se candidatar de novo; a mesma candidatura volta para a primeira etapa.
- Dado candidatura já finalizada, então o botão não aparece e a API responde 409.

**ALU-09 · Acompanhar candidaturas em andamento**

- A aba "Em andamento" lista vaga, empresa, status, etapa atual (ex.: "Entrevista técnica · 2 de 4") e data da última mudança.
- O detalhe mostra a linha do tempo de eventos da candidatura.

**ALU-10 · Histórico**

- A aba "Histórico" lista as candidaturas SELECIONADO, NAO\_SELECIONADO e CANCELADA, inclusive de vagas pausadas ou encerradas, com filtro por status.

**ALU-11 · Notificações**

- O sino mostra o número de não lidas; cada notificação leva à tela do evento e pode ser marcada como lida.
- Todo evento in-app também sai por e-mail (RN-23).

**ALU-12 · Trocar de faculdade**

- Dado aluno INATIVO (ou ativo que mudou de faculdade), quando informa um e-mail de outra faculdade cliente e confirma o link enviado a ele, então a faculdade passa a ser a nova, ele escolhe curso, turma e semestre, e a conta fica ATIVA.
- O histórico de candidaturas é mantido. Domínio não cliente bloqueia a troca.

### 4.3 Faculdade

**FAC-01 · Primeiro acesso:** o convite do admin chega por e-mail com link válido por 72 h; a faculdade define a senha (RN-04) e a conta fica ATIVA.

**FAC-02 · Dados cadastrais:** pode editar razão social, nome fantasia, telefone e e-mail de contato. CNPJ e domínios só o admin altera.

**FAC-03 · Cursos**

- Criar ou editar curso com nome (único na faculdade), área de formação do catálogo (obrigatória, RN-07), duração em anos (1 a 6) e ementa.
- Quando salva a duração, então o sistema gera os semestres (anos × 2, D13).
- Reduzir a duração é bloqueado se houver aluno em semestre acima do novo limite.
- Curso com alunos não pode ser excluído, só inativado: some dos novos cadastros e continua para quem já está nele (RN-25).

**FAC-04 · Grade:** em cada semestre a faculdade cadastra, ordena, edita e remove aulas com nome e ementa.

**FAC-05 · Turmas:** cria turma por ano e período de ingresso, única por curso; turma com alunos não pode ser excluída.

**FAC-06 · Alunos**

- Lista os alunos da faculdade com filtro por curso, turma, semestre e status; vê dados cadastrais com CPF mascarado.
- Quando desliga um aluno informando o motivo, então a conta fica INATIVA e as candidaturas em andamento dele são canceladas (RN-22); pode reativá-la depois.

### 4.4 Empresa

**EMP-01 · Cadastro**

- Campos obrigatórios: razão social, nome fantasia, CNPJ, telefone, e-mail, senha, ramo de atuação e endereço completo (CEP, logradouro, número, bairro, cidade, UF; complemento opcional).
- Dado CNPJ com dígitos inválidos ou já usado, então erro no campo (RN-20).
- Quando digita o CEP, então logradouro, bairro, cidade e UF são preenchidos via ViaCEP e continuam editáveis.
- Depois de verificar o e-mail, a empresa entra e edita o perfil, mas só publica vagas após a aprovação do admin (ADM-04); até lá vê o aviso "Cadastro em análise". Se reprovada, vê o motivo.

**EMP-02 · Editar perfil:** tudo, menos o CNPJ.

**EMP-03 · Criar vaga**

- Campos obrigatórios: função, tipo, modalidade, áreas de formação (1 ou mais), atividades do dia a dia, o que se espera (formação, experiência), salário (faixa ou "a combinar") e benefícios, descrição do processo seletivo, etapas (ao menos 1, ordenadas), cultura da empresa e prazo. Semestre mínimo é opcional; não há exigência de curso específico, só de área (D22).
- Cidade e UF são obrigatórias para vaga presencial ou híbrida e vêm preenchidas com o endereço da empresa.
- Dado prazo no passado ou a mais de 1 ano da publicação, então erro no campo prazo (RN-11).
- Quando publica, então a vaga fica ABERTA e já aparece para os alunos das áreas escolhidas.

**EMP-04 · Editar vaga**

- Permitido enquanto a vaga não está ENCERRADA.
- Trocar áreas não remove candidaturas existentes; etapa com candidatos não pode ser removida.
- Duas edições simultâneas: a segunda recebe 409 e recarrega a versão atual (controle otimista).

**EMP-05 · Pausar e reativar:** pausar tira a vaga da listagem e bloqueia novas candidaturas, sem mexer nas existentes; reativar só se o prazo não venceu (RN-16).

**EMP-06 · Excluir vaga:** só se a vaga nunca teve candidatura; caso contrário o botão vira "Encerrar" (D10, RN-17).

**EMP-07 · Prorrogar prazo:** o novo prazo precisa ser futuro e no máximo 1 ano após a publicação (RN-11); dada vaga com prazo expirado, então ela volta para ABERTA.

**EMP-08 · Lista de candidatos**

- Mostra os candidatos não cancelados da vaga, com contagem por etapa. Candidaturas canceladas por desligamento aparecem com o selo "Aluno inativo", sem acesso ao perfil (D17).
- Filtros: curso, faixa de semestre, faculdade, etapa e status; ordenação por data de candidatura.

**EMP-09 · Perfil do candidato**

- Mostra nome, e-mail, telefone, faculdade, curso, turma, semestre e currículo atual; nunca o CPF (D12).
- Dado candidatura cancelada ou de vaga de outra empresa, então 404 (RN-19). Cada acesso fica na auditoria.

**EMP-10 · Mover etapa ou não selecionar**

- Quando move o candidato para outra etapa, então o aluno é notificado com o nome da nova etapa.
- Quando marca "Não selecionado" antes do encerramento, então a candidatura finaliza e o aluno recebe a mensagem genérica (RN-15).

**EMP-11 · Encerrar vaga com devolutiva**

- Quando encerra, então escolhe os selecionados (zero ou mais) entre os candidatos em processo e confirma uma tela de resumo.
- Então selecionados viram SELECIONADO, os demais em processo viram NAO\_SELECIONADO, e todos são notificados in-app e por e-mail (RN-14). A ação é irreversível.

**EMP-12 · Aviso de prazo:** no vencimento a empresa recebe notificação com os atalhos "Prorrogar" e "Encerrar", e um lembrete 24 h antes do encerramento automático (RN-12, RN-13).

### 4.5 Admin

**ADM-01 · Criar faculdade**

- Campos: CNPJ (válido e único, RN-20), razão social, nome fantasia, telefone, e-mail e um ou mais domínios estudantis.
- Dado domínio já usado por outra faculdade ou de provedor público (gmail.com, outlook.com, hotmail.com, yahoo.com…), então o domínio é recusado.
- Quando salva, então o convite FAC-01 vai para o e-mail da faculdade.

**ADM-02 · Gerir faculdade:** adicionar ou remover domínios, reenviar convite e inativar a faculdade, o que bloqueia o login dela e novos cadastros daquele domínio e inativa todos os alunos dela (D19, RN-22). Reativar a faculdade reativa só os alunos inativados por esse motivo.

**ADM-03 · Áreas de formação:** criar, renomear e inativar áreas; área em uso por curso ou vaga não pode ser excluída.

**ADM-04 · Aprovar empresas:** o admin vê as empresas com e-mail verificado aguardando análise, aprova ou reprova com motivo, e a empresa recebe o resultado in-app e por e-mail (D20).

**ADM-05 · Empresas:** listar, ver e inativar empresas; inativar pausa todas as vagas abertas dela.

### 4.6 Jobs automáticos

**JOB-01 · Vencimento do prazo**

- Dada vaga ABERTA ou PAUSADA com prazo vencido, quando o job roda, então ela vira PRAZO\_EXPIRADO, sai da listagem e a empresa é notificada (RN-12).

**JOB-02 · Encerramento automático**

- Dada vaga em PRAZO\_EXPIRADO há 72 h, quando o job roda, então ela vira ENCERRADA (motivo AUTOMATICO), toda candidatura EM\_PROCESSO vira NAO\_SELECIONADO e alunos e empresa são notificados (RN-13).
- Dado que a empresa prorrogou ou encerrou no mesmo instante, então só uma das ações vence e nenhum aluno é notificado duas vezes.

**JOB-03 · Lembrete:** 48 h após o vencimento, se a vaga segue em PRAZO\_EXPIRADO, a empresa recebe o lembrete de EMP-12 uma única vez.

## 5. Regras de negócio

As regras vivem na camada de domínio da API e têm teste unitário próprio; o front repete só as validações de formulário.

| ID | Regra |
| --- | --- |
| RN-01 | O domínio do e-mail (parte após o @, em minúsculas, igualdade exata) precisa pertencer a uma faculdade ATIVA; essa é a faculdade do aluno |
| RN-02 | CPF com 11 dígitos e verificadores válidos; sequências repetidas (111.111.111-11) recusadas; único entre todos os alunos, inclusive inativos |
| RN-03 | A conta só fica ATIVA após verificar o e-mail. Cadastro não verificado em 7 dias é apagado, liberando CPF e e-mail |
| RN-04 | Senha de 8 a 128 caracteres com ao menos 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial; não pode conter a parte do e-mail antes do @ nem estar na lista das 10 mil senhas mais comuns |
| RN-05 | O aluno só se vincula a curso ativo e turma da própria faculdade; semestre entre 1 e duração × 2, atualizado por ele mesmo |
| RN-06 | Faculdade só é criada pelo admin; o convite vale 72 h e pode ser reenviado |
| RN-07 | Todo curso tem exatamente uma área de formação ativa do catálogo |
| RN-08 | Vaga visível ao aluno = vaga ABERTA + empresa ativa e aprovada + aluno ATIVO + área do curso do aluno entre as áreas da vaga + semestre do aluno maior ou igual ao semestre mínimo da vaga, quando houver |
| RN-09 | No máximo uma candidatura por par aluno–vaga (índice único), criada só em vaga visível ao aluno |
| RN-10 | O aluno só remove candidatura EM\_PROCESSO, que vira CANCELADA; reinscrever-se reativa a mesma candidatura se a vaga estiver ABERTA |
| RN-11 | Prazo obrigatório e futuro, válido até 23:59:59 (America/Sao\_Paulo) da data escolhida; pode ser prorrogado, mas nunca passa de 1 ano após a publicação (D21) |
| RN-12 | Prazo vencido: a vaga vira PRAZO\_EXPIRADO, sai da listagem, bloqueia candidaturas e a empresa é notificada |
| RN-13 | 72 h após o prazo, se a vaga segue em PRAZO\_EXPIRADO, ela é encerrada automaticamente e todos em processo recebem a devolutiva genérica |
| RN-14 | No encerramento manual a empresa marca de 0 a n selecionados; os demais em processo viram NAO\_SELECIONADO |
| RN-15 | A empresa pode marcar NAO\_SELECIONADO a qualquer momento antes do encerramento, com a mesma mensagem genérica |
| RN-16 | Vaga PAUSADA fica fora da listagem e sem novas candidaturas; o prazo continua correndo |
| RN-17 | Vaga só é excluída (exclusão lógica) se nunca teve candidatura |
| RN-18 | Toda mudança de status ou etapa de candidatura grava um evento imutável: quem, quando, de, para |
| RN-19 | A empresa só acessa o perfil de aluno com candidatura não cancelada em vaga dela; o CPF nunca vai na resposta |
| RN-20 | CNPJ com 14 dígitos e verificadores válidos; único entre empresas e faculdades |
| RN-21 | E-mail único na plataforma inteira, comparado em minúsculas |
| RN-22 | Aluno INATIVO (desligado pela faculdade ou com a faculdade inativada) não vê vagas nem se candidata; suas candidaturas EM\_PROCESSO viram CANCELADA com motivo ALUNO\_INATIVO, a empresa é avisada e vê o candidato como "Aluno inativo", sem perfil; no login, ele só acessa troca de faculdade e histórico |
| RN-23 | Toda notificação in-app também gera e-mail, enviado de forma assíncrona com até 5 tentativas |
| RN-24 | Datas são guardadas em UTC e exibidas em America/Sao\_Paulo |
| RN-25 | Curso ou turma com aluno vinculado não é excluído, só inativado |
| RN-26 | Empresa só publica vagas com cadastro APROVADO pelo admin; reprovada, pode corrigir o perfil e pedir nova análise |
| RN-27 | Inativar uma faculdade inativa todos os alunos dela (D19); reativá-la reativa só os alunos inativados por esse motivo |

### Mensagens padrão de devolutiva

| Evento | Mensagem ao aluno |
| --- | --- |
| Selecionado | "Parabéns! Você foi selecionado(a) para a vaga {função} na {empresa}. A empresa entrará em contato pelo seu e-mail ou telefone." |
| Não selecionado / vaga encerrada | "A vaga {função} na {empresa} foi encerrada. Obrigado pela sua candidatura e boa sorte nas próximas oportunidades." |
| Mudança de etapa | "Sua candidatura para {função} na {empresa} avançou para a etapa {etapa}." |

## 6. Máquinas de estado

Vaga e candidatura mudam de estado só pelas transições abaixo; qualquer outra resposta é 409. Cada transição é um UPDATE condicional (`WHERE id = ? AND status = ?`), então ações simultâneas de empresa, aluno e job nunca aplicam duas mudanças.

&#91;embedded content: estados da vaga e da candidatura\]

Pausar, reativar e prorrogar só circulam dentro de "Não encerrada"; na candidatura, CANCELADA é o único estado que volta a EM\_PROCESSO.

### Vaga

| De | Para | Quem dispara | Efeito |
| --- | --- | --- | --- |
| (nova) | ABERTA | Empresa publica | Visível aos alunos das áreas escolhidas |
| ABERTA | PAUSADA | Empresa | Sai da listagem; candidaturas continuam |
| PAUSADA | ABERTA | Empresa, com prazo não vencido | Volta à listagem |
| ABERTA ou PAUSADA | PRAZO\_EXPIRADO | JOB-01 no vencimento | Empresa notificada |
| PRAZO\_EXPIRADO | ABERTA | Empresa prorroga | Volta à listagem |
| ABERTA, PAUSADA ou PRAZO\_EXPIRADO | ENCERRADA (manual) | Empresa encerra | Devolutiva a todos em processo |
| PRAZO\_EXPIRADO | ENCERRADA (automático) | JOB-02, 72 h após o prazo | Devolutiva genérica; empresa avisada |

### Candidatura

| De | Para | Quem dispara | Efeito |
| --- | --- | --- | --- |
| (nova) | EM\_PROCESSO, 1ª etapa | Aluno se candidata | Empresa notificada |
| EM\_PROCESSO, etapa n | EM\_PROCESSO, etapa m | Empresa move | Aluno notificado com o nome da etapa |
| EM\_PROCESSO | CANCELADA | Aluno remove, ou desligamento (RN-22) | Empresa perde acesso ao perfil; no desligamento, vê "Aluno inativo" |
| CANCELADA | EM\_PROCESSO, 1ª etapa | Aluno, com vaga ABERTA | Empresa notificada |
| EM\_PROCESSO | NAO\_SELECIONADO | Empresa, encerramento ou JOB-02 | Mensagem genérica |
| EM\_PROCESSO | SELECIONADO | Encerramento manual | Mensagem de selecionado |

## 7. Modelo de dados

PostgreSQL com Prisma; o schema abaixo é a fonte de verdade e cada RN de unicidade vira um índice único no banco, não só uma checagem no código.

&#91;embedded content: entidades principais e cardinalidades\]

O diagrama agrupa entidades auxiliares: etapas e áreas dentro de Vaga, eventos dentro de Candidatura, experiências e idiomas dentro de Curriculo; tokens, notificações e auditoria ficam ligados a Usuario.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Papel {
  ALUNO
  FACULDADE
  EMPRESA
  ADMIN
}

enum StatusUsuario {
  PENDENTE_VERIFICACAO
  ATIVO
  INATIVO
  BLOQUEADO
}

enum TipoTokenEmail {
  VERIFICACAO
  RESET_SENHA
  CONVITE
  TROCA_EMAIL
}

enum TipoVaga {
  ESTAGIO
  JOVEM_APRENDIZ
  TRAINEE
  CLT
  PJ
  TEMPORARIO
}

enum Modalidade {
  PRESENCIAL
  HIBRIDO
  REMOTO
}

enum StatusVaga {
  ABERTA
  PAUSADA
  PRAZO_EXPIRADO
  ENCERRADA
}

enum MotivoEncerramento {
  MANUAL
  AUTOMATICO
}

enum StatusCandidatura {
  EM_PROCESSO
  SELECIONADO
  NAO_SELECIONADO
  CANCELADA
}

enum NivelIdioma {
  BASICO
  INTERMEDIARIO
  AVANCADO
  FLUENTE
  NATIVO
}

enum MotivoCancelamento {
  ALUNO_REMOVEU
  ALUNO_INATIVO
}

enum MotivoInativacao {
  DESLIGADO_PELA_FACULDADE
  FACULDADE_INATIVA
}

enum StatusAprovacao {
  PENDENTE
  APROVADA
  REPROVADA
}

enum TipoExperiencia {
  EMPREGO
  ESTAGIO
  JOVEM_APRENDIZ
  FREELANCE
  VOLUNTARIADO
  INICIACAO_CIENTIFICA
  MONITORIA
  EMPRESA_JUNIOR
}

enum NivelFormacao {
  ENSINO_MEDIO
  TECNICO
  GRADUACAO
  POS_GRADUACAO
}

enum SituacaoFormacao {
  CURSANDO
  CONCLUIDO
  TRANCADO
}

// ---------- Identidade e sessão ----------
model Usuario {
  id                String         @id @default(uuid()) @db.Uuid
  email             String         @unique // sempre minúsculo (RN-21)
  senhaHash         String?        // argon2id; null até aceitar o convite
  papel             Papel
  status            StatusUsuario  @default(PENDENTE_VERIFICACAO)
  emailVerificadoEm DateTime?
  falhasLogin       Int            @default(0)
  bloqueadoAte      DateTime?
  totpSecretCifrado String?        // 2FA do admin
  criadoEm          DateTime       @default(now())
  atualizadoEm      DateTime       @updatedAt
  aluno             Aluno?
  empresa           Empresa?
  faculdade         Faculdade?
  refreshTokens     RefreshToken[]
  tokensEmail       TokenEmail[]
  notificacoes      Notificacao[]
}

model RefreshToken {
  id               String    @id @default(uuid()) @db.Uuid
  usuarioId        String    @db.Uuid
  familia          String    @db.Uuid
  tokenHash        String    @unique // SHA-256 do token opaco
  expiraEm         DateTime
  revogadoEm       DateTime?
  substituidoPorId String?   @db.Uuid
  criadoEm         DateTime  @default(now())
  usuario          Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  @@index([familia])
}

model TokenEmail {
  id        String         @id @default(uuid()) @db.Uuid
  usuarioId String         @db.Uuid
  tipo      TipoTokenEmail
  tokenHash String         @unique
  dados     Json?          // ex.: novo e-mail na troca de faculdade
  expiraEm  DateTime
  usadoEm   DateTime?
  usuario   Usuario        @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
}

// ---------- Catálogo do admin ----------
model AreaFormacao {
  id     String     @id @default(uuid()) @db.Uuid
  nome   String     @unique
  ativa  Boolean    @default(true)
  cursos Curso[]
  vagas  VagaArea[]
}

// ---------- Faculdade ----------
model Faculdade {
  id           String             @id @default(uuid()) @db.Uuid
  usuarioId    String             @unique @db.Uuid
  cnpj         String             @unique @db.Char(14)
  razaoSocial  String
  nomeFantasia String
  telefone     String
  email        String
  ativa        Boolean            @default(true)
  usuario      Usuario            @relation(fields: [usuarioId], references: [id])
  dominios     DominioFaculdade[]
  cursos       Curso[]
  alunos       Aluno[]
}

model DominioFaculdade {
  id          String    @id @default(uuid()) @db.Uuid
  faculdadeId String    @db.Uuid
  dominio     String    @unique // ex.: aluno.unifoo.edu.br
  faculdade   Faculdade @relation(fields: [faculdadeId], references: [id])
}

model Curso {
  id          String       @id @default(uuid()) @db.Uuid
  faculdadeId String       @db.Uuid
  areaId      String       @db.Uuid
  nome        String
  duracaoAnos Int
  ementa      String
  ativo       Boolean      @default(true)
  faculdade   Faculdade    @relation(fields: [faculdadeId], references: [id])
  area        AreaFormacao @relation(fields: [areaId], references: [id])
  semestres   Semestre[]
  turmas      Turma[]
  alunos      Aluno[]
  @@unique([faculdadeId, nome])
}

model Semestre {
  id      String @id @default(uuid()) @db.Uuid
  cursoId String @db.Uuid
  ano     Int    // 1..duracaoAnos
  periodo Int    // 1 ou 2
  ordem   Int    // 1..duracaoAnos*2
  curso   Curso  @relation(fields: [cursoId], references: [id], onDelete: Cascade)
  aulas   Aula[]
  @@unique([cursoId, ordem])
}

model Aula {
  id         String   @id @default(uuid()) @db.Uuid
  semestreId String   @db.Uuid
  nome       String
  ementa     String
  ordem      Int
  semestre   Semestre @relation(fields: [semestreId], references: [id], onDelete: Cascade)
}

model Turma {
  id              String  @id @default(uuid()) @db.Uuid
  cursoId         String  @db.Uuid
  anoIngresso     Int
  periodoIngresso Int     @default(1)
  ativa           Boolean @default(true)
  curso           Curso   @relation(fields: [cursoId], references: [id])
  alunos          Aluno[]
  @@unique([cursoId, anoIngresso, periodoIngresso])
}

// ---------- Aluno ----------
model Aluno {
  id              String        @id @default(uuid()) @db.Uuid
  usuarioId       String        @unique @db.Uuid
  nome            String
  cpfHash         String        @unique // HMAC-SHA256: índice cego (RN-02)
  cpfCifrado      String        // AES-256-GCM
  telefone        String
  faculdadeId     String        @db.Uuid
  cursoId         String        @db.Uuid
  turmaId         String        @db.Uuid
  semestreAtual   Int
  motivoInativacao MotivoInativacao? // null enquanto ativo (RN-22, RN-27)
  termosVersao    String
  termosAceitosEm DateTime
  usuario         Usuario       @relation(fields: [usuarioId], references: [id])
  faculdade       Faculdade     @relation(fields: [faculdadeId], references: [id])
  curso           Curso         @relation(fields: [cursoId], references: [id])
  turma           Turma         @relation(fields: [turmaId], references: [id])
  curriculo       Curriculo?
  candidaturas    Candidatura[]
  @@index([cursoId])
}

// Nome, e-mail e telefone vêm de Aluno/Usuario; a graduação atual vem do vínculo (curso, turma, semestre)
model Curriculo {
  id                         String              @id @default(uuid()) @db.Uuid
  alunoId                    String              @unique @db.Uuid
  objetivo                   String?             // até 200 caracteres
  resumo                     String?             // até 1 000 caracteres
  cidade                     String?
  uf                         String?             @db.Char(2)
  habilidadesTecnicas        String[]
  habilidadesComportamentais String[]
  links                      Json                @default("[]") // [{ tipo: linkedin | github | portfolio | lattes | outro, url }]
  disponibilidade            String?             // manhã, tarde, noite, integral
  informacoesAdicionais      String?             // CNH, viagem, mudança, prêmios
  atualizadoEm               DateTime            @updatedAt
  aluno                      Aluno               @relation(fields: [alunoId], references: [id], onDelete: Cascade)
  formacoes                  FormacaoAcademica[]
  experiencias               Experiencia[]
  cursos                     CursoComplementar[]
  idiomas                    Idioma[]
  projetos                   Projeto[]
}

model FormacaoAcademica {
  id          String           @id @default(uuid()) @db.Uuid
  curriculoId String           @db.Uuid
  nivel       NivelFormacao
  curso       String
  instituicao String
  inicio      DateTime?        @db.Date
  conclusao   DateTime?        @db.Date
  situacao    SituacaoFormacao
  curriculo   Curriculo        @relation(fields: [curriculoId], references: [id], onDelete: Cascade)
}

model Experiencia {
  id          String          @id @default(uuid()) @db.Uuid
  curriculoId String          @db.Uuid
  tipo        TipoExperiencia
  organizacao String
  cargo       String
  inicio      DateTime        @db.Date
  fim         DateTime?       @db.Date // null = atual
  descricao   String?         // atividades e resultados
  curriculo   Curriculo       @relation(fields: [curriculoId], references: [id], onDelete: Cascade)
}

model CursoComplementar {
  id             String    @id @default(uuid()) @db.Uuid
  curriculoId    String    @db.Uuid
  nome           String
  instituicao    String
  cargaHoraria   Int?      // em horas
  conclusao      DateTime? @db.Date
  certificadoUrl String?
  curriculo      Curriculo @relation(fields: [curriculoId], references: [id], onDelete: Cascade)
}

model Projeto {
  id          String    @id @default(uuid()) @db.Uuid
  curriculoId String    @db.Uuid
  titulo      String
  descricao   String
  link        String?
  curriculo   Curriculo @relation(fields: [curriculoId], references: [id], onDelete: Cascade)
}

model Idioma {
  id          String      @id @default(uuid()) @db.Uuid
  curriculoId String      @db.Uuid
  idioma      String
  nivel       NivelIdioma
  curriculo   Curriculo   @relation(fields: [curriculoId], references: [id], onDelete: Cascade)
}

// ---------- Empresa e vagas ----------
model Empresa {
  id           String  @id @default(uuid()) @db.Uuid
  usuarioId    String  @unique @db.Uuid
  cnpj         String  @unique @db.Char(14)
  razaoSocial  String
  nomeFantasia String
  telefone     String
  email        String
  ramoAtuacao  String
  cep          String  @db.Char(8)
  logradouro   String
  numero       String
  complemento  String?
  bairro       String
  cidade       String
  uf           String  @db.Char(2)
  ativa        Boolean @default(true)
  aprovacao    StatusAprovacao @default(PENDENTE) // RN-26
  aprovacaoMotivo String?
  aprovadaEm   DateTime?
  usuario      Usuario @relation(fields: [usuarioId], references: [id])
  vagas        Vaga[]
}

model Vaga {
  id                 String              @id @default(uuid()) @db.Uuid
  empresaId          String              @db.Uuid
  funcao             String
  tipo               TipoVaga
  modalidade         Modalidade
  atividades         String
  requisitos         String              // o que se espera
  salarioMin         Decimal?            @db.Decimal(10, 2) // null = a combinar
  salarioMax         Decimal?            @db.Decimal(10, 2)
  beneficios         String
  processoSeletivo   String
  cultura            String
  cidade             String?
  uf                 String?             @db.Char(2)
  semestreMinimo     Int?                // opcional (D22)
  status             StatusVaga          @default(ABERTA)
  prazo              DateTime            // 23:59:59 de Brasília, em UTC; <= criadaEm + 1 ano
  lembreteEnviadoEm  DateTime?
  encerradaEm        DateTime?
  motivoEncerramento MotivoEncerramento?
  excluidaEm         DateTime?           // exclusão lógica (RN-17)
  versao             Int                 @default(0) // controle otimista
  criadaEm           DateTime            @default(now())
  atualizadaEm       DateTime            @updatedAt
  empresa            Empresa             @relation(fields: [empresaId], references: [id])
  areas              VagaArea[]
  etapas             EtapaSelecao[]
  candidaturas       Candidatura[]
  @@index([status, prazo])
}

model VagaArea {
  vagaId String       @db.Uuid
  areaId String       @db.Uuid
  vaga   Vaga         @relation(fields: [vagaId], references: [id], onDelete: Cascade)
  area   AreaFormacao @relation(fields: [areaId], references: [id])
  @@id([vagaId, areaId])
  @@index([areaId])
}

model EtapaSelecao {
  id           String        @id @default(uuid()) @db.Uuid
  vagaId       String        @db.Uuid
  nome         String
  ordem        Int
  vaga         Vaga          @relation(fields: [vagaId], references: [id], onDelete: Cascade)
  candidaturas Candidatura[]
  @@unique([vagaId, ordem])
}

model Candidatura {
  id           String              @id @default(uuid()) @db.Uuid
  alunoId      String              @db.Uuid
  vagaId       String              @db.Uuid
  status       StatusCandidatura   @default(EM_PROCESSO)
  etapaAtualId String?             @db.Uuid
  motivoCancelamento MotivoCancelamento?
  criadaEm     DateTime            @default(now())
  atualizadaEm DateTime            @updatedAt
  aluno        Aluno               @relation(fields: [alunoId], references: [id])
  vaga         Vaga                @relation(fields: [vagaId], references: [id])
  etapaAtual   EtapaSelecao?       @relation(fields: [etapaAtualId], references: [id])
  eventos      CandidaturaEvento[]
  @@unique([alunoId, vagaId]) // RN-09
  @@index([vagaId, status])
}

model CandidaturaEvento {
  id            String             @id @default(uuid()) @db.Uuid
  candidaturaId String             @db.Uuid
  tipo          String             // CRIADA, ETAPA_ALTERADA, CANCELADA, REATIVADA, SELECIONADO, NAO_SELECIONADO
  deStatus      StatusCandidatura?
  paraStatus    StatusCandidatura?
  etapaNome     String?
  autorId       String?            @db.Uuid // null = sistema (job)
  criadoEm      DateTime           @default(now())
  candidatura   Candidatura        @relation(fields: [candidaturaId], references: [id], onDelete: Cascade)
}

// ---------- Notificações e auditoria ----------
model Notificacao {
  id             String    @id @default(uuid()) @db.Uuid
  usuarioId      String    @db.Uuid
  tipo           String
  titulo         String
  mensagem       String
  link           String?
  lidaEm         DateTime?
  emailEnviadoEm DateTime?
  tentativas     Int       @default(0)
  criadaEm       DateTime  @default(now())
  usuario        Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  @@index([usuarioId, lidaEm])
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  usuarioId  String?  @db.Uuid
  acao       String   // ex.: EMPRESA_VIU_PERFIL, ADMIN_CRIOU_FACULDADE
  entidade   String
  entidadeId String
  ip         String?
  dados      Json?
  criadoEm   DateTime @default(now())
  @@index([entidade, entidadeId])
}
```

## 8. Segurança

A sessão usa JWT de vida curta em cookie httpOnly mais refresh token opaco rotativo com detecção de reuso; a autorização checa, nessa ordem, papel, posse do recurso e estado. O Next.js encaminha `/api/*` para a API (rewrite), então os cookies são first-party e o navegador nunca acessa um token por JavaScript.

### 8.1 Sessão e credenciais

| Item | Definição |
| --- | --- |
| Access token | JWT RS256, 15 min, claims `sub`, `papel`, `status`, `jti`, `kid`. Cookie `at`: httpOnly, Secure, SameSite=Lax, Path=/ |
| Refresh token | 256 bits aleatórios, só o SHA-256 no banco, 7 dias, trocado a cada uso. Reuso de token já trocado revoga a família inteira. Cookie `rt`: httpOnly, Secure, SameSite=Strict, Path=/api/v1/auth |
| Verificação no front | O middleware do Next valida o JWT com a chave pública (jose) e barra rota de outro papel antes de renderizar |
| CSRF | Double submit: cookie `csrf` legível + header `X-CSRF-Token` obrigatório em POST, PUT, PATCH e DELETE de rotas autenticadas; login, cadastro, refresh e links de e-mail ficam isentos, protegidos por SameSite e rate limit |
| Senhas | argon2id (memória 19 MiB, 2 iterações, paralelismo 1), política RN-04 |
| Tokens de e-mail | 256 bits, só o hash no banco, uso único, validade por tipo (verificação 24 h, senha 1 h, convite 72 h) |
| Admin | 2FA TOTP obrigatório |
| Chaves | Em secret manager; rotação via `kid` sem derrubar sessões ativas |

### 8.2 Autorização

Três camadas no NestJS: `JwtAuthGuard` global (rotas abertas marcadas com `@Public()`), `RolesGuard` com `@Roles(...)` e políticas de posse dentro do serviço. Toda consulta de recurso de outro dono já filtra pelo dono (`where: { id, empresaId: user.empresaId }`) e responde 404, não 403, para não revelar que o recurso existe. Aluno INATIVO só passa em rotas marcadas com `@PermitirInativo()`.

| Recurso | Aluno | Faculdade | Empresa | Admin |
| --- | --- | --- | --- | --- |
| Vagas | Lê só as visíveis (RN-08) | Não acessa | CRUD só das suas | Lê todas |
| Candidaturas | Só as suas | Não acessa | Só das suas vagas; as canceladas por desligamento aparecem como "Aluno inativo", sem perfil | Lê todas |
| Perfil e currículo do aluno | O seu | Dados cadastrais dos seus alunos, sem currículo | Candidatos às suas vagas, sem CPF | Lê todos |
| CPF | O seu, mascarado | Dos seus alunos, mascarado | Nunca | Mascarado |
| Cursos, semestres, aulas, turmas | Lê os da sua faculdade | CRUD dos seus | Lê só o nome do curso | Lê todos |
| Faculdades e domínios | Não acessa | A sua (sem CNPJ e domínios) | Não acessa | CRUD |
| Áreas de formação | Lê | Lê áreas | Lê áreas | CRUD |

### 8.3 Demais proteções

- **Validação:** schemas Zod estritos (chaves desconhecidas recusadas), compartilhados entre front e API; limite de tamanho em todo texto (ex.: 5 000 caracteres nos campos longos da vaga).
- **Rate limit** (`@nestjs/throttler` com Redis): login 5/min por IP + e-mail; cadastro 10/h por IP; esqueci a senha 3/h por e-mail; consulta de domínio 30/min por IP; demais rotas 100/min por usuário.
- **Bloqueio:** 5 falhas de login seguidas bloqueiam a conta por 15 min (AUTH-01).
- **Cabeçalhos:** helmet na API; no Next, CSP com nonce, HSTS, `X-Content-Type-Options: nosniff` e `frame-ancestors 'none'`.
- **Erros:** formato problem+json, sem stack trace em produção; mensagens de auth genéricas para evitar enumeração de contas.
- **Injeção e XSS:** só consultas Prisma parametrizadas (`$queryRawUnsafe` proibido por lint); textos de vaga e currículo exibidos como texto puro, nunca com `dangerouslySetInnerHTML`.
- **Logs:** sem senha, token ou CPF; cada requisição carrega um `request-id`.
- **Dependências:** Renovate, `pnpm audit` e varredura de imagem no CI; vulnerabilidade alta bloqueia o merge.
- **Rotas de teste:** o módulo `/__test__` só é registrado com `NODE_ENV=test` e `ENABLE_TEST_ROUTES=true`.

### 8.4 LGPD

- CPF guardado cifrado (AES-256-GCM) com índice cego HMAC-SHA256 para a unicidade; exibido mascarado (`***.456.789-**`).
- Aceite de termos e política de privacidade com versão e data no cadastro.
- Minimização: empresa nunca vê CPF e perde acesso ao perfil quando a candidatura é cancelada.
- Direitos do titular: o aluno exporta seus dados em JSON e pede exclusão, que anonimiza os dados pessoais e mantém só agregados.
- Auditoria (`AuditLog`) de acesso da empresa a perfil, mudanças de status e toda ação de admin.

### 8.5 Requisitos de segurança testáveis

| ID | Requisito | Resultado esperado |
| --- | --- | --- |
| SEG-01 | Matriz de acesso: toda rota × todo papel × anônimo | 401, 403 ou 404 conforme 8.2 |
| SEG-02 | Empresa A pede candidato, vaga ou candidatura da empresa B | 404 |
| SEG-03 | Refresh token reapresentado após rotação | 401 e família revogada |
| SEG-04 | Mutação sem header CSRF ou com valor diferente do cookie | 403 |
| SEG-05 | 6º login em 1 min do mesmo IP + e-mail | 429 |
| SEG-06 | 5 senhas erradas seguidas | Conta bloqueada 15 min, mesmo com a senha certa |
| SEG-07 | Cabeçalhos de segurança nas páginas e na API | Presentes em toda resposta |
| SEG-08 | `/__test__` na imagem de produção | 404 |
| SEG-09 | Qualquer resposta para empresa | Nunca contém CPF (checagem do corpo inteiro) |
| SEG-10 | JWT alterado, expirado ou com `alg: none` | 401 |

## 9. Contratos da API

REST em `/api/v1`, JSON, IDs UUID e datas ISO 8601 em UTC. Os schemas Zod de `packages/contracts` geram a documentação OpenAPI (em `/api/docs`, fora de produção) e o cliente tipado do front, então front e API nunca divergem.

- **Listas:** `?page=1&pageSize=20` (máx. 100) → `{ data: [...], meta: { page, pageSize, total } }`.
- **Erros:** problem+json `{ type, title, status, detail, errors?: [{ campo, mensagem }] }`; 400 validação, 401 sem sessão, 403 papel ou CSRF, 404 inexistente ou de outro dono, 409 conflito de estado ou versão, 422 regra de negócio, 429 limite.
- **Concorrência:** PATCH de vaga envia `versao`; versão desatualizada → 409.

### Autenticação

| Método | Rota | Acesso | História |
| --- | --- | --- | --- |
| GET | /faculdades/por-dominio?email= | Público | ALU-01 |
| POST | /auth/alunos | Público | ALU-01 |
| POST | /auth/empresas | Público | EMP-01 |
| POST | /auth/verificar-email | Público | AUTH-05 |
| POST | /auth/reenviar-verificacao | Público | AUTH-05 |
| POST | /auth/login | Público | AUTH-01 |
| POST | /auth/refresh | Cookie `rt` | AUTH-02 |
| POST | /auth/logout | Logado | AUTH-03 |
| POST | /auth/senha/esqueci | Público | AUTH-04 |
| POST | /auth/senha/redefinir | Público (token) | AUTH-04 |
| POST | /auth/convite/aceitar | Público (token) | FAC-01 |
| GET | /me | Logado | AUTH-01 |

### Aluno

| Método | Rota | Acesso | História |
| --- | --- | --- | --- |
| GET, PATCH | /alunos/me | Aluno | ALU-02 |
| PATCH | /alunos/me/senha | Aluno | ALU-02 |
| PATCH | /alunos/me/vinculo | Aluno | ALU-03 |
| POST | /alunos/me/troca-faculdade | Aluno (inclusive inativo) | ALU-12 |
| GET, PUT | /alunos/me/curriculo | Aluno | ALU-04 |
| GET | /alunos/me/dados (exportação LGPD) | Aluno | 8.4 |
| GET | /vagas?q=&tipo=&modalidade=&uf=&cidade=&salarioMin=&dias=&ordem= | Aluno | ALU-05 |
| GET | /vagas/:id | Aluno | ALU-06 |
| POST | /vagas/:id/candidaturas | Aluno | ALU-07 |
| GET | /alunos/me/candidaturas?aba=andamento\|historico&status= | Aluno (inclusive inativo) | ALU-09, ALU-10 |
| GET | /candidaturas/:id | Aluno dono | ALU-09 |
| DELETE | /candidaturas/:id | Aluno dono | ALU-08 |

### Faculdade

| Método | Rota | Acesso | História |
| --- | --- | --- | --- |
| GET, PATCH | /faculdade/me | Faculdade | FAC-02 |
| GET, POST | /faculdade/cursos | Faculdade | FAC-03 |
| GET, PATCH, DELETE | /faculdade/cursos/:id | Faculdade dona | FAC-03 |
| GET | /faculdade/cursos/:id/semestres | Faculdade dona | FAC-04 |
| POST | /faculdade/semestres/:id/aulas | Faculdade dona | FAC-04 |
| PATCH, DELETE | /faculdade/aulas/:id | Faculdade dona | FAC-04 |
| GET, POST | /faculdade/cursos/:id/turmas | Faculdade dona | FAC-05 |
| PATCH, DELETE | /faculdade/turmas/:id | Faculdade dona | FAC-05 |
| GET | /faculdade/alunos?cursoId=&turmaId=&semestre=&status= | Faculdade | FAC-06 |
| PATCH | /faculdade/alunos/:id/status | Faculdade | FAC-06 |

### Empresa

| Método | Rota | Acesso | História |
| --- | --- | --- | --- |
| GET, PATCH | /empresa/me | Empresa | EMP-02 |
| GET, POST | /empresa/vagas | Empresa | EMP-03 |
| GET, PATCH, DELETE | /empresa/vagas/:id | Empresa dona | EMP-04, EMP-06 |
| POST | /empresa/vagas/:id/pausar | Empresa dona | EMP-05 |
| POST | /empresa/vagas/:id/reativar | Empresa dona | EMP-05 |
| POST | /empresa/vagas/:id/prorrogar `{ prazo }` | Empresa dona | EMP-07 |
| POST | /empresa/vagas/:id/encerrar `{ selecionados: [ids] }` | Empresa dona | EMP-11 |
| GET | /empresa/vagas/:id/candidaturas?cursoId=&semestreMin=&semestreMax=&faculdadeId=&etapaId=&status= | Empresa dona | EMP-08 |
| GET | /empresa/candidaturas/:id | Empresa dona | EMP-09 |
| PATCH | /empresa/candidaturas/:id/etapa `{ etapaId }` | Empresa dona | EMP-10 |
| POST | /empresa/candidaturas/:id/nao-selecionar | Empresa dona | EMP-10 |

### Admin, catálogo e notificações

| Método | Rota | Acesso | História |
| --- | --- | --- | --- |
| GET, POST | /admin/faculdades | Admin | ADM-01 |
| PATCH | /admin/faculdades/:id | Admin | ADM-02 |
| POST, DELETE | /admin/faculdades/:id/dominios | Admin | ADM-02 |
| POST | /admin/faculdades/:id/convite | Admin | ADM-02 |
| GET, POST, PATCH | /admin/areas | Admin | ADM-03 |
| POST | /admin/empresas/:id/aprovar e /reprovar { motivo } | Admin | ADM-04 |
| GET, PATCH | /admin/empresas | Admin | ADM-05 |
| GET | /areas | Logado | ALU-05, FAC-03, EMP-03 |
| GET | /notificacoes?naoLidas= | Logado | ALU-11 |
| PATCH | /notificacoes/:id/lida | Dono | ALU-11 |
| PATCH | /notificacoes/lidas | Logado | ALU-11 |

### Rotas de teste (só `NODE_ENV=test`)

| Método | Rota | Para quê |
| --- | --- | --- |
| POST | `/__test__/reset` | Limpa o banco e roda o seed base |
| POST | `/__test__/cenarios` | Cria faculdade, curso, aluno, empresa e vaga já verificados, com dados únicos |
| POST | `/__test__/vagas/:id/prazo { prazo }` | Coloca o prazo de uma vaga no passado para testar jobs sem esperar |
| POST | `/__test__/jobs/:nome { vagaId? }` | Roda um job na hora (expirar-prazos, lembrete, encerrar-automatico, enviar-emails), só para a vaga indicada quando há `vagaId`, sem afetar testes paralelos |

## 10. Arquitetura e stack

Monorepo pnpm + Turborepo com o front Next.js, a API NestJS e um worker de jobs que roda o mesmo código da API em outro processo; PostgreSQL é a fonte de verdade e Redis guarda filas e contadores de rate limit.

&#91;embedded content: componentes e quem chama quem\]

API e worker são o mesmo código NestJS em dois processos; só o worker envia e-mail e roda os jobs de prazo. As linhas tracejadas existem apenas no ambiente de teste.

| Camada | Escolha |
| --- | --- |
| Front | Next.js (App Router, Server Components), Tailwind CSS v4, TanStack Query, React Hook Form + Zod |
| API | NestJS, Prisma, nestjs-zod, @nestjs/jwt, @nestjs/throttler, helmet, argon2 |
| Jobs | BullMQ sobre Redis, jobs repetíveis a cada 5 min, worker em processo separado |
| Banco | PostgreSQL |
| E-mail | Nodemailer com templates React Email; Mailpit em dev e teste |
| Testes | Jest, Supertest, Testcontainers, Playwright, @axe-core/playwright |
| Local e CI | Docker Compose (postgres, redis, mailpit, api, worker, web) |

```text
apps/
  web/                     Next.js + Tailwind
    app/(publico)/         login, cadastro/aluno, cadastro/empresa, verificar-email, senha
    app/aluno/             vagas, vagas/[id], candidaturas, perfil, curriculo, trocar-faculdade
    app/empresa/           vagas, vagas/nova, vagas/[id], vagas/[id]/candidatos, candidatos/[id], perfil
    app/faculdade/         cursos, cursos/[id], alunos, perfil
    app/admin/             faculdades, areas, perguntas, empresas
    middleware.ts          valida o JWT e o papel por prefixo de rota
  api/
    src/modules/           auth, alunos, curriculos, faculdades, cursos, empresas,
                           vagas, candidaturas, notificacoes, admin, auditoria
    src/domain/            regras puras: visibilidade, máquinas de estado, prazos, validadores
    src/jobs/              prazo-vaga.processor.ts, email.processor.ts
    src/common/            guards, decorators, filtros de erro, clock.service.ts
    src/testing/           rotas /__test__ (só NODE_ENV=test)
    prisma/                schema.prisma, migrations, seed.ts
packages/
  contracts/               schemas Zod, tipos, validadores de CPF, CNPJ e senha
  ui/                      componentes Tailwind compartilhados
e2e/                       Playwright: specs, fixtures, page objects, helpers do Mailpit
docs/spec.md               esta spec exportada em Markdown (lida pelo checador de rastreabilidade)
docker-compose.yml
```

### Notificações e jobs

- **Outbox:** a mudança de estado e a linha de `Notificacao` são gravadas na mesma transação; o worker envia os e-mails pendentes com até 5 tentativas e backoff exponencial. Nenhuma notificação se perde se o SMTP cair.
- **expirar-prazos:** `status IN (ABERTA, PAUSADA) AND prazo <= agora` → PRAZO\_EXPIRADO + notificação (JOB-01).
- **lembrete:** `status = PRAZO_EXPIRADO AND prazo + 48 h <= agora AND lembreteEnviadoEm IS NULL` (JOB-03).
- **encerrar-automatico:** `status = PRAZO_EXPIRADO AND prazo + 72 h <= agora` (JOB-02), em transação com as candidaturas.
- **Relógio:** todo código lê a hora do `ClockService`, nunca de `new Date()` direto; nos testes, em vez de mexer no relógio global, o prazo da vaga é movido para o passado por `/__test__/vagas/:id/prazo`.

### 10.1 Ambiente de demonstração

A demo roda só na máquina local: `docker compose up` sobe tudo e `pnpm db:seed:demo` popula o banco como se a plataforma estivesse em uso há alguns semestres. O site fica em `http://localhost:3000` e a caixa de e-mails do Mailpit em `http://localhost:8025`.

- **Datas relativas:** o seed calcula prazos e históricos a partir do dia em que roda, então sempre há vaga vencendo amanhã, vaga com prazo expirado ontem e candidaturas dos últimos meses.
- **Determinístico:** usa Faker com semente fixa (nomes e textos sempre iguais) e `--reset` apaga e recria tudo antes da aula.
- **Dados fictícios:** CPFs e CNPJs com dígitos válidos, mas inventados; nenhum e-mail sai do Mailpit.
- **Separado dos testes:** o seed de demonstração não é usado pelo Playwright, que cria os próprios dados.
- **Bloqueio:** o comando recusa rodar com `NODE_ENV=production`.

| Conteúdo | Quantidade e estados |
| --- | --- |
| Faculdades | 3: Universidade Horizonte e Faculdade Vale do Sul ativas; Instituto Aurora inativa (mostra RN-27) |
| Cursos | 6, com ementa, grade completa de aulas e turmas de 2022/1 a 2025/2 (Computação, Engenharia de Software, Administração, Direito, Enfermagem, Ciências Contábeis) |
| Empresas | 6: 4 aprovadas de ramos diferentes, 1 aguardando aprovação, 1 reprovada com motivo |
| Vagas | 15: abertas (uma com semestre mínimo, uma vencendo amanhã), 1 pausada, 1 com prazo expirado ontem, encerradas manualmente e automaticamente |
| Alunos | 40 com currículo completo, espalhados por cursos e semestres; 2 desligados pela faculdade |
| Candidaturas | Cerca de 80, em todas as etapas e status, com linha do tempo e notificações não lidas |

### Contas de demonstração

Todas usam a senha `Demo@2026!`, que só existe no seed e no README. O admin tem 2FA: o segredo TOTP do seed também fica no README.

| Papel | E-mail | O que mostrar na aula |
| --- | --- | --- |
| Admin | admin@vagas.local | Aprovar a empresa pendente, ver a faculdade inativa, catálogo de áreas |
| Faculdade | contato@uhorizonte.edu.br | Cursos com grade e turmas, lista de alunos, desligar um aluno ao vivo |
| Empresa | rh@nuvemazul.com.br | Vagas em todos os estados, candidatos por etapa, encerrar vaga com devolutiva |
| Empresa pendente | contato@faisca.com.br | Aviso "Cadastro em análise" e bloqueio de publicação |
| Aluna ativa | ana.souza@aluno.uhorizonte.edu.br | Vagas da área, candidaturas em etapas diferentes, uma seleção aprovada, notificações |
| Aluno com histórico | bruno.lima@aluno.uhorizonte.edu.br | Histórico com candidatura cancelada e não selecionada |
| Aluna desligada | carla.mendes@aluno.uhorizonte.edu.br | Acesso restrito à troca de faculdade; empresa vê "Aluno inativo" |
| Aluno novo | diego.alves@aluno.valedosul.edu.br | Primeiro acesso com currículo vazio |

## 11. Estratégia de testes

Os testes nascem dos critérios de aceite, antes do código: regra de domínio vira teste unitário, contrato e permissão viram teste de integração, jornada do usuário vira teste Playwright. Todo título de teste começa pelo ID da história ou do requisito (ALU-07, SEG-03).

| Camada | Ferramenta | O que cobre | Quando roda | Meta |
| --- | --- | --- | --- | --- |
| Unidade | Jest | `src/domain`: CPF, CNPJ, senha, visibilidade RN-08, máquinas de estado, cálculo de prazo | Todo commit | ≥ 90% de linhas em `domain` |
| Integração | Jest + Supertest + Testcontainers (Postgres, Redis) | Cada endpoint: validação, códigos de erro, RBAC, posse, transações, jobs | Todo PR | ≥ 80% de linhas na API |
| E2E | Playwright | Jornadas das histórias pela UI, e-mails lidos no Mailpit, acessibilidade | Todo PR (4 shards) | 1+ teste por história |
| Segurança | Playwright (request) + integração | SEG-01 a SEG-10 | Todo PR | 100% dos SEG |

### 11.1 Playwright: ambiente e convenções

- **Ambiente:** `docker compose -f docker-compose.test.yml up --wait` sobe postgres, redis, mailpit, api (`NODE_ENV=test`), worker e web; o `globalSetup` chama `/__test__/reset` uma vez.
- **Isolamento:** cada teste cria seus dados em `/__test__/cenarios`, com e-mail, CPF e CNPJ únicos e válidos. Sem estado compartilhado, os testes rodam em paralelo sem reset entre eles.
- **Login:** feito por API com `page.request`, que divide os cookies com o navegador; o login pela tela é testado só em AUTH-01.
- **Tempo:** em vez de mudar o relógio global da API (o que quebraria testes paralelos), o teste move o prazo da vaga para o passado e roda o job só para ela. Contagens regressivas na tela usam `page.clock`.
- **E-mail:** um helper consulta a API do Mailpit para ler assunto e link de verificação, convite ou redefinição.
- **Seletores:** `getByRole` e `getByLabel` primeiro; `data-testid` só quando não há nome acessível. Isso também obriga a UI a ser acessível.
- **Acessibilidade:** axe em cada página principal, sem violação serious ou critical.
- **Tags:** `@aluno @empresa @faculdade @admin @jobs @seguranca @smoke`; os `@smoke` rodam também em Firefox e em viewport mobile.
- **Diagnóstico:** trace na primeira repetição, vídeo e screenshot só em falha, relatório HTML anexado ao CI.

### 11.2 Configuração

```ts
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['junit', { outputFile: 'results/junit.xml' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@smoke/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@smoke/ },
  ],
});
```

### 11.3 Fixtures e helpers

```ts
// e2e/fixtures.ts
import { test as base, expect, type APIRequestContext } from '@playwright/test';

const API = '/api/v1';
type Conta = { id: string; email: string; senha: string };
export type Cenario = {
  aluno: Conta & { nome: string };
  empresa: Conta;
  vaga: { id: string; funcao: string; prazo: string };
  candidaturaId?: string;
};
type Job = 'expirar-prazos' | 'lembrete' | 'encerrar-automatico' | 'enviar-emails';

export class TestApi {
  constructor(private readonly request: APIRequestContext) {}

  async cenario(opcoes: { areaCurso?: string; areasVaga?: string[]; comCandidatura?: boolean } = {}) {
    const res = await this.request.post(`${API}/__test__/cenarios`, { data: opcoes });
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as Cenario;
  }

  async moverPrazo(vagaId: string, prazo: Date) {
    await this.request.post(`${API}/__test__/vagas/${vagaId}/prazo`, { data: { prazo: prazo.toISOString() } });
  }

  async rodarJob(nome: Job, vagaId?: string) {
    const res = await this.request.post(`${API}/__test__/jobs/${nome}`, { data: { vagaId } });
    expect(res.ok()).toBeTruthy();
  }

  async ultimoEmailPara(email: string) {
    const res = await this.request.get(`${process.env.MAILPIT_URL}/api/v1/search`, { params: { query: `to:${email}` } });
    const { messages } = await res.json();
    return messages[0] as { ID: string; Subject: string };
  }
}

export const test = base.extend<{ api: TestApi; entrarComo: (conta: Conta) => Promise<void> }>({
  api: async ({ request }, use) => {
    await use(new TestApi(request));
  },
  entrarComo: async ({ page }, use) => {
    await use(async ({ email, senha }) => {
      // page.request divide os cookies com o navegador: a página já abre logada
      const res = await page.request.post(`${API}/auth/login`, { data: { email, senha } });
      expect(res.status()).toBe(200);
    });
  },
});

export { expect };
```

### 11.4 Exemplos de specs

```ts
// e2e/specs/candidaturas.spec.ts
import { subHours } from 'date-fns';
import { test, expect } from '../fixtures';

test.describe('Candidaturas do aluno', () => {
  test('ALU-07 candidata-se a vaga aberta da sua área @aluno @smoke', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario({ areaCurso: 'Tecnologia', areasVaga: ['Tecnologia'] });
    await entrarComo(aluno);

    await page.goto('/aluno/vagas');
    await page.getByRole('link', { name: vaga.funcao }).click();
    await page.getByRole('button', { name: 'Candidatar-me' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('status')).toHaveText('Candidatura enviada');

    await page.goto('/aluno/candidaturas');
    const linha = page.getByRole('row', { name: new RegExp(vaga.funcao) });
    await expect(linha).toContainText('Em processo');
    await expect(linha).toContainText('Inscrição recebida');
  });

  test('ALU-05 vaga de outra área não aparece nem abre pela URL @aluno', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario({ areaCurso: 'Direito', areasVaga: ['Tecnologia'] });
    await entrarComo(aluno);

    await page.goto('/aluno/vagas');
    await expect(page.getByRole('link', { name: vaga.funcao })).toHaveCount(0);
    expect((await page.request.get(`/api/v1/vagas/${vaga.id}`)).status()).toBe(404);
  });

  test('JOB-01 JOB-02 vaga sem ação encerra 72 h após o prazo e avisa o aluno @jobs', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario({ comCandidatura: true });

    await api.moverPrazo(vaga.id, subHours(new Date(), 1));
    await api.rodarJob('expirar-prazos', vaga.id);
    await api.moverPrazo(vaga.id, subHours(new Date(), 73));
    await api.rodarJob('encerrar-automatico', vaga.id);
    await api.rodarJob('enviar-emails');

    await entrarComo(aluno);
    await page.goto('/aluno/candidaturas?aba=historico');
    await expect(page.getByRole('row', { name: new RegExp(vaga.funcao) })).toContainText('Não selecionado');
    expect((await api.ultimoEmailPara(aluno.email)).Subject).toContain('encerrada');
  });
});
```

```ts
// e2e/specs/seguranca/sessao.spec.ts
import { test, expect } from '../../fixtures';

test('SEG-03 refresh reapresentado após rotação revoga a família @seguranca', async ({ api, playwright, baseURL }) => {
  const { aluno } = await api.cenario();
  const vitima = await playwright.request.newContext({ baseURL });
  await vitima.post('/api/v1/auth/login', { data: { email: aluno.email, senha: aluno.senha } });
  const rtAntigo = (await vitima.storageState()).cookies.find((c) => c.name === 'rt')!;

  expect((await vitima.post('/api/v1/auth/refresh')).status()).toBe(200); // rotaciona

  const atacante = await playwright.request.newContext({ baseURL, storageState: { cookies: [rtAntigo], origins: [] } });
  expect((await atacante.post('/api/v1/auth/refresh')).status()).toBe(401);
  expect((await vitima.post('/api/v1/auth/refresh')).status()).toBe(401); // família inteira revogada
});

test('SEG-02 empresa não acessa candidatura de outra empresa @seguranca', async ({ api, playwright, baseURL }) => {
  const a = await api.cenario({ comCandidatura: true });
  const b = await api.cenario();
  const empresaB = await playwright.request.newContext({ baseURL });
  await empresaB.post('/api/v1/auth/login', { data: { email: b.empresa.email, senha: b.empresa.senha } });

  expect((await empresaB.get(`/api/v1/empresa/candidaturas/${a.candidaturaId}`)).status()).toBe(404);
});
```

### 11.5 Rastreabilidade

`pnpm spec:check` extrai de `docs/spec.md` todo ID no padrão `(AUTH|ALU|FAC|EMP|ADM|JOB|SEG)-\d{2}`, lista os títulos dos testes (`playwright test --list --reporter=json` e o JSON do Jest) e falha o CI se algum ID não aparecer.

| Arquivo Playwright | Histórias |
| --- | --- |
| auth.spec.ts | AUTH-01 a AUTH-05 |
| cadastro-aluno.spec.ts | ALU-01, ALU-12 |
| perfil-aluno.spec.ts | ALU-02 a ALU-04 |
| vagas-aluno.spec.ts | ALU-05, ALU-06 |
| candidaturas.spec.ts | ALU-07 a ALU-11 |
| faculdade.spec.ts | FAC-01 a FAC-06 |
| empresa-cadastro.spec.ts | EMP-01, EMP-02 |
| empresa-vagas.spec.ts | EMP-03 a EMP-07 |
| empresa-candidatos.spec.ts | EMP-08 a EMP-11 |
| ciclo-da-vaga.spec.ts | EMP-12, JOB-01 a JOB-03 |
| admin.spec.ts | ADM-01 a ADM-05 |
| seguranca/\*.spec.ts | SEG-01 a SEG-10 |

### 11.6 Pipeline de CI

1. Instalação com cache do pnpm; lint, typecheck e `prisma validate`.
2. Testes unitários com cobertura.
3. Testes de integração com Testcontainers.
4. Build das imagens api, worker e web.
5. E2E: sobe o compose de teste, roda o Playwright em 4 shards e junta os relatórios.
6. `pnpm spec:check` e `pnpm audit --audit-level high`.
7. SEG-08: sobe a imagem de produção e confirma 404 em `/__test__`.

## 12. Plano de implementação

Oito fases em ordem de dependência; uma fase só fecha quando todas as histórias dela passam em E2E e o `spec:check` está verde.

**Definição de pronto de cada história:** critérios de aceite cobertos por testes verdes no CI; papel e posse cobertos em integração; telas responsivas e sem violação grave no axe; spec atualizada se a regra mudou; nenhuma vulnerabilidade alta no audit.

### Fase 0 · Fundação

- [ ] Monorepo pnpm + Turborepo com `apps/web`, `apps/api`, `packages/contracts` e `packages/ui`
- [ ] Docker Compose de dev e de teste (postgres, redis, mailpit)
- [ ] Schema Prisma da seção 7, primeira migração e seed (admin e áreas de formação)
- [ ] CI com lint, typecheck, unitários, integração e um Playwright vazio já rodando
- [ ] `ClockService`, filtro problem+json, helmet, módulo `/__test__` e script `spec:check`

### Fase 1 · Autenticação e admin

- [ ] Login, refresh rotativo, logout, CSRF, rate limit e bloqueio (AUTH-01 a AUTH-03)
- [ ] Verificação de e-mail e redefinição de senha (AUTH-04, AUTH-05)
- [ ] Guards de papel e posse; middleware de rotas no Next
- [ ] Admin: faculdades, domínios, convite, áreas e 2FA (ADM-01 a ADM-03)
- [ ] SEG-03 a SEG-08 e SEG-10; a matriz SEG-01 nasce aqui e cresce a cada fase

### Fase 2 · Faculdade

- [ ] Primeiro acesso por convite e dados cadastrais (FAC-01, FAC-02)
- [ ] Cursos com geração de semestres, grade de aulas e turmas (FAC-03 a FAC-05)

### Fase 3 · Aluno

- [ ] Cadastro em 3 passos com consulta de domínio e CPF cifrado (ALU-01)
- [ ] Perfil, vínculo acadêmico e currículo (ALU-02 a ALU-04)
- [ ] Lista e desligamento de alunos na faculdade (FAC-06) e troca de faculdade (ALU-12)

### Fase 4 · Empresa e vagas

- [ ] Cadastro com ViaCEP e perfil (EMP-01, EMP-02); aprovação e gestão de empresas pelo admin (ADM-04, ADM-05)
- [ ] Criar, editar, pausar, excluir e prorrogar vaga (EMP-03 a EMP-07)
- [ ] Listagem e detalhe para o aluno com filtros e regra de visibilidade (ALU-05, ALU-06)

### Fase 5 · Candidaturas

- [ ] Candidatar-se e remover candidatura (ALU-07, ALU-08)
- [ ] Em andamento e histórico com linha do tempo (ALU-09, ALU-10)
- [ ] Lista de candidatos, perfil, etapas e não selecionar (EMP-08 a EMP-10); SEG-02 e SEG-09

### Fase 6 · Ciclo de vida e notificações

- [ ] Outbox, worker de e-mail e central de notificações (ALU-11)
- [ ] Encerramento com devolutiva (EMP-11)
- [ ] Jobs de vencimento, lembrete e encerramento automático (JOB-01 a JOB-03, EMP-12)

### Fase 7 · Endurecimento

- [ ] LGPD: exportação de dados, exclusão com anonimização e auditoria
- [ ] Revisão pelo OWASP ASVS nível 1 e pentest antes da apresentação
- [ ] Teste de carga das listagens de vagas e candidatos, com metas a definir

* [ ] Seed de demonstração da seção 10.1, com as contas prontas e um roteiro de apresentação