#!/usr/bin/env python3
"""
dev.py — ตัวช่วยติดตั้ง/รันโปรเจกต์แบบข้ามแพลตฟอร์ม (macOS / Windows / Linux)

ใช้ Python เป็นตัวกลางเพราะ backend ต้องมี Python อยู่แล้ว จึงไม่ต้องมีสคริปต์
แยกตาม OS (.sh / .ps1) ให้ดูแลซ้ำซ้อน

วิธีใช้:
    python dev.py setup     # ติดตั้ง dependencies (ครั้งแรกครั้งเดียว / หรือเวลาย้ายเครื่อง)
    python dev.py           # สตาร์ท backend (:8000) + frontend (:5173) พร้อมกัน
    python dev.py run       # เหมือนด้านบน
    python dev.py backend   # สตาร์ทเฉพาะ backend
    python dev.py frontend  # สตาร์ทเฉพาะ frontend

หยุดเซิร์ฟเวอร์: กด Ctrl+C (จะปิดทั้งสอง process พร้อมกัน)

หมายเหตุ: บน Windows ถ้า PowerShell บล็อกสคริปต์ ให้รันผ่าน  python dev.py ...
          ได้โดยตรง (ไม่ต้องตั้ง ExecutionPolicy เพราะไม่ใช่ไฟล์ .ps1)
"""
import os
import shutil
import signal
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
FRONTEND = os.path.join(ROOT, "frontend")
IS_WIN = os.name == "nt"

VENV_DIR = os.path.join(BACKEND, "venv")

# หา uv binary
UV = shutil.which("uv") or os.path.expanduser("~/.local/bin/uv")

# สี ANSI (บน Windows 10+ terminal รองรับอยู่แล้ว)
BOLD, GREEN, YELLOW, RED, RESET = "\033[1m", "\033[32m", "\033[33m", "\033[31m", "\033[0m"


def info(msg):
    print(f"{GREEN}==>{RESET} {BOLD}{msg}{RESET}", flush=True)


def warn(msg):
    print(f"{YELLOW}!  {msg}{RESET}", flush=True)


def die(msg):
    print(f"{RED}X  {msg}{RESET}", flush=True)
    sys.exit(1)


def venv_python():
    """path ของ python ใน virtualenv — ต่างกันระหว่าง Windows กับ Unix"""
    if IS_WIN:
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    return os.path.join(VENV_DIR, "bin", "python")


def bun_cmd(*args):
    """คำสั่ง bun ที่รันได้ทั้งสอง OS (ใช้ bun แทน npm เพราะ project ใช้ bun.lock)"""
    if IS_WIN:
        return ["cmd", "/c", "bun", *args]
    bun = shutil.which("bun") or os.path.expanduser("~/.bun/bin/bun")
    if not bun or not os.path.isfile(bun):
        die("ไม่พบ bun — ติดตั้งก่อน: curl -fsSL https://bun.sh/install | bash")
    return [bun, *args]


# ---------------------------------------------------------------------------
# setup — ติดตั้ง dependencies
# ---------------------------------------------------------------------------
def cmd_setup():
    info("ตรวจสอบเครื่องมือที่จำเป็น")

    # Python (เรารันอยู่ใน interpreter นี้แล้ว)
    if sys.version_info < (3, 11):
        die(f"ต้องใช้ Python 3.11 ขึ้นไป (เครื่องนี้ {sys.version.split()[0]})")
    print(f"   Python: {sys.executable} ({sys.version.split()[0]})")

    # Node / npm
    node = shutil.which("node")
    if not node:
        die("ไม่พบ Node.js — ติดตั้งก่อน: macOS 'brew install node' / Windows ดาวน์โหลดจาก nodejs.org (แนะนำ v20+)")
    node_ver = subprocess.run([node, "-v"], capture_output=True, text=True).stdout.strip()
    print(f"   Node: {node_ver}")
    try:
        node_major = int(node_ver.lstrip("v").split(".")[0])
        if node_major < 20:
            warn(f"แนะนำ Node 20 ขึ้นไป (เครื่องนี้ {node_ver}) — อาจมีปัญหากับ Vite 8 / Tailwind 4")
    except ValueError:
        pass

    # ----- Backend: uv venv + uv pip -----
    info("ตั้งค่า backend (Python)")
    if not UV:
        die("ไม่พบ uv — ติดตั้งก่อน: curl -LsSf https://astral.sh/uv/install.sh | sh")
    if not os.path.isdir(VENV_DIR):
        print("   สร้าง virtualenv ที่ backend/venv ด้วย uv")
        subprocess.run([UV, "venv", VENV_DIR, "--python", "3.11"], check=True)
    else:
        print("   ใช้ virtualenv เดิมที่ backend/venv")

    vpy = venv_python()
    print("   ติดตั้ง dependencies จาก requirements.txt ด้วย uv ...")
    subprocess.run([UV, "pip", "install", "-r",
                    os.path.join(BACKEND, "requirements.txt"),
                    "--python", vpy], check=True)

    # ----- Frontend: bun install -----
    info("ตั้งค่า frontend (Node)")
    nm = os.path.join(FRONTEND, "node_modules")
    if os.path.isdir(nm):
        print("   ลบ node_modules เดิม (อาจมี native binary ของ OS อื่น) เพื่อติดตั้งใหม่ให้ตรงเครื่อง")
        shutil.rmtree(nm, ignore_errors=True)
    print("   bun install ...")
    subprocess.run(bun_cmd("install"), cwd=FRONTEND, check=True)

    info("ติดตั้งเสร็จเรียบร้อย")
    print("\nเริ่มรันด้วย:  " + BOLD + "python dev.py" + RESET)
    print("แล้วเปิดเบราว์เซอร์ที่  http://localhost:5173")
    print("บัญชีทดสอบ: admin / admin1234\n")


# ---------------------------------------------------------------------------
# run — สตาร์ทเซิร์ฟเวอร์
# ---------------------------------------------------------------------------
def _spawn(cmd, cwd):
    """เปิด process ในกลุ่ม/เซสชันใหม่ เพื่อให้ปิดทั้ง tree ได้ตอน Ctrl+C"""
    kwargs = {"cwd": cwd}
    if IS_WIN:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    return subprocess.Popen(cmd, **kwargs)


def _terminate(proc):
    """ปิด process พร้อม child ทั้งหมด (uvicorn --reload / npm จะ spawn ลูกไว้)"""
    if proc is None or proc.poll() is not None:
        return
    try:
        if IS_WIN:
            # taskkill /T ปิดทั้ง process tree
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        proc.terminate()


def _check_setup():
    if not os.path.isfile(venv_python()):
        die("ยังไม่ได้ตั้งค่า backend — รัน  python dev.py setup  ก่อน")
    if not os.path.isdir(os.path.join(FRONTEND, "node_modules")):
        die("ยังไม่ได้ตั้งค่า frontend — รัน  python dev.py setup  ก่อน")


def cmd_backend_only():
    _check_setup()
    info("สตาร์ท backend  ->  http://localhost:8000  (Ctrl+C เพื่อหยุด)")
    proc = _spawn([venv_python(), "-m", "uvicorn", "main:app", "--reload", "--port", "8000"], BACKEND)
    try:
        proc.wait()
    except KeyboardInterrupt:
        _terminate(proc)


def cmd_frontend_only():
    _check_setup()
    info("สตาร์ท frontend ->  http://localhost:5173  (Ctrl+C เพื่อหยุด)")
    proc = _spawn(bun_cmd("run", "dev"), FRONTEND)
    try:
        proc.wait()
    except KeyboardInterrupt:
        _terminate(proc)


def cmd_run():
    _check_setup()
    info("สตาร์ท backend  ->  http://localhost:8000")
    backend = _spawn([venv_python(), "-m", "uvicorn", "main:app", "--reload", "--port", "8000"], BACKEND)

    info("สตาร์ท frontend ->  http://localhost:5173")
    frontend = _spawn(bun_cmd("run", "dev"), FRONTEND)

    print()
    info("ทั้งสองเซิร์ฟเวอร์กำลังทำงาน — เปิด  http://localhost:5173")
    print(f"   บัญชีทดสอบ: {BOLD}admin / admin1234{RESET}   (กด Ctrl+C เพื่อหยุดทั้งคู่)\n")

    try:
        # รอจนกด Ctrl+C หรือมีตัวใดตัวหนึ่งตาย
        while True:
            if backend.poll() is not None:
                warn("backend หยุดทำงาน — กำลังปิด frontend ด้วย")
                break
            if frontend.poll() is not None:
                warn("frontend หยุดทำงาน — กำลังปิด backend ด้วย")
                break
            try:
                backend.wait(timeout=1)
            except subprocess.TimeoutExpired:
                pass
    except KeyboardInterrupt:
        print()
        info("กำลังปิดเซิร์ฟเวอร์...")
    finally:
        _terminate(frontend)
        _terminate(backend)


# ---------------------------------------------------------------------------
def main():
    cmd = (sys.argv[1] if len(sys.argv) > 1 else "run").lower()
    actions = {
        "setup": cmd_setup,
        "run": cmd_run,
        "backend": cmd_backend_only,
        "frontend": cmd_frontend_only,
    }
    action = actions.get(cmd)
    if action is None:
        print(__doc__)
        die(f"ไม่รู้จักคำสั่ง '{cmd}'")
    action()


if __name__ == "__main__":
    main()
