-- CreateTable
CREATE TABLE "sessions" (
    "sid" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "comando_ou_payload" TEXT,
    "webhook_url" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dias_semana" TEXT NOT NULL,
    "horarios" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tarefa_id" TEXT NOT NULL,
    CONSTRAINT "agendamentos_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "execucoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "saida" TEXT,
    "duracao" INTEGER,
    "executado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tarefa_id" TEXT NOT NULL,
    CONSTRAINT "execucoes_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "agendamentos_tarefa_id_key" ON "agendamentos"("tarefa_id");
