import os
import re
import json
import asyncio
import logging
import tempfile
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo, ReplyKeyboardRemove, MenuButtonWebApp, MenuButtonDefault, MenuButtonCommands
from aiogram.types import BotCommand, BotCommandScopeDefault
from dotenv import load_dotenv

# Завантаження налаштувань
load_dotenv()
API_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
ADMIN_ID = os.getenv("ADMIN_ID", "YOUR_TELEGRAM_ID")
PORTAL_URL = os.getenv("PORTAL_URL", "https://talan.ua/novy-shlyakh") # Посилання на сайт

# Налаштування логування
logging.basicConfig(level=logging.INFO)
bot = Bot(token=API_TOKEN)
dp = Dispatcher()

from aiogram import BaseMiddleware
import time

class ThrottlingMiddleware(BaseMiddleware):
    def __init__(self, limit=1.0):
        self.limit = limit
        self.users = {}

    async def __call__(self, handler, event, data):
        if not hasattr(event, "from_user") or not event.from_user:
            return await handler(event, data)

        # Навігаційні команди ЗАВЖДИ пропускаються (substring-перевірка стійка до emoji-варіацій)
        msg_text = getattr(event, "text", None) or ""
        nav_keywords = [
            "Вийти з підтримки",
            "Повернутися до вибору",
            "/start",
        ]
        if any(kw in msg_text for kw in nav_keywords):
            return await handler(event, data)

        user_id = event.from_user.id
        now = time.time()
        if user_id in self.users:
            if now - self.users[user_id] < self.limit:
                # Spam detected (Double Front Door effect)
                return
        self.users[user_id] = now
        return await handler(event, data)

dp.message.middleware(ThrottlingMiddleware())


# Шлях до бази даних
JSON_PATH = "data/specialists.json"

# Підключаємо менеджер бази даних
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    import db_manager
except ImportError:
    from . import db_manager

# СТАНИ FSM (Для реєстрації спеціаліста)
class Registration(StatesGroup):
    partner_role = State()
    org_name = State()
    contact_person = State()
    name = State()
    category = State()
    address = State()
    phone = State()
    bio = State()
    discount = State()
    photo = State()
    document = State()
    
    # States for the portal transition (optional, kept for logic)
    portal_redirect = State()
    
    # Стан для редагування
    edit_field = State()
    edit_value = State()

# СТАНИ FSM (Для реєстрації ветерана)
class VeteranRegistration(StatesGroup):
    first_name = State()
    phone = State()
    status = State()
    needs = State()
    # Phase 3.5 — Hierarchical geography
    geo_region = State()       # Вибір області
    geo_raion = State()        # Вибір району
    geo_otg = State()          # Вибір ОТГ / міста / села
    geo_city_district = State() # Вибір району міста (якщо місто)
    # Legacy
    district = State()         # Kept for backward compat
    data_consent = State()

class AIMatchmaking(StatesGroup):
    waiting_for_query = State()

# СТАНИ ДЛЯ ВІДГУКІВ
class Feedback(StatesGroup):
    waiting_for_spec = State()
    rating_quality = State()
    rating_ethics = State()
    rating_honesty = State()
    comment = State()

# СТАНИ ДЛЯ ФІНАНСІВ
class Financial(StatesGroup):
    reporting_amount = State()
    uploading_receipt = State()

# СТАНИ ДЛЯ ТЕХПІДТРИМКИ
class SupportDialog(StatesGroup):
    choosing_option = State()    # вибір між чатом та email
    in_dialogue = State()        # активний діалог з ШІ
    waiting_device_info = State() # очікуємо дані пристрою/браузер

# --- ДОПОМІЖНІ ФУНКЦІЇ ---

db_lock = asyncio.Lock()

async def load_db_async():
    """Завантажує спеціалістів з SQL бази."""
    async with db_lock:
        try:
            return db_manager.get_specialists()
        except Exception as e:
            logging.error(f"SQL Load Error: {e}. Falling back to JSON.")
            try:
                with open(JSON_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except:
                return []

async def save_db_async(data):
    """Синхронізує дані (SQL вже оновився через db_manager, тут робимо JSON бекап)."""
    async with db_lock:
        try:
            db_manager.sync_to_json()
        except Exception as e:
            logging.error(f"Sync to JSON error: {e}")


def validate_text(text, min_words=1, min_len=2, allow_latin=False):
    # Видаляємо зайві пробіли
    text = text.strip()
    
    # Перевірка на мову (тільки українська + спецсимволи)
    if not allow_latin:
        if re.search(r'[a-zA-Z]', text):
            return False, "❌ Будь ласка, використовуйте лише українську мову (латиниця заборонена)."
    
    # Перевірка на російські літери
    if re.search(r'[ыэъЫЭЪ]', text):
        return False, "❌ Будь ласка, використовуйте лише українську мову (російські літери заборонені)."
        
    # Перевірка на безглузді повтори літер (напр. 'ааааа')
    if re.search(r'(.)\1{3,}', text):
        return False, "❌ Текст містить занадто багато повторюваних символів. Напишіть змістовно."
        
    words = text.split()
    if len(words) < min_words:
        return False, f"❌ Будь ласка, введіть принаймні {min_words} слова."
        
    if len(text) < min_len:
        return False, f"❌ Текст занадто короткий (мінімум {min_len} симв.)."
        
    # Перевірка на повтори слів (напр. 'апро апро апро')
    if len(words) > 2:
        unique_words = set(w.lower() for w in words)
        if len(unique_words) / len(words) < 0.4:
            return False, "❌ Ваша відповідь містить занадто багато однакових слів. Будь ласка, опишіть детальніше."
            
    # Перевірка на "клавіатурне сміття" (машинг)
    vowels = "аеєиіїоуюя"
    consonants = "бвгґджзйклмнпрстфхцчшщ"
    
    for word in words:
        if len(word) > 5:
            word_lower = word.lower()
            # Шукаємо 5+ приголосних підряд (типу 'йцукен')
            consonant_streak = 0
            for char in word_lower:
                if char in consonants:
                    consonant_streak += 1
                    if consonant_streak >= 5:
                        return False, f"❌ Слово '{word}' схоже на випадковий набір літер. Будь ласка, пишіть зрозуміло."
                else:
                    consonant_streak = 0
            
            # Перевірка балансу голосних (в українській мові зазвичай 30-50% голосних)
            v_count = sum(1 for char in word_lower if char in vowels)
            if v_count == 0 or (v_count / len(word) < 0.15):
                return False, f"❌ Слово '{word}' містить занадто мало голосних. Це не схоже на українське слово."

    return True, ""

# --- ГОРОВНЕ МЕНЮ ---
@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext = None):
    logging.info(f"DEBUG: /start command received from {message.from_user.id}")

    # ☰ Оновлюємо кнопку меню для цього конкретного чату (список команд)
    try:
        await bot.set_chat_menu_button(
            chat_id=message.chat.id,
            menu_button=MenuButtonCommands()
        )
    except Exception:
        pass  # Не критично — не блокуємо головну логіку

    args = message.text.split() if message.text else []
    is_login_redirect = len(args) > 1 and args[1] == "login"
    is_reg_vet_redirect = len(args) > 1 and args[1] == "reg_vet"
    is_spec_redirect = len(args) > 1 and args[1].startswith("spec_")
    is_support_redirect = len(args) > 1 and args[1] == "support"
    
    # Скидаємо стан, якщо це звичайний старт (не підтримка і не логін)
    if state and not (is_support_redirect or is_reg_vet_redirect):
        await state.clear()
        
    if is_reg_vet_redirect:
        if state:
            await start_veteran_registration_flow(message, state)
            return

    if is_support_redirect:
        import uuid
        session_id = str(uuid.uuid4())
        await state.set_state(SupportDialog.in_dialogue)
        await state.update_data(
            support_session_id=session_id,
            support_platform="bot",
            support_user_id=str(message.from_user.id),
            support_bug_reported=False,
            return_context="start"
        )
        await message.answer(
            "🤖 *ШІ-асистент підтримки автоматично підключено (перехід з порталу).*\n\n"
            "Опишіть вашу проблему текстом. Я допоможу або передам звіт розробникам.\n"
            "_Щоб завершити діалог і повернутись до меню — напишіть /start_",
            reply_markup=ReplyKeyboardMarkup(
                keyboard=[[KeyboardButton(text="/start")]],
                resize_keyboard=True
            ),
            parse_mode="Markdown"
        )
        return

    # Якщо перейшов з порталу на конкретного спеціаліста
    if is_spec_redirect:
        spec_param = args[1]  
        spec_id = spec_param[5:]  
        db = await load_db_async()
        
        spec = next((s for s in db if str(s.get("id")) == spec_id or str(s.get("tg_id")) == spec_id), None)
        if spec:
            text = (
                f"👤 **{spec.get('name')}**\n"
                f"🏷 Категорія: {spec.get('category')}\n"
                f"📍 Адреса: {spec.get('address')}\n\n"
                f"🎁 Пільги: {spec.get('discount', 'Уточнюйте')}\n\n"
                f"📝 {spec.get('bio', '')}"
            )
            kb_inline = [[InlineKeyboardButton(text="📞 Отримати контакти", callback_data=f"contact_{spec['id']}")]]
            await message.answer(
                f"Ви обрали спеціаліста з порталу:\n\n{text}",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=kb_inline),
                parse_mode="Markdown"
            )
        else:
            await message.answer("На жаль, спеціаліста не знайдено. Можливо, він вже не активний.")
    
    # --- АВТОМАТИЧНИЙ ВХІД ДО КАБІНЕТУ ---
    db = await load_db_async()
    user_id_str = str(message.from_user.id)
    
    # Перевіряємо партнера
    partner = next((
        s for s in db 
        if str(s.get("tg_id")) == user_id_str or 
        str(s.get("id", "")).startswith(f"user_{user_id_str}") 
    ), None)
    
    # Перевіряємо ветерана
    vet = db_manager.get_veteran(message.from_user.id)
    is_veteran = vet is not None and vet.get("name") is not None
    
    if partner:
        # Авто-редирект партнера до його кабінету
        await route_partner_cabinet(message, partner, state)
        return
    elif is_veteran:
        # Авто-редирект ветерана до його кабінету
        await show_vet_profile(message, state)
        return
        
    # --- ЯКЩО НЕ ЗАРЕЄСТРОВАНИЙ - МЕНЮ ВИБОРУ ---
    kb = [
        [KeyboardButton(text="Ветеран / Родина")],
        [KeyboardButton(text="Партнер")]
    ]
    
    if str(message.from_user.id).strip() == str(ADMIN_ID).strip():
        kb.append([KeyboardButton(text="🛡️ Адмін-панель")])

    reply_markup = ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)
    
    welcome_text = "Вітаємо у координаційному центрі **'Новий Шлях'**!\n\nЦей бот допоможе вам знайти фахівця або долучитися до нашої мережі підтримки."
        
    if is_login_redirect:
        welcome_text = "🔐 **Ви успішно авторизувалися через портал!**\n\nВаше меню керування активоване нижче 👇"
        tmp = await message.answer("Оновлення інтерфейсу", reply_markup=ReplyKeyboardRemove())
        await tmp.delete()

    await message.answer(welcome_text, reply_markup=reply_markup, parse_mode="Markdown")

@dp.message(F.text == "🌐 Перейти на Портал")
async def portal_redirect(message: types.Message):
    user_id_str = str(message.from_user.id)
    db = await load_db_async()
    partner = next((
        s for s in db 
        if str(s.get("tg_id")) == user_id_str or 
        str(s.get("id", "")).startswith(f"user_{user_id_str}") 
    ), None)
    vet = db_manager.get_veteran(message.from_user.id)
    is_veteran = vet is not None and vet.get("name") is not None
    
    import time
    ts = int(time.time())
    base = PORTAL_URL.rstrip("/")
    if base.endswith("index.html"):
        base = base[:-len("index.html")].rstrip("/")

    if partner:
        target_url = f"{base}/cabinet.html?tg_id={user_id_str}&role=spec&v={ts}"
        button_text = "🚀 Відкрити свій кабінет на Порталі"
    elif is_veteran:
        target_url = f"{base}/index.html?tg_id={user_id_str}&role=vet&v={ts}"
        button_text = "🚀 Відкрити свій кабінет на Порталі"
    else:
        target_url = f"{base}/index.html?v={ts}"
        button_text = "🚀 Відкрити Портал"

    kb = [[InlineKeyboardButton(text=button_text, web_app=WebAppInfo(url=target_url))]]
    await message.answer(
        "🌐 **Наш Веб-портал «Новий Шлях»** — це зручний інтерактивний каталог допомоги Черкащини.\n\n"
        "**Переваги порталу:**\n"
        "✨ **Розумний пошук та фільтри**: миттєва фільтрація за статтю спеціаліста, вартістю послуг (Pro Bono/знижки), вашим районом/ОТГ Черкащини чи підкатегоріями.\n"
        "🎥 **Відеовізитки**: дивіться короткі відеопривітання спеціалістів перед записом.\n"
        "⭐️ **Реальні відгуки та оцінки** від інших ветеранів з інтегрованою системою модерації.\n\n"
        "На комп'ютері портал відкриється у великому вікні браузера, на телефоні — безпосередньо у Telegram. 👇",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb),
        parse_mode="Markdown"
    )

# --- ШЛЯХ ВЕТЕРАНА ---
@dp.message(F.text == "Ветеран / Родина")
async def veteran_menu(message: types.Message, state: FSMContext = None):
    # Якщо state не передано, спробуємо отримати його (для виклику з інших функцій)
    if state is None:
        state = dp.current_state(chat=message.chat.id, user=message.from_user.id)
        
    kb = [
        [InlineKeyboardButton(text="🤖 Підібрати спеціаліста (AI)", callback_data="ai_matchmaking")],
        [InlineKeyboardButton(text="⚖️ Юрист", callback_data="find_legal")],
        [InlineKeyboardButton(text="🧠 Психолог", callback_data="find_psychology")],
        [InlineKeyboardButton(text="🦾 Реабілітація", callback_data="find_rehab")],
        [InlineKeyboardButton(text="💼 Кар'єра", callback_data="find_career")]
    ]
    markup = InlineKeyboardMarkup(inline_keyboard=kb)
    
    vet = db_manager.get_veteran(message.from_user.id)
    is_veteran = vet is not None and vet.get("name") is not None
    state_data = await state.get_data() if state else {}
    
    # Створюємо нижню клавіатуру для навігації
    nav_kb = []
    if not is_veteran and state_data.get("skipped_reg"):
        nav_kb.append([KeyboardButton(text="🎖️ Реєстрація ветерана (знижка 10%)")])
    elif is_veteran:
        nav_kb.append([KeyboardButton(text="🎖️ Кабінет Ветерана")])

    nav_kb.append([KeyboardButton(text="📰 Новини та Оголошення")])
    nav_kb.append([KeyboardButton(text="⬅️ Повернутися до вибору ролі")])
    nav_markup = ReplyKeyboardMarkup(keyboard=nav_kb, resize_keyboard=True)
    
    # Зберігаємо контекст для повернення після техпідтримки
    if state:
        await state.update_data(return_context="veteran_menu")
    
    # Зберігаємо ID повідомлення з меню, щоб видалити його потім
    msg = await message.answer("Яка допомога вам потрібна зараз?", reply_markup=markup)
    if state:
        await state.update_data(last_menu_id=msg.message_id)
    await message.answer("Ви можете повернутися або перейти на портал кнопками внизу 👇", reply_markup=nav_markup)

@dp.message(F.text == "📰 Новини та Оголошення")
async def show_bot_news(message: types.Message):
    import time
    ts = int(time.time())
    base = PORTAL_URL.rstrip("/")
    if base.endswith("index.html"):
        base = base[:-len("index.html")].rstrip("/")

    text = (
        "📰 **Актуальні новини та оголошення «Нового Шляху»**\n\n"
        "1️⃣ **🛡️ Портал розпочав роботу** (29 лип)\n"
        "Координаційний центр відкрив онлайн-портал підтримки для ветеранів Черкащини.\n\n"
        "2️⃣ **⚖️ Оновлення процедури УБД** (27 лип)\n"
        "Міністерство у справах ветеранів скоротило строк розгляду з 30 до 15 робочих днів.\n\n"
        "3️⃣ **🏆 Гранти «єРобота 2026»** (25 лип)\n"
        "Відкрито прийом заявок на безповоротні гранти до 250 000 грн на власну справу.\n\n"
        "4️⃣ **🧠 Безкоштовні психологічні сесії** (22 лип)\n"
        "Три нові психологи зі спеціалізацією ПТСР долучились до команди.\n\n"
        "5️⃣ **📅 Юридичні консультації у ЦНАП Черкас** (20 лип)\n"
        "Щотижня пн, ср, пт з 10:00 до 13:00 — безкоштовно та без запису.\n"
    )

    kb = [
        [InlineKeyboardButton(text="⚖️ Записатись до юриста", callback_data="find_legal")],
        [InlineKeyboardButton(text="🧠 Записатись до психолога", callback_data="find_psychology")],
        [InlineKeyboardButton(text="🌐 Читати всі новини на Порталі", web_app=WebAppInfo(url=f"{base}/news.html?v={ts}"))]
    ]

    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb), parse_mode="Markdown")

@dp.message(F.text == "⬅️ Повернутися до вибору ролі")
async def back_to_main_msg(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    
    # Спроба видалити останнє Inline-меню, якщо воно є
    data = await state.get_data()
    last_menu_id = data.get("last_menu_id")
    if last_menu_id:
        try:
            await bot.delete_message(message.chat.id, last_menu_id)
        except Exception:
            pass
            
    await state.clear()
    await cmd_start(message)

@dp.callback_query(F.data == "to_main_menu")
async def back_to_main(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.delete() # Видаляємо старе меню
    # Викликаємо головне меню з відновленням ReplyKeyboardMarkup
    await cmd_start(callback.message)
    await callback.answer()

@dp.callback_query(F.data.startswith("find_"))
async def show_specialists(callback: types.CallbackQuery, state: FSMContext = None):
    parts = callback.data.split("_")
    category = parts[1]
    filter_by_district = None
    if len(parts) > 2:
        filter_by_district = parts[2]
        
    vet = db_manager.get_veteran(callback.from_user.id)
    
    if vet and vet.get("district") and len(parts) <= 2:
        kb = [
            [InlineKeyboardButton(text="✅ Так, у моєму районі", callback_data=f"find_{category}_yes")],
            [InlineKeyboardButton(text="❌ Ні, показати всіх", callback_data=f"find_{category}_no")]
        ]
        await callback.message.delete()
        await callback.message.answer(
            f"📍 Бажаєте відфільтрувати фахівців за вашим районом проживання ({vet['district']})?",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=kb)
        )
        await callback.answer()
        return

    await callback.message.delete() # Видаляємо меню вибору, щоб не захаращувати чат
    
    # Миттєво оновлюємо клавіатуру (прибираємо кнопку порталу)
    nav_kb = [[KeyboardButton(text="⬅️ Повернутися до вибору послуг")]]
    nav_markup = ReplyKeyboardMarkup(keyboard=nav_kb, resize_keyboard=True)
    await callback.message.answer("Завантажую список фахівців… 🔎", reply_markup=nav_markup)
    
    db = await load_db_async()
    # Показуємо тільки верифікованих
    specialists = [s for s in db if s.get("category") == category and s.get("status") == "verified"]
    
    filtered = False
    if filter_by_district == "yes" and vet and vet.get("district"):
        district_keyword = vet["district"].split(" ")[0][:6].lower()
        matching_specs = [s for s in specialists if district_keyword in s.get("address", "").lower()]
        if matching_specs:
            specialists = matching_specs
            filtered = True
        else:
            await callback.message.answer(f"⚠️ У вашому районі ({vet['district']}) наразі немає фахівців цієї категорії. Показуємо список для всієї області:")

    if not specialists:
        await callback.message.answer(
            "Наразі у цій категорії немає активних фахівців. Ми працюємо над розширенням мережі!"
        )
    else:
        def get_cat_name(cat):
            names = {"legal": "Юрист", "psychology": "Психолог", "rehab": "Реабілітолог", "career": "Кар'єра/Бізнес"}
            return names.get(cat, cat)

        for s in specialists:
            text = (
                f"👤 **{s.get('name', 'Без імені')}**\n"
                f"🎓 {get_cat_name(s.get('category'))}\n"
                f"📍 {s.get('address', 'Черкаси')}\n"
                f"🎁 Пільги: {s.get('discount', 'Уточнюйте')}\n\n"
                f"📝 {s.get('bio', '')}"
            )
            
            await callback.message.answer(
                text, 
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="📞 Отримати контакти", callback_data=f"contact_{s['id']}")]]),
                parse_mode="Markdown"
            )
            
    # Soft registration offer for unregistered veterans
    is_registered_vet = vet is not None and vet.get("name") is not None
    if not is_registered_vet and state:
        state_data = await state.get_data()
        if not state_data.get("session_soft_offered"):
            await state.update_data(session_soft_offered=True)
            
            benefits_text = (
                f"До речі — якщо зареєструєтесь як ветеран (займе 1 хвилину), ви отримаєте:\n\n"
                f"✅ **10% знижку** на послуги платних фахівців\n"
                f"✅ **Персональні підбірки** під ваш район і потреби\n"
                f"✅ Ваші запити (анонімно) допомагають нам розуміти потреби в регіоні для покращення доступності послуг, про що будемо вас повідомляти."
            )
            
            kb = [
                [InlineKeyboardButton(text="📝 Зареєструватись", callback_data="vet_start_reg")],
                [InlineKeyboardButton(text="⏱️ Пізніше", callback_data="vet_skip_reg")]
            ]
            await callback.message.answer(benefits_text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
            
    await callback.answer()

@dp.callback_query(F.data.startswith("contact_"))
async def handle_contact_request(callback: types.CallbackQuery):
    spec_id = callback.data.replace("contact_", "")
    db = await load_db_async()
    spec = next((s for s in db if str(s.get("id")) == str(spec_id) or s.get("tg_id") == spec_id), None)
    
    if spec:
        # --- ДИСПЕТЧЕРСЬКА ЛОГІКА (SQL Logging) ---
        try:
            # Зберігаємо факт звернення в SQL
            db_manager.log_intake(callback.from_user.id, spec.get('id'))
            logging.info(f"✅ Intake logged for veteran {callback.from_user.id} to spec {spec.get('id')}")
        except Exception as e:
            logging.error(f"Intake logging error: {e}")

        # Надсилаємо контакти користувачу
        contact_text = f"📞 Телефон: `{spec.get('phone', 'Не вказано')}`"
        if spec.get('username'):
            contact_text += f"\n✈️ Telegram: @{spec['username']}"
        
        await callback.message.answer(f"✅ Контакти спеціаліста {spec.get('name', '')}:\n\n{contact_text}", parse_mode="Markdown")
        
        # Попередження про зворотний зв'язок
        await callback.message.answer(
            "⏳ **За 48 годин** ми надішлемо вам коротке опитування, щоб дізнатися, чи була ця допомога корисною. \n"
            "Це допомагає нам покращувати сервіс для ветеранів. Дякуємо!\n\n"
            "💡 *Підказка:* Наступного разу ви можете налаштувати свої персональні критерії пошуку (стать спеціаліста, локацію Черкащини чи пільговий тариф) в Особистому кабінеті в боті, або скористатися нашими зручними розширеними фільтрами безпосередньо на порталі 🌐.",
            parse_mode="Markdown"
        )
        
        # Сповіщаємо спеціаліста
        if spec.get('tg_id'):
            try:
                await bot.send_message(
                    spec['tg_id'],
                    f"🔔 До ваших контактів щойно звернувся користувач через портал 'Новий Шлях'!\n"
                    f"Будьте готові до дзвінка або повідомлення. Дякуємо за вашу працю! 🫡"
                )
            except Exception:
                pass
    
    await callback.answer("Контакти отримано та зафіксовано в системі!")

@dp.message(F.text == "⬅️ Повернутися до вибору послуг")
async def back_to_vet_menu_msg(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    await veteran_menu(message, state)


# --- ШЛЯХ РЕЄСТРАЦІЇ ВЕТЕРАНА (FSM) ---

async def start_veteran_registration_flow(message: types.Message, state: FSMContext):
    # Check if already registered
    vet = db_manager.get_veteran(message.from_user.id)
    if vet and vet.get("name"):
        await message.answer("Ви вже зареєстровані як ветеран!")
        return
        
    await state.set_state(VeteranRegistration.first_name)
    kb = [[KeyboardButton(text="❌ Скасувати реєстрацію")]]
    markup = ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)
    await message.answer(
        "👋 Розпочнемо швидку реєстрацію ветерана (це займе 1 хвилину).\n\n"
        "Введіть ваше ім'я (як до вас звертатися):",
        reply_markup=markup
    )

@dp.message(F.text == "🎖️ Реєстрація ветерана (знижка 10%)")
async def cmd_register_veteran(message: types.Message, state: FSMContext):
    await start_veteran_registration_flow(message, state)

@dp.callback_query(F.data == "vet_start_reg")
async def callback_register_veteran(callback: types.CallbackQuery, state: FSMContext):
    await callback.message.delete()
    await start_veteran_registration_flow(callback.message, state)
    await callback.answer()

@dp.callback_query(F.data == "vet_skip_reg")
async def skip_vet_reg(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(skipped_reg=True)
    await callback.message.edit_text("Добре, ви можете зареєструватися пізніше за допомогою кнопки в меню. 👍")
    await veteran_menu(callback.message, state)
    await callback.answer()

@dp.message(VeteranRegistration.first_name, F.text == "❌ Скасувати реєстрацію")
@dp.message(VeteranRegistration.phone, F.text == "❌ Скасувати реєстрацію")
async def cancel_vet_reg_msg(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("Реєстрацію скасовано.", reply_markup=ReplyKeyboardRemove())
    await cmd_start(message, state)

@dp.callback_query(F.data == "vet_cancel_reg")
async def cancel_vet_reg_cb(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.delete()
    await callback.message.answer("Реєстрацію скасовано.")
    await cmd_start(callback.message, state)
    await callback.answer()

@dp.message(VeteranRegistration.first_name)
async def process_vet_first_name(message: types.Message, state: FSMContext):
    is_valid, error_msg = validate_text(message.text, min_words=1, min_len=2)
    if not is_valid:
        await message.answer(error_msg)
        return
        
    await state.update_data(first_name=message.text)
    await state.set_state(VeteranRegistration.phone)
    
    kb = [
        [KeyboardButton(text="📱 Поділитися номером", request_contact=True)],
        [KeyboardButton(text="❌ Скасувати реєстрацію")]
    ]
    markup = ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True, one_time_keyboard=True)
    await message.answer(
        "📞 Поділіться, будь ласка, своїм номером телефону для авторизації, натиснувши кнопку нижче 👇",
        reply_markup=markup
    )

@dp.message(VeteranRegistration.phone, F.contact)
async def process_vet_phone_contact(message: types.Message, state: FSMContext):
    contact = message.contact
    if contact.user_id != message.from_user.id:
        await message.answer("❌ З метою безпеки ви можете поділитися лише власним контактом. Будь ласка, натисніть кнопку '📱 Поділитися номером'.")
        return
        
    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = "+" + phone
        
    await state.update_data(phone=phone)
    await state.set_state(VeteranRegistration.status)
    
    kb = [
        [InlineKeyboardButton(text="🎖️ Ветеран / УБД", callback_data="vet_status:veteran")],
        [InlineKeyboardButton(text="👥 Член родини ветерана", callback_data="vet_status:family")],
        [InlineKeyboardButton(text="🤝 Близький до ветеранської спільноти", callback_data="vet_status:close")]
    ]
    await message.answer("Оберіть ваш статус:", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))

@dp.message(VeteranRegistration.phone)
async def process_vet_phone_invalid(message: types.Message):
    await message.answer("❌ Будь ласка, скористайтеся кнопкою '📱 Поділитися номером' внизу екрану для верифікації вашого контакту.")

@dp.callback_query(F.data.startswith("vet_status:"))
async def process_vet_status(callback: types.CallbackQuery, state: FSMContext):
    status_key = callback.data.split(":")[1]
    status_map = {
        "veteran": "Ветеран, учасник/учасниця бойових дій",
        "family": "Член родини ветерана",
        "close": "Близький до ветеранської спільноти"
    }
    status_text = status_map.get(status_key, "Ветеран")
    await state.update_data(status=status_text)
    
    await state.update_data(needs_selected=[])
    await state.set_state(VeteranRegistration.needs)
    
    await callback.message.delete()
    await show_needs_keyboard(callback.message, [])
    await callback.answer()

NEEDS_OPTIONS = [
    "Психологічна допомога",
    "Юридична допомога",
    "Фізична реабілітація",
    "Протезування",
    "Працевлаштування",
    "Державні дотації / виплати",
    "Інше"
]

async def show_needs_keyboard(message: types.Message, selected_indices: list, edit=False):
    kb = []
    for idx, option in enumerate(NEEDS_OPTIONS):
        checkbox = "✅" if idx in selected_indices else "⬜"
        kb.append([InlineKeyboardButton(text=f"{checkbox} {option}", callback_data=f"vet_need_toggle:{idx}")])
        
    kb.append([
        InlineKeyboardButton(text="💾 Зберегти вибір", callback_data="vet_needs_save"),
        InlineKeyboardButton(text="❌ Скасувати", callback_data="vet_cancel_reg")
    ])
    
    text = "Що вам потрібно? (можна обрати кілька варіантів, після чого натиснуть «Зберегти вибір»):"
    
    if edit:
        await message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    else:
        await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))

@dp.callback_query(F.data.startswith("vet_need_toggle:"))
async def process_vet_need_toggle(callback: types.CallbackQuery, state: FSMContext):
    idx = int(callback.data.split(":")[1])
    data = await state.get_data()
    selected = data.get("needs_selected", [])
    
    if idx in selected:
        selected.remove(idx)
    else:
        selected.append(idx)
        
    await state.update_data(needs_selected=selected)
    
    try:
        await show_needs_keyboard(callback.message, selected, edit=True)
    except Exception:
        pass
    await callback.answer()

@dp.callback_query(F.data == "vet_needs_save")
async def process_vet_needs_save(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    selected_indices = data.get("needs_selected", [])
    
    if not selected_indices:
        await callback.answer("⚠️ Будь ласка, оберіть хоча б один пункт!", show_alert=True)
        return
        
    selected_needs = [NEEDS_OPTIONS[i] for i in selected_indices]
    await state.update_data(needs=", ".join(selected_needs))
    await state.set_state(VeteranRegistration.district)
    
    kb = [
        [InlineKeyboardButton(text="Черкаський район", callback_data="vet_dist:Черкаський район")],
        [InlineKeyboardButton(text="Уманський район", callback_data="vet_dist:Уманський район")],
        [InlineKeyboardButton(text="Золотоніський район", callback_data="vet_dist:Золотоніський район")],
        [InlineKeyboardButton(text="Звенигородський район", callback_data="vet_dist:Звенигородський район")],
        [InlineKeyboardButton(text="❌ Скасувати", callback_data="vet_cancel_reg")]
    ]
    
    await callback.message.delete()
    # Запускаємо ієрархічний вибір регіону
    await show_region_selector(callback.message, callback.from_user.id)
    await callback.answer()

# ============================================================
# Phase 3.5 — Ієрархічний географічний вибір
# ============================================================

# Географічні дані Черкащини
CHERKASY_RAIONS = [
    "Черкаський",
    "Уманський",
    "Золотоніський",
    "Звенигородський",
    "Кам’янський",
]

CHERKASY_OTG = {
    "Черкаський": [
        "Черкаси (місто)",
        "Сміланська ТГ",
        "Чорнобаївська ТГ",
        "Гелехівська ТГ",
        "Уманська ТГ (Черк.р-н)",
    ],
    "Уманський": [
        "Умань (місто)",
        "Маньківська ТГ",
        "Уманська ТГ",
        "Ладижинська ТГ",
        "Христинівська ТГ",
    ],
    "Золотоніський": [
        "Золотоноша (місто)",
        "Драбівська ТГ",
        "Андрушівська ТГ",
        "Прохорівська ТГ",
    ],
    "Звенигородський": [
        "Звенигородка (місто)",
        "Лисянківська ТГ",
        "Бузьківська ТГ",
        "Борисівська ТГ",
    ],
    "Кам’янський": [
        "Кам’янка (місто)",
        "Сміланська ТГ (Кам.р-н)",
        "Талнівська ТГ",
        "Хоролівська ТГ",
    ]
}

# Райони міста Черкаси
CHERKASY_CITY_DISTRICTS = [
    "Бобринський",
    "Содницький",
    "Розумівський",
    "Митницький",
]

# Всі області України (для вибору з інших регіонів)
ALL_OBLASTS = [
    "Черкаська",  # першою! Наш регіон
    "Вінницька", "Волинська", "Дніпропетровська",
    "Донецька", "Житомирська", "Закарпатська",
    "Запорізька", "Івано-Франківська", "Київська",
    "Кіровоградська", "Луганська", "Львівська",
    "Миколаївська", "Одеська", "Полтавська",
    "Рівненська", "Сумська", "Тернопільська",
    "Харківська", "Херсонська", "Хмельницька"
]


async def show_region_selector(message: types.Message, user_id: int):
    """Step 1: Вибір області."""
    # Перша кнопка — Черкаська (наш регіон) з роздільником
    rows = [[InlineKeyboardButton(
        text="⭐ Черкаська область",
        callback_data="geo_region:Черкаська"
    )]]
    # Інші області у двох колонках
    other_oblasts = [o for o in ALL_OBLASTS if o != "Черкаська"]
    for i in range(0, len(other_oblasts), 2):
        row = [InlineKeyboardButton(
            text=other_oblasts[i],
            callback_data=f"geo_region:{other_oblasts[i]}"
        )]
        if i + 1 < len(other_oblasts):
            row.append(InlineKeyboardButton(
                text=other_oblasts[i+1],
                callback_data=f"geo_region:{other_oblasts[i+1]}"
            ))
        rows.append(row)
    rows.append([InlineKeyboardButton(text="❌ Скасувати", callback_data="vet_cancel_reg")])

    await message.answer(
        "🇺🇦 **Оберіть область проживання:**\n\n"
        "⭐ Наша платформа вже працює у Черкаській області. \n"
        "Інші регіони на стадії подключення — запити враховуються при плануванні розширення.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        parse_mode="Markdown"
    )


@dp.callback_query(F.data.startswith("geo_region:"))
async def process_geo_region(callback: types.CallbackQuery, state: FSMContext):
    region = callback.data.split(":", 1)[1]
    await state.update_data(geo_region=region)
    await state.set_state(VeteranRegistration.geo_region)

    await callback.message.delete()

    if region == "Черкаська":
        # Переходимо до вибору району
        await show_raion_selector(callback.message)
    else:
        # Інший регіон — попросимо ввести місто/район вручну і повідомимо
        await state.set_state(VeteranRegistration.geo_raion)
        await callback.message.answer(
            f"📌 *{region} область* поки не покрита нашою мережею.\n\n"
            "Ваш запит збережено і допоможе нам планувати підключення фахівців у вашому регіоні. 🙏\n\n"
            "Введіть, будь ласка, назву вашого району / міста:",
            parse_mode="Markdown"
        )
    await callback.answer()


async def show_raion_selector(message: types.Message):
    """Step 2 (Черкащина): Вибір району."""
    rows = []
    for raion in CHERKASY_RAIONS:
        rows.append([InlineKeyboardButton(
            text=f"📍 {raion} район",
            callback_data=f"geo_raion:{raion}"
        )])
    rows.append([InlineKeyboardButton(text="❌ Скасувати", callback_data="vet_cancel_reg")])
    await message.answer(
        "🏠 **Оберіть район Черкаської області:**",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        parse_mode="Markdown"
    )


@dp.message(VeteranRegistration.geo_raion)
async def process_other_region_raion_text(message: types.Message, state: FSMContext):
    """Handle free-text raion input for non-Cherkasy regions."""
    data = await state.get_data()
    region = data.get("geo_region", "")
    raion_text = message.text.strip()

    is_valid, error_msg = validate_text(raion_text, min_words=1, min_len=2, allow_latin=False)
    if not is_valid:
        await message.answer(error_msg)
        return

    await state.update_data(geo_raion=raion_text)
    # Переходимо на згоду
    await state.set_state(VeteranRegistration.data_consent)
    # Зберігаємо як regional_request_only=1 після згоди
    await state.update_data(region_request_only=1)
    await show_consent_screen(message)


@dp.callback_query(F.data.startswith("geo_raion:"))
async def process_geo_raion(callback: types.CallbackQuery, state: FSMContext):
    raion = callback.data.split(":", 1)[1]
    await state.update_data(geo_raion=raion)
    await state.set_state(VeteranRegistration.geo_raion)
    await callback.message.delete()
    await show_otg_selector(callback.message, raion)
    await callback.answer()


async def show_otg_selector(message: types.Message, raion: str):
    """Step 3: Вибір ОТГ / міста / села."""
    otg_list = CHERKASY_OTG.get(raion, [])
    rows = []
    for otg in otg_list:
        rows.append([InlineKeyboardButton(
            text=otg,
            callback_data=f"geo_otg:{otg}"
        )])
    rows.append([InlineKeyboardButton(text="⬅️ Назад", callback_data="geo_back_raion")])
    rows.append([InlineKeyboardButton(text="❌ Скасувати", callback_data="vet_cancel_reg")])
    await message.answer(
        f"🏡 **Оберіть вашу ТГ / місто / село ({raion} р-н):**",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        parse_mode="Markdown"
    )


@dp.callback_query(F.data == "geo_back_raion")
async def geo_back_to_raion(callback: types.CallbackQuery, state: FSMContext):
    await callback.message.delete()
    await show_raion_selector(callback.message)
    await callback.answer()


@dp.callback_query(F.data.startswith("geo_otg:"))
async def process_geo_otg(callback: types.CallbackQuery, state: FSMContext):
    otg = callback.data.split(":", 1)[1]
    await state.update_data(geo_otg=otg)
    await state.set_state(VeteranRegistration.geo_otg)
    await callback.message.delete()

    # Якщо обрали місто (іде з "місто" в назві) — показуємо райони міста
    if "місто" in otg.lower():
        await show_city_district_selector(callback.message, otg)
    else:
        # Село / ТГ — немає районів міста, переходимо до згоди
        await state.set_state(VeteranRegistration.data_consent)
        await show_consent_screen(callback.message)
    await callback.answer()


async def show_city_district_selector(message: types.Message, city_otg: str):
    """Step 4 (опціонально): Вибір району міста."""
    # Райони міста Черкаси
    districts = CHERKASY_CITY_DISTRICTS if "Черкаси" in city_otg else []
    rows = []
    for d in districts:
        rows.append([InlineKeyboardButton(
            text=f"🏨 {d}",
            callback_data=f"geo_city_dist:{d}"
        )])
    rows.append([InlineKeyboardButton(
        text="⏭️ Пропустити (невідомо)",
        callback_data="geo_city_dist:skip"
    )])
    rows.append([InlineKeyboardButton(text="❌ Скасувати", callback_data="vet_cancel_reg")])
    await message.answer(
        f"🏙 **Оберіть район міста {city_otg.split(' ')[0]}:**",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        parse_mode="Markdown"
    )


@dp.callback_query(F.data.startswith("geo_city_dist:"))
async def process_geo_city_district(callback: types.CallbackQuery, state: FSMContext):
    district = callback.data.split(":", 1)[1]
    if district != "skip":
        await state.update_data(geo_city_district=district)
    await state.set_state(VeteranRegistration.data_consent)
    await callback.message.delete()
    await show_consent_screen(callback.message)
    await callback.answer()


async def show_consent_screen(message: types.Message):
    """Displays the GDPR consent screen."""
    kb = [
        [InlineKeyboardButton(text="✅ Згоден / Згодна", callback_data="vet_consent:yes")],
        [InlineKeyboardButton(text="❌ Не згоден / Скасувати", callback_data="vet_consent:no")]
    ]
    consent_text = (
        "⚖️ **Згода на обробку персональних даних**:\n\n"
        "Я згоден/згодна на обробку персональних даних (анонімізована аналітика).\n\n"
        "ℹ️ *Примітка:* Аналітичні звіти використовують ТІЛЬКИ категорію запиту + район, без імені/контакту. "
        "Персональні дані не передаються третім особам."
    )
    await message.answer(consent_text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb), parse_mode="Markdown")


@dp.callback_query(F.data.startswith("vet_consent:"))
async def process_vet_consent(callback: types.CallbackQuery, state: FSMContext):
    decision = callback.data.split(":")[1]
    if decision == "no":
        await state.clear()
        await callback.message.delete()
        await callback.message.answer("Реєстрацію скасовано.")
        msg = callback.message
        msg.from_user = callback.from_user
        await cmd_start(msg, state)
        await callback.answer()
        return
        
    data = await state.get_data()
    geo_region = data.get("geo_region")
    geo_raion = data.get("geo_raion")
    geo_otg = data.get("geo_otg")
    geo_city_district = data.get("geo_city_district")
    is_other_region = data.get("region_request_only", 0)

    try:
        db_manager.add_veteran(
            tg_id=callback.from_user.id,
            name=data.get("first_name"),
            phone=data.get("phone"),
            status=data.get("status"),
            needs=data.get("needs"),
            district=data.get("district"),
            data_consent=1,
            region=geo_region,
            raion=geo_raion,
            otg=geo_otg,
            city_district=geo_city_district,
            region_request_only=is_other_region
        )
        logging.info(f"✅ Veteran registered: {data.get('first_name')} (ID: {callback.from_user.id}), region={geo_region}, raion={geo_raion}, otg={geo_otg}")

        # Якщо інший регіон — логуємо як регіональний запит
        if is_other_region and geo_region:
            db_manager.log_regional_request(
                tg_id=callback.from_user.id,
                region=geo_region,
                raion=geo_raion,
                otg=geo_otg,
                needs=data.get("needs"),
                status=data.get("status")
            )
            logging.info(f"📍 Regional request logged: {geo_region}, {geo_raion}")

        await callback.message.delete()
        if is_other_region:
            await callback.message.answer(
                f"🎉 Вітаємо, {data.get('first_name')}!\n\n"
                f"Ваша реєстрація та запит з **{geo_region} області** зафіксовано.\n\n"
                "Ми ще не працюємо у вашому регіоні, але ваш запит враховується при плануванні розширення. "
                "Як тільки в вашому регіоні з'являться партнери — ми повідомимо вас першими. 🫡\n\n"
                "Ви вже можете користуватися порталом та отримувати консультації онлайн!",
                parse_mode="Markdown"
            )
        else:
            await callback.message.answer(
                f"🎉 Вітаємо, {data.get('first_name')}!\n\n"
                "Ви успішно зареєструвалися на порталі 'Новий Шлях'.\n"
                "Тепер вам доступні персональні підбірки та знижка 10% у партнерів. 🫡\n\n"
                "💡 *Порада:* Ви можете налаштувати свої персональні критерії пошуку (стать спеціаліста, ціновий тариф або локацію Черкащини) в Особистому кабінеті в боті, або перейти безпосередньо на наш веб-портал 🌐, де доступні зручні розширені фільтри, реальні відгуки та відеовізитки спеціалістів!",
                parse_mode="Markdown"
            )
    except Exception as e:
        logging.error(f"Error registering veteran: {e}")
        await callback.message.answer("❌ Виникла помилка при реєстрації. Спробуйте пізніше або зверніться до підтримки.")
        
    await state.clear()
    msg = callback.message
    msg.from_user = callback.from_user
    await cmd_start(msg, state)
    await callback.answer()

# --- ОСОБИСТИЙ ПРОФІЛЬ ВЕТЕРАНА ---

@dp.message(F.text.in_({"👤 Мій профіль", "👤 Мій профіль / 📋 Мої запити", "🎖️ Кабінет Ветерана"}))
async def show_vet_profile(message: types.Message, state: FSMContext = None):
    if state:
        await state.update_data(return_context="veteran_cabinet")
    from datetime import datetime
    vet = db_manager.get_veteran(message.from_user.id)
    if not vet:
        await message.answer("Ваш профіль не знайдено. Будь ласка, зареєструйтесь.")
        return
        
    status_label = vet.get("status")
    needs_label = vet.get("needs")
    district_label = vet.get("district")
    
    conn = db_manager.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.id as spec_db_id, s.name, s.category, l.created_at, l.status
        FROM intake_logs l
        JOIN specialists s ON l.specialist_id = s.id
        WHERE l.veteran_id = ?
        ORDER BY l.created_at DESC
        LIMIT 5
    ''', (vet['id'],))
    logs = cursor.fetchall()
    conn.close()
    
    kb = []
    logs_text = ""
    if logs:
        logs_text = "\n\n📋 **Останні звернення:**\n"
        for i, log in enumerate(logs, 1):
            cat_name = "Спеціаліст"
            if log['category'] == 'legal': cat_name = "Юрист"
            elif log['category'] == 'psychology': cat_name = "Психолог"
            elif log['category'] == 'rehab': cat_name = "Реабілітолог"
            elif log['category'] == 'career': cat_name = "Кар'єра"
            
            date_str = log['created_at']
            try:
                dt = datetime.strptime(log['created_at'], "%Y-%m-%d %H:%M:%S")
                date_str = dt.strftime("%d.%m.%Y")
            except: pass
            
            # Перевіряємо, чи є відгук
            review = db_manager.has_veteran_reviewed_specialist(message.from_user.id, log['spec_db_id'])
            
            if review:
                rating_str = f"✅ (Оцінено: {review['rating_average']}★)"
            else:
                rating_str = "⏳ (не оцінено)"
                kb.append([InlineKeyboardButton(
                    text=f"⭐ Оцінити: {log['name']}",
                    callback_data=f"rate_spec:{log['spec_db_id']}"
                )])
            
            logs_text += f"{i}. {log['name']} ({cat_name}) — {date_str} {rating_str}\n"
    else:
        logs_text = "\n\nℹ️ *Ви ще не зверталися до фахівців через бот.*"
        
    # Формуємо рядок місцезнаходження з нових полів (або fallback на старий district)
    geo_parts = []
    if vet.get("region"):
        geo_parts.append(f"{vet.get('region')} обл.")
    if vet.get("raion"):
        geo_parts.append(f"{vet.get('raion')} р-н")
    if vet.get("otg"):
        geo_parts.append(vet.get("otg"))
    if vet.get("city_district"):
        geo_parts.append(f"({vet.get('city_district')} р-н міста)")
    location_str = ", ".join(geo_parts) if geo_parts else (vet.get("district") or "Не вказано")
 
    # Значок для тих хто з іншого регіону
    region_note = ""
    if vet.get("region_request_only"):
        region_note = "\n⏳ _Ваш регіон у черзі на підключення_"

 

    text = (

        f"🎖️ **Ваш профіль ветерана**\n\n"

        f"👤 **Ім'я:** {vet.get('name')}\n"

        f"📞 **Телефон:** {vet.get('phone')}\n"

        f"🏷️ **Статус:** {status_label}\n"

        f"📍 **Місцезнаходження:** {location_str}{region_note}\n"

        f"💡 **Потреби:** {needs_label}"

        f"{logs_text}\n\n"

        f"Ви можете видалити свій профіль відповідно до GDPR (Право бути забутим)."

    )

    
    kb.append([InlineKeyboardButton(text="❌ Видалити профіль ветерана", callback_data="vet_delete_profile_confirm")])
    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb), parse_mode="Markdown")

@dp.callback_query(F.data == "vet_delete_profile_confirm")
async def vet_delete_confirm(callback: types.CallbackQuery):
    kb = [
        [InlineKeyboardButton(text="✅ Так, видалити", callback_data="vet_delete_profile_final")],
        [InlineKeyboardButton(text="🔙 Скасувати", callback_data="vet_delete_profile_cancel")]
    ]
    await callback.message.edit_text(
        "⚠️ **Увага!** Ви впевнені, що хочете видалити свій профіль ветерана?\n\n"
        "Всі ваші дані та історія звернень будуть безповоротно видалені з бази даних.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb),
        parse_mode="Markdown"
    )
    await callback.answer()

@dp.callback_query(F.data == "vet_delete_profile_final")
async def vet_delete_final(callback: types.CallbackQuery, state: FSMContext = None):
    db_manager.delete_veteran(callback.from_user.id)
    await callback.message.edit_text("🗑️ Ваш профіль ветерана успішно та безповоротно видалено з системи.")
    msg = callback.message
    msg.from_user = callback.from_user
    await cmd_start(msg, state)
    await callback.answer()

@dp.callback_query(F.data == "vet_delete_profile_cancel")
async def vet_delete_cancel(callback: types.CallbackQuery):
    await callback.message.delete()
    msg = callback.message
    msg.from_user = callback.from_user
    await show_vet_profile(msg)
    await callback.answer()


# --- ШЛЯХ СПЕЦІАЛІСТА (FSM) ---
@dp.message(F.text.in_({"💼 Я Спеціаліст (Реєстрація)", "Партнер"}))
async def spec_reg_start(message: types.Message, state: FSMContext):
    await state.set_state(Registration.partner_role)
    # Зберігаємо контекст для повернення після техпідтримки
    await state.update_data(return_context="partner_menu")
    kb = [
        [InlineKeyboardButton(text="👨‍⚕️ Приватний фахівець", callback_data="partner_role:specialist")],
        [InlineKeyboardButton(text="🏢 Організація / установа / бюро", callback_data="partner_role:partner")],
        [InlineKeyboardButton(text="💚 Громадська організація / БФ", callback_data="partner_role:ngo")],
        [InlineKeyboardButton(text="🏛️ Державна структура / орган влади", callback_data="partner_role:state")]
    ]
    markup = InlineKeyboardMarkup(inline_keyboard=kb)
    
    nav_kb = [
        [KeyboardButton(text="❌ Скасувати реєстрацію")],
        [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]
    ]
    await message.answer("Оберіть форму співпраці для реєстрації:", reply_markup=markup)
    msg = await message.answer(
        "Ви можете скасувати реєстрацію або перейти на портал кнопками внизу 👇", 
        reply_markup=ReplyKeyboardMarkup(keyboard=nav_kb, resize_keyboard=True)
    )
    await state.update_data(last_prompt_id=msg.message_id)

# --- CANCEL GUARD: перехоплює кнопку скасування у всіх станах реєстрації партнера ---
@dp.message(Registration.partner_role, F.text == "❌ Скасувати реєстрацію")
@dp.message(Registration.org_name, F.text == "❌ Скасувати реєстрацію")
@dp.message(Registration.contact_person, F.text == "❌ Скасувати реєстрацію")
async def cancel_partner_reg(message: types.Message, state: FSMContext):
    await state.clear()
    try:
        await message.delete()
    except Exception:
        pass
    await message.answer("Реєстрацію скасовано.", reply_markup=ReplyKeyboardRemove())
    await cmd_start(message, state)

@dp.callback_query(F.data.startswith("partner_role:"))
async def process_partner_role(callback: types.CallbackQuery, state: FSMContext):
    role = callback.data.split(":")[1]
    await state.update_data(partner_role=role)
    await callback.message.delete()
    
    cancel_nav_kb = ReplyKeyboardMarkup(keyboard=[
        [KeyboardButton(text="⬅️ Назад до вибору ролі")],
        [KeyboardButton(text="❌ Скасувати реєстрацію")]
    ], resize_keyboard=True)

    if role == "specialist":
        await state.set_state(Registration.name)
        await callback.message.answer(
            "📝 Інтродукція: Реєстрація приватного фахівця.\n\n"
            "Будь ласка, введіть ваші ПІБ та посаду (наприклад: 'Іванов Петро Сидорович, юрист'):",
            reply_markup=cancel_nav_kb
        )
    else:
        role_names = {
            "partner": "організації / установи / бюро",
            "ngo": "громадської організації / благодійного фонду",
            "state": "державної структури / органу влади"
        }
        await state.set_state(Registration.org_name)
        await callback.message.answer(
            f"📝 Інтродукція: Реєстрація {role_names.get(role, 'партнера')}.\n\n"
            f"Будь ласка, введіть офіційну назву вашої організації/установи/фонду:",
            reply_markup=cancel_nav_kb
        )
    await callback.answer()

# --- BACK: повернення на вибір ролі (для орг. та спеціаліста) ---
@dp.message(Registration.org_name, F.text == "⬅️ Назад до вибору ролі")
@dp.message(Registration.name, F.text == "⬅️ Назад до вибору ролі")
async def back_to_partner_role(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    await state.set_state(Registration.partner_role)
    
    kb = [
        [InlineKeyboardButton(text="👨‍⚕️ Приватний фахівець", callback_data="partner_role:specialist")],
        [InlineKeyboardButton(text="🏢 Організація / установа / бюро", callback_data="partner_role:partner")],
        [InlineKeyboardButton(text="💚 Громадська організація / БФ", callback_data="partner_role:ngo")],
        [InlineKeyboardButton(text="🏛️ Державна структура / орган влади", callback_data="partner_role:state")]
    ]
    nav_kb = ReplyKeyboardMarkup(keyboard=[
        [KeyboardButton(text="❌ Скасувати реєстрацію")],
        [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]
    ], resize_keyboard=True)
    await message.answer("Оберіть форму співпраці:", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    await message.answer("Ви можете скасувати або перейти на портал 👇", reply_markup=nav_kb)

@dp.message(Registration.org_name, ~F.text.in_({"❌ Скасувати реєстрацію", "⬅️ Назад до вибору ролі"}))
async def process_partner_org_name(message: types.Message, state: FSMContext):
    is_valid, error_msg = validate_text(message.text, min_words=1, min_len=3)
    if not is_valid:
        await message.answer(error_msg)
        return
        
    await state.update_data(org_name=message.text)
    await state.set_state(Registration.contact_person)
    nav_kb = ReplyKeyboardMarkup(keyboard=[
        [KeyboardButton(text="⬅️ Назад до назви")],
        [KeyboardButton(text="❌ Скасувати реєстрацію")]
    ], resize_keyboard=True)
    await message.answer("👤 Введіть ПІБ контактної особи для взаємодії:", reply_markup=nav_kb)

# --- BACK: повернення на назву організації ---
@dp.message(Registration.contact_person, F.text == "⬅️ Назад до назви")
async def back_to_org_name(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    await state.set_state(Registration.org_name)
    nav_kb = ReplyKeyboardMarkup(keyboard=[
        [KeyboardButton(text="⬅️ Назад до вибору ролі")],
        [KeyboardButton(text="❌ Скасувати реєстрацію")]
    ], resize_keyboard=True)
    await message.answer("Повертаємось. Введіть офіційну назву організації/установи/фонду:", reply_markup=nav_kb)

@dp.message(Registration.contact_person, ~F.text.in_({"❌ Скасувати реєстрацію", "⬅️ Назад до назви"}))
async def process_partner_contact_person(message: types.Message, state: FSMContext):
    is_valid, error_msg = validate_text(message.text, min_words=2, min_len=5)
    if not is_valid:
        await message.answer(error_msg)
        return
        
    await state.update_data(contact_person=message.text)
    await state.set_state(Registration.phone)
    
    kb = [
        [KeyboardButton(text="📱 Поділитися моїм номером", request_contact=True)],
        [KeyboardButton(text="⬅️ Назад до контактної особи")],
        [KeyboardButton(text="❌ Скасувати реєстрацію")]
    ]
    markup = ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True, one_time_keyboard=True)
    await message.answer("📞 Будь ласка, поділіться своїм номером телефону для верифікації профілю:", reply_markup=markup)

# --- BACK: phone → contact_person (для орг/нго/держ) ---
@dp.message(Registration.phone, F.text == "⬅️ Назад до контактної особи")
async def back_to_contact_person(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    await state.set_state(Registration.contact_person)
    nav_kb = ReplyKeyboardMarkup(keyboard=[
        [KeyboardButton(text="⬅️ Назад до назви")],
        [KeyboardButton(text="❌ Скасувати реєстрацію")]
    ], resize_keyboard=True)
    await message.answer("Повертаємось. Введіть ПІБ контактної особи для взаємодії:", reply_markup=nav_kb)

@dp.message(F.text == "❌ Скасувати реєстрацію")
async def cancel_reg(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    await state.clear()
    await cmd_start(message)

@dp.message(Registration.name, ~F.text.in_({"❌ Скасувати реєстрацію", "⬅️ Назад до вибору ролі"}))
async def process_name(message: types.Message, state: FSMContext):
    is_valid, error_msg = validate_text(message.text, min_words=2, min_len=5)
    if not is_valid:
        await message.answer(error_msg)
        return
    await state.update_data(name=message.text)
    kb = [
        [InlineKeyboardButton(text="Юрист", callback_data="cat_legal")],
        [InlineKeyboardButton(text="Психолог", callback_data="cat_psychology")],
        [InlineKeyboardButton(text="Реабілітолог", callback_data="cat_rehab")],
        [InlineKeyboardButton(text="Кар'єра/Бізнес", callback_data="cat_career")]
    ]
    await state.set_state(Registration.category)
    
    nav_kb = [
        [KeyboardButton(text="⬅️ Назад до вибору ролі")],
        [KeyboardButton(text="❌ Скасувати реєстрацію")]
    ]
    await message.answer("Оберіть вашу категорію:", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    msg = await message.answer("Натисніть кнопку нижче для навігації 👇", reply_markup=ReplyKeyboardMarkup(keyboard=nav_kb, resize_keyboard=True))
    await state.update_data(last_prompt_id=msg.message_id)

@dp.message(Registration.category, F.text == "⬅️ Назад до імені")
async def back_to_name(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    
    data = await state.get_data()
    last_id = data.get("last_prompt_id")
    if last_id:
        try:
            await bot.delete_message(message.chat.id, last_id)
        except:
            pass
            
    await state.set_state(Registration.name)
    nav_kb = ReplyKeyboardMarkup(keyboard=[
        [KeyboardButton(text="⬅️ Назад до вибору ролі")],
        [KeyboardButton(text="❌ Скасувати реєстрацію")]
    ], resize_keyboard=True)
    msg = await message.answer(
        "Повертаємось. Як вас звати? (Введіть ПІБ та посаду)", 
        reply_markup=nav_kb
    )
    await state.update_data(last_prompt_id=msg.message_id)

@dp.callback_query(F.data.startswith("cat_"))
async def process_category(callback: types.CallbackQuery, state: FSMContext):
    cat = callback.data.split("_")[1]
    await state.update_data(category=cat)
    await state.set_state(Registration.phone)
    
    kb = [
        [KeyboardButton(text="📱 Поділитися моїм номером", request_contact=True)],
        [KeyboardButton(text="⬅️ Назад до категорії")],
        [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]
    ]
    markup = ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True, one_time_keyboard=True)
    await callback.message.answer("📞 Будь ласка, поділіться своїм номером телефону для верифікації:", reply_markup=markup)
    await callback.answer()

@dp.message(Registration.address, F.text == "⬅️ Назад до категорії")
async def back_to_cat(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    
    data = await state.get_data()
    last_id = data.get("last_prompt_id")
    if last_id:
        try:
            await bot.delete_message(message.chat.id, last_id)
        except:
            pass
            
    await state.set_state(Registration.category)
    # Відправляємо вибір категорії ще раз
    kb = [
        [InlineKeyboardButton(text="Юрист", callback_data="cat_legal")],
        [InlineKeyboardButton(text="Психолог", callback_data="cat_psychology")],
        [InlineKeyboardButton(text="Реабілітолог", callback_data="cat_rehab")],
        [InlineKeyboardButton(text="Кар'єра/Бізнес", callback_data="cat_career")]
    ]
    await message.answer("Оберіть вашу категорію:", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    nav_kb = [[KeyboardButton(text="⬅️ Назад до імені")], [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]]
    msg = await message.answer("Ви можете повернутися або перейти на портал 👇", reply_markup=ReplyKeyboardMarkup(keyboard=nav_kb, resize_keyboard=True))
    await state.update_data(last_prompt_id=msg.message_id)

@dp.callback_query(F.data == "reg_back_cat")
async def reg_back_cat(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    # Імітуємо повідомлення з ім'ям щоб викликати вибір категорії
    msg = types.Message(message_id=0, date=None, chat=callback.message.chat, from_user=callback.from_user, text=data.get('name'))
    await process_name(msg, state)
    await callback.message.delete()
    await callback.answer()

@dp.message(Registration.address)
async def process_address(message: types.Message, state: FSMContext):
    is_valid, error_msg = validate_text(message.text, min_words=1, min_len=5)
    if not is_valid:
        await message.answer(error_msg)
        return
    await state.update_data(address=message.text)
    await state.set_state(Registration.phone)
    kb = [
        [KeyboardButton(text="📱 Поділитися моїм номером", request_contact=True)],
        [KeyboardButton(text="⬅️ Назад до адреси")],
        [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]
    ]
    markup = ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True, one_time_keyboard=True)
    await message.answer("📞 Будь ласка, поділіться своїм номером телефону для верифікації:", reply_markup=markup)

@dp.message(Registration.phone, F.text == "⬅️ Назад до адреси")
async def reg_back_address(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
    
    data = await state.get_data()
    last_id = data.get("last_prompt_id")
    if last_id:
        try:
            await bot.delete_message(message.chat.id, last_id)
        except:
            pass
            
    await state.set_state(Registration.address)
    nav_kb = [[KeyboardButton(text="⬅️ Назад до категорії")], [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]]
    msg = await message.answer("Повертаємось. Введіть адресу вашого кабінету ще раз:", reply_markup=ReplyKeyboardMarkup(keyboard=nav_kb, resize_keyboard=True))
    await state.update_data(last_prompt_id=msg.message_id)

@dp.message(Registration.phone, F.contact)
async def process_phone_contact(message: types.Message, state: FSMContext):
    contact = message.contact
    if contact.user_id != message.from_user.id:
        await message.answer("❌ З метою безпеки ви можете зареєструвати лише свій власний номер телефону. Будь ласка, скористайтеся системною кнопкою.")
        return
    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = "+" + phone
    
    data = await state.get_data()
    role = data.get("partner_role", "specialist")
    
    import urllib.parse
    params = {
        "role": role,
        "phone": phone,
        "tg_id": message.from_user.id
    }
    
    if role == "specialist":
        params["name"] = data.get("name")
        params["cat"] = data.get("category")
    else:
        params["name"] = data.get("org_name")
        params["contact_person"] = data.get("contact_person")
        
    query = urllib.parse.urlencode(params)
    # Направляємо на my.html#register, де my.js правильно парсить hash+params
    base = PORTAL_URL.rstrip("/")
    # Якщо base вже закінчується на index.html — замінюємо, інакше додаємо my.html
    if base.endswith("index.html"):
        base = base[:-len("index.html")]
    reg_url = f"{base}/my.html#register?{query}"
    
    kb = [[InlineKeyboardButton(text="🚀 Завершити реєстрацію на порталі", web_app=WebAppInfo(url=reg_url))]]
    markup = InlineKeyboardMarkup(inline_keyboard=kb)
    
    await message.answer(
        "✅ Основну інформацію отримано!\n\n"
        "Тепер, будь ласка, перейдіть на наш портал для завершення реєстрації. \n"
        "Там ви зможете:\n"
        "1. Заповнити детальні відомості про вашу діяльність.\n"
        "2. Ознайомитися з Політикою конфіденційності.\n"
        "3. Підписати угоду про співпрацю.\n\n"
        "Це необхідно для верифікації вашого профілю.",
        reply_markup=markup
    )
    await state.clear()

@dp.message(Registration.bio, F.text == "⬅️ Назад до телефону")
async def back_to_phone(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
        
    data = await state.get_data()
    last_id = data.get("last_prompt_id")
    if last_id:
        try:
            await bot.delete_message(message.chat.id, last_id)
        except:
            pass
            
    await state.set_state(Registration.phone)
    kb = [
        [KeyboardButton(text="📱 Поділитися моїм номером", request_contact=True)],
        [KeyboardButton(text="⬅️ Назад до адреси")],
        [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]
    ]
    msg = await message.answer("Повертаємось. Поділіться номером телефону:", reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True))
    await state.update_data(last_prompt_id=msg.message_id)

@dp.callback_query(F.data == "reg_back_phone")
async def reg_back_phone(callback: types.CallbackQuery, state: FSMContext):
    await state.set_state(Registration.phone)
    kb = [[KeyboardButton(text="📱 Поділитися моїм номером", request_contact=True)]]
    await callback.message.answer("Повертаємось. Поділіться номером телефону:", reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True))
    await callback.message.delete()
    await callback.answer()

@dp.message(Registration.phone)
async def process_phone_invalid(message: types.Message):
    await message.answer("❌ Будь ласка, скористайтеся кнопкою '📱 Поділитися моїм номером' внизу екрану для верифікації вашого контакту.")

@dp.message(Registration.bio)
async def process_bio(message: types.Message, state: FSMContext):
    is_valid, error_msg = validate_text(message.text, min_words=5, min_len=30)
    if not is_valid:
        await message.answer(error_msg + "\n\n(Розкажіть про ваш досвід детальніше — мінімум 5 слів та 30 символів)")
        return
    await state.update_data(bio=message.text)
    await state.set_state(Registration.discount)
    kb = [
        [KeyboardButton(text="⬅️ Назад до опису")],
        [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]
    ]
    await message.answer(
        "🎁 Які пільгові умови ви надаєте ветеранам? (напр. 'Перша консультація безкоштовно'):", 
        reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)
    )

@dp.message(Registration.discount, F.text == "⬅️ Назад до опису")
async def back_to_bio(message: types.Message, state: FSMContext):
    try:
        await message.delete()
    except Exception:
        pass
        
    data = await state.get_data()
    last_id = data.get("last_prompt_id")
    if last_id:
        try:
            await bot.delete_message(message.chat.id, last_id)
        except:
            pass
            
    await state.set_state(Registration.bio)
    nav_kb = [[KeyboardButton(text="⬅️ Назад до телефону")], [KeyboardButton(text="🌐 Перейти на Портал", web_app=WebAppInfo(url=f"{PORTAL_URL}?v=24"))]]
    msg = await message.answer("Повертаємось. Опишіть ваш досвід ще раз:", reply_markup=ReplyKeyboardMarkup(keyboard=nav_kb, resize_keyboard=True))
    await state.update_data(last_prompt_id=msg.message_id)

@dp.message(Registration.discount)
async def process_discount(message: types.Message, state: FSMContext):
    is_valid, error_msg = validate_text(message.text, min_words=1, min_len=3)
    if not is_valid:
        await message.answer(error_msg)
        return
    import time
    data = await state.get_data()
    data['discount'] = message.text
    data['status'] = 'pending'
    data['id'] = f"user_{message.from_user.id}_{int(time.time())}"
    data['tg_id'] = message.from_user.id
    data['username'] = message.from_user.username
    
    # Зберігаємо в SQL базу через db_manager
    try:
        db_manager.add_specialist(data)
        logging.info(f"✅ New specialist added to SQL: {data['name']}")
    except Exception as e:
        logging.error(f"SQL Add Error: {e}")
        # Fallback to JSON if SQL fails
        db = await load_db_async()
        db.append(data)
        async with db_lock:
             with open(JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(db, f, ensure_ascii=False, indent=2)
    
    await state.clear()
    await message.answer("Дякуємо! Ваша заявка надіслана на модерацію. Ми повідомимо вас, коли ваш профіль стане активним.")
    
    # Сповіщення адміну
    if ADMIN_ID:
        kb = [
            [InlineKeyboardButton(text="✅ Схвалити", callback_data=f"approve_{data['id']}")],
            [InlineKeyboardButton(text="❌ Відхилити", callback_data=f"reject_{data['id']}")]
        ]
        await bot.send_message(
            ADMIN_ID, 
            f"🆕 **Нова заявка спеціаліста!**\n\n"
            f"👤 {data['name']}\n"
            f"🗂 Категорія: {data['category']}\n"
            f"📍 {data['address']}\n"
            f"📞 {data['phone']}\n"
            f"🎁 {data['discount']}",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=kb),
            parse_mode="Markdown"
        )

# --- АДМІН-ЛОГІКА ---
@dp.callback_query(F.data.startswith("approve_"))
async def approve_specialist(callback: types.CallbackQuery):
    spec_id = callback.data.replace("approve_", "")
    
    # Оновлюємо статус в SQL
    db_manager.update_specialist_status(spec_id, 'verified')
    
    await callback.message.edit_text(callback.message.text + "\n\n✅ **СХВАЛЕНО** (Очікуємо фото та документи від спеціаліста)")
    
    # Отримуємо ID спеціаліста
    user_id = int(spec_id.replace("user_", "").split("_")[0])
    
    # Налаштовуємо стан для спеціаліста, щоб він міг завантажити фото
    state_spec = dp.fsm.resolve_context(bot, message_thread_id=None, chat_id=user_id, user_id=user_id)
    await state_spec.set_state(Registration.photo)
    await state_spec.update_data(spec_db_id=spec_id)
    
    try:
        await bot.send_message(
            user_id, 
            "🎉 Ваш профіль попередньо схвалено!\n\n"
            "📸 Тепер, будь ласка, надішліть ваше **фото** для профілю на порталі."
        )
    except Exception:
        pass
    await callback.answer()

@dp.message(Registration.photo, F.photo)
async def process_photo(message: types.Message, state: FSMContext):
    photo = message.photo[-1]
    file_info = await bot.get_file(photo.file_id)
    
    data = await state.get_data()
    spec_id = data.get("spec_db_id", f"user_{message.from_user.id}")
    
    photo_path = f"media/photos/{spec_id}.jpg"
    
    # Переконуємось, що папка для фото існує
    os.makedirs(os.path.dirname(photo_path), exist_ok=True)
    
    await bot.download_file(file_info.file_path, photo_path)
    
    try:
        # Оновлюємо шлях у SQLite базі
        db_manager.update_specialist_documents(spec_id, {
            "photo_path": photo_path
        })
        logging.info(f"✅ Photo path for specialist {spec_id} updated in SQL.")
    except Exception as e:
        logging.error(f"❌ Error updating photo path in SQL: {e}")
    
    await state.set_state(Registration.document)
    await message.answer(
        "✅ Фото збережено!\n\n"
        "📄 Останній крок: надішліть ваш **диплом або ліцензію у форматі PDF** для внутрішньої перевірки."
    )

@dp.message(Registration.document, F.document)
async def process_document(message: types.Message, state: FSMContext):
    if not message.document.file_name.lower().endswith('.pdf'):
        await message.answer("❌ Будь ласка, надішліть файл саме у форматі **PDF**.")
        return
        
    doc = message.document
    file_info = await bot.get_file(doc.file_id)
    
    data = await state.get_data()
    spec_id = data.get("spec_db_id", f"user_{message.from_user.id}")
    
    doc_path = f"media/documents/{spec_id}.pdf"
    
    # Переконуємось, що папка для документів існує
    os.makedirs(os.path.dirname(doc_path), exist_ok=True)
    
    await bot.download_file(file_info.file_path, doc_path)
    
    try:
        # 1. Зчитуємо та шифруємо вміст файлу
        import crypto_utils
        with open(doc_path, "rb") as f:
            file_bytes = f.read()
            
        encrypted_bytes = crypto_utils.encrypt_file(file_bytes)
        enc_doc_path = doc_path + ".enc"
        
        with open(enc_doc_path, "wb") as f:
            f.write(encrypted_bytes)
            
        # Видаляємо оригінальний нешифрований файл з диску
        if os.path.exists(doc_path):
            os.remove(doc_path)
            
        # 2. Оновлюємо інформацію в SQLite базі (це автоматично оновить JSON бекап)
        db_manager.update_specialist_documents(spec_id, {
            "document_path": enc_doc_path,
            "doc_diploma_enc": enc_doc_path,
            "status": "verified"
        })
        logging.info(f"✅ Document for specialist {spec_id} encrypted and saved to SQL.")
    except Exception as e:
        logging.error(f"❌ Error encrypting/saving specialist document: {e}")
        # Якщо виникла помилка, все ж спробуємо оновити статус
        db_manager.update_specialist_status(spec_id, 'verified')
    
    await state.clear()
    await message.answer(
        "🎊 Вітаємо! Всі дані отримано. Ваш профіль тепер повністю активовано та додано на портал.\n\n"
        "Дякуємо за вашу службу та підтримку ветеранів!"
    )
    
    # Також робимо фінальну синхронізацію з GitHub
    import subprocess
    try:
        subprocess.run(
            'Copy-Item -Path "data/specialists.json" -Destination "../../Novy-Shlyakh-Portal-Repo/backend/data/" -Force ; cd "../../Novy-Shlyakh-Portal-Repo" ; git add . ; git commit -m "Final activation: Specialist docs uploaded" ; git push origin main',
            shell=True, check=False, executable="powershell.exe"
        )
    except Exception:
        pass

@dp.callback_query(F.data.startswith("reject_"))
async def reject_specialist(callback: types.CallbackQuery):
    spec_id = callback.data.replace("reject_", "")
    db = await load_db_async()
    
    # Видаляємо з бази
    new_db = [s for s in db if s.get("id") != spec_id]
    await save_db_async(new_db)
    
    await callback.message.edit_text(callback.message.text + "\n\n❌ **ВІДХИЛЕНО** (Заявку видалено)")
    
    # Повідомлення користувачу
    user_id = spec_id.replace("user_", "").split("_")[0]
    try:
        await bot.send_message(user_id, "⚠️ На жаль, ваш профіль не пройшов модерацію. Перевірте правильність заповнення даних та спробуйте ще раз.")
    except Exception:
        pass
    await callback.answer()

# --- ОСОБИСТІ КАБІНЕТИ ПАРТНЕРІВ ---
@dp.message(F.text == "👤 Мій Кабінет")
async def show_cabinet_handler(message: types.Message, state: FSMContext, user_id=None):
    db = await load_db_async()
    uid = str(user_id if user_id else message.from_user.id)
    partner = next((s for s in db if str(s.get("tg_id")) == uid or s.get("id", "").startswith(f"user_{uid}")), None)
    
    if not partner:
        await message.answer("Ваш профіль не знайдено.")
        return
        
    await route_partner_cabinet(message, partner, state)

async def route_partner_cabinet(message: types.Message, partner: dict, state: FSMContext = None):
    role = partner.get("role", "specialist")
    
    if state:
        await state.update_data(return_context=f"cabinet_{role}")
    
    if role == "ngo":
        await show_ngo_cabinet(message, partner)
    elif role == "state":
        await show_state_cabinet(message, partner)
    else:
        # specialist, partner fallback
        await show_specialist_cabinet(message, partner)

async def show_specialist_cabinet(message: types.Message, spec: dict):
    status_emoji = "✅" if spec.get("status") == "verified" else "⏳"
    status_text = "Верифіковано" if spec.get("status") == "verified" else "На модерації"
    
    text = (
        f"👨‍⚕️ **Кабінет Спеціаліста**\n\n"
        f"Статус: {status_emoji} {status_text}\n"
        f"ПІБ: {spec.get('name')}\n"
        f"Категорія: {spec.get('category')}\n\n"
        "Тут ви можете переглядати звернення від ветеранів, бачити свій рейтинг та оновлювати послуги."
    )
    
    import time
    timestamp = int(time.time())
    kb = [
        [KeyboardButton(text="📩 Мої звернення"), KeyboardButton(text="✏️ Редагувати профіль")],
        [KeyboardButton(text="💰 Звітувати про оплату (25%)")]
    ]
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True), parse_mode="Markdown")

async def show_ngo_cabinet(message: types.Message, spec: dict):
    status_emoji = "✅" if spec.get("status") == "verified" else "⏳"
    status_text = "Верифіковано" if spec.get("status") == "verified" else "На модерації"
    
    text = (
        f"💚 **Кабінет ГО / БФ / Спонсора**\n\n"
        f"Статус: {status_emoji} {status_text}\n"
        f"Організація: {spec.get('name')}\n\n"
        "Тут ви можете переглядати партнерські угоди, пожертви та статистику."
    )
    
    import time
    timestamp = int(time.time())
    kb = [
        [KeyboardButton(text="🤝 Партнерські угоди"), KeyboardButton(text="📊 Статистика")],
        [KeyboardButton(text="✏️ Редагувати профіль")]
    ]
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True), parse_mode="Markdown")

async def show_state_cabinet(message: types.Message, spec: dict):
    status_emoji = "✅" if spec.get("status") == "verified" else "⏳"
    status_text = "Верифіковано" if spec.get("status") == "verified" else "На модерації"
    
    text = (
        f"🏛️ **Кабінет Державної Установи**\n\n"
        f"Статус: {status_emoji} {status_text}\n"
        f"Установа: {spec.get('name')}\n\n"
        "Тут ви можете обробляти інформаційні запити та переглядати статус меморандумів."
    )
    
    import time
    timestamp = int(time.time())
    kb = [
        [KeyboardButton(text="📜 Меморандуми"), KeyboardButton(text="✉️ Запити ветеранів")],
        [KeyboardButton(text="✏️ Редагувати профіль")]
    ]
    await message.answer(text, reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True), parse_mode="Markdown")

@dp.message(F.text == "❌ Видалити профіль")
async def delete_profile_btn(message: types.Message):
    kb = [
        [InlineKeyboardButton(text="✅ Так, видалити", callback_data="delete_profile_final")],
        [InlineKeyboardButton(text="🔙 Скасувати", callback_data="to_cabinet")]
    ]
    await message.answer("⚠️ Ви впевнені, що хочете видалити свій профіль? Цю дію неможливо скасувати.", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))

# ══════════════════════════════════════════════════════════════════
# КАБІНЕТНІ КНОПКИ — ХЕНДЛЕРИ (раніше були «мертвими»)
# ══════════════════════════════════════════════════════════════════

@dp.message(F.text == "📩 Мої звернення")
async def my_requests_handler(message: types.Message):
    """Спеціаліст переглядає звернення від ветеранів зі своєї БД."""
    db = await load_db_async()
    uid = str(message.from_user.id)
    spec = next((s for s in db if str(s.get("tg_id")) == uid or
                 s.get("id", "").startswith(f"user_{uid}")), None)
    if not spec:
        await message.answer("Профіль спеціаліста не знайдено.")
        return

    conn = db_manager.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT v.name, v.phone, l.created_at, l.status
        FROM intake_logs l
        JOIN veterans v ON l.veteran_id = v.id
        WHERE l.specialist_id = ?
        ORDER BY l.created_at DESC LIMIT 10
    ''', (spec['id'],))
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        await message.answer(
            "📭 Поки що звернень від ветеранів не було.\n\n"
            "Переконайтесь, що ваш профіль **верифіковано** та видимий на порталі.",
            parse_mode="Markdown"
        )
        return

    text = "📩 **Останні звернення ветеранів:**\n\n"
    for row in rows:
        name = row['name'] or "Анонімний ветеран"
        date_str = row['created_at'][:10] if row['created_at'] else "—"
        status_icon = "✅" if row['status'] == 'completed' else "⏳"
        text += f"{status_icon} {name} — {date_str}\n"
    text += "\n_Для зв'язку скористайтесь контактом у профілі ветерана._"
    await message.answer(text, parse_mode="Markdown")


@dp.message(F.text == "✏️ Редагувати профіль")
async def edit_profile_btn_handler(message: types.Message):
    """Bridge: ReplyKeyboard → InlineKeyboard (хендлер edit_profile вже є)."""
    kb = [[InlineKeyboardButton(text="✏️ Перейти до редагування", callback_data="edit_profile")]]
    await message.answer(
        "Оберіть, що ви хочете змінити у своєму профілі 👇",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb)
    )


@dp.message(F.text == "💰 Звітувати про оплату (25%)")
async def report_payment_btn_handler(message: types.Message):
    """Bridge: ReplyKeyboard → InlineKeyboard (хендлер report_payment вже є)."""
    kb = [[InlineKeyboardButton(text="💰 Розпочати звітування", callback_data="report_payment")]]
    await message.answer(
        "📊 **Звітування про оплату (25% внесок)**\n\n"
        "Після надання послуги ветерану ви зобов'язані перерахувати **25%** від "
        "отриманої суми на статутну діяльність ГО «Талан ЮА».\n\n"
        "Натисніть кнопку нижче, щоб вказати суму та надіслати квитанцію:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb),
        parse_mode="Markdown"
    )


@dp.message(F.text == "🤝 Партнерські угоди")
async def ngo_agreements_handler(message: types.Message):
    """Кнопка кабінету ГО / БФ — інформація про партнерські угоди."""
    await message.answer(
        "🤝 **Партнерські угоди**\n\n"
        "Для перегляду або підписання нового партнерського меморандуму зверніться "
        "до координатора проєкту «Новий Шлях»:\n\n"
        "📧 Email: ngo.talan.ua@gmail.com\n"
        "🆘 Або скористайтесь: /support\n\n"
        "_Укладені угоди відображаються в офісі ГО «Талан ЮА»._",
        parse_mode="Markdown"
    )


@dp.message(F.text == "📊 Статистика")
async def ngo_stats_handler(message: types.Message):
    """Кнопка кабінету ГО / БФ — загальна статистика порталу."""
    try:
        conn = db_manager.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as total FROM intake_logs")
        total_intakes = cursor.fetchone()['total']
        cursor.execute("SELECT COUNT(*) as cnt FROM specialists WHERE status='verified'")
        active_specs = cursor.fetchone()['cnt']
        cursor.execute("SELECT COUNT(*) as cnt FROM veterans WHERE name IS NOT NULL")
        veterans_count = cursor.fetchone()['cnt']
        conn.close()
    except Exception:
        total_intakes = 0
        active_specs = 0
        veterans_count = 0

    await message.answer(
        "📊 **Статистика порталу «Новий Шлях»**\n\n"
        f"🧑‍⚕️ Верифікованих спеціалістів: **{active_specs}**\n"
        f"🎖️ Зареєстрованих ветеранів: **{veterans_count}**\n"
        f"📩 Всього звернень: **{total_intakes}**\n\n"
        "_Дані оновлюються в режимі реального часу._",
        parse_mode="Markdown"
    )


@dp.message(F.text == "📜 Меморандуми")
async def state_memorandums_handler(message: types.Message):
    """Кнопка кабінету Держустанови — інформація про меморандуми."""
    await message.answer(
        "📜 **Меморандуми про співпрацю**\n\n"
        "Для укладання або ознайомлення з меморандумом про співпрацю між "
        "вашою установою та ГО «Талан ЮА» зверніться до керівництва організації:\n\n"
        "📧 Email: ngo.talan.ua@gmail.com\n"
        "🆘 Техпідтримка: /support",
        parse_mode="Markdown"
    )


@dp.message(F.text == "✉️ Запити ветеранів")
async def state_vet_requests_handler(message: types.Message):
    """Кнопка кабінету Держустанови — переглянути запити ветеранів у регіоні."""
    try:
        conn = db_manager.get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT region, raion, needs, created_at
            FROM regional_requests
            ORDER BY created_at DESC LIMIT 10
        ''')
        rows = cursor.fetchall()
        conn.close()
    except Exception:
        rows = []

    if not rows:
        await message.answer(
            "📭 Наразі запитів від ветеранів у системі не зафіксовано.\n\n"
            "_Нові звернення з'являться тут після того, як ветерани заповнять анкету._",
            parse_mode="Markdown"
        )
        return

    text = "✉️ **Останні запити ветеранів у регіоні:**\n\n"
    for row in rows:
        region = row['region'] or "—"
        needs = row['needs'] or "не вказано"
        date_str = row['created_at'][:10] if row['created_at'] else "—"
        text += f"• {region} | {needs} ({date_str})\n"
    text += "\n_Для отримання деталей зверніться до ГО «Талан ЮА»._"
    await message.answer(text, parse_mode="Markdown")

# ══════════════════════════════════════════════════════════════════

@dp.callback_query(F.data == "delete_profile_confirm")
async def delete_profile_confirm(callback: types.CallbackQuery):
    kb = [
        [InlineKeyboardButton(text="✅ Так, видалити", callback_data="delete_profile_final")],
        [InlineKeyboardButton(text="🔙 Скасувати", callback_data="to_cabinet")]
    ]
    await callback.message.edit_text("⚠️ Ви впевнені, що хочете видалити свій профіль? Цю дію неможливо скасувати.", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))

@dp.callback_query(F.data == "delete_profile_final")
async def delete_profile_final(callback: types.CallbackQuery):
    # Виконуємо анонімізацію в SQLite та видалення файлів
    db_manager.anonymize_specialist(str(callback.from_user.id))
    await callback.message.edit_text("✅ Ваш профіль успішно видалено (анонімізовано). Дякуємо за співпрацю!")
    await callback.answer()

@dp.callback_query(F.data == "to_cabinet")
async def to_cabinet(callback: types.CallbackQuery):
    await callback.message.delete()
    await show_cabinet(callback.message, user_id=callback.from_user.id)
    await callback.answer()

@dp.callback_query(F.data == "edit_profile")
async def edit_profile_menu(callback: types.CallbackQuery):
    kb = [
        [InlineKeyboardButton(text="👤 Змінити ПІБ", callback_data="edit_name")],
        [InlineKeyboardButton(text="📍 Змінити адресу", callback_data="edit_address")],
        [InlineKeyboardButton(text="📝 Оновити біо", callback_data="edit_bio")],
        [InlineKeyboardButton(text="🎁 Змінити пільги", callback_data="edit_discount")],
        [InlineKeyboardButton(text="❌ Видалити профіль", callback_data="delete_profile_confirm")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="to_cabinet")]
    ]
    await callback.message.edit_text("Оберіть, що ви хочете змінити:", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))
    await callback.answer()

@dp.callback_query(F.data == "delete_profile_confirm")
async def delete_profile_confirm(callback: types.CallbackQuery):
    kb = [
        [InlineKeyboardButton(text="✅ Так, видалити", callback_data="delete_profile_final")],
        [InlineKeyboardButton(text="🔙 Скасувати", callback_data="edit_profile")]
    ]
    await callback.message.edit_text(
        "⚠️ Ви впевнені, що хочете **видалити свій профіль**?\n\n"
        "🗑️ Цю дію неможливо скасувати. Усі ваші дані будуть видалені.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb),
        parse_mode="Markdown"
    )
    await callback.answer()

@dp.callback_query(F.data.startswith("edit_"))
async def start_edit_field(callback: types.CallbackQuery, state: FSMContext):
    field = callback.data.replace("edit_", "")
    await state.update_data(editing_field=field)
    await state.set_state(Registration.edit_value)
    
    # Отримуємо поточне значення з бази
    db = await load_db_async()
    user_id_str = str(callback.from_user.id)
    spec = next((s for s in db if str(s.get("tg_id")) == user_id_str or s.get("id", "").startswith(f"user_{user_id_str}")), {})
    current_value = spec.get(field, "не вказано")
    
    prompts = {
        "name": "Ваше поточне ПІБ",
        "address": "Ваша поточна адреса",
        "bio": "Ваш поточний опис",
        "discount": "Ваші поточні пільги"
    }
    
    field_label = prompts.get(field, "Поточне значення")
    text = f"📝 **{field_label}**: \n`{current_value}`\n\nВведіть нове значення або натисніть 'Скасувати' 👇"
    
    kb = [[InlineKeyboardButton(text="🔙 Скасувати", callback_data="edit_profile")]]
    await callback.message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb), parse_mode="Markdown")
    await callback.answer()

@dp.message(Registration.edit_value)
async def process_edit_value(message: types.Message, state: FSMContext):
    data = await state.get_data()
    field = data.get("editing_field")
    new_value = message.text
    
    # Валідація
    is_valid, error_msg = validate_text(new_value)
    if not is_valid:
        await message.answer(error_msg)
        return
        
    db = await load_db_async()
    user_id_str = str(message.from_user.id)
    for s in db:
        if str(s.get("tg_id")) == user_id_str or s.get("id", "").startswith(f"user_{user_id_str}"):
            s[field] = new_value
            s["status"] = "pending" # Відправляємо на повторну модерацію
            break
    await save_db_async(db)
    
    await state.clear()
    await message.answer("✅ Дані оновлено! Ваша анкета відправлена на повторну модерацію.")
    await show_cabinet(message, user_id=message.from_user.id)
    
    # Сповіщення адміну з кнопками
    spec_id = None
    for s in db:
        if str(s.get("tg_id")) == user_id_str or s.get("id", "").startswith(f"user_{user_id_str}"):
            spec_id = s.get("id")
            break
            
    kb = [
        [InlineKeyboardButton(text="✅ Схвалити зміни", callback_data=f"approve_{spec_id}")],
        [InlineKeyboardButton(text="❌ Відхилити", callback_data=f"reject_{spec_id}")],
        [InlineKeyboardButton(text="💬 Зв'язатися", url=f"tg://user?id={message.from_user.id}")]
    ]
    
    await bot.send_message(
        ADMIN_ID, 
        f"🔔 **Спеціаліст оновив дані!**\n\n"
        f"👤 Фахівець: {message.from_user.full_name}\n"
        f"📝 Поле: `{field}`\n"
        f"🆕 Нове значення: {new_value}",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=kb),
        parse_mode="Markdown"
    )

@dp.message(F.text == "🛡️ Адмін-панель")
async def show_admin_panel(message: types.Message):
    if str(message.from_user.id).strip() != str(ADMIN_ID).strip():
        return
        
    db = await load_db_async()
    total = len(db)
    verified = len([s for s in db if s.get("status") == "verified"])
    pending = len([s for s in db if s.get("status") == "pending"])
    
    # Статистика кліків
    clicks = 0
    try:
        with open("data/stats.json", "r", encoding="utf-8") as f:
            stats = json.load(f)
            clicks = len(stats)
    except Exception:
        pass
        
    text = (
        "📊 **Статистика Порталу**\n\n"
        f"👥 Усього спеціалістів: {total}\n"
        f"✅ Верифіковано: {verified}\n"
        f"⏳ Очікують перевірки: {pending}\n"
        f"📞 Запитів на контакти: {clicks}\n\n"
        "Оберіть дію нижче 👇"
    )
    
    kb = [
        [InlineKeyboardButton(text="📑 База спеціалістів", callback_data="admin_export")],
        [InlineKeyboardButton(text="⏳ Переглянути чергу", callback_data="admin_queue")],
        [InlineKeyboardButton(text="📈 Детальна статистика", callback_data="admin_stats")]
    ]
    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb), parse_mode="Markdown")

@dp.callback_query(F.data == "admin_export")
async def admin_export(callback: types.CallbackQuery):
    if str(callback.from_user.id).strip() != str(ADMIN_ID).strip(): return
    
    import pandas as pd
    from aiogram.types import FSInputFile
    
    db = await load_db_async()
    if not db:
        await callback.answer("База порожня!", show_alert=True)
        return
        
    # Створюємо DataFrame та перейменовуємо колонки
    df = pd.DataFrame(db)
    
    # Обираємо та перейменовуємо важливі колонки
    cols_map = {
        "name": "ПІБ",
        "category": "Категорія",
        "address": "Адреса",
        "phone": "Телефон",
        "bio": "Біографія",
        "discount": "Знижки/Пільги",
        "status": "Статус"
    }
    
    # Додаємо відсутні колонки з порожнім значенням (захист від KeyError)
    for col in cols_map.keys():
        if col not in df.columns:
            df[col] = ""
    
    df = df[list(cols_map.keys())].rename(columns=cols_map)
    
    # Зберігаємо в Excel
    excel_path = "data/specialists_export.xlsx"
    df.to_excel(excel_path, index=False)
    
    file = FSInputFile(excel_path)
    await callback.message.answer_document(file, caption="Актуальна база спеціалістів (Excel) 📊")
    await callback.answer()

@dp.callback_query(F.data == "admin_queue")
async def admin_queue(callback: types.CallbackQuery):
    if str(callback.from_user.id) != ADMIN_ID: return
    db = await load_db_async()
    pending = [s for s in db if s.get("status") == "pending"]
    
    if not pending:
        await callback.answer("Черга порожня! 🎉", show_alert=True)
        return
        
    await callback.message.answer(f"🔎 Знайдено {len(pending)} нових заявок:")
    for s in pending:
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="✅ Схвалити", callback_data=f"approve_{s['id']}")],
            [InlineKeyboardButton(text="❌ Відхилити", callback_data=f"reject_{s['id']}")]
        ])
        await callback.message.answer(
            f"👤 {s['name']}\n🎓 {s['category']}\n📍 {s['address']}", 
            reply_markup=markup
        )
    await callback.answer()

@dp.callback_query(F.data == "admin_stats")
async def admin_stats(callback: types.CallbackQuery):
    if str(callback.from_user.id).strip() != str(ADMIN_ID).strip(): return
    
    db = await load_db_async()
    
    # 1. Розподіл за категоріями
    cat_counts = {}
    for s in db:
        cat = s.get("category", "інше")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        
    def get_cat_name(cat):
        names = {"legal": "⚖️ Юрист", "psychology": "🧠 Психолог", "rehab": "🦾 Реабілітація", "career": "💼 Кар'єра"}
        return names.get(cat, cat)
        
    cat_text = "\n".join([f"{get_cat_name(c)}: {count}" for c, count in cat_counts.items()])
    
    # 2. Популярність (з логів)
    click_stats = {}
    total_clicks = 0
    try:
        with open("data/stats.json", "r", encoding="utf-8") as f:
            stats = json.load(f)
            total_clicks = len(stats)
            for entry in stats:
                cat = entry.get("category", "інше")
                click_stats[cat] = click_stats.get(cat, 0) + 1
    except Exception:
        pass
        
    popular_text = "Даних про запити поки немає ⏳"
    if click_stats:
        popular_text = "\n".join([f"{get_cat_name(c)}: {count} запитів" for c, count in click_stats.items()])

    text = (
        "📈 **Детальна Аналітика Порталу**\n\n"
        "👥 **Мережа фахівців:**\n"
        f"{cat_text}\n\n"
        "🔥 **Популярність категорій:**\n"
        f"{popular_text}\n\n"
        f"🚀 **Загальна кількість звернень:** {total_clicks}\n\n"
        "Ці дані допоможуть вам планувати розвиток мережі! 🫡"
    )
    
    kb = [[InlineKeyboardButton(text="🔙 Назад до панелі", callback_data="to_admin_panel")]]
    await callback.message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb), parse_mode="Markdown")

@dp.callback_query(F.data == "to_admin_panel")
async def to_admin_panel(callback: types.CallbackQuery):
    await callback.message.delete()
    await show_admin_panel(callback.message)
    await callback.answer()

# ЗАПУСК
async def main():
    # ══════════════════════════════════════════
    # БІЧНА ПАНЕЛЬ (Persistent Menu) A + C
    # Варіант A: set_my_commands — список команд через кнопку "/"
    # Варіант C: MenuButtonCommands — ☰ у верхньому лівому куті відкриває цей список
    # ══════════════════════════════════════════
    static_commands = [
        BotCommand(command="portal",  description="🌐 Портал"),
        BotCommand(command="news",    description="📰 Новини та Оголошення"),
        BotCommand(command="start",   description="🏠 Головне меню"),
        BotCommand(command="cabinet", description="👤 Мій кабінет"),
        BotCommand(command="support", description="🆘 Техпідтримка"),
    ]
    await bot.set_my_commands(static_commands, scope=BotCommandScopeDefault())

    # Кнопка ☰ (ліворуч від поля вводу) відкриває список команд (/support, /portal, /start, /cabinet)
    await bot.set_chat_menu_button(menu_button=MenuButtonCommands())

    await dp.start_polling(bot)

@dp.message(Command("admin"))
async def cmd_admin_direct(message: types.Message):
    await show_admin_panel(message)

@dp.message(Command("cabinet"))
async def cmd_cabinet_direct(message: types.Message):
    await show_cabinet(message)

# ══════════════════════════════════════════
# КОМАНДИ БІЧНОЇ ПАНЕЛІ (Persistent Menu)
# ══════════════════════════════════════════

@dp.message(Command("support"))
async def cmd_support(message: types.Message, state: FSMContext):
    """Команда /support — аліас кнопки 🆘 Техпідтримка.
    Доступна з бічної панелі (☰) незалежно від поточного місця навігації.
    """
    await support_entry(message, state)

@dp.message(Command("portal"))
async def cmd_portal(message: types.Message):
    """Команда /portal — аліас кнопки 🌐 Перейти на Портал.
    Доступна з бічної панелі (☰) незалежно від поточного місця навігації.
    """
    await portal_redirect(message)

@dp.message(Command("news"))
async def cmd_news(message: types.Message):
    """Команда /news — новини та оголошення «Нового Шляху».
    Доступна з бічної панелі (☰) для всіх користувачів незалежно від ролі.
    Персоналізована версія: ветерани та зареєстровані користувачі
    отримують ту саму стрічку, але з підказкою про записи до спеціалістів.
    """
    await show_bot_news(message)

# --- ЛОГІКА ВІДГУКІВ (Feedback Loop) ---

@dp.message(Command("feedback"))
async def start_feedback(message: types.Message, state: FSMContext):
    """Початок опитування ветерана"""
    await message.answer(
        "🎖 Вітаємо! Нам важливо знати вашу думку про роботу наших спеціалістів.\n"
        "Будь ласка, оберіть фахівця, з яким ви спілкувалися, або введіть його ім'я:"
    )
    await state.set_state(Feedback.waiting_for_spec)

@dp.message(Feedback.waiting_for_spec)
async def process_feedback_spec(message: types.Message, state: FSMContext):
    await state.update_data(spec_name=message.text)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⭐", callback_data="rate_1"),
         InlineKeyboardButton(text="⭐⭐", callback_data="rate_2"),
         InlineKeyboardButton(text="⭐⭐⭐", callback_data="rate_3"),
         InlineKeyboardButton(text="⭐⭐⭐⭐", callback_data="rate_4"),
         InlineKeyboardButton(text="⭐⭐⭐⭐⭐", callback_data="rate_5")]
    ])
    
    await message.answer(
        f"1/3. **Якість допомоги**: Чи була консультація корисною?",
        reply_markup=keyboard,
        parse_mode="Markdown"
    )
    await state.set_state(Feedback.rating_quality)

@dp.callback_query(Feedback.rating_quality)
async def process_quality(callback: types.CallbackQuery, state: FSMContext):
    rating = callback.data.split("_")[1]
    await state.update_data(quality=rating)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👍 Добре", callback_data="eth_good"),
         InlineKeyboardButton(text="😐 Нейтрально", callback_data="eth_neut"),
         InlineKeyboardButton(text="👎 Погано", callback_data="eth_bad")]
    ])
    
    await callback.message.edit_text(
        f"2/3. **Відношення та Етика**: Наскільки комфортним було спілкування?",
        reply_markup=keyboard,
        parse_mode="Markdown"
    )
    await state.set_state(Feedback.rating_ethics)

@dp.callback_query(Feedback.rating_ethics)
async def process_ethics(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(ethics=callback.data)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Так, все чесно", callback_data="hon_yes"),
         InlineKeyboardButton(text="❌ Ні, умови змінилися", callback_data="hon_no")]
    ])
    
    await callback.message.edit_text(
        f"3/3. **Чесність**: Чи відповідали умови та ціна обіцяним на порталі?",
        reply_markup=keyboard,
        parse_mode="Markdown"
    )
    await state.set_state(Feedback.rating_honesty)

@dp.callback_query(Feedback.rating_honesty)
async def process_honesty(callback: types.CallbackQuery, state: FSMContext):
    await state.update_data(honesty=callback.data)
    await callback.message.edit_text("Дякуємо за ваш відгук! Ваша оцінка допоможе іншим ветеранам обрати найкращого спеціаліста. 🇺🇦")
    
    data = await state.get_data()
    logging.info(f"FEEDBACK RECEIVED: {data}")
    # Тут логіка збереження відгуку в БД та перерахунку рейтингу
    await state.clear()
# --- ФІНАНСОВА ЗВІТНІСТЬ (25% Внесок) ---

@dp.callback_query(F.data == "report_payment")
async def start_report_payment(callback: types.CallbackQuery, state: FSMContext):
    await callback.message.edit_text(
        "📊 **Звіт про оплату**\n\n"
        "Будь ласка, вкажіть загальну суму, яку ви отримали від клієнта (у гривнях).\n"
        "Система автоматично розрахує 25% внеску на статутну діяльність ГО.",
        parse_mode="Markdown"
    )
    await state.set_state(Financial.reporting_amount)
    await callback.answer()

@dp.message(Financial.reporting_amount)
async def process_payment_amount(message: types.Message, state: FSMContext):
    try:
        amount = float(message.text.replace(",", "."))
        contribution = amount * 0.25
        await state.update_data(amount=amount, contribution=contribution)
        
        text = (
            f"✅ **Розрахунок завершено**\n\n"
            f"Сума оплати: {amount} грн\n"
            f"Внесок ГО (25%): **{contribution:.2f} грн**\n\n"
            f"Будь ласка, перерахуйте внесок за реквізитами ГО:\n"
            f"`IBAN: UA000000000000000000000000` (Приклад)\n\n"
            f"Після оплати надішліть **скріншот квитанції** сюди 👇"
        )
        await message.answer(text, parse_mode="Markdown")
        await state.set_state(Financial.uploading_receipt)
    except ValueError:
        await message.answer("❌ Будь ласка, введіть число (наприклад, 1000).")

@dp.message(Financial.uploading_receipt, F.photo)
async def process_receipt(message: types.Message, state: FSMContext):
    data = await state.get_data()
    amount = data.get("amount")
    contribution = data.get("contribution")
    
    # Зберігаємо квитанцію (логіка аналогічна документам)
    photo = message.photo[-1]
    file_info = await bot.get_file(photo.file_id)
    receipt_path = f"media/receipts/{message.from_user.id}_{int(time.time())}.jpg"
    if not os.path.exists("media/receipts"): os.makedirs("media/receipts")
    await bot.download_file(file_info.file_path, receipt_path)
    
    # Логуємо фінансову операцію
    log_entry = {
        "timestamp": int(time.time()),
        "user_id": message.from_user.id,
        "amount": amount,
        "contribution": contribution,
        "receipt": receipt_path,
        "status": "pending_verification"
    }
    
    finance_path = "data/finance.json"
    try:
        if not os.path.exists("data"): os.makedirs("data")
        if not os.path.exists(finance_path):
            with open(finance_path, "w", encoding="utf-8") as f:
                json.dump([], f)
        
        with open(finance_path, "r+", encoding="utf-8") as f:
            records = json.load(f)
            records.append(log_entry)
            f.seek(0)
            json.dump(records, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    await message.answer(
        "🙏 **Дякуємо за внесок!**\n\n"
        "Ваша підтримка допомагає нам розвивати портал та допомагати іншим ветеранам.\n"
        "Квитанція надіслана на модерацію. Ваш рейтинг активності буде підвищено! 🚀",
        parse_mode="Markdown"
    )
    await state.clear()


import asyncio

async def schedule_followup(user_id, specialist_name):
    # Mocking a 3-day follow-up with a 10-second delay for testing
    await asyncio.sleep(10)
    try:
        await bot.send_message(
            user_id, 
            f"🤖 Привіт! Минуло 3 дні після вашого метчу зі спеціалістом ({specialist_name}).\n\nЯк ваше самопочуття? Чи вдалося вирішити вашу проблему? Напишіть мені, якщо потрібна додаткова підтримка."
        )
    except Exception as e:
        logging.error(f"Followup failed: {e}")

# ══════════════════════════════════════════
# AI MATCHMAKING — Powered by OpenAI GPT-4o
# ══════════════════════════════════════════

CAT_LABELS = {
    "legal":      "⚖️ Юрист",
    "psychology": "🧠 Психолог",
    "rehab":      "🦾 Реабілітолог",
    "career":     "💼 Кар'єра / Бізнес",
}

async def transcribe_voice(file_path: str) -> str:
    """Транскрибує голосове повідомлення через OpenAI Whisper."""
    try:
        from openai import AsyncOpenAI
        oai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        with open(file_path, "rb") as audio_file:
            result = await oai.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="uk"
            )
        return result.text
    except Exception as e:
        logging.error(f"Whisper transcription error: {e}")
        return ""

async def ai_analyze_request(query: str, specialists: list) -> dict:
    """
    Надсилає запит ветерана до GPT-4o.
    Повертає JSON:
    {
        "categories": ["psychology", "legal"],   // відсортовані за релевантністю
        "summary": "Коротко: опис запиту",       // що GPT зрозумів
        "matches": [
            {"id": "ід_спеціаліста", "score": 92, "reason": "пояснення"},
        ]
    }
    """
    try:
        from openai import AsyncOpenAI
        oai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Формуємо каталог спеціалістів для GPT
        spec_catalog = json.dumps(
            [
                {
                    "id": s.get("id"),
                    "name": s.get("name"),
                    "category": s.get("category"),
                    "role": s.get("role", ""),
                    "bio": (s.get("bio") or "")[:200],  # обрізаємо для токен-ефективності
                    "address": s.get("address", ""),
                    "discount": s.get("discount", ""),
                }
                for s in specialists
            ],
            ensure_ascii=False
        )

        system_prompt = (
            "Ти — розумний AI-диспетчер ветеранського порталу 'Новий Шлях' (Черкаси, Україна).\n"
            "Твоя задача: проаналізувати запит ветерана і підібрати 1-2 найкращих спеціалістів із наданого каталогу.\n"
            "Категорії: legal (юридична), psychology (психологічна), rehab (реабілітаційна), career (кар'єра/бізнес).\n"
            "ВАЖЛИВО: відповідай ТІЛЬКИ валідним JSON без markdown-блоків, без пояснень поза JSON.\n"
            "Формат відповіді:\n"
            "{\"summary\": \"Коротко (1 речення) що потрібно ветерану\","
            "\"categories\": [\"назва_категорії\"],"
            "\"matches\": [{\"id\": \"id спеца\", \"score\": 0-100, \"reason\": \"пояснення чому саме він підходить (1-2 речення)\"}]}"
        )

        user_prompt = (
            f"Запит ветерана:\n\"{query}\"\n\n"
            f"Каталог верифікованих спеціалістів:\n{spec_catalog}"
        )

        response = await oai.chat.completions.create(
            model="gpt-4o-mini",  # оптимальний баланс ціна/якість
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=600,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        return json.loads(raw)

    except Exception as e:
        logging.error(f"AI matchmaking error: {e}")
        return {}


@dp.callback_query(F.data == "ai_matchmaking")
async def start_ai_matchmaking(callback: types.CallbackQuery, state: FSMContext):
    await callback.message.delete()
    kb = [[KeyboardButton(text="❌ Скасувати пошук")]]
    await callback.message.answer(
        "🤖 **Розумний підбір (AI)**\n\n"
        "Опишіть своїми словами, яка допомога вам потрібна.\n\n"
        "_Наприклад:_\n"
        "• «Маю проблеми зі сном і тривогу після служби»\n"
        "• «Потрібно оскаржити статус інваліда у суді»\n"
        "• «Хочу відкрити власний бізнес, не знаю з чого почати»\n\n"
        "Також можна надіслати 🎙️ **голосове повідомлення**.",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)
    )
    await state.set_state(AIMatchmaking.waiting_for_query)
    await callback.answer()


@dp.message(AIMatchmaking.waiting_for_query, F.text == "❌ Скасувати пошук")
async def cancel_ai_matchmaking(message: types.Message, state: FSMContext):
    await state.clear()
    await cmd_start(message)


@dp.message(AIMatchmaking.waiting_for_query)
async def process_ai_query(message: types.Message, state: FSMContext):
    query_text = ""

    # ── Голосове повідомлення → Whisper ──
    if message.voice:
        processing_msg = await message.answer("🎙️ Розпізнаю голосове повідомлення")
        try:
            file_info = await bot.get_file(message.voice.file_id)
            with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
                tmp_path = tmp.name
            await bot.download_file(file_info.file_path, tmp_path)
            query_text = await transcribe_voice(tmp_path)
            os.unlink(tmp_path)

            if not query_text:
                await processing_msg.delete()
                await message.answer(
                    "❌ Не вдалося розпізнати голос. Будь ласка, напишіть текстом."
                )
                return
            await processing_msg.edit_text(f"✅ *Розпізнано:* _{query_text}_", parse_mode="Markdown")
        except Exception as e:
            logging.error(f"Voice download error: {e}")
            await processing_msg.delete()
            await message.answer("❌ Помилка обробки голосу. Напишіть текстом.")
            return
    elif message.text:
        query_text = message.text
    else:
        await message.answer("Будь ласка, надішліть текст або голосове повідомлення.")
        return

    # ── Завантажуємо тільки верифікованих спеціалістів ──
    db = await load_db_async()
    verified_specs = [s for s in db if s.get("status") == "verified"]

    if not verified_specs:
        await message.answer(
            "😔 На жаль, наразі в базі немає верифікованих спеціалістів.\n"
            "Ми активно поповнюємо мережу — спробуйте пізніше!",
            reply_markup=ReplyKeyboardMarkup(
                keyboard=[[KeyboardButton(text="🎖️ Я Ветеран / Родина")]],
                resize_keyboard=True
            )
        )
        await state.clear()
        return

    # ── GPT-4o аналізує запит ──
    thinking_msg = await message.answer(
        "🧠 *ШІ аналізує ваш запит*\n"
        "_Це займе кілька секунд_",
        parse_mode="Markdown"
    )

    ai_result = await ai_analyze_request(query_text, verified_specs)

    await thinking_msg.delete()

    if not ai_result or not ai_result.get("matches"):
        # Fallback: показуємо список категорій
        await message.answer(
            "🔍 ШІ не зміг автоматично підібрати — оберіть категорію вручну:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="⚖️ Юрист",     callback_data="find_legal")],
                [InlineKeyboardButton(text="🧠 Психолог",  callback_data="find_psychology")],
                [InlineKeyboardButton(text="🦾 Реабілітація", callback_data="find_rehab")],
                [InlineKeyboardButton(text="💼 Кар'єра",   callback_data="find_career")],
            ])
        )
        await state.clear()
        return

    summary = ai_result.get("summary", "")
    matches = ai_result.get("matches", [])[:2]  # максимум 2 результати

    # ── Формуємо відповідь ──
    header = (
        "🎯 **Підбір завершено!**\n\n"
        f"📋 *ШІ зрозумів:* {summary}\n"
        "━━━━━━━━━━━━━━━━━━━━"
    )
    await message.answer(header, parse_mode="Markdown")

    # Формуємо словник спеців за ID для швидкого пошуку
    specs_by_id = {str(s.get("id")): s for s in verified_specs}

    for i, match in enumerate(matches, 1):
        spec = specs_by_id.get(str(match.get("id")))
        if not spec:
            continue

        score = match.get("score", 0)
        reason = match.get("reason", "")
        cat_label = CAT_LABELS.get(spec.get("category", ""), "🔷 Спеціаліст")

        # Індикатор відповідності
        bar_filled = int(score / 10)
        bar = "█" * bar_filled + "░" * (10 - bar_filled)

        card = (
            f"**{i}. {spec.get('name', 'Без імені')}**\n"
            f"{cat_label}\n"
            f"📊 Відповідність: `{bar}` {score}%\n"
            f"📍 {spec.get('address', 'Черкаси')}\n"
            f"🎁 Пільги: {spec.get('discount', 'Уточнюйте')}\n\n"
            f"💡 _{reason}_"
        )

        kb = [[
            InlineKeyboardButton(
                text="📞 Отримати контакти",
                callback_data=f"contact_{spec['id']}"
            )
        ]]
        await message.answer(
            card,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=kb)
        )

    # ── Повертаємо звичайну клавіатуру ──
    nav_kb = [
        [KeyboardButton(text="🔄 Новий пошук")],
        [KeyboardButton(text="⬅️ Повернутися до вибору ролі")],
    ]
    await message.answer(
        "⏱️ *ШІ-протокол турботи активовано:* через 3 дні я запитаю, чи вдалося вирішити питання.",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardMarkup(keyboard=nav_kb, resize_keyboard=True)
    )

    # ── Follow-up через 3 дні (259200 сек) ──
    spec_name = specs_by_id.get(str(matches[0].get("id")), {}).get("name", "спеціаліста") if matches else "спеціаліста"
    asyncio.create_task(schedule_followup(message.from_user.id, spec_name))

    await state.clear()


@dp.message(F.text == "🔄 Новий пошук")
async def new_ai_search(message: types.Message, state: FSMContext):
    """Повторний AI-пошук без повернення в головне меню."""
    kb = [[KeyboardButton(text="❌ Скасувати пошук")]]
    await message.answer(
        "🤖 Опишіть нову ситуацію або проблему:",
        reply_markup=ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)
    )
    await state.set_state(AIMatchmaking.waiting_for_query)


# ══════════════════════════════════════════
# ТЕХПІДТРИМКА (шІ-асистент)
# ══════════════════════════════════════════
@dp.message(F.text == "🆘 Техпідтримка")
async def support_entry(message: types.Message, state: FSMContext):
    """Перша точка входу в систему підтримки."""
    # Зберігаємо контекст повернення ДО переходу в support-стан
    current_data = await state.get_data()
    return_context = current_data.get("return_context", "start")
    await state.set_state(SupportDialog.choosing_option)
    # Відновлюємо збережений контекст після set_state (який скидає дані)
    await state.update_data(return_context=return_context)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💬 Почати діалог (ШІ-асистент)", callback_data="support_chat")],
        [InlineKeyboardButton(text="✉️ Написати на Email", callback_data="support_email")],
        [InlineKeyboardButton(text="❌ Скасувати", callback_data="support_cancel")],
    ])
    await message.answer(
        "🆘 *Технічна Підтримка — Портал «Новий Шлях»*\n\n"
        "Оберіть зручний варіант:\n\n"
        "💬 *Діалог з ШІ-асистентом* — відповість зазвичай протягом 30 сек.\n"
        "✉️ *Email* — ngo.talan.ua@gmail.com (до 2 роб. днів)",
        reply_markup=kb,
        parse_mode="Markdown"
    )



@dp.callback_query(F.data == "support_chat")
async def support_start_chat(callback: types.CallbackQuery, state: FSMContext):
    """Запускаємо діалог з ШІ."""
    await callback.message.edit_text(
        "🤖 *ШІ-асистент підтримки підключено.*\n\n"
        "Опишіть вашу проблему текстом. Я допоможу або передам звіт розробникам.\n"
        "_Щоб завершити діалог — натисніть кнопку нижче або напишіть /start_",
        parse_mode="Markdown"
    )
    # Зберігаємо сесію
    import uuid
    session_id = str(uuid.uuid4())
    # Читаємо return_context ДО set_state (щоб не загубити)
    prev_data = await state.get_data()
    saved_return_context = prev_data.get("return_context", "start")
    await state.set_state(SupportDialog.in_dialogue)
    await state.update_data(
        support_session_id=session_id,
        support_platform="bot",
        support_user_id=str(callback.from_user.id),
        support_bug_reported=False,
        return_context=saved_return_context,  # відновлюємо після set_state
    )
    # Надсилаємо нову клавіатуру, де ТІЛЬКИ одна кнопка виходу
    await callback.message.answer(
        "Напишіть ваше повідомлення:",
        reply_markup=ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="❌ Вийти з підтримки")]],
            resize_keyboard=True
        )
    )
    await callback.answer()


@dp.callback_query(F.data == "support_email")
async def support_show_email(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "✉️ *Офіційна Email підтримки:*\n\n"
        "`ngo.talan.ua@gmail.com`\n\n"
        "У листі вкажіть:\n"
        "• Опис проблеми\n"
        "• Скріншот помилки (якщо є)\n"
        "• Ваш Telegram ID: `{}`\n\n"
        "⤵️ Очікуйте відповідь до 2 робочих днів.".format(callback.from_user.id),
        parse_mode="Markdown"
    )
    await callback.answer()


@dp.callback_query(F.data == "support_cancel")
async def support_cancel(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text("❌ Підтримку скасовано.")
    # Відновлюємо повну клавіатуру меню
    await cmd_start(callback.message, state)
    await callback.answer()


from aiogram.filters import StateFilter

@dp.message(F.text.contains("Вийти з підтримки"))
async def support_global_exit(message: types.Message, state: FSMContext):
    """Глобальний вихід з техпідтримки — повертає туди, звідки зайшов."""
    current_data = await state.get_data()
    return_context = current_data.get("return_context", "start")

    await state.clear()
    
    if return_context == "veteran_menu":
        await message.answer("🚪 Повертаємося до меню послуг.", reply_markup=ReplyKeyboardRemove())
        await veteran_menu(message, state)
    elif return_context == "veteran_cabinet":
        await message.answer("🚪 Повертаємося до вашого кабінету.", reply_markup=ReplyKeyboardRemove())
        await show_vet_profile(message, state)
    elif return_context == "partner_menu":
        await message.answer("🚪 Повертаємося до реєстрації партнера.", reply_markup=ReplyKeyboardRemove())
        await spec_reg_start(message, state)
    elif return_context.startswith("cabinet_"):
        await message.answer("🚪 Повертаємося до вашого кабінету.", reply_markup=ReplyKeyboardRemove())
        # Імітуємо команду старт, яка завдяки новому коду автоматично перекине в кабінет
        await cmd_start(message, state)
    else:
        tmp = await message.answer("🚪 Повертаємося до головного меню.", reply_markup=ReplyKeyboardRemove())
        await tmp.delete()
        await cmd_start(message, state)

@dp.message(SupportDialog.in_dialogue)
async def support_handle_message(message: types.Message, state: FSMContext):
    """Обробка повідомлень у діалозі з ШІ-асистентом."""
    
    # Дозволяємо вихід через /start або ключові слова
    if message.text in ["/start", "вихід", "вийти", "exit", "❌ Вийти з підтримки"]:
        await support_global_exit(message, state)
        return

    data = await state.get_data()
    session_id = data.get("support_session_id", "unknown")
    user_id = str(message.from_user.id)

    # Показуємо статус друку
    typing_msg = await message.answer("🤖 Друкує")

    try:
        import aiohttp
        import json as _json

        # Звертаємось до локального API
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        payload = {
            "message": message.text,
            "session_id": session_id,
            "platform": "bot",
            "user_id": user_id,
            "page_url": "Телеграм-бот «Новий Шлях»",
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{backend_url}/api/support/chat",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                result = await resp.json()

        reply = result.get("reply", "Вибачте, відповідь не отримана. Спробуйте ще раз.")
        is_bug = result.get("is_system_bug", False)
        is_escalated = result.get("is_escalated", False)
        report_id = result.get("report_id")

        await typing_msg.delete()
        await message.answer(reply, parse_mode="Markdown")

        # Якщо баг зафіксовано і ще не запитували дані пристрою
        if is_bug and not data.get("support_bug_reported"):
            await state.update_data(support_bug_reported=True)
            await state.set_state(SupportDialog.waiting_device_info)
            await message.answer(
                "📱 Уточніть, будь ласка: який *пристрій* (телефон/планшет/комп'ютер) \n"
                "та який *браузер* ви використовуєте? (напр., _iPhone, Chrome_)",
                parse_mode="Markdown"
            )
            if report_id:
                await message.answer(f"📌 ID звіту: `{report_id}`", parse_mode="Markdown")

    except Exception as e:
        logging.error(f"Support bot handler error: {e}")
        await typing_msg.delete()
        await message.answer(
            "❗️ Без з'єднання з асистентом. \n"
            "Напишіть на ngo.talan.ua@gmail.com"
        )


@dp.message(SupportDialog.waiting_device_info)
async def support_collect_device(message: types.Message, state: FSMContext):
    """Отримуємо дані пристрою/браузер і додаємо до звіту."""
    data = await state.get_data()
    session_id = data.get("support_session_id", "unknown")
    user_id = str(message.from_user.id)
    device_info = message.text

    # Оновлюємо звіт з даними пристрою
    try:
        import aiohttp
        backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        payload = {
            "message": f"[DEVICE INFO] {device_info}",
            "session_id": session_id,
            "platform": "bot",
            "user_id": user_id,
            "device": device_info,
            "browser": device_info,
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{backend_url}/api/support/chat",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as resp:
                pass
    except Exception:
        pass

    await state.set_state(SupportDialog.in_dialogue)
    await message.answer(
        "✅ Дякую! Інформацію додано до технічного звіту.\n"
        "Проблему вирішатимуться якнайшвидше.\n\n"
        "Продовжуйте писати, якщо є інші запитання, \n"
        "або /start для повернення до меню."
    )


# ══════════════════════════════════════════
# CATCH-ALL: будь-яке невідоме повідомлення
# ══════════════════════════════════════════
@dp.message()
async def catch_all_handler(message: types.Message, state: FSMContext):
    """Спрацьовує на будь-яке повідомлення, яке не обробив жоден хендлер.
    Якщо є активний FSM-стан — не втручаємось.
    Якщо незнайомий/незареєстрований — показуємо стартове меню.
    Якщо відомий — нагадуємо про кнопки меню.
    """
    current_state = await state.get_state()
    if current_state is not None:
        # Є активний FSM (реєстрація, пошук тощо) — не чіпаємо
        return
    
    db = await load_db_async()
    user_id_str = str(message.from_user.id)
    is_specialist = any(
        str(s.get("tg_id")) == user_id_str or
        str(s.get("id", "")).startswith(f"user_{user_id_str}")
        for s in db
    )
    vet = db_manager.get_veteran(message.from_user.id)
    is_veteran = vet is not None and vet.get("name") is not None
    
    if is_veteran or is_specialist:
        # Відомий користувач — нагадуємо про кнопки
        await message.answer("Скористайся кнопками меню нижче 👇")
    else:
        # Новий або невідомий — показуємо вибір ролі
        kb = [
            [KeyboardButton(text="Ветеран / Родина")],
            [KeyboardButton(text="Партнер")],
        ]
        import time
        if str(message.from_user.id).strip() == str(ADMIN_ID).strip():
            kb.append([KeyboardButton(text="🛡️ Адмін-панель")])
        reply_markup = ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)
        await message.answer(
            "Вітаємо! Оберіть, будь ласка, хто ви:",
            reply_markup=reply_markup
        )


# ══════════════════════════════════════════
# ЗАПУСК (має бути в самому кінці файлу!)
# ══════════════════════════════════════════
if __name__ == "__main__":
    asyncio.run(main())
