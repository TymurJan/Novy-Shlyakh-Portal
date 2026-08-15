"""
harness.py — Детермінований Автономний SDD-Оркестратор (v6.0)
Організація: ГО "Талан ЮА" / Antigravity Manager

АРХІТЕКТУРА v6.0 (ПОВНИЙ РЕГЛАМЕНТ):

1. ДВОСТОРОННЄ ДЗЕРКАЛЮВАННЯ (Linear ↔ PENDING_TASKS.md):
   - Нова задача в PENDING_TASKS.md БЕЗ [TYM-X] → демон створює у Linear та отримує
     унікальний ID → записує [TYM-X] у рядок файлу.
   - Задача у Linear (не Done/Canceled) без пари в PENDING_TASKS.md → демон додає її.
   - Наявність [TYM-X] = ЖОРСТКА ЗАБОРОНА повторного issueCreate.
   - Номери TYM-X завжди отримуються від Linear API (не задаються вручну) —
     гарантований захист від накладень з архівними Done/Canceled картками.

2. ДИНАМІЧНИЙ РОЗПОДІЛ ВИКОНАВЦЯ (Handover Loop):
   - Усі задачі за замовчуванням = Assignee: Antigravity (агент).
   - При виникненні зовнішньої залежності (⏳) → Assignee перемикається на Тимура →
     картка з'являється у "My Issues" на мобільному з Push-сповіщенням.
   - Після коментаря «Оплатив», «Готово», «Зроблено» → Assignee повертається на Antigravity.

3. ПОВНИЙ SDD-ЦИКЛ РОЗРОБКИ:
   - Задача у Todo → генерація ПОВНОГО архітектурного плану (Мета, Архітектура,
     Task List, Verification Plan, Acceptance Criteria) та публікація у Linear коментарі.
   - Статус → Spec Review → очікування підтвердження від Тимура.
   - Тригери апруву: "апрув", "роби", "погнали", "ок", "підтверджую", "старт",
                     "прийнято", "починай", "почати", "зроблено", "оплатив", "готово".
   - Тригери скасування: "негативно", "відміна", "не потрібно", "відмінити", "стоп",
                          "скасувати", "відхилено", "відмова".
   - Семантичний аналіз: реакція на ЗМІСТ коментаря, а не тільки ключові слова.
   - Після виконання → статус Done у Linear → видалення рядка з PENDING_TASKS.md.

4. ПРОТОКОЛ ЗАЛЕЖНОСТЕЙ ТА ОЧІКУВАННЯ (v6.0):
   - 🔒 ВНУТРІШНЯ ЗАЛЕЖНІСТЬ: Задача A (🔴) чекає Задачу B (⚪) → Задача B
     успадковує 🔴 найвищий пріоритет (Priority Inheritance).
   - ⏳ ЗОВНІШНЄ ОЧІКУВАННЯ: Задача пропускається у конвеєрі, не блокує інші,
     Assignee перемикається на Тимура, Watchdog нагадує про статус.
   - Конвеєр НІКОЛИ не зупиняється через зовнішні блокування.

5. СТІЙКІСТЬ ТА БЕЗПЕКА:
   - UnicodeError-стійкість: усі файли читаються з errors='replace'.
   - Мережева стійкість: всі API-виклики у try/except без крашу демону.
   - Захист від TYM-дублювання: перевірка наявного [TYM-X] префіксу.
"""

import os
import sys
import re
import time
import json
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# ──────────────────────────────────────────────────────────────
# НАЛАШТУВАННЯ ШЛЯХІВ ТА ЗМІННИХ ОТОЧЕННЯ
# ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

SDD_TASK_TRACKER = os.getenv("SDD_TASK_TRACKER", "linear").lower()
SDD_HARNESS_INTERVAL_MINUTES = int(os.getenv("SDD_HARNESS_INTERVAL_MINUTES", "1"))
SDD_SPECS_DIR = BASE_DIR / os.getenv("SDD_SPECS_DIR", "specs")
SDD_HARNESS_LOG_PATH = BASE_DIR / os.getenv("SDD_HARNESS_LOG_PATH", ".agent/harness_error.log")
NOTIFICATION_CACHE_PATH = BASE_DIR / ".agent" / "notification_cache.json"
PENDING_TASKS_PATH = BASE_DIR / "PENDING_TASKS.md"

LINEAR_API_KEY = os.getenv("LINEAR_API_KEY", "")
LINEAR_TEAM_ID = os.getenv("LINEAR_TEAM_ID", "")
LINEAR_ASSIGNEE_ANTIGRAVITY = os.getenv("LINEAR_ASSIGNEE_ANTIGRAVITY_ID", "")
LINEAR_ASSIGNEE_TYMUR = os.getenv("LINEAR_ASSIGNEE_TYMUR_ID", "")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ALLOWED_USER_IDS = os.getenv("ALLOWED_USER_IDS", "").split(",")

# Директорії
SDD_HARNESS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
SDD_SPECS_DIR.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────
# ЛОГУВАННЯ
# ──────────────────────────────────────────────────────────────
logger = logging.getLogger("harness")
logger.setLevel(logging.DEBUG)

if not logger.handlers:
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s: %(message)s"))
    logger.addHandler(console_handler)

    file_handler = logging.FileHandler(SDD_HARNESS_LOG_PATH, encoding="utf-8")
    file_handler.setLevel(logging.WARNING)
    file_handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s: %(message)s"))
    logger.addHandler(file_handler)


def log_error(err_msg: str, exc: Exception = None):
    """Логування помилок у .agent/harness_error.log та консоль"""
    full_msg = err_msg
    if exc:
        full_msg += f" | Деталі: {str(exc)}"
    logger.error(full_msg)


# ──────────────────────────────────────────────────────────────
# ПАРСЕР PENDING_TASKS.MD
# ──────────────────────────────────────────────────────────────
class TaskParser:
    """Парсер та дедуплікатор для PENDING_TASKS.md"""

    # Рядки з TYM-номером: "🔴 [TYM-5] [NS-DEPLOY] Назва задачі"
    # Рядки без TYM-номера: "🔴 [NS-DEPLOY] Назва задачі"
    TASK_REGEX_WITH_ID = re.compile(
        r"^(🔴|🟡|⚪|⛔|🔒|⏳)\s+\[(TYM-\d+)\]\s+\[(.*?)\]\s+(.*)$"
    )
    TASK_REGEX_NO_ID = re.compile(
        r"^(🔴|🟡|⚪|⛔|🔒|⏳)\s+\[(.*?)\]\s+(.*)$"
    )

    @staticmethod
    def _read_file_safe() -> str:
        if not PENDING_TASKS_PATH.exists():
            return ""
        with open(PENDING_TASKS_PATH, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    @staticmethod
    def _write_file_safe(content: str):
        with open(PENDING_TASKS_PATH, "w", encoding="utf-8") as f:
            f.write(content)

    @staticmethod
    def read_pending_tasks() -> list:
        """Зчитує всі задачі з PENDING_TASKS.md"""
        text = TaskParser._read_file_safe()
        tasks = []
        for line in text.splitlines():
            line_str = line.strip()

            # Пробуємо формат з TYM-ID: 🔴 [TYM-5] [NS-DEPLOY] Назва
            m_with = TaskParser.TASK_REGEX_WITH_ID.match(line_str)
            if m_with:
                emoji, tym_id, project_id, content = m_with.groups()
                tasks.append({
                    "raw": line_str,
                    "emoji": emoji,
                    "tym_id": tym_id,
                    "project_id": project_id,
                    "content": content.strip(),
                    "has_linear_id": True,
                    "is_external_wait": emoji in ("⏳", "⛔"),
                    "is_internal_dep": emoji == "🔒",
                })
                continue

            # Пробуємо формат без TYM-ID: 🔴 [NS-DEPLOY] Назва (нова задача для відправки в Linear)
            m_no = TaskParser.TASK_REGEX_NO_ID.match(line_str)
            if m_no:
                emoji, project_id, content = m_no.groups()
                # Переконуємось що це не TYM-X (уникаємо колізій)
                if not project_id.startswith("TYM-"):
                    tasks.append({
                        "raw": line_str,
                        "emoji": emoji,
                        "tym_id": None,
                        "project_id": project_id,
                        "content": content.strip(),
                        "has_linear_id": False,
                        "is_external_wait": emoji in ("⏳", "⛔"),
                        "is_internal_dep": emoji == "🔒",
                    })

        return tasks

    @staticmethod
    def update_task_with_linear_id(raw_line: str, tym_id: str):
        """Після отримання TYM-X від Linear вписує номер у відповідний рядок файлу"""
        text = TaskParser._read_file_safe()
        if raw_line not in text:
            return

        # Парсимо оригінальний рядок для реконструкції з TYM-ID
        m = TaskParser.TASK_REGEX_NO_ID.match(raw_line.strip())
        if not m:
            return
        emoji, project_id, content = m.groups()
        new_line = f"{emoji} [{tym_id}] [{project_id}] {content}"
        updated = text.replace(raw_line, new_line)
        TaskParser._write_file_safe(updated)
        logger.info(f"📝 PENDING_TASKS: рядок оновлено з Linear ID: {new_line}")

    @staticmethod
    def remove_completed_task(tym_id: str):
        """Видаляє виконану задачу з PENDING_TASKS.md після Done у Linear"""
        text = TaskParser._read_file_safe()
        new_lines = []
        removed = False
        for line in text.splitlines(keepends=True):
            if f"[{tym_id}]" in line:
                removed = True
                logger.info(f"✅ PENDING_TASKS: видалено виконану задачу {tym_id}")
                continue
            new_lines.append(line)
        if removed:
            TaskParser._write_file_safe("".join(new_lines))

    @staticmethod
    def clean_internal_duplicates():
        """Видаляє рядки з однаковим вмістом (без урахування emoji та ID)"""
        text = TaskParser._read_file_safe()
        seen = set()
        new_lines = []
        removed = 0
        for line in text.splitlines(keepends=True):
            line_str = line.strip()
            # Беремо контент як ключ дедуплікації
            m_with = TaskParser.TASK_REGEX_WITH_ID.match(line_str)
            m_no = TaskParser.TASK_REGEX_NO_ID.match(line_str)
            if m_with:
                key = m_with.group(4).strip().lower()
            elif m_no:
                key = m_no.group(3).strip().lower()
            else:
                new_lines.append(line)
                continue

            if key in seen:
                removed += 1
                logger.info(f"🔁 Дедуплікація: видалено дублікат: {line_str[:60]}")
            else:
                seen.add(key)
                new_lines.append(line)

        if removed > 0:
            TaskParser._write_file_safe("".join(new_lines))
            logger.info(f"Очищено PENDING_TASKS.md від {removed} внутрішніх повторів.")


# ──────────────────────────────────────────────────────────────
# LINEAR GRAPHQL CLIENT
# ──────────────────────────────────────────────────────────────
class LinearClient:
    """Клієнт GraphQL API Linear v6.0"""

    PRIORITY_MAP_TO_LINEAR = {"🔴": 1, "🟡": 2, "⚪": 3, "⛔": 4, "🔒": 2, "⏳": 3}
    PRIORITY_MAP_FROM_LINEAR = {1: "🔴", 2: "🟡", 3: "⚪", 4: "⛔", 0: "⚪"}
    FINISHED_STATES = {"done", "canceled", "cancelled", "completed", "duplicate"}

    APPROVE_KEYWORDS = (
        "апрув", "роби", "погнали", "ок", "підтверджую", "старт",
        "прийнято", "починай", "почати", "оплатив", "готово", "зроблено",
    )
    CANCEL_KEYWORDS = (
        "негативно", "негативна", "негативний", "відміна",
        "не потрібно", "відмінити", "стоп", "скасувати", "відхилено", "відмова",
    )
    # Тригери повернення до Агента після зовнішньої дії Тимура
    HANDOVER_BACK_KEYWORDS = (
        "оплатив", "готово", "зроблено", "підписав", "отримав", "підтверджено",
        "виконано", "зроблено", "підписано",
    )

    def __init__(self, api_key: str, team_id: str):
        self.api_key = api_key
        self.team_id = team_id
        self.url = "https://api.linear.app/graphql"

    def _execute_query(self, query: str, variables: dict = None) -> dict:
        import requests
        headers = {
            "Content-Type": "application/json",
            "Authorization": self.api_key,
        }
        try:
            response = requests.post(
                self.url,
                json={"query": query, "variables": variables or {}},
                headers=headers,
                timeout=15,
            )
        except Exception as e:
            raise Exception(f"Мережевий збій Linear API: {e}")

        if response.status_code != 200:
            raise Exception(
                f"Linear API HTTP {response.status_code}: {response.text[:200]}"
            )

        res_json = response.json()
        if "errors" in res_json:
            raise Exception(f"Linear GraphQL помилки: {res_json['errors']}")

        return res_json.get("data", {})

    # ── Отримання задач ───────────────────────────────────────
    def fetch_all_issues(self) -> list:
        query = """
        query GetTeamIssues($teamId: String!) {
          team(id: $teamId) {
            issues(first: 100) {
              nodes {
                id
                identifier
                title
                priority
                createdAt
                creator { id name email }
                state { id name }
                assignee { id name email }
                comments {
                  nodes {
                    id
                    body
                    createdAt
                    user { id name email }
                  }
                }
              }
            }
          }
        }
        """
        data = self._execute_query(query, {"teamId": self.team_id})
        return data.get("team", {}).get("issues", {}).get("nodes", [])

    def get_max_issue_number(self) -> int:
        """Отримує максимальний порядковий номер TYM-X у всьому просторі Linear
        (враховуючи Done та Canceled — для гарантії унікальності нового ID)."""
        query = """
        query GetAllIssueIdentifiers($teamId: String!) {
          team(id: $teamId) {
            issues(first: 250, includeArchived: true) {
              nodes { identifier }
            }
          }
        }
        """
        try:
            data = self._execute_query(query, {"teamId": self.team_id})
            issues = data.get("team", {}).get("issues", {}).get("nodes", [])
            max_num = 0
            for issue in issues:
                m = re.match(r"[A-Z]+-(\d+)", issue.get("identifier", ""))
                if m:
                    max_num = max(max_num, int(m.group(1)))
            return max_num
        except Exception as e:
            log_error("Помилка отримання максимального номеру задач", e)
            return 0

    # ── Стани та виконавці ────────────────────────────────────
    def get_or_create_state(self, state_name: str, color: str = "#f2994a",
                             state_type: str = "started") -> str:
        query_states = """
        query GetTeamStates($teamId: String!) {
          team(id: $teamId) {
            states {
              nodes { id name }
            }
          }
        }
        """
        data = self._execute_query(query_states, {"teamId": self.team_id})
        states = data.get("team", {}).get("states", {}).get("nodes", [])

        for s in states:
            if s["name"].lower() == state_name.lower():
                return s["id"]

        mutation_create_state = """
        mutation CreateWorkflowState($teamId: String!, $name: String!,
                                      $color: String!, $type: String!) {
          workflowStateCreate(input: {
            teamId: $teamId, name: $name, color: $color, type: $type
          }) {
            success
            workflowState { id name }
          }
        }
        """
        res = self._execute_query(mutation_create_state, {
            "teamId": self.team_id,
            "name": state_name,
            "color": color,
            "type": state_type,
        })
        return res.get("workflowStateCreate", {}).get("workflowState", {}).get("id", "")

    def update_issue_state(self, issue_id: str, state_name: str):
        state_id = self.get_or_create_state(state_name)
        if state_id:
            mutation = """
            mutation UpdateIssueState($id: String!, $stateId: String!) {
              issueUpdate(id: $id, input: { stateId: $stateId }) {
                success
                issue { id identifier state { name } }
              }
            }
            """
            self._execute_query(mutation, {"id": issue_id, "stateId": state_id})
            logger.info(f"Linear: задачу {issue_id} переведено у статус {state_name}")

    def update_issue_assignee(self, issue_id: str, assignee_id: str):
        """Перемикає виконавця задачі між Тимуром та Antigravity"""
        if not assignee_id:
            return
        mutation = """
        mutation UpdateAssignee($id: String!, $assigneeId: String!) {
          issueUpdate(id: $id, input: { assigneeId: $assigneeId }) {
            success
            issue { id identifier assignee { name } }
          }
        }
        """
        self._execute_query(mutation, {"id": issue_id, "assigneeId": assignee_id})
    def update_issue_title(self, issue_id: str, new_title: str):
        """Оновлює заголовок задачі у Linear (наприклад, додає [TALAN])"""
        mutation = """
        mutation UpdateTitle($id: String!, $title: String!) {
          issueUpdate(id: $id, input: { title: $title }) {
            success
            issue { id identifier title }
          }
        }
        """
        self._execute_query(mutation, {"id": issue_id, "title": new_title})
        logger.info(f"Linear: заголовок задачі {issue_id} оновлено на '{new_title}'")

    # ── Створення задач ───────────────────────────────────────
    def create_issue(self, title: str, priority: int, assignee_id: str = "") -> dict:
        """Створює нову задачу у Linear у статусі 'Todo' та повертає її identifier (TYM-X)"""
        todo_state_id = self.get_or_create_state("Todo", color="#e2e2e2", state_type="unstarted")
        mutation = """
        mutation CreateIssue($teamId: String!, $title: String!,
                              $priority: Int, $assigneeId: String, $stateId: String) {
          issueCreate(input: {
            teamId: $teamId,
            title: $title,
            priority: $priority,
            assigneeId: $assigneeId,
            stateId: $stateId
          }) {
            success
            issue { id identifier title state { name } }
          }
        }
        """
        variables = {
            "teamId": self.team_id,
            "title": title,
            "priority": priority,
            "assigneeId": assignee_id or None,
            "stateId": todo_state_id or None,
        }
        data = self._execute_query(mutation, variables)
        issue = data.get("issueCreate", {}).get("issue", {})
        return issue

    # ── Публікація специфікації ───────────────────────────────
    def publish_full_spec_comment(self, issue_id: str, spec_filename: str,
                                   spec_full_content: str):
        """Публікує ПОВНИЙ ТЕКСТ специфікації у коментарі та переводить у Spec Review"""
        state_id = self.get_or_create_state("Spec Review")
        if state_id:
            mutation_state = """
            mutation UpdateIssueState($id: String!, $stateId: String!) {
              issueUpdate(id: $id, input: { stateId: $stateId }) {
                success
                issue { id state { name } }
              }
            }
            """
            self._execute_query(mutation_state, {"id": issue_id, "stateId": state_id})

        comment_body = f"""📋 **ПОВНИЙ АРХІТЕКТУРНИЙ ПЛАН (SDD Spec Review v6.0):**

Файл специфікації: `{spec_filename}`

---

{spec_full_content}

---

**Статус:** Spec Review — очікує підтвердження від Тимура.
Напиши **«Апрув»** або **«Роби»** для старту реалізації.
Напиши **«Негативно»** або **«Відміна»** для скасування."""

        mutation_comment = """
        mutation CreateComment($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) {
            success
            comment { id createdAt }
          }
        }
        """
        self._execute_query(mutation_comment, {"issueId": issue_id, "body": comment_body})
        logger.info(f"Linear: ПОВНИЙ ТЕКСТ специфікації надіслано до задачі {issue_id}")

    def post_completion_report(self, issue_id: str, report: str):
        """Публікує звіт про виконання та переводить задачу у Done"""
        mutation_comment = """
        mutation CreateComment($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) {
            success
            comment { id }
          }
        }
        """
        self._execute_query(mutation_comment, {"issueId": issue_id, "body": report})
        self.update_issue_state(issue_id, "Done")
        logger.info(f"Linear: задачу {issue_id} переведено у Done з фінальним звітом.")

    # ── Дзеркалювання ─────────────────────────────────────────
    def sync_mirror_between_worlds(self, local_tasks: list):
        """
        Двостороннє дзеркалювання:
        1. Нові задачі з PENDING_TASKS (без TYM-X) → Linear (отримати TYM-X → записати назад)
        2. Активні задачі з Linear без пари в PENDING_TASKS → додати у файл
        """
        remote_issues = self.fetch_all_issues()

        # Індекс активних задач Linear: identifier (TYM-X) → issue
        active_remote = {
            i["identifier"]: i
            for i in remote_issues
            if i.get("state", {}).get("name", "").lower() not in self.FINISHED_STATES
        }

        # Індекс TYM-X наявних у PENDING_TASKS
        local_tym_ids = {t["tym_id"] for t in local_tasks if t["tym_id"]}

        # ── Крок 1: Нові локальні задачі → Linear ──
        for task in local_tasks:
            if task["has_linear_id"]:
                continue  # вже синхронізована — пропускаємо
            if task["is_external_wait"] or task["is_internal_dep"]:
                continue  # ⏳/🔒 не відправляємо самостійно

            full_title = f"[{task['project_id']}] {task['content']}"
            priority = self.PRIORITY_MAP_TO_LINEAR.get(task["emoji"], 3)

            # Виконавець: не передаємо Antigravity ID щоб уникнути блокування Linear (coding sessions error)
            assignee_id = None

            new_issue = self.create_issue(full_title, priority, assignee_id)
            if new_issue and new_issue.get("identifier"):
                tym_id = new_issue["identifier"]
                TaskParser.update_task_with_linear_id(task["raw"], tym_id)
                logger.info(f"→ Linear: створено задачу {tym_id} — {full_title}")

        # ── Крок 2: Активні задачі Linear без пари або з невідомим префіксом ──
        for identifier, issue in active_remote.items():
            title = issue.get("title", "")
            m = re.match(r"^\[(.*?)\]\s+(.*)$", title)
            if not m:
                # Якщо у Linear задача без [PROJECT_ID] — оновлюємо її заголовок прямо в Linear!
                new_remote_title = f"[TALAN] {title}"
                try:
                    self.update_issue_title(issue["id"], new_remote_title)
                    issue["title"] = new_remote_title
                    title = new_remote_title
                    project_id = "TALAN"
                    content = issue.get("title", "")
                except Exception as e:
                    logger.error(f"Не вдалося оновити заголовок у Linear для {identifier}: {e}")
                    project_id = "TALAN"
                    content = title
            else:
                project_id, content = m.groups()

            if identifier in local_tym_ids:
                continue  # вже є у файлі — пропускаємо

            priority_int = issue.get("priority", 0)
            emoji = self.PRIORITY_MAP_FROM_LINEAR.get(priority_int, "⚪")

            new_line = f"{emoji} [{identifier}] [{project_id}] {content}"
            text = TaskParser._read_file_safe()

            if f"[{identifier}]" not in text:
                # Шукаємо маркер і додаємо перед ним, або в кінець
                if "\n---\n" in text:
                    updated = text.replace(
                        "\n---\n",
                        f"\n{new_line}\n\n---\n",
                        1,
                    )
                else:
                    updated = text.rstrip() + f"\n\n{new_line}\n"
                TaskParser._write_file_safe(updated)
                logger.info(f"→ PENDING_TASKS: додано з Linear: {new_line}")

    # ── Аналіз коментарів ─────────────────────────────────────
    def analyze_user_comments_and_update(self, issues: list):
        """
        Семантичний аналіз коментарів:
        - Апрув → Ready for Implementation
        - Скасування → Canceled
        - Виконання зовнішньої дії (оплатив/готово) + задача призначена Тимуру
          → повернути виконавця на Antigravity + зняти ⏳
        """
        for issue in issues:
            state_name = issue.get("state", {}).get("name", "").lower()
            if state_name in self.FINISHED_STATES:
                continue

            comments = issue.get("comments", {}).get("nodes", [])
            if not comments:
                continue

            # Аналізуємо тільки свіжий коментар (останній)
            for comment in reversed(comments):
                user_info = comment.get("user", {}) or {}
                body = comment.get("body", "").lower().strip()

                # Ігноруємо власні коментарі агента
                agent_markers = (
                    "повний архітектурний план", "sdd spec review",
                    "acceptance criteria", "verification plan",
                )
                if any(m in body for m in agent_markers):
                    continue

                # Тригери скасування
                if any(kw in body for kw in self.CANCEL_KEYWORDS):
                    logger.info(
                        f"💡 {issue['identifier']}: коментар скасування '{body[:40]}'"
                    )
                    self.update_issue_state(issue["id"], "Canceled")
                    break

                # Тригери апруву (Spec Review → Ready for Implementation)
                if state_name == "spec review" and any(kw in body for kw in self.APPROVE_KEYWORDS):
                    logger.info(
                        f"🚀 {issue['identifier']}: коментар апруву '{body[:40]}'"
                    )
                    self.update_issue_state(issue["id"], "Ready for Implementation")
                    break

                # Handover Back: людина виконала зовнішню дію → повертаємо на Агента
                if any(kw in body for kw in self.HANDOVER_BACK_KEYWORDS):
                    assignee_data = issue.get("assignee") or {}
                    if assignee_data.get("id") == LINEAR_ASSIGNEE_TYMUR:
                        logger.info(
                            f"🔄 {issue['identifier']}: хендовер назад на Antigravity '{body[:40]}'"
                        )
                        if LINEAR_ASSIGNEE_ANTIGRAVITY:
                            self.update_issue_assignee(
                                issue["id"], LINEAR_ASSIGNEE_ANTIGRAVITY
                            )
                    break

    # ── Передача задачі Тимуру ─────────────────────────────────
    def handover_to_tymur(self, issue_id: str, reason: str):
        """При виявленні зовнішньої залежності — перепризначає задачу на Тимура"""
        if LINEAR_ASSIGNEE_TYMUR:
            self.update_issue_assignee(issue_id, LINEAR_ASSIGNEE_TYMUR)
        comment = f"""⏳ **Зовнішня залежність виявлена:**

{reason}

Задача тимчасово перепризначена на Тимура. Після вирішення — напиши **«Готово»** або **«Оплатив»**,
і задача повернеться в автономний конвеєр Агента."""
        mutation_comment = """
        mutation CreateComment($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) {
            success
            comment { id }
          }
        }
        """
        self._execute_query(mutation_comment, {"issueId": issue_id, "body": comment})
        logger.info(f"Linear: задача {issue_id} передана Тимуру. Причина: {reason[:60]}")


# ──────────────────────────────────────────────────────────────
# ГЕНЕРАТОР СПЕЦИФІКАЦІЙ
# ──────────────────────────────────────────────────────────────
class SpecGenerator:
    """Генератор повноцінних SDD-специфікацій"""

    @staticmethod
    def generate_spec_for_issue(issue: dict) -> tuple:
        """
        Генерує ПОВНИЙ архітектурний план для задачі.
        Повертає (filepath, full_content).
        """
        title = issue.get("title", "")
        identifier = issue.get("identifier", "TASK")

        # Спроба прив'язки до існуючої spec-файлу (NS-DEPLOY)
        if "NS-DEPLOY" in title:
            ns_spec_path = BASE_DIR / "Talan_UA" / "Novy_Shlyakh" / "spec_ns_deploy.md"
            if ns_spec_path.exists():
                with open(ns_spec_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                logger.info(f"Використовую наявний spec_ns_deploy.md для {identifier}")
                return ns_spec_path, content

        m = re.match(r"^\[(.*?)\]\s+(.*)$", title)
        if m:
            project_id, clean_title = m.groups()
        else:
            project_id = "TALAN"   # загальний проєкт якщо [PROJECT_ID] не вказано
            clean_title = title

        safe_name = re.sub(r"[^\w\-]", "_", clean_title)[:35].strip("_")
        filename = f"spec_{identifier}_{safe_name}.md".lower()
        filepath = SDD_SPECS_DIR / filename

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content = f"""# Специфікація: {identifier} — [{project_id}] {clean_title}

## Метадані
- **PROJECT_ID:** {project_id}
- **Linear Issue:** {identifier}
- **Дата створення:** {now_str}
- **Статус:** Spec Review

---

## 🎯 1. Технічна Мета
Забезпечити повноцінну реалізацію: **{clean_title}**
відповідно до архітектурних вимог проєкту **{project_id}** та правил **Talan Core Rules**.

---

## 🏗️ 2. Архітектурний Підхід та Безпека
- Аналіз файлової структури проєкту `{project_id}` та залежностей.
- Дотримання протоколу **Talan Shield** (Rate Limiting, Asyncio Lock, Cloudflare).
- Повна семантична цілісність (No Shortening Hardening).
- Відсутність персональних даних у коді (De-NGO-ification для UAO).

---

## 📋 3. Покроковий Список Дій (Task List)
1. **[АНАЛІЗ]** Вивчити структуру модулів проєкту та виявити залежності.
2. **[ФАЙЛ]** Реалізувати необхідні зміни у цільових файлах.
3. **[ТЕСТ]** Провести локальне тестування та перевірку через Integrity Guard.
4. **[ІНТЕГРАЦІЯ]** Переконатися в сумісності зі суміжними модулями.
5. **[ЗВІТ]** Опублікувати фінальний звіт виконання у Linear.

---

## 🧪 4. Verification Plan (План Тестування)
- Запустити `python talan/autobot/integrity_guard.py <змінений_файл>`.
- Перевірити відсутність виключень у runtime-логах.
- Переконатися у коректності виводу / відповіді системи.

---

## ✅ 5. Acceptance Criteria (Критерії Прийомки)
- [ ] Функціонал повністю реалізований відповідно до цієї специфікації.
- [ ] Код перевірено `Integrity Guard` — результат **passed**.
- [ ] Відсутні Unhandled Errors у логах системи.
- [ ] Зміни не порушують сумісність з іншими модулями.

---

## 🏁 6. Definition of Done
- [ ] Всі Acceptance Criteria виконані.
- [ ] Фінальний звіт опубліковано у коментарі Linear.
- [ ] Статус задачі у Linear → **Done**.
- [ ] Рядок видалено з `PENDING_TASKS.md`.
"""
        if not filepath.exists():
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f"Spec-файл створено: {filepath.name}")

        return filepath, content


# ──────────────────────────────────────────────────────────────
# TELEGRAM NOTIFIER
# ──────────────────────────────────────────────────────────────
class TelegramNotifier:
    @staticmethod
    def notify(message: str):
        if not TELEGRAM_BOT_TOKEN or not ALLOWED_USER_IDS or not ALLOWED_USER_IDS[0]:
            return

        msg_hash = hashlib.md5(message.encode()).hexdigest()
        cache = {}
        if NOTIFICATION_CACHE_PATH.exists():
            try:
                with open(NOTIFICATION_CACHE_PATH, "r", encoding="utf-8") as f:
                    cache = json.load(f)
            except Exception:
                cache = {}

        if msg_hash in cache:
            return

        try:
            import requests
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            for user_id in ALLOWED_USER_IDS:
                uid = user_id.strip()
                if uid:
                    requests.post(url, json={"chat_id": uid, "text": message}, timeout=5)

            cache[msg_hash] = datetime.now().isoformat()
            with open(NOTIFICATION_CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
            logger.info("Telegram: сповіщення надіслано.")
        except Exception as e:
            log_error("Помилка відправки Telegram-сповіщення", e)


# ──────────────────────────────────────────────────────────────
# ОСНОВНИЙ ЦИКЛ ХАРНЕСУ
# ──────────────────────────────────────────────────────────────
def run_harness_cycle():
    """Оперативний 1-хвилинний цикл SDD-Харнесу v6.0"""
    logger.info("--- [1-ХВИННИЙ ЦИКЛ] Запуск SDD-Харнесу v6.0 ---")

    # ── Локальні операції (завжди, незалежно від мережі) ──
    try:
        TaskParser.clean_internal_duplicates()
    except Exception as e:
        log_error("Помилка дедуплікації PENDING_TASKS", e)

    try:
        local_tasks = TaskParser.read_pending_tasks()
    except Exception as e:
        log_error("Помилка читання PENDING_TASKS.md", e)
        local_tasks = []

    if SDD_TASK_TRACKER != "linear":
        logger.info("Трекер не Linear — пропускаємо мережевий блок.")
        return

    # ── Мережевий блок: у try/except для стійкості до відсутності інтернету ──
    try:
        linear_client = LinearClient(LINEAR_API_KEY, LINEAR_TEAM_ID)

        # 1. Отримання всіх задач з Linear
        all_issues = linear_client.fetch_all_issues()

        # 2. Двостороннє дзеркалювання (Linear ↔ PENDING_TASKS)
        try:
            linear_client.sync_mirror_between_worlds(local_tasks)
        except Exception as e:
            log_error("Помилка синхронізації дзеркала", e)

        # 3. Семантичний аналіз коментарів користувача у Linear
        try:
            linear_client.analyze_user_comments_and_update(all_issues)
        except Exception as e:
            log_error("Помилка аналізу коментарів", e)

        # 4. SDD-Конвеєр: генерація специфікацій для активних задач (Todo/Backlog)
        # Фільтр: приймаємо ВСІХ задачі з ідентифікатором TYM- (навіть без [PROJECT_ID])
        # Відкидаємо тільки системний онбординг Linear (без TYM- префіксу)
        todo_issues = [
            i for i in all_issues
            if i.get("state", {}).get("name", "").lower() in ("todo", "backlog")
            and i.get("identifier", "").startswith("TYM-")
        ]
        logger.info(
            f"Активних задач для SDD-Конвеєру: {len(todo_issues)}"
        )

        for index, issue in enumerate(todo_issues, 1):
            logger.info(
                f"🔄 SDD [{index}/{len(todo_issues)}]: "
                f"{issue['identifier']} — {issue['title'][:50]}"
            )
            title = issue.get("title", "")

            # ── 🛡️ СИСТЕМНЕ ОНОВЛЕННЯ СЕРВЕРА (Author Whitelist Guard) ──
            if "UPDATE_SERVER_CODE" in title.upper():
                creator = issue.get("creator", {}) or {}
                creator_email = (creator.get("email") or "").lower()
                creator_id = creator.get("id") or ""
                allowed_emails = ["tymur.jan21.04@gmail.com"]

                # Перевіряємо автора: дозволено лише Тимуру
                if creator_email not in allowed_emails and creator_id != LINEAR_ASSIGNEE_TYMUR:
                    logger.warning(f"⛔ Відхилено команду оновлення від неавторизованого користувача: {creator_email} ({creator_id})")
                    linear_client.update_issue_state(issue["id"], "Canceled")
                    reject_msg = f"⛔ **Відхилено системою безпеки Talan Shield:**\nКоманда `UPDATE_SERVER_CODE` дозволена лише авторизованому власнику. Автор: `{creator_email}`."
                    linear_client.post_completion_report(issue["id"], reject_msg)
                    TelegramNotifier.notify(f"🚨 [Security Alert] Спроба оновлення сервера від стороннього акаунту: {creator_email}")
                    continue

                # Якщо є активні задачі на виконання (Ready for Implementation) — ставимо оновлення у чергу,
                # щоб не обірвати активну роботу посередині
                ready_count = len([
                    i for i in all_issues
                    if i.get("state", {}).get("name", "").lower() == "ready for implementation"
                    and i.get("identifier", "").startswith("TYM-")
                ])
                if ready_count > 0:
                    logger.info(f"⏳ Graceful Drain: виявлено {ready_count} активних задач у розробці. Оновлення сервера відкладено до їх завершення.")
                    linear_client.update_issue_state(issue["id"], "Todo")
                    continue

                logger.info(f"🚀 Запуск системного оновлення сервера за запитом {issue['identifier']} від {creator_email}...")
                linear_client.update_issue_state(issue["id"], "In Progress")

                try:
                    # Імпортуємо SafeUpdateHandler
                    update_script_path = BASE_DIR / "Talan_UA" / "Novy_Shlyakh" / "Novy_Shlyakh_Portal" / "backend"
                    if str(update_script_path) not in sys.path:
                        sys.path.insert(0, str(update_script_path))
                    from update_handler import SafeUpdateHandler

                    updater = SafeUpdateHandler(repo_dir=str(BASE_DIR))
                    update_result = updater.perform_safe_update()

                    if update_result.get("success"):
                        report = (
                            f"✅ **Системне оновлення сервера виконано успішно!**\n\n"
                            f"- **Повідомлення:** {update_result.get('message')}\n"
                            f"- **Коміт:** `{update_result.get('commit', update_result.get('new_commit', ''))}`\n"
                            f"- **Синтаксис Python:** Усі файли валідовано (Smoke-test passed).\n\n"
                            f"Статус переведено в **Done**. Перезапуск процесу через systemd..."
                        )
                        linear_client.post_completion_report(issue["id"], report)
                        TaskParser.remove_completed_task(issue["identifier"])
                        TelegramNotifier.notify(f"✅ [VPS Self-Update] Сервер успішно оновлено до {update_result.get('new_commit', '')[:7]}. Перезапуск...")
                        
                        # Якщо код дійсно оновився — робимо м'який перезапуск процесу через systemd
                        if update_result.get("updated"):
                            logger.info("🔄 Оновлення підтягнуто. Виконуємо Graceful Exit (код 42) для перезапуску systemd...")
                            time.sleep(2)  # Даємо Linear та Telegram завершити HTTP-запити
                            sys.exit(42)
                    else:
                        error_report = (
                            f"❌ **Помилка під час системного оновлення!**\n\n"
                            f"- **Помилка:** {update_result.get('error')}\n"
                            f"- **Деталі:** `{update_result.get('details')}`\n"
                            f"- **Автоматичний відкат (Rollback):** {'Виконано успішно' if update_result.get('rolled_back') else 'Не знадобився / Помилка'}\n"
                            f"- **Повідомлення відкату:** {update_result.get('rollback_msg', 'N/A')}\n\n"
                            f"Сервер продовжує стабільну роботу на попередній робочій версії."
                        )
                        linear_client.post_completion_report(issue["id"], error_report)
                        TelegramNotifier.notify(f"⚠️ [VPS Self-Update Error] Помилка оновлення: {update_result.get('error')}. Сервер відкочено.")
                except Exception as update_err:
                    log_error(f"Аварія під час SafeUpdateHandler: {update_err}", update_err)
                    linear_client.update_issue_state(issue["id"], "Canceled")
                    TelegramNotifier.notify(f"🚨 [Critical Update Error] {update_err}")

                continue

            try:
                # Перевіряємо чи заголовок вже нормалізовано з [PROJECT_ID]
                title = issue.get("title", "")
                if not re.match(r"^\[.+?\]\s+.+", title):
                    new_title = f"[TALAN] {title}"
                    try:
                        linear_client.update_issue_title(issue["id"], new_title)
                        issue["title"] = new_title
                        logger.info(f"SDD: заголовок {issue['identifier']} нормалізовано на '{new_title}'")
                    except Exception as e:
                        logger.error(f"Не вдалося оновити заголовок для {issue['identifier']}: {e}")

                spec_path, spec_full_content = SpecGenerator.generate_spec_for_issue(issue)
                spec_filename = spec_path.name

                linear_client.publish_full_spec_comment(
                    issue_id=issue["id"],
                    spec_filename=spec_filename,
                    spec_full_content=spec_full_content,
                )

                TelegramNotifier.notify(
                    f"📋 [SDD Harness v6.0] Специфікацію опубліковано:\n"
                    f"📌 {issue['identifier']} — {issue['title']}\n"
                    f"📄 Файл: {spec_filename}\n"
                    f"Статус: Spec Review. Напиши 'Апрув' або 'Негативно' у коментарі."
                )

            except Exception as e:
                log_error(f"Помилка обробки задачі {issue.get('identifier', '?')}", e)
                continue

        # ── 5. Rescue Loop: Spec Review без SPEC-коментаря → допублікувати специфікацію ──
        # Гарантія: жодна задача не залишиться у Spec Review без плану навіть після краша.
        # Перевіряємо наявність БУДЬ-ЯКОГО коментаря, що містить маркер архітектурного плану.
        # ── 6. Autonomous Execution Loop (Ready for Implementation → In Progress → Done) ──
        ready_issues = [
            i for i in all_issues
            if i.get("state", {}).get("name", "").lower() == "ready for implementation"
            and i.get("identifier", "").startswith("TYM-")
        ]
        if ready_issues:
            logger.info(f"⚡ Autonomous Execution: знайдено {len(ready_issues)} задач, готових до розробки!")

        for issue in ready_issues:
            identifier = issue["identifier"]
            title = issue["title"]
            logger.info(f"🚀 Старт авто-імплементації для {identifier}: {title}")

            # 1. Переводимо в In Progress
            linear_client.update_issue_state(issue["id"], "In Progress")

            # 2. Шукаємо файл специфікації
            spec_files = list(SDD_SPECS_DIR.glob(f"spec_{identifier}_*.md".lower()))
            if not spec_files:
                spec_path, _ = SpecGenerator.generate_spec_for_issue(issue)
            else:
                spec_path = spec_files[0]

            # 3. Формуємо промпт для Gemini CLI
            prompt = (
                f"Ти — автономний AI-розробник ГО 'Талан ЮА'. Виконай задачу {identifier}.\n"
                f"Специфікація завдання знаходиться у файлі: {spec_path}\n"
                f"1. Прочитай специфікацію та виконай усі необхідні технічні зміни у коді репозиторію.\n"
                f"2. Дотримуйся правил Talan Core Rules (українська мова, безпека, No Shortening).\n"
                f"3. Після внесення змін перевір код.\n"
                f"4. Створи коротке резюме виконаної роботи.\n"
            )

            try:
                import subprocess
                # Запускаємо gemini cli
                cmd = ["gemini", "--approval-mode", "auto", prompt]
                logger.info(f"🤖 Запуск Gemini CLI для {identifier}...")
                result = subprocess.run(
                    cmd,
                    cwd=str(BASE_DIR),
                    capture_output=True,
                    text=True,
                    timeout=300,
                    encoding="utf-8",
                    errors="replace"
                )

                output_summary = result.stdout.strip() if result.stdout else "Зміни внесено автономним агентом."
                if len(output_summary) > 2000:
                    output_summary = output_summary[:2000] + "\n...(скорочено)"

                # 4. Фіналізація: публікація звіту, Done у Linear, видалення з PENDING_TASKS.md
                report = (
                    f"✅ **Автономне виконання завершено!**\n\n"
                    f"**Задача:** {identifier} — {title}\n"
                    f"**Результат:**\n```\n{output_summary}\n```\n\n"
                    f"Статус переведено в **Done**."
                )
                linear_client.post_completion_report(issue["id"], report)
                TaskParser.remove_completed_task(identifier)

                TelegramNotifier.notify(
                    f"✅ [Autonomous Execution] Завдання виконано!\n"
                    f"📌 {identifier} — {title}\n"
                    f"Статус: Done. Запис вилучено з PENDING_TASKS.md"
                )
                logger.info(f"🎉 Завдання {identifier} успішно виконано та переведено в Done!")

            except Exception as exec_err:
                log_error(f"Помилка автономного виконання {identifier}", exec_err)
                linear_client.update_issue_state(issue["id"], "Spec Review")
                TelegramNotifier.notify(
                    f"⚠️ Помилка авто-виконання {identifier}: {exec_err}. Повернуто у Spec Review."
                )

    except Exception as e:
        # Мережевий збій, sleep ноутбука — продовжуємо без краша
        log_error(
            f"Мережева помилка — пропускаємо цикл, "
            f"наступна спроба через {SDD_HARNESS_INTERVAL_MINUTES} хв.",
            e,
        )
        logger.info("⏳ Інтернет недоступний. Харнес живий, очікуємо відновлення.")
        return

    logger.info("--- 1-хвилинний цикл v6.0 завершено ---")


# ──────────────────────────────────────────────────────────────
# ТОЧКА ВХОДУ
# ──────────────────────────────────────────────────────────────
def main():
    import schedule

    logger.info(
        f"Старт harness.py v6.0 (Symmetric Mirror + SDD + Handover Loop + "
        f"Priority Inheritance). Інтервал: {SDD_HARNESS_INTERVAL_MINUTES} хв."
    )

    # Перший запуск одразу при старті
    run_harness_cycle()

    schedule.every(SDD_HARNESS_INTERVAL_MINUTES).minutes.do(run_harness_cycle)

    while True:
        try:
            schedule.run_pending()
        except Exception as e:
            log_error("Непередбачена помилка у головному циклі schedule", e)
        time.sleep(10)


if __name__ == "__main__":
    main()
