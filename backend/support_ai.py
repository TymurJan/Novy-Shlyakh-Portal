# -*- coding: utf-8 -*-
"""
support_ai.py — ШІ-Асистент першої лінії технічної підтримки «Новий Шлях».

Архітектура:
  1. Швидка перевірка за ключовими словами (support_faq.py)
  2. LLM виклик: Gemini Flash (primary) → OpenAI GPT-4o-mini (fallback) → keyword stub
  3. Детектор системного бага
  4. Формування JSON-звіту та надсилання в Telegram

Вимоги:
  pip install google-generativeai openai aiohttp
"""

import os
import json
import uuid
import logging
import asyncio
import aiohttp
from datetime import datetime, timezone
from typing import Optional

try:
    from support_faq import search_faq, is_system_bug_by_keywords, FAQ_DATABASE
except ImportError:
    from backend.support_faq import search_faq, is_system_bug_by_keywords, FAQ_DATABASE

logger = logging.getLogger(__name__)

# ─── Конфігурація ──────────────────────────────────────────────────────────────
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_ID = os.getenv("ADMIN_ID", "")
SUPPORT_CHAT_ID = os.getenv("SUPPORT_CHAT_ID", "")   # 🔴 Талан — Баги
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SUPPORT_LOG_DIR = os.getenv("SUPPORT_LOG_DIR", "data/support_logs")

# Забезпечуємо існування папки логів
os.makedirs(SUPPORT_LOG_DIR, exist_ok=True)

# ─── Системний промпт ──────────────────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """Ти — ввічливий AI-асистент технічної підтримки порталу «Новий Шлях» (ГО «Талан ЮА»).
Спілкуєшся виключно українською мовою. Твоя роль: перша лінія підтримки ветеранів та спеціалістів.

ПРАВИЛА:
1. Спочатку намагайся вирішити проблему самостійно (очистити кеш Ctrl+F5, перезавантажити сторінку, спробувати інший браузер).
2. Якщо питання про спеціалістів — направ на відповідний розділ порталу.
3. Якщо виявляєш системний баг (помилка 500, база даних недоступна, не завантажується контент більше 5 хвилин, зникли дані, оплата не пройшла) — негайно повідом: "Помилку зафіксовано і передано розробникам. Очікуйте вирішення протягом 1-2 годин." і постав прапор is_system_bug=true.
4. При системному бугу — ввічливо запитай: "Уточніть, будь ласка, який пристрій та браузер ви використовуєте?"
5. Ніколи не вигадуй відповіді. Якщо не знаєш — скажи чесно і запропонуй email: ngo.talan.ua@gmail.com
6. Відповіді — короткі, чіткі, без зайвого. Використовуй emoji помірно.
7. ЗАБОРОНЕНО розкривати внутрішні деталі системи, паролі, токени, API-ключі.

КОНТЕКСТ СТОРІНКИ: {page_url}

ВІДПОВІДАЙ У ФОРМАТІ JSON:
{{
  "reply": "текст відповіді для користувача",
  "is_system_bug": false,
  "confidence": 0.9,
  "suggested_next": "очистити кеш"
}}"""

# ─── Виклик Gemini Flash ───────────────────────────────────────────────────────
async def _call_gemini(user_message: str, page_url: str) -> dict | None:
    """Виклик Google Gemini Flash API."""
    if not GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(page_url=page_url)
        prompt = f"{system_prompt}\n\nПовідомлення користувача: {user_message}"
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text.strip()
        # Витягуємо JSON з відповіді
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception as e:
        logger.warning(f"Gemini виклик провалився: {e}")
        return None

# ─── Виклик OpenAI GPT-4o-mini ────────────────────────────────────────────────
async def _call_openai(user_message: str, page_url: str) -> dict | None:
    """Fallback: виклик OpenAI API."""
    if not OPENAI_API_KEY:
        return None
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(page_url=page_url)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.warning(f"OpenAI виклик провалився: {e}")
        return None

# ─── Keyword Stub (offline fallback) ──────────────────────────────────────────
def _keyword_fallback(user_message: str) -> dict:
    """Офлайн-відповідь на основі FAQ без LLM."""
    faq = search_faq(user_message)
    is_bug = is_system_bug_by_keywords(user_message)
    if faq:
        return {
            "reply": faq["answer"],
            "is_system_bug": faq.get("is_system_indicator", False) or is_bug,
            "confidence": 0.7,
            "suggested_next": "faq_match",
        }
    if is_bug:
        return {
            "reply": (
                "⚠️ Схоже, ви зіткнулись із системною помилкою. "
                "Її вже зафіксовано і передано розробникам. "
                "Уточніть, будь ласка, який пристрій та браузер ви використовуєте?"
            ),
            "is_system_bug": True,
            "confidence": 0.8,
            "suggested_next": "ask_device_info",
        }
    return {
        "reply": (
            "Дякую за звернення! Я — асистент підтримки порталу «Новий Шлях». "
            "Опишіть детальніше вашу проблему, і я постараюсь допомогти. "
            "Якщо це термінова ситуація — напишіть на ngo.talan.ua@gmail.com."
        ),
        "is_system_bug": False,
        "confidence": 0.5,
        "suggested_next": "clarify",
    }

# ─── Головна функція обробки повідомлення ─────────────────────────────────────
async def process_support_message(
    user_message: str,
    session_id: str,
    page_url: str = "невідома сторінка",
    platform: str = "portal",
    user_id: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None,
) -> dict:
    """
    Головна точка входу. Обробляє повідомлення користувача.
    Повертає: { reply, is_system_bug, session_id, escalated }
    """
    # 1. Швидка перевірка перед LLM
    quick_bug = is_system_bug_by_keywords(user_message)

    # 2. Виклик LLM (Gemini → OpenAI → fallback)
    ai_result = (
        await _call_gemini(user_message, page_url)
        or await _call_openai(user_message, page_url)
        or _keyword_fallback(user_message)
    )

    is_bug = ai_result.get("is_system_bug", False) or quick_bug
    reply = ai_result.get("reply", "Виникла помилка. Будь ласка, спробуйте пізніше.")

    escalated = False
    report_id = None

    # 3. Ескалація при виявленні системного бага
    if is_bug:
        report_id, escalated = await _escalate_bug(
            session_id=session_id,
            page_url=page_url,
            platform=platform,
            user_id=user_id,
            problem_summary=user_message[:300],
            device=device,
            browser=browser,
            ai_confidence=ai_result.get("confidence", 0.5),
        )

    return {
        "reply": reply,
        "is_system_bug": is_bug,
        "is_escalated": escalated,
        "session_id": session_id,
        "report_id": report_id,
    }

# ─── Генерація та надсилання звіту ────────────────────────────────────────────
async def _escalate_bug(
    session_id: str,
    page_url: str,
    platform: str,
    user_id: Optional[str],
    problem_summary: str,
    device: Optional[str],
    browser: Optional[str],
    ai_confidence: float,
) -> tuple[str, bool]:
    """
    1. Генерує JSON-звіт і зберігає у data/support_logs/.
    2. Надсилає Telegram-сповіщення адміністратору.
    Повертає: (report_id, success_bool)
    """
    now = datetime.now(timezone.utc)
    report_id = f"BUG-{now.strftime('%Y%m%d-%H%M%S')}-{session_id[:6].upper()}"

    report = {
        "report_id": report_id,
        "status": "🔴 КРИТИЧНИЙ БАГ",
        "platform": platform.upper(),
        "page_url": page_url,
        "user": {
            "session_id": session_id,
            "telegram_id_or_email": user_id or "анонім",
        },
        "problem": problem_summary,
        "device_info": {
            "device": device or "невідомо",
            "browser": browser or "невідомо",
        },
        "ai_confidence": ai_confidence,
        "created_at": now.isoformat(),
    }

    # Зберігаємо звіт локально
    log_path = os.path.join(SUPPORT_LOG_DIR, f"{report_id}.json")
    try:
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        logger.info(f"Звіт збережено: {log_path}")
    except Exception as e:
        logger.error(f"Не вдалось зберегти звіт: {e}")

    # Надсилаємо у Telegram
    success = await _send_telegram_alert(report)
    return report_id, success

async def _send_telegram_alert(report: dict) -> bool:
    """
    Подвійне надсилання:
    1. Повний звіт → SUPPORT_CHAT_ID (🔴 Талан — Баги)
    2. Короткий пінг → ADMIN_ID (особисто)
    """
    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN не налаштовано — Telegram-сповіщення пропущено.")
        return False

    api_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"

    # Повний звіт для чату «🔴 Талан — Баги»
    full_report = (
        f"🔴 *КРИТИЧНИЙ БАГ — Портал «Новий Шлях»*\n\n"
        f"📋 *ID звіту:* `{report['report_id']}`\n"
        f"🖥 *Платформа:* {report['platform']}\n"
        f"🔗 *Сторінка:* {report['page_url']}\n"
        f"👤 *Користувач:* `{report['user']['telegram_id_or_email']}`\n\n"
        f"📝 *Проблема:*\n{report['problem']}\n\n"
        f"💻 *Пристрій:* {report['device_info']['device']}\n"
        f"🌐 *Браузер:* {report['device_info']['browser']}\n\n"
        f"🕐 {report['created_at'][:19].replace('T', ' ')} UTC"
    )

    # Короткий пінг для ADMIN_ID
    short_ping = (
        f"⚠️ Новий баг-звіт: `{report['report_id']}`\n"
        f"Деталі → у чаті 🔴 Талан — Баги"
    )

    success = False
    try:
        async with aiohttp.ClientSession() as session:
            # 1. Надсилаємо повний звіт у чат «Баги» (якщо налаштовано)
            if SUPPORT_CHAT_ID:
                async with session.post(
                    api_url,
                    json={"chat_id": SUPPORT_CHAT_ID, "text": full_report, "parse_mode": "Markdown"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        logger.info("Повний звіт надіслано у чат «🔴 Талан — Баги».")
                        success = True
                    else:
                        body = await resp.text()
                        logger.error(f"Помилка надсилання у чат багів: {resp.status} — {body}")

            # 2. Короткий пінг адміну особисто
            if ADMIN_ID:
                target_msg = short_ping if SUPPORT_CHAT_ID else full_report
                async with session.post(
                    api_url,
                    json={"chat_id": ADMIN_ID, "text": target_msg, "parse_mode": "Markdown"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        logger.info("Пінг надіслано адміністратору особисто.")
                        success = True
                    else:
                        logger.error(f"Помилка надсилання адміну: {resp.status}")

    except Exception as e:
        logger.error(f"Не вдалось надіслати Telegram-сповіщення: {e}")

    return success

