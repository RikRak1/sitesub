import os
import subprocess
import sys
from pathlib import Path
import shutil

BACKEND_DIR = "backend"
VENV_NAME = ".venv"

def run_cmd(args, cwd=None, env=None):
    print("💻", " ".join(args), f"(cwd={cwd})" if cwd else "")
    subprocess.check_call(args, cwd=cwd, env=env)

def find_py311():
    if os.name == "nt":
        py = shutil.which("py")
        if py:
            try:
                subprocess.check_output([py, "-3.11", "--version"])
                return [py, "-3.11"]
            except Exception:
                pass
    if sys.version_info[:2] == (3, 11):
        return [sys.executable]
    cand = shutil.which("python3.11") or shutil.which("python311")
    if cand:
        return [cand]
    raise RuntimeError("Не найден Python 3.11. Установите его и повторите.")

def venv_python(venv_dir: Path):
    return venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")

def main():
    repo_root = Path(__file__).resolve().parent
    backend = repo_root / BACKEND_DIR
    assert backend.is_dir(), f"Не найдена папка {backend}"

    venv_dir = backend / VENV_NAME
    req_file = backend / "requirements.txt"

    py311 = find_py311()

    if not venv_dir.exists():
        run_cmd(py311 + ["-m", "venv", str(venv_dir)])
    else:
        print("✅ venv уже существует:", venv_dir)

    py = str(venv_python(venv_dir))

    # фиксируем инструменты сборки (wheel, pip, setuptools<81)
    try:
        run_cmd([py, "-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools<81"])
    except subprocess.CalledProcessError:
        print("⚠️ Не удалось обновить pip/wheel/setuptools — продолжаю.")

    # предпочитаем бинарные колёса
    env = os.environ.copy()
    env["PIP_PREFER_BINARY"] = "1"

    if req_file.exists():
        run_cmd([py, "-m", "pip", "install", "-r", str(req_file)], env=env)
    else:
        print(f"⚠️ {req_file} не найден — пропускаю установку.")

    # .gitignore
    gi = repo_root / ".gitignore"
    lines = [
        f"{BACKEND_DIR}/{VENV_NAME}/",
        f"{BACKEND_DIR}/__pycache__/",
        f"{BACKEND_DIR}/.pytest_cache/",
        f"{BACKEND_DIR}/*.pyc",
    ]
    existing = gi.read_text().splitlines() if gi.exists() else []
    changed = False
    with gi.open("a", encoding="utf-8") as f:
        for line in lines:
            if line not in existing:
                f.write(line + "\n"); changed = True
    print("🧹 Обновил .gitignore" if changed else "🧹 .gitignore уже ок")

    print("\n🎉 Готово! Активируйте окружение:")
    if os.name == "nt":
        print(rf"  {backend}\{VENV_NAME}\Scripts\activate")
    else:
        print(rf"  source {backend}/{VENV_NAME}/bin/activate")


if __name__ == "__main__":
    main()