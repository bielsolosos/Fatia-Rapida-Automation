# ADR-0007: Cache self-healing (`ensure`) em vez de temp-file por execução

Date: 2026-07-07
Status: Accepted

## Context

O `scripts/user/` (arquivos de script em disco) é um cache do `Script.conteudo` (banco). Se o disco for apagado (container reiniciou, volume faltando), a execução quebra — mesmo o banco tendo o conteúdo. Precisava deixar o projeto stateless pra suportar Docker.

Duas opções:
- **(A) Temp-file por execução:** materializar o script num temp dir, rodar, deletar no `finally`. Disco = zero estado.
- **(B) Cache self-healing (`ensure`):** manter o arquivo persistente, mas re-criar do banco se faltar antes de cada spawn.

## Decision

Opção **(B) — `ensure`**. `ScriptStorage.ensure(arquivo, conteudo)` checa se o arquivo existe (`fs.access`); se não, re-escreve a partir de `conteudo`. `ScriptActionExecutor` chama antes de todo spawn.

A opção (A) foi considerada e descartada: sem gestão de ambientes (runtimes + pacotes), o temp-file quebraria `require()` em scripts Node (cwd em `os.tmpdir()` não acha `node_modules`), referências entre scripts (`source ./other.sh`), e data relativo. Não compensa sem um feature maior de environments.

## Consequences

- **+** Disco vira cache reconstrutível — container reinicia com `scripts/user/` vazio, re-materializa do banco na 1ª execução. App stateless w.r.t. filesystem.
- **+** Preserva cwd (`scripts/user/`) — `require`, refs entre scripts, data relativo continuam funcionando.
- **+** Não preclude o feature de ambientes/pacotes futuro — `ensure` é o padrão que vai se estender pros `installDir`s de ambiente (re-instalar do manifest se o disco sumir).
- **−** Primeira execução após disk-wipe paga o write do arquivo (latência baixa).
- **−** `Script.arquivo` no banco virou legado (não há arquivo persistente obrigatório). Mantido pra evitar migration.
