/*
  Warnings:

  - You are about to drop the `agendamentos` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "agendamentos_tarefa_id_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "agendamentos";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_tarefas" ("ativo", "comando_ou_payload", "created_at", "descricao", "id", "nome", "updated_at", "webhook_url") SELECT "ativo", "comando_ou_payload", "created_at", "descricao", "id", "nome", "updated_at", "webhook_url" FROM "tarefas";
DROP TABLE "tarefas";
ALTER TABLE "new_tarefas" RENAME TO "tarefas";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
