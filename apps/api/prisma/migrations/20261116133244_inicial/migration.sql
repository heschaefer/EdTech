-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ALUNO', 'FACULDADE', 'EMPRESA', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('PENDENTE_VERIFICACAO', 'ATIVO', 'INATIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "TipoTokenEmail" AS ENUM ('VERIFICACAO', 'RESET_SENHA', 'CONVITE', 'TROCA_EMAIL');

-- CreateEnum
CREATE TYPE "TipoVaga" AS ENUM ('ESTAGIO', 'JOVEM_APRENDIZ', 'TRAINEE', 'CLT', 'PJ', 'TEMPORARIO');

-- CreateEnum
CREATE TYPE "Modalidade" AS ENUM ('PRESENCIAL', 'HIBRIDO', 'REMOTO');

-- CreateEnum
CREATE TYPE "StatusVaga" AS ENUM ('ABERTA', 'PAUSADA', 'PRAZO_EXPIRADO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "MotivoEncerramento" AS ENUM ('MANUAL', 'AUTOMATICO');

-- CreateEnum
CREATE TYPE "StatusCandidatura" AS ENUM ('EM_PROCESSO', 'SELECIONADO', 'NAO_SELECIONADO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "NivelIdioma" AS ENUM ('BASICO', 'INTERMEDIARIO', 'AVANCADO', 'FLUENTE', 'NATIVO');

-- CreateEnum
CREATE TYPE "MotivoCancelamento" AS ENUM ('ALUNO_REMOVEU', 'ALUNO_INATIVO');

-- CreateEnum
CREATE TYPE "MotivoInativacao" AS ENUM ('DESLIGADO_PELA_FACULDADE', 'FACULDADE_INATIVA');

-- CreateEnum
CREATE TYPE "StatusAprovacao" AS ENUM ('PENDENTE', 'APROVADA', 'REPROVADA');

-- CreateEnum
CREATE TYPE "TipoExperiencia" AS ENUM ('EMPREGO', 'ESTAGIO', 'JOVEM_APRENDIZ', 'FREELANCE', 'VOLUNTARIADO', 'INICIACAO_CIENTIFICA', 'MONITORIA', 'EMPRESA_JUNIOR');

-- CreateEnum
CREATE TYPE "NivelFormacao" AS ENUM ('ENSINO_MEDIO', 'TECNICO', 'GRADUACAO', 'POS_GRADUACAO');

-- CreateEnum
CREATE TYPE "SituacaoFormacao" AS ENUM ('CURSANDO', 'CONCLUIDO', 'TRANCADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "papel" "Papel" NOT NULL,
    "status" "StatusUsuario" NOT NULL DEFAULT 'PENDENTE_VERIFICACAO',
    "emailVerificadoEm" TIMESTAMP(3),
    "falhasLogin" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "totpSecretCifrado" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "familia" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "substituidoPorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenEmail" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" "TipoTokenEmail" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "dados" JSONB,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),

    CONSTRAINT "TokenEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaFormacao" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AreaFormacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculdade" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Faculdade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DominioFaculdade" (
    "id" UUID NOT NULL,
    "faculdadeId" UUID NOT NULL,
    "dominio" TEXT NOT NULL,

    CONSTRAINT "DominioFaculdade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" UUID NOT NULL,
    "faculdadeId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "duracaoAnos" INTEGER NOT NULL,
    "ementa" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semestre" (
    "id" UUID NOT NULL,
    "cursoId" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "periodo" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "Semestre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aula" (
    "id" UUID NOT NULL,
    "semestreId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ementa" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "Aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" UUID NOT NULL,
    "cursoId" UUID NOT NULL,
    "anoIngresso" INTEGER NOT NULL,
    "periodoIngresso" INTEGER NOT NULL DEFAULT 1,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aluno" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "cpfCifrado" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "faculdadeId" UUID NOT NULL,
    "cursoId" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "semestreAtual" INTEGER NOT NULL,
    "motivoInativacao" "MotivoInativacao",
    "termosVersao" TEXT NOT NULL,
    "termosAceitosEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curriculo" (
    "id" UUID NOT NULL,
    "alunoId" UUID NOT NULL,
    "objetivo" TEXT,
    "resumo" TEXT,
    "cidade" TEXT,
    "uf" CHAR(2),
    "habilidadesTecnicas" TEXT[],
    "habilidadesComportamentais" TEXT[],
    "links" JSONB NOT NULL DEFAULT '[]',
    "disponibilidade" TEXT,
    "informacoesAdicionais" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curriculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormacaoAcademica" (
    "id" UUID NOT NULL,
    "curriculoId" UUID NOT NULL,
    "nivel" "NivelFormacao" NOT NULL,
    "curso" TEXT NOT NULL,
    "instituicao" TEXT NOT NULL,
    "inicio" DATE,
    "conclusao" DATE,
    "situacao" "SituacaoFormacao" NOT NULL,

    CONSTRAINT "FormacaoAcademica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiencia" (
    "id" UUID NOT NULL,
    "curriculoId" UUID NOT NULL,
    "tipo" "TipoExperiencia" NOT NULL,
    "organizacao" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "descricao" TEXT,

    CONSTRAINT "Experiencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoComplementar" (
    "id" UUID NOT NULL,
    "curriculoId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "instituicao" TEXT NOT NULL,
    "cargaHoraria" INTEGER,
    "conclusao" DATE,
    "certificadoUrl" TEXT,

    CONSTRAINT "CursoComplementar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projeto" (
    "id" UUID NOT NULL,
    "curriculoId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "link" TEXT,

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idioma" (
    "id" UUID NOT NULL,
    "curriculoId" UUID NOT NULL,
    "idioma" TEXT NOT NULL,
    "nivel" "NivelIdioma" NOT NULL,

    CONSTRAINT "Idioma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ramoAtuacao" TEXT NOT NULL,
    "cep" CHAR(8) NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "aprovacao" "StatusAprovacao" NOT NULL DEFAULT 'PENDENTE',
    "aprovacaoMotivo" TEXT,
    "aprovadaEm" TIMESTAMP(3),

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaga" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "funcao" TEXT NOT NULL,
    "tipo" "TipoVaga" NOT NULL,
    "modalidade" "Modalidade" NOT NULL,
    "atividades" TEXT NOT NULL,
    "requisitos" TEXT NOT NULL,
    "salarioMin" DECIMAL(10,2),
    "salarioMax" DECIMAL(10,2),
    "beneficios" TEXT NOT NULL,
    "processoSeletivo" TEXT NOT NULL,
    "cultura" TEXT NOT NULL,
    "cidade" TEXT,
    "uf" CHAR(2),
    "semestreMinimo" INTEGER,
    "status" "StatusVaga" NOT NULL DEFAULT 'ABERTA',
    "prazo" TIMESTAMP(3) NOT NULL,
    "lembreteEnviadoEm" TIMESTAMP(3),
    "encerradaEm" TIMESTAMP(3),
    "motivoEncerramento" "MotivoEncerramento",
    "excluidaEm" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VagaArea" (
    "vagaId" UUID NOT NULL,
    "areaId" UUID NOT NULL,

    CONSTRAINT "VagaArea_pkey" PRIMARY KEY ("vagaId","areaId")
);

-- CreateTable
CREATE TABLE "EtapaSelecao" (
    "id" UUID NOT NULL,
    "vagaId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "EtapaSelecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidatura" (
    "id" UUID NOT NULL,
    "alunoId" UUID NOT NULL,
    "vagaId" UUID NOT NULL,
    "status" "StatusCandidatura" NOT NULL DEFAULT 'EM_PROCESSO',
    "etapaAtualId" UUID,
    "motivoCancelamento" "MotivoCancelamento",
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidaturaEvento" (
    "id" UUID NOT NULL,
    "candidaturaId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "deStatus" "StatusCandidatura",
    "paraStatus" "StatusCandidatura",
    "etapaNome" TEXT,
    "autorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidaturaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "link" TEXT,
    "lidaEm" TIMESTAMP(3),
    "emailEnviadoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "usuarioId" UUID,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "ip" TEXT,
    "dados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_familia_idx" ON "RefreshToken"("familia");

-- CreateIndex
CREATE UNIQUE INDEX "TokenEmail_tokenHash_key" ON "TokenEmail"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AreaFormacao_nome_key" ON "AreaFormacao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Faculdade_usuarioId_key" ON "Faculdade"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculdade_cnpj_key" ON "Faculdade"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "DominioFaculdade_dominio_key" ON "DominioFaculdade"("dominio");

-- CreateIndex
CREATE UNIQUE INDEX "Curso_faculdadeId_nome_key" ON "Curso"("faculdadeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Semestre_cursoId_ordem_key" ON "Semestre"("cursoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_cursoId_anoIngresso_periodoIngresso_key" ON "Turma"("cursoId", "anoIngresso", "periodoIngresso");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_usuarioId_key" ON "Aluno"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_cpfHash_key" ON "Aluno"("cpfHash");

-- CreateIndex
CREATE INDEX "Aluno_cursoId_idx" ON "Aluno"("cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "Curriculo_alunoId_key" ON "Curriculo"("alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_usuarioId_key" ON "Empresa"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");

-- CreateIndex
CREATE INDEX "Vaga_status_prazo_idx" ON "Vaga"("status", "prazo");

-- CreateIndex
CREATE INDEX "VagaArea_areaId_idx" ON "VagaArea"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "EtapaSelecao_vagaId_ordem_key" ON "EtapaSelecao"("vagaId", "ordem");

-- CreateIndex
CREATE INDEX "Candidatura_vagaId_status_idx" ON "Candidatura"("vagaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Candidatura_alunoId_vagaId_key" ON "Candidatura"("alunoId", "vagaId");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lidaEm_idx" ON "Notificacao"("usuarioId", "lidaEm");

-- CreateIndex
CREATE INDEX "AuditLog_entidade_entidadeId_idx" ON "AuditLog"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenEmail" ADD CONSTRAINT "TokenEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculdade" ADD CONSTRAINT "Faculdade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DominioFaculdade" ADD CONSTRAINT "DominioFaculdade_faculdadeId_fkey" FOREIGN KEY ("faculdadeId") REFERENCES "Faculdade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_faculdadeId_fkey" FOREIGN KEY ("faculdadeId") REFERENCES "Faculdade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "AreaFormacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semestre" ADD CONSTRAINT "Semestre_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aula" ADD CONSTRAINT "Aula_semestreId_fkey" FOREIGN KEY ("semestreId") REFERENCES "Semestre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_faculdadeId_fkey" FOREIGN KEY ("faculdadeId") REFERENCES "Faculdade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculo" ADD CONSTRAINT "Curriculo_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormacaoAcademica" ADD CONSTRAINT "FormacaoAcademica_curriculoId_fkey" FOREIGN KEY ("curriculoId") REFERENCES "Curriculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiencia" ADD CONSTRAINT "Experiencia_curriculoId_fkey" FOREIGN KEY ("curriculoId") REFERENCES "Curriculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoComplementar" ADD CONSTRAINT "CursoComplementar_curriculoId_fkey" FOREIGN KEY ("curriculoId") REFERENCES "Curriculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_curriculoId_fkey" FOREIGN KEY ("curriculoId") REFERENCES "Curriculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idioma" ADD CONSTRAINT "Idioma_curriculoId_fkey" FOREIGN KEY ("curriculoId") REFERENCES "Curriculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VagaArea" ADD CONSTRAINT "VagaArea_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "Vaga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VagaArea" ADD CONSTRAINT "VagaArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "AreaFormacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaSelecao" ADD CONSTRAINT "EtapaSelecao_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "Vaga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidatura" ADD CONSTRAINT "Candidatura_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidatura" ADD CONSTRAINT "Candidatura_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "Vaga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidatura" ADD CONSTRAINT "Candidatura_etapaAtualId_fkey" FOREIGN KEY ("etapaAtualId") REFERENCES "EtapaSelecao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidaturaEvento" ADD CONSTRAINT "CandidaturaEvento_candidaturaId_fkey" FOREIGN KEY ("candidaturaId") REFERENCES "Candidatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
