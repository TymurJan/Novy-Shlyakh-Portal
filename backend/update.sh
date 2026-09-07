#!/bin/bash
# =============================================================
# TALAN UA — Скрипт швидкого оновлення порталу «Новий Шлях»
# Сервер: 91.216.106.91 | Домен: novy-shlyakh.org
# Використання: bash /root/update.sh
# =============================================================

set -e

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
APP_DIR="/home/ngotalanua/app/Talan_UA/Novy_Shlyakh/Novy_Shlyakh_Portal"
WEB_ROOT="/home/ngotalanua/domains/novy-shlyakh.org/public_html"
LOG_FILE="/var/log/talan/update.log"

echo ""
echo "======================================================"
echo "  🔄 TALAN UA — ОНОВЛЕННЯ ПОРТАЛУ «НОВИЙ ШЛЯХ»"
echo "  📅 $TIMESTAMP"
echo "======================================================"

# --- Крок 1: Git pull ---
echo ""
echo "📥 [1/4] Отримання оновлень з GitHub..."
cd "$APP_DIR"
git pull origin master
echo "  ✅ Git pull завершено."

# --- Крок 2: Копіювання фронтенду ---
echo ""
echo "🌐 [2/4] Оновлення фронтенду у public_html..."
cp -f *.html "$WEB_ROOT/"
cp -f *.css "$WEB_ROOT/" 2>/dev/null || true
cp -f *.js "$WEB_ROOT/" 2>/dev/null || true
if [ -d "assets" ]; then
    cp -rf assets/ "$WEB_ROOT/" 2>/dev/null || true
fi
chown -R ngotalanua:ngotalanua "$WEB_ROOT"
echo "  ✅ Фронтенд оновлено у $WEB_ROOT"

# --- Крок 3: Перезапуск сервісів (якщо змінився бекенд) ---
echo ""
echo "🔁 [3/4] Перезапуск сервісів..."
systemctl restart novyshlyakh-backend.service 2>/dev/null && echo "  ✅ novyshlyakh-backend — перезапущено" || echo "  ⚠️  novyshlyakh-backend — не знайдено (пропущено)"
systemctl restart novyshlyakh-bot.service 2>/dev/null && echo "  ✅ novyshlyakh-bot — перезапущено" || echo "  ⚠️  novyshlyakh-bot — не знайдено (пропущено)"

# --- Крок 4: Лог ---
echo ""
echo "📋 [4/4] Запис у лог..."
mkdir -p /var/log/talan
echo "[$TIMESTAMP] UPDATE OK — git pull + frontend deployed + services restarted" >> "$LOG_FILE"
echo "  ✅ Записано у $LOG_FILE"

echo ""
echo "======================================================"
echo "  ✅ ОНОВЛЕННЯ ЗАВЕРШЕНО!"
echo ""
echo "  🌐 Сайт: https://novy-shlyakh.org"
echo "  📋 Лог:  $LOG_FILE"
echo "======================================================"
echo ""
