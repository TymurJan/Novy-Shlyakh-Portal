"""
Talan Shield Protocol - Safe Self-Update Handler (Rollback & Smoke-Test Guard)
Автоматизоване та безпечне оновлення коду на VPS з захистом від падіння процесу.
"""

import os
import sys
import subprocess
import logging
from pathlib import Path
from typing import Tuple, Dict, Any

logger = logging.getLogger("SelfUpdateHandler")


class SafeUpdateHandler:
    def __init__(self, repo_dir: str = None):
        self.repo_dir = Path(repo_dir).resolve() if repo_dir else Path(__file__).resolve().parent.parent

    def _run_cmd(self, cmd: list, cwd: Path = None) -> Tuple[int, str, str]:
        """Виконує консольну команду з перехопленням виводу."""
        target_cwd = cwd or self.repo_dir
        try:
            res = subprocess.run(
                cmd,
                cwd=str(target_cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=120
            )
            return res.returncode, res.stdout.strip(), res.stderr.strip()
        except Exception as e:
            return 1, "", str(e)

    def get_current_commit(self) -> str:
        """Отримує поточний SHA коміту."""
        code, out, _ = self._run_cmd(["git", "rev-parse", "HEAD"])
        return out if code == 0 else "UNKNOWN"

    def pull_master(self) -> Tuple[bool, str]:
        """Виконує git fetch та git pull з гілки master."""
        code, out, err = self._run_cmd(["git", "pull", "origin", "master"])
        if code != 0:
            return False, f"Git pull failed: {err or out}"
        return True, out

    def verify_python_syntax(self) -> Tuple[bool, list]:
        """Перевіряє синтаксис усіх .py файлів у проєкті."""
        broken_files = []
        for py_file in self.repo_dir.rglob("*.py"):
            # Ігноруємо віртуальне середовище та системні теки
            if any(part in py_file.parts for part in [".venv", "venv", "__pycache__", ".git"]):
                continue
            code, out, err = self._run_cmd([sys.executable, "-m", "py_compile", str(py_file)])
            if code != 0:
                broken_files.append(f"{py_file.name}: {err or out}")
        
        if broken_files:
            return False, broken_files
        return True, []

    def rollback(self, target_commit: str) -> Tuple[bool, str]:
        """Відкочує репозиторій до вказаного коміту у разі аварії."""
        logger.warning(f"🔄 Відкат до коміту {target_commit}...")
        code, out, err = self._run_cmd(["git", "reset", "--hard", target_commit])
        if code != 0:
            return False, f"Rollback failed: {err or out}"
        return True, f"Успішно відкочено до {target_commit}"

    def perform_safe_update(self) -> Dict[str, Any]:
        """
        Повний цикл безпечного оновлення:
        1. Збереження поточної точки (rollback point)
        2. git pull origin master
        3. Перевірка синтаксису (Smoke test)
        4. Відкат, якщо виявлено поломку
        """
        previous_commit = self.get_current_commit()
        logger.info(f"Початковий коміт: {previous_commit}")

        # 1. Стягуємо master
        success, pull_msg = self.pull_master()
        if not success:
            return {
                "success": False,
                "error": "Git pull failed",
                "details": pull_msg,
                "rolled_back": False,
                "commit": previous_commit
            }

        new_commit = self.get_current_commit()
        if previous_commit == new_commit and "Already up to date" in pull_msg:
            return {
                "success": True,
                "updated": False,
                "message": "Репозиторій вже має найновішу версію (Already up to date).",
                "commit": new_commit
            }

        # 2. Перевірка синтаксису коду
        syntax_ok, errors = self.verify_python_syntax()
        if not syntax_ok:
            logger.error(f"❌ Виявлено помилки у коді після pull: {errors}")
            rb_ok, rb_msg = self.rollback(previous_commit)
            return {
                "success": False,
                "error": "Syntax Verification Failed",
                "details": errors,
                "rolled_back": rb_ok,
                "rollback_msg": rb_msg,
                "commit": previous_commit
            }

        # 3. Усе чисто
        return {
            "success": True,
            "updated": True,
            "message": f"Оновлено успішно: {previous_commit[:7]} ➔ {new_commit[:7]}",
            "previous_commit": previous_commit,
            "new_commit": new_commit,
            "pull_output": pull_msg
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    handler = SafeUpdateHandler()
    res = handler.perform_safe_update()
    print(res)
