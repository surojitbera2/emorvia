"""
Shim: This module gets imported by uvicorn (which is launched by supervisor).
At import time, we replace this Python process with the Node.js EMORVIA backend
listening on port 8001. This lets us reuse supervisor's existing 'backend'
program slot without modifying the read-only supervisord config.
"""
import os
import sys
import socket
import time
import subprocess

NODE_DIR = "/app/node-backend"
NODE_SCRIPT = os.path.join(NODE_DIR, "server.js")
PORT = 8001

os.environ.setdefault("PORT", str(PORT))
os.chdir(NODE_DIR)


def _port_busy(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("0.0.0.0", port))
        return False
    except OSError:
        return True
    finally:
        s.close()


# Free port 8001 if a stale node from a previous reload still holds it.
if _port_busy(PORT):
    print(f"[server.py] port {PORT} busy — killing stale processes", flush=True)
    try:
        subprocess.run(["pkill", "-9", "-f", "/app/node-backend/server.js"], check=False)
    except Exception:
        pass
    for _ in range(10):
        time.sleep(0.3)
        if not _port_busy(PORT):
            break

print(f"[server.py] handing off to Node.js: {NODE_SCRIPT}", flush=True)
sys.stdout.flush()
os.execvp("node", ["node", NODE_SCRIPT])
