#!/bin/bash
###############################################################################
# Script de exemplo: Backup do banco de dados SQLite
#
# Cria um backup timestamped do banco de dados SQLite
# 
# Vari√°veis de ambiente:
# - DATABASE_URL: caminho do banco de dados (ex: file:./prisma/dev.db)
# - BACKUP_DIR: diret√≥rio de backup (padr√£o: ./backups)
###############################################################################

set -e  # Parar em caso de erro

# Configura√ß√µes
DB_PATH="${DATABASE_URL:-file:./prisma/dev.db}"
DB_PATH="${DB_PATH#file:}"  # Remove prefixo 'file:'
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.db"

# Criar diret√≥rio de backup se n√£o existir
mkdir -p "$BACKUP_DIR"

echo "Ì∑ÑÔ∏è  Iniciando backup do banco de dados..."
echo "Origem: $DB_PATH"
echo "Destino: $BACKUP_FILE"

# Verificar se o arquivo de origem existe
if [ ! -f "$DB_PATH" ]; then
  echo "‚ùå Erro: Banco de dados n√£o encontrado em $DB_PATH"
  exit 1
fi

# Fazer backup
cp "$DB_PATH" "$BACKUP_FILE"

# Verificar integridade do backup
if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "‚úÖ Backup criado com sucesso! Tamanho: $SIZE"
  echo "Arquivo: $BACKUP_FILE"
  
  # Limpar backups antigos (manter apenas os 10 mais recentes)
  echo "Ì∑π Limpando backups antigos..."
  cd "$BACKUP_DIR"
  ls -t backup_*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
  REMAINING=$(ls -1 backup_*.db 2>/dev/null | wc -l)
  echo "Ì≥¶ Backups mantidos: $REMAINING"
else
  echo "‚ùå Erro ao criar backup"
  exit 1
fi

exit 0
