-- CreateTable
CREATE TABLE "scripts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL DEFAULT '',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_execucoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "saida" TEXT,
    "duracao" INTEGER,
    "executado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tarefa_id" TEXT,
    "script_id" TEXT,
    CONSTRAINT "execucoes_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "execucoes_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_execucoes" ("duracao", "executado_em", "id", "saida", "status", "tarefa_id") SELECT "duracao", "executado_em", "id", "saida", "status", "tarefa_id" FROM "execucoes";
DROP TABLE "execucoes";
ALTER TABLE "new_execucoes" RENAME TO "execucoes";
CREATE TABLE "new_tarefas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "comando_ou_payload" TEXT,
    "webhook_url" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dias_semana" TEXT NOT NULL DEFAULT '[]',
    "horarios" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "script_id" TEXT,
    CONSTRAINT "tarefas_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "scripts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tarefas" ("ativo", "comando_ou_payload", "created_at", "descricao", "dias_semana", "horarios", "id", "nome", "updated_at", "webhook_url") SELECT "ativo", "comando_ou_payload", "created_at", "descricao", "dias_semana", "horarios", "id", "nome", "updated_at", "webhook_url" FROM "tarefas";
DROP TABLE "tarefas";
ALTER TABLE "new_tarefas" RENAME TO "tarefas";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "scripts_arquivo_key" ON "scripts"("arquivo");
