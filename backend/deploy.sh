#!/bin/bash
# =============================================================
# TALAN UA — DevOps Deploy Script для AlmaLinux 9 + DirectAdmin
# Проєкт: Novy Shlyakh Portal + Backend Bot + Antigravity Agent
# Сервер: 91.216.106.91 | Домен: novy-shlyakh.org
# Користувач: ngotalanua
# Версія: 2.0 | 2026-08-11
# =============================================================
# ВИКОРИСТАННЯ (виконується від root або sudo):
#   chmod +x deploy.sh
#   ./deploy.sh
# =============================================================

set -e  # Зупинка при будь-якій помилці

echo "======================================================"
echo "  🚀 TALAN UA — ДЕПЛОЙ НА ALMALINUX 9 (DIRECTADMIN)"
echo "======================================================"

# --- КРОК 1: Оновлення системи та встановлення пакетів AlmaLinux 9 ---
echo ""
echo "📦 [1/8] Оновлення пакетів AlmaLinux 9 (dnf):"
dnf update -y
dnf install -y epel-release
dnf install -y python3.11 python3.11-pip python3.11-devel git gcc firewalld

# --- КРОК 2: Перевірка користувача та створення директорій ---
echo ""
echo "👤 [2/8] Підготовка директорій для користувача ngotalanua:"
USER_NAME="ngotalanua"
DOMAIN="novy-shlyakh.org"
WEB_ROOT="/home/$USER_NAME/domains/$DOMAIN/public_html"
APP_ROOT="/home/$USER_NAME/app"

mkdir -p "$WEB_ROOT"
mkdir -p "$APP_ROOT"
mkdir -p /var/log/talan

# --- КРОК 3: Розгортання статичного фронтенду ---
echo ""
echo "🌐 [3/8] Розгортання статичного фронтенду:"
cp -r ../index.html ../news.html ../cabinet.html ../style.css ../my.css ../cabinet.css \
    ../accessibility.css ../main.js ../my.js ../cabinet.js ../accessibility.js \
    "$WEB_ROOT/"
chown -R "$USER_NAME:$USER_NAME" "$WEB_ROOT"
echo "  ✅ Фронтенд скопійовано до $WEB_ROOT"

# --- КРОК 4: Встановлення залежностей бекенду ---
echo ""
echo "🐍 [4/8] Встановлення Python 3.11 залежностей у venv:"
cd "$APP_ROOT"
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
if [ -f "$APP_ROOT/backend/requirements.txt" ]; then
    pip install -r "$APP_ROOT/backend/requirements.txt"
fi
deactivate
chown -R "$USER_NAME:$USER_NAME" "$APP_ROOT"
echo "  ✅ Python-залежності встановлено."

# --- КРОК 5: Перевірка .env секретів ---
echo ""
echo "🔐 [5/8] Перевірка .env секретів:"
ENV_FILE="$APP_ROOT/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo "  ⚠️  УВАГА: Файл $ENV_FILE відсутній!"
    echo "  Будь ласка, створіть його вручну:"
    echo ""
    echo "  nano $ENV_FILE"
    echo ""
    echo "  Заповніть змінні:"
    echo "    BOT_TOKEN=ВАШ_ТОКЕН_БОТА"
    echo "    ADMIN_ID=ВАШ_TELEGRAM_ID"
    echo "    SUPPORT_CHAT_ID=ID_ЧАТУ_БАГИ"
    echo "    PORTAL_URL=https://novy-shlyakh.org"
    echo "    BACKEND_URL=http://127.0.0.1:8000"
    echo "    GEMINI_API_KEY=ВАШ_GEMINI_КЛЮЧ"
    echo "    OPENAI_API_KEY=ВАШ_OPENAI_КЛЮЧ"
    echo ""
    read -p "  Натисніть Enter після заповнення .env: " _
fi
chmod 600 "$ENV_FILE"
chown "$USER_NAME:$USER_NAME" "$ENV_FILE"
echo "  ✅ .env файл захищено та перевірено."

# --- КРОК 6: Створення systemd сервісів ---
echo ""
echo "⚙️  [6/8] Реєстрація systemd сервісів (користувач: ngotalanua):"

# -- Сервіс 1: Novy Shlyakh Backend (FastAPI / Server)
cat > /etc/systemd/system/novyshlyakh-backend.service << EOF
[Unit]
Description=Novy Shlyakh Portal — Backend API Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$APP_ROOT/Talan_UA/Novy_Shlyakh/Novy_Shlyakh_Portal/backend
EnvironmentFile=$APP_ROOT/Talan_UA/Novy_Shlyakh/Novy_Shlyakh_Portal/backend/.env
ExecStart=$APP_ROOT/.venv/bin/python server.py
Restart=always
RestartSec=5
StandardOutput=append:/var/log/talan/novyshlyakh_backend.log
StandardError=append:/var/log/talan/novyshlyakh_backend_err.log

[Install]
WantedBy=multi-user.target
EOF

# -- Сервіс 2: Novy Shlyakh Telegram Bot
cat > /etc/systemd/system/novyshlyakh-bot.service << EOF
[Unit]
Description=Novy Shlyakh Portal — Telegram Bot
After=network.target novyshlyakh-backend.service
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$APP_ROOT/Talan_UA/Novy_Shlyakh/Novy_Shlyakh_Portal/backend
EnvironmentFile=$APP_ROOT/Talan_UA/Novy_Shlyakh/Novy_Shlyakh_Portal/backend/.env
ExecStart=$APP_ROOT/.venv/bin/python bot.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/talan/novyshlyakh_bot.log
StandardError=append:/var/log/talan/novyshlyakh_bot_err.log

[Install]
WantedBy=multi-user.target
EOF

# -- Сервіс 3: Antigravity Manager Agent Bot
cat > /etc/systemd/system/antigravity-bot.service << EOF
[Unit]
Description=Talan UA — Antigravity Manager Agent Bot
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$APP_ROOT
EnvironmentFile=$APP_ROOT/Talan_UA/Novy_Shlyakh/Novy_Shlyakh_Portal/backend/.env
ExecStart=$APP_ROOT/.venv/bin/python bot.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/talan/antigravity.log
StandardError=append:/var/log/talan/antigravity_err.log

[Install]
WantedBy=multi-user.target
EOF

chown -R "$USER_NAME:$USER_NAME" /var/log/talan
systemctl daemon-reload
systemctl enable novyshlyakh-backend.service
systemctl enable novyshlyakh-bot.service
systemctl enable antigravity-bot.service
echo "  ✅ Всі 3 systemd сервіси зареєстровано."

# --- КРОК 7: Налаштування Firewalld ---
echo ""
echo "🛡️  [7/8] Налаштування файрволу (firewalld):"
if systemctl unmask firewalld &>/dev/null; then
    systemctl enable --now firewalld || true
    firewall-cmd --permanent --add-service=http || true
    firewall-cmd --permanent --add-service=https || true
    firewall-cmd --permanent --add-port=2222/tcp || true
    firewall-cmd --permanent --add-port=22/tcp || true
    firewall-cmd --reload || true
else
    echo "  ℹ️  CSF / DirectAdmin файрвол активний, пропускаємо firewalld."
fi
echo "  ✅ Файрвол налаштовано (порти 22, 80, 443, 2222)."

# --- КРОК 8: Запуск сервісів ---
echo ""
echo "▶️  [8/8] Запуск сервісів:"
systemctl start novyshlyakh-backend.service
systemctl start novyshlyakh-bot.service
systemctl start antigravity-bot.service
echo ""
echo "======================================================"
echo "  ✅ ДЕПЛОЙ НА ALMALINUX 9 ЗАВЕРШЕНО!"
echo ""
echo "  🌐 Портал: https://novy-shlyakh.org"
echo "  💻 DirectAdmin: https://server-91-216-106-91.da.direct:2222"
echo "  🤖 Боти: активні 24/7 у тлі"
echo "  📋 Логи: /var/log/talan/"
echo "======================================================"
