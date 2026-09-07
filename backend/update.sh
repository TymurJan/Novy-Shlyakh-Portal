#!/bin/bash
set -e
echo "🚀 Оновлення сайту з гілки MASTER..."
cd /home/ngotalanua/app/Talan_UA/Novy_Shlyakh/Novy_Shlyakh_Portal
git checkout master
git pull origin master
cp -rf *.html *.css *.js /home/ngotalanua/domains/novy-shlyakh.org/public_html/
chown -R ngotalanua:ngotalanua /home/ngotalanua/domains/novy-shlyakh.org/public_html/
systemctl restart novyshlyakh-backend novyshlyakh-bot
echo "✅ Оновлення завершено!"
