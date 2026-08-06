"""
import_unity_orgs.py — Імпортер організацій з платформи «Єдність»
==================================================================
Принцип: Кожна організація з /fonds Єдності (ukrveteran.ck.gov.ua)
вноситься вручну одним рядком у список ORGANIZATIONS нижче,
після чого запускається цей скрипт.

Запуск:
    python import_unity_orgs.py
    або
    python import_unity_orgs.py --dry-run  (без реального запису у БД)

Поля словника організації:
    name        — Повна назва організації (обов'язково)
    phone       — Контактний телефон (або "" якщо немає)
    address     — Адреса або "Онлайн" (обов'язково)
    bio         — Короткий опис послуг для ветеранів (обов'язково)
    discount    — Умови надання послуг ("Безкоштовно", "Пільгова ціна" тощо)
    website     — Посилання на сторінку організації (опціонально)
    source      — Завжди "unity" для організацій з Єдності
"""

import sqlite3
import json
import os
import sys
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "novy_shlyakh.db")
JSON_PATH = os.path.join(BASE_DIR, "data", "specialists.json")

# ══════════════════════════════════════════════════════════════════════════════
# 📋 СПИСОК ОРГАНІЗАЦІЙ З ПЛАТФОРМИ «ЄДНІСТЬ»
# Заповнюйте цей масив. Один словник = одна організація.
# ══════════════════════════════════════════════════════════════════════════════

ORGANIZATIONS = [
    # Приклад формату (розкоментуйте та заповніть реальними даними):
    # {
    #     "name": "Назва організації / установи",
    #     "phone": "+38 (0472) 000-00-00",
    #     "address": "м. Черкаси, вул. Прикладна, 1",
    #     "bio": "Опис послуг, які надає організація ветеранам та їх родинам.",
    #     "discount": "Безкоштовно",
    #     "website": "https://example.com.ua",
    #     "source": "unity"
    # },
]

# ══════════════════════════════════════════════════════════════════════════════


def import_organizations(dry_run=False):
    if not ORGANIZATIONS:
        print("⚠️  Список ORGANIZATIONS порожній. Додайте організації та запустіть знову.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    added = 0
    skipped = 0

    for org in ORGANIZATIONS:
        name = org.get("name", "").strip()
        if not name:
            print(f"  ⏭️  Пропуск: відсутня назва → {org}")
            skipped += 1
            continue

        # Перевірка дублікатів за назвою
        cursor.execute("SELECT id FROM specialists WHERE name = ? AND category = 'social'", (name,))
        existing = cursor.fetchone()
        if existing:
            print(f"  ⏭️  Вже існує: «{name}» (id={existing['id']})")
            skipped += 1
            continue

        if dry_run:
            print(f"  🔍 [DRY-RUN] Буде додано: «{name}» | {org.get('address')} | {org.get('phone')}")
            added += 1
            continue

        # Запис у БД
        cursor.execute('''
            INSERT INTO specialists (
                name, category, role, phone, address, bio,
                status, discount, video_url, sub_specialties,
                gender, tariff_plan, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            name,
            "social",
            org.get("source", "unity"),
            org.get("phone", ""),
            org.get("address", ""),
            org.get("bio", ""),
            "verified",                         # Одразу верифіковані (державна платформа)
            org.get("discount", "Уточнюйте"),
            org.get("website", ""),             # website → зберігаємо у video_url як зовнішнє посилання
            "unity_import",                     # Мітка для розрізнення від вручну доданих
            "org",
            "zone4_ngo",
            datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        ))
        print(f"  ✅ Додано: «{name}»")
        added += 1

    if not dry_run:
        conn.commit()
        # Синхронізуємо JSON-бекап
        cursor.execute("SELECT * FROM specialists WHERE status = 'verified'")
        rows = cursor.fetchall()
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump([dict(row) for row in rows], f, ensure_ascii=False, indent=2)
        print(f"\n📄 JSON-бекап оновлено: {JSON_PATH}")

    conn.close()

    mode = "[DRY-RUN]" if dry_run else "[РЕАЛЬНИЙ ЗАПИС]"
    print(f"\n{'='*55}")
    print(f"  {mode} Результат:")
    print(f"  ✅ Додано:    {added}")
    print(f"  ⏭️  Пропущено: {skipped}")
    print(f"{'='*55}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("🔍 Режим ТЕСТОВОГО ЗАПУСКУ (без змін у БД)\n")
    else:
        print("🚀 Імпорт організацій «Єдності» у базу даних Новий Шлях\n")
    import_organizations(dry_run=dry_run)
