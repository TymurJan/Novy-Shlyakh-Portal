#!/bin/bash
# =============================================================
# TALAN UA — 1-Click Deploy Script для Ubuntu VPS (SVAI)
# Проєкт: Novy Shlyakh Portal + Backend Bot + Antigravity Agent
# Версія: 1.0 | 2026-08-06
# =============================================================
# ВИКОРИСТАННЯ:
#   chmod +x deploy.sh
#   sudo ./deploy.sh
# =============================================================

set -e  # Зупинка при будь-якій помилці

echo "======================================================"
echo "  🚀 TALAN UA — ГЛОБАЛЬНИЙ ДЕПЛОЙ НА VPS (SVAI)"
echo "======================================================"

# --- КРОК 1: Оновлення системи ---
echo ""
echo "📦 [1/8] Оновлення пакетів Ubuntu..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx git curl

# --- КРОК 2: Встановлення Docker ---
echo ""
echo "🐳 [2/8] Встановлення Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "  ✅ Docker встановлено."
else
    echo "  ✅ Docker вже встановлено, пропускаємо."
fi

# --- КРОК 3: Розгортання фронтенду порталу ---
echo ""
echo "🌐 [3/8] Розгортання статичного фронтенду..."
sudo mkdir -p /var/www/novyshlyakh_portal
sudo cp -r ./index.html ./news.html ./cabinet.html ./style.css ./my.css ./cabinet.css \
    ./accessibility.css ./main.js ./my.js ./cabinet.js ./accessibility.js \
    /var/www/novyshlyakh_portal/
sudo chown -R www-data:www-data /var/www/novyshlyakh_portal
echo "  ✅ Фронтенд скопійовано до /var/www/novyshlyakh_portal/"

# --- КРОК 4: Встановлення залежностей бекенду ---
echo ""
echo "🐍 [4/8] Встановлення Python-залежностей бекенду..."
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..
echo "  ✅ Python-залежності встановлено."

# --- КРОК 5: Перевірка .env секретів (НЕ ЗАПИСУЄМО КЛЮЧІ В КОД!) ---
echo ""
echo "🔐 [5/8] Перевірка .env на сервері..."
if [ ! -f ./backend/.env ]; then
    echo ""
    echo "  ⚠️  УВАГА: Файл backend/.env відсутній!"
    echo "  Будь ласка, створіть його вручну на сервері:"
    echo ""
    echo "  nano ./backend/.env"
    echo ""
    echo "  Та заповніть наступні змінні (дивись backend/.env.example):"
    echo "    BOT_TOKEN=ВАШ_ТОКЕН_БОТА"
    echo "    ADMIN_ID=ВАШ_TELEGRAM_ID"
    echo "    SUPPORT_CHAT_ID=ID_ЧАТУ_БАГИ"
    echo "    PORTAL_URL=https://novyshlyakh.org.ua"
    echo "    BACKEND_URL=http://localhost:8000"
    echo "    GEMINI_API_KEY=ВАШ_GEMINI_КЛЮЧ"
    echo "    OPENAI_API_KEY=ВАШ_OPENAI_КЛЮЧ"
    echo ""
    read -p "  Натисніть Enter після того як заповните .env файл..." _
fi
echo "  ✅ .env файл знайдено."

# --- КРОК 6: Встановлення systemd сервісів ---
echo ""
echo "⚙️  [6/8] Встановлення systemd сервісів (автозапуск)..."

# -- Сервіс 1: Novy Shlyakh Backend (FastAPI / Server)
cat > /etc/systemd/system/novyshlyakh-backend.service << 'EOF'
[Unit]
Description=Novy Shlyakh Portal — Backend API Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/ubuntu/talan/Novy_Shlyakh_Portal/backend
EnvironmentFile=/home/ubuntu/talan/Novy_Shlyakh_Portal/backend/.env
ExecStart=/home/ubuntu/talan/Novy_Shlyakh_Portal/backend/.venv/bin/python server.py
Restart=always
RestartSec=5
StandardOutput=append:/var/log/talan/novyshlyakh_backend.log
StandardError=append:/var/log/talan/novyshlyakh_backend_err.log

[Install]
WantedBy=multi-user.target
EOF

# -- Сервіс 2: Novy Shlyakh Telegram Bot (окремо від бекенду!)
cat > /etc/systemd/system/novyshlyakh-bot.service << 'EOF'
[Unit]
Description=Novy Shlyakh Portal — Telegram Bot
After=network.target novyshlyakh-backend.service
Wants=network-online.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/ubuntu/talan/Novy_Shlyakh_Portal/backend
EnvironmentFile=/home/ubuntu/talan/Novy_Shlyakh_Portal/backend/.env
ExecStart=/home/ubuntu/talan/Novy_Shlyakh_Portal/backend/.venv/bin/python bot.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/talan/novyshlyakh_bot.log
StandardError=append:/var/log/talan/novyshlyakh_bot_err.log

[Install]
WantedBy=multi-user.target
EOF

# -- Сервіс 3: Antigravity Manager Agent (головний бот управління)
cat > /etc/systemd/system/antigravity-bot.service << 'EOF'
[Unit]
Description=Talan UA — Antigravity Manager Agent Bot
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/ubuntu/talan
EnvironmentFile=/home/ubuntu/talan/.env
ExecStart=/home/ubuntu/talan/.venv/bin/python bot.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/talan/antigravity.log
StandardError=append:/var/log/talan/antigravity_err.log

[Install]
WantedBy=multi-user.target
EOF

sudo mkdir -p /var/log/talan
sudo systemctl daemon-reload
sudo systemctl enable novyshlyakh-backend.service
sudo systemctl enable novyshlyakh-bot.service
sudo systemctl enable antigravity-bot.service
echo "  ✅ Всі 3 systemd сервіси зареєстровано та увімкнено."

# --- КРОК 7: Налаштування Nginx ---
echo ""
echo "🔧 [7/8] Налаштування Nginx..."
sudo cp ./backend/novyshlyakh.conf /etc/nginx/sites-available/novyshlyakh.conf
sudo ln -sf /etc/nginx/sites-available/novyshlyakh.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
echo "  ✅ Nginx налаштовано та перезапущено."

# --- КРОК 8: Запуск всіх сервісів ---
echo ""
echo "▶️  [8/8] Запуск всіх сервісів..."
sudo systemctl start novyshlyakh-backend.service
sudo systemctl start novyshlyakh-bot.service
sudo systemctl start antigravity-bot.service
echo ""
echo "======================================================"
echo "  ✅ ДЕПЛОЙ ЗАВЕРШЕНО!"
echo ""
echo "  🌐 Портал: https://novyshlyakh.org.ua (після DNS)"
echo "  🤖 Бот: активний 24/7 (незалежно від вашого ноутбука)"
echo "  📋 Логи: /var/log/talan/"
echo ""
echo "  ⚠️  Не забудьте запустити SSL сертифікат:"
echo "  sudo certbot --nginx -d novyshlyakh.org.ua"
echo "======================================================"
