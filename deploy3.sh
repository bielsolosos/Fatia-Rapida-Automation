#!/bin/bash
set -e

echo "🚀 Deploy Fatia Rápida v2"
echo "========================="

pm2 delete fatia-rapida 2>/dev/null || true

echo "📦 Instalando dependências..."
npm ci

echo "🗄️ Rodando migrations..."
npm run db:generate
npm run db:migrate

echo "🔨 Buildando aplicação..."
npm run build

echo "🧹 Removendo devDependencies..."
npm prune --omit=dev

echo "▶️ Iniciando PM2..."
pm2 start ecosystem.config.cjs
pm2 save

echo "✅ Deploy concluído!"
