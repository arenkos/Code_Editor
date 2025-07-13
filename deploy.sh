#!/bin/bash

echo "🚀 Code Editor Projesi Deploy Ediliyor..."

# Build oluştur
echo "📦 React uygulaması build ediliyor..."
npm run build

# Sunucuya yükle
echo "📤 Sunucuya yükleniyor..."
rsync -avz --exclude node_modules --exclude .git --exclude .venv --exclude .idea build/ root@147.93.123.9:/var/www/html/code-editor/
rsync -avz server.js package.json root@147.93.123.9:/var/www/html/code-editor/

# Sunucuda npm install ve server başlat
echo "🔧 Sunucuda kurulum yapılıyor..."
ssh root@147.93.123.9 "cd /var/www/html/code-editor && npm install --production && pm2 restart code-editor || pm2 start server.js --name code-editor"

echo "✅ Deploy tamamlandı!"
echo "🌐 https://code.aryazilimdanismanlik.com" 