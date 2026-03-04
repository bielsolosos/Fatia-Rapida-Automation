#!/bin/bash
set -e

echo "🚀 Deploy Fatia Rápida v2"
echo "========================="

# ── 1. Remover processo do PM2 ──
echo ""
echo "⏹  Removendo processo 'app' do PM2..."
pm2 delete app 2>/dev/null || echo "   ℹ️  Processo 'app' não estava rodando, continuando..."

# ── 2. Instalar TODAS as dependências (inclui dev)
echo ""
echo "📦 Instalando dependências..."
npm ci

# ── 3. Migrations do Prisma ──
echo ""
echo "🗄️  Rodando migrations do Prisma..."
npm run db:generate
npm run db:migrate

# ── 4. Build ──
echo ""
echo "🔨 Buildando aplicação..."
npm run build

# ── 5. Remover devDependencies para produção
echo ""
echo "🧹 Removendo devDependencies..."
npm prune --omit=dev

# ── 6. Iniciar com PM2 ──
echo ""
echo "▶️  Iniciando com PM2..."
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "✅ Deploy concluído!"
pm2 status
