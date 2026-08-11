#!/usr/bin/env python3
"""Cross-platform self-host launcher for STRATUM.

Usage examples:
  python stratum_bundle.py install
  python stratum_bundle.py up
  python stratum_bundle.py status
  python stratum_bundle.py logs --follow backend
  python stratum_bundle.py down
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import shlex
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

STATUS_URL = "http://127.0.0.1:8000/api/system/status"
CAPABILITIES_URL = "http://127.0.0.1:8000/api/capabilities"
CONFIG_DIR = Path.home() / ".stratum-bundle"
CONFIG_FILE = CONFIG_DIR / "config.json"
RUNTIME_DIR = CONFIG_DIR / "runtime"
RUNTIME_PROJECT_ROOT = RUNTIME_DIR / "project"
RUNTIME_PAYLOAD_VERSION_FILE = RUNTIME_DIR / ".payload_version"
BUNDLE_PAYLOAD_VERSION = "2026-04-24.4"

_runtime_project_root_override: Path | None = None


def _print(msg: str) -> None:
    print(f"[stratum-bundle] {msg}")


def _fail(msg: str, code: int = 1) -> None:
    _print(f"ERROR: {msg}")
    raise SystemExit(code)


def _load_saved_project_root() -> Path | None:
    try:
        if not CONFIG_FILE.exists():
            return None
        payload = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None

    path_value = payload.get("project_root")
    if not isinstance(path_value, str) or not path_value.strip():
        return None

    candidate = Path(path_value).expanduser().resolve()
    if _has_project_layout(candidate):
        return candidate
    return None


def _save_project_root(project_root: Path) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"project_root": str(project_root)}
    CONFIG_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _has_project_layout(root: Path) -> bool:
    return (
        (root / "selfhost-compose.yml").exists()
        and (root / "backend").exists()
        and (root / "frontend" / "stratum-app").exists()
        and (root / "frontend" / "dashboard").exists()
    )


def _possible_embedded_roots() -> list[Path]:
    roots: list[Path] = []
    if not getattr(sys, "frozen", False):
        return roots

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        roots.append(Path(meipass))

    exe_path = Path(sys.executable).resolve()
    roots.append(exe_path.parent)
    roots.append(exe_path.parent.parent)
    roots.append(exe_path.parent.parent.parent)

    if ".app/Contents/MacOS/" in exe_path.as_posix():
        contents_dir = exe_path.parent.parent
        roots.append(contents_dir / "Resources")
        roots.append(contents_dir / "Frameworks")

    unique: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        try:
            resolved = root.resolve()
        except Exception:
            continue
        resolved_str = str(resolved)
        if resolved_str in seen:
            continue
        seen.add(resolved_str)
        unique.append(resolved)

    return unique


def _resolve_embedded_project_root() -> Path | None:
    for root in _possible_embedded_roots():
        if _has_project_layout(root):
            return root
    return None


def _materialize_embedded_project_root() -> Path | None:
    embedded_root = _resolve_embedded_project_root()
    if embedded_root is None:
        return None

    current_version = ""
    if RUNTIME_PAYLOAD_VERSION_FILE.exists():
        try:
            current_version = RUNTIME_PAYLOAD_VERSION_FILE.read_text(encoding="utf-8").strip()
        except Exception:
            current_version = ""

    if _has_project_layout(RUNTIME_PROJECT_ROOT) and current_version == BUNDLE_PAYLOAD_VERSION:
        return RUNTIME_PROJECT_ROOT

    runtime_parent = RUNTIME_PROJECT_ROOT.parent
    runtime_parent.mkdir(parents=True, exist_ok=True)
    if RUNTIME_PROJECT_ROOT.exists():
        shutil.rmtree(RUNTIME_PROJECT_ROOT, ignore_errors=True)

    RUNTIME_PROJECT_ROOT.mkdir(parents=True, exist_ok=True)
    for relative in ["selfhost-compose.yml", "backend", "frontend"]:
        source = embedded_root / relative
        target = RUNTIME_PROJECT_ROOT / relative
        if not source.exists():
            continue
        if source.is_dir():
            shutil.copytree(source, target)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)

    if not _has_project_layout(RUNTIME_PROJECT_ROOT):
        return None

    RUNTIME_PAYLOAD_VERSION_FILE.write_text(BUNDLE_PAYLOAD_VERSION, encoding="utf-8")
    _save_project_root(RUNTIME_PROJECT_ROOT)
    return RUNTIME_PROJECT_ROOT


def _iter_project_root_candidates() -> list[Path]:
    candidates: list[Path] = []

    env_root = os.environ.get("STRATUM_BUNDLE_ROOT", "").strip()
    if env_root:
        candidates.append(Path(env_root).expanduser())

    if _runtime_project_root_override is not None:
        candidates.append(_runtime_project_root_override)

    cwd = Path.cwd()
    candidates.append(cwd)
    candidates.extend(cwd.parents)

    saved_root = _load_saved_project_root()
    if saved_root is not None:
        candidates.append(saved_root)

    materialized_root = _materialize_embedded_project_root()
    if materialized_root is not None:
        candidates.append(materialized_root)

    embedded_root = _resolve_embedded_project_root()
    if embedded_root is not None:
        candidates.append(embedded_root)

    if getattr(sys, "frozen", False):
        exe_path = Path(sys.executable).resolve()
        candidates.append(exe_path.parent)
        candidates.append(exe_path.parent.parent)
        candidates.append(exe_path.parent.parent.parent)

        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            candidates.append(Path(meipass))

        if ".app/Contents/MacOS/" in exe_path.as_posix():
            contents_dir = exe_path.parent.parent
            candidates.append(contents_dir / "Resources")
            candidates.append(contents_dir / "Frameworks")
    else:
        candidates.append(Path(__file__).resolve().parent)

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except Exception:
            continue
        resolved_str = str(resolved)
        if resolved_str in seen:
            continue
        seen.add(resolved_str)
        unique.append(resolved)

    return unique


def _resolve_project_root(*, strict: bool) -> Path | None:
    for candidate in _iter_project_root_candidates():
        if _has_project_layout(candidate):
            return candidate

    if strict:
        _fail(
            "Could not locate selfhost-compose.yml. "
            "Set STRATUM_BUNDLE_ROOT to your project root, use set-root, "
            "or rebuild the packaged binary so embedded project files are included."
        )
    return None


def _set_project_root(path: Path, *, persist: bool = True) -> Path:
    global _runtime_project_root_override

    resolved = path.expanduser().resolve()
    compose_file = resolved / "selfhost-compose.yml"
    if not compose_file.exists():
        _fail(f"No selfhost-compose.yml found at: {compose_file}")

    _runtime_project_root_override = resolved
    if persist:
        _save_project_root(resolved)

    return resolved


def _compose_file() -> Path:
    project_root = _resolve_project_root(strict=True)
    assert project_root is not None
    return project_root / "selfhost-compose.yml"


def _backend_env_file() -> Path:
    project_root = _resolve_project_root(strict=True)
    assert project_root is not None
    return project_root / "backend" / ".env"


def _find_compose_base_cmd() -> list[str]:
    if shutil.which("docker"):
        result = subprocess.run(
            ["docker", "compose", "version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if result.returncode == 0:
            return ["docker", "compose"]

    if shutil.which("docker-compose"):
        return ["docker-compose"]

    _fail(
        "Docker Compose is not available. Install Docker Desktop/Engine with Compose support."
    )


def _compose_cmd(*args: str) -> list[str]:
    return [*_find_compose_base_cmd(), "-f", str(_compose_file()), *args]


def _run(
    cmd: list[str],
    *,
    cwd: Path | None = None,
    capture: bool = False,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    _print("$ " + " ".join(cmd))
    default_cwd = _resolve_project_root(strict=False) or Path.cwd()
    return subprocess.run(
        cmd,
        cwd=cwd or default_cwd,
        text=True,
        capture_output=capture,
        check=check,
    )


def _random_secret() -> str:
    return secrets.token_urlsafe(32)


def _default_backend_env() -> str:
    # Every credential here is generated per install. Shipping fixed defaults
    # would put the admin password of every self-hosted deployment in this
    # public repo, and the maintainer account bypasses project permissions.
    postgres_user = "stratum_user"
    postgres_password = _random_secret()
    postgres_db = "stratum_db"
    minio_access = "stratum_minio_access"
    minio_secret = _random_secret()
    maintainer_password = _random_secret()

    return "\n".join(
        [
            "# Auto-generated by stratum_bundle.py",
            "AUTH_MODE=local",
            "DEPLOYMENT_MODE=self_hosted",
            "SELF_HOST_BUNDLE=true",
            f"POSTGRES_USER={postgres_user}",
            f"POSTGRES_PASSWORD={postgres_password}",
            f"POSTGRES_DB={postgres_db}",
            "POSTGRES_HOST=postgres",
            "POSTGRES_PORT=5432",
            f"DATABASE_URL=postgresql+psycopg://{postgres_user}:{postgres_password}@postgres:5432/{postgres_db}",
            "MINIO_ENDPOINT=minio:9000",
            f"MINIO_ACCESS_KEY={minio_access}",
            f"MINIO_SECRET_KEY={minio_secret}",
            "MINIO_BUCKET_NAME=stratum-files",
            "MINIO_USE_SSL=false",
            "MAINTAINER_EMAIL=maintainer@localhost",
            f"MAINTAINER_PASSWORD={maintainer_password}",
            "APP_SECRET_KEY=" + _random_secret(),
            "APP_DEBUG=False",
            "APP_HOST=0.0.0.0",
            "APP_PORT=8000",
            "ALLOWED_ORIGINS=http://localhost:19006,http://localhost:5173,http://localhost:8000",
            "JWT_SECRET_KEY=" + _random_secret(),
            "JWT_EXPIRATION_HOURS=24",
            "ENVIRONMENT=production",
            "",
        ]
    )


def _ensure_backend_env() -> None:
    backend_env_file = _backend_env_file()
    backend_dir = backend_env_file.parent
    if not backend_dir.exists():
        _fail(f"Backend directory not found: {backend_dir}")

    if backend_env_file.exists():
        return

    env_text = _default_backend_env()
    backend_env_file.write_text(env_text, encoding="utf-8")
    backend_env_file.chmod(0o600)
    _print(f"Created {backend_env_file} with freshly generated credentials")

    # The maintainer password is randomly generated, so show it once here.
    # There is no other way for the operator to learn it.
    for line in env_text.splitlines():
        if line.startswith(("MAINTAINER_EMAIL=", "MAINTAINER_PASSWORD=")):
            _print(f"  {line}")
    _print(f"  (stored in {backend_env_file}, keep it out of version control)")


def _http_get_json(url: str, timeout: float = 2.0) -> dict[str, Any] | None:
    try:
        with urlopen(url, timeout=timeout) as response:
            if response.status != 200:
                return None
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except (URLError, TimeoutError, ValueError, OSError):
        return None


def _wait_for_backend(timeout_seconds: int = 180) -> dict[str, Any] | None:
    start = time.time()
    while time.time() - start < timeout_seconds:
        status = _http_get_json(STATUS_URL, timeout=2.0)
        if status:
            return status
        time.sleep(2)
    return None


def _get_host_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def _print_endpoints() -> None:
    host_ip = _get_host_ip()
    _print("Boot endpoints:")
    print(f"  API base URL: http://{host_ip}:8000/api")
    print(f"  API health:   http://{host_ip}:8000/api/health")
    print(f"  Mobile web:   http://{host_ip}:19006")
    print(f"  Dashboard:    http://{host_ip}:5173")
    print(f"  MinIO API:    http://{host_ip}:9000")
    print(f"  MinIO UI:     http://{host_ip}:9001")


def _print_runtime_stats() -> None:
    status_payload = _http_get_json(STATUS_URL, timeout=2.0)
    capabilities = _http_get_json(CAPABILITIES_URL, timeout=2.0)

    if not status_payload:
        _print("Backend status endpoint is not reachable yet")
        return

    services = status_payload.get("services", {})
    resources = status_payload.get("resources", {})

    _print("Runtime status:")
    print(f"  Backend status: {status_payload.get('status', 'unknown')}")
    print(f"  Uptime seconds: {status_payload.get('uptime_seconds', 'n/a')}")
    print(f"  Memory RSS MB:  {resources.get('memory_rss_mb', 'n/a')}")
    print(f"  DB:             {services.get('database', 'unknown')}")
    print(f"  Storage:        {services.get('storage', 'unknown')}")
    print(f"  Firebase:       {services.get('firebase', 'unknown')}")

    if capabilities:
        auth = capabilities.get("auth", {})
        deployment = capabilities.get("deployment", {})
        print(f"  Auth mode:      {auth.get('auth_mode', 'unknown')}")
        print(
            "  Google auth:    "
            + ("enabled" if auth.get("google_auth_available") else "disabled")
        )
        print(f"  Deployment:     {deployment.get('mode', 'unknown')}")


def cmd_install(_args: argparse.Namespace) -> None:
    _ensure_backend_env()
    _run(_compose_cmd("pull"))
    _print("Install step complete.")


def cmd_initialize(args: argparse.Namespace) -> None:
    """One-shot setup + start flow used by UI option 1."""
    cmd_install(argparse.Namespace())
    cmd_up(args)


def cmd_up(args: argparse.Namespace) -> None:
    _ensure_backend_env()
    _run(_compose_cmd("up", "-d"))

    _print("Waiting for backend status endpoint...")
    status_payload = _wait_for_backend(timeout_seconds=args.wait_timeout)
    _print_endpoints()

    if status_payload:
        _print_runtime_stats()
    else:
        _print(
            "Backend did not report ready status within timeout. Check logs with "
            "'python stratum_bundle.py logs --follow backend'."
        )


def cmd_down(_args: argparse.Namespace) -> None:
    _run(_compose_cmd("down"))


def cmd_restart(args: argparse.Namespace) -> None:
    cmd_down(args)
    cmd_up(args)


def cmd_ps(_args: argparse.Namespace) -> None:
    _run(_compose_cmd("ps"), check=False)


def cmd_status(_args: argparse.Namespace) -> None:
    _run(_compose_cmd("ps"), check=False)
    _print_runtime_stats()


def cmd_logs(args: argparse.Namespace) -> None:
    cmd = _compose_cmd("logs")
    if args.follow:
        cmd.append("-f")
    if args.service:
        cmd.append(args.service)
    _run(cmd, check=False)


def _clear_screen() -> None:
    print("\033[2J\033[H", end="")


def _render_terminal_ui() -> None:
    host_ip = _get_host_ip()
    project_root = _resolve_project_root(strict=False)
    status_payload = _http_get_json(STATUS_URL, timeout=2.0)
    capabilities = _http_get_json(CAPABILITIES_URL, timeout=2.0)

    print("STRATUM Self-Host Launcher")
    print("==========================")
    print()
    print("Endpoints")
    print(f"- API base:   http://{host_ip}:8000/api")
    print(f"- API health: http://{host_ip}:8000/api/health")
    print(f"- Mobile web: http://{host_ip}:19006")
    print(f"- Dashboard:  http://{host_ip}:5173")
    print(f"- MinIO API:  http://{host_ip}:9000")
    print(f"- MinIO UI:   http://{host_ip}:9001")
    if project_root is not None:
        print(f"- Project:    {project_root}")
    else:
        print("- Project:    not configured (choose action 7)")
    print()

    if status_payload:
        services = status_payload.get("services", {})
        resources = status_payload.get("resources", {})

        print("Runtime")
        print(f"- Status:     {status_payload.get('status', 'unknown')}")
        print(f"- Uptime(s):  {status_payload.get('uptime_seconds', 'n/a')}")
        print(f"- Memory MB:  {resources.get('memory_rss_mb', 'n/a')}")
        print(f"- Database:   {services.get('database', 'unknown')}")
        print(f"- Storage:    {services.get('storage', 'unknown')}")
        print(f"- Firebase:   {services.get('firebase', 'unknown')}")
    else:
        print("Runtime")
        print("- Backend status endpoint not reachable")

    if capabilities:
        auth = capabilities.get("auth", {})
        deployment = capabilities.get("deployment", {})
        print()
        print("Capabilities")
        print(f"- Auth mode:  {auth.get('auth_mode', 'unknown')}")
        print(
            "- Google:     "
            + ("enabled" if auth.get("google_auth_available") else "disabled")
        )
        print(f"- Deploy:     {deployment.get('mode', 'unknown')}")

    print()
    print("Actions")
    print("[1] Initialize (setup + start)")
    print("[2] Start stack (up)")
    print("[3] Show status")
    print("[4] Follow backend logs")
    print("[5] Stop stack (down)")
    print("[6] Restart stack")
    print("[7] Configure project root")
    print("[r] Refresh panel")
    print("[q] Quit")


def _pause() -> None:
    try:
        input("\nPress Enter to continue...")
    except EOFError:
        return


def _configure_project_root_interactive() -> None:
    print()
    print("Enter the STRATUM project root (folder containing selfhost-compose.yml).")
    print("Press Enter with no value to cancel.")
    raw_value = input("Path: ").strip()
    if not raw_value:
        print("Cancelled.")
        return

    configured = _set_project_root(Path(raw_value), persist=True)
    _print(f"Project root configured: {configured}")


def cmd_ui(_args: argparse.Namespace) -> None:
    """Open an interactive terminal control panel for launcher operations."""
    while True:
        _clear_screen()
        _render_terminal_ui()

        try:
            choice = input("\nSelect action: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return

        if choice in {"", "r"}:
            continue

        try:
            if choice == "1":
                cmd_initialize(argparse.Namespace(wait_timeout=180))
                _pause()
            elif choice == "2":
                cmd_up(argparse.Namespace(wait_timeout=180))
                _pause()
            elif choice == "3":
                cmd_status(argparse.Namespace())
                _pause()
            elif choice == "4":
                print("\nPress Ctrl+C to stop log follow and return to the panel.\n")
                cmd_logs(argparse.Namespace(service="backend", follow=True))
                _pause()
            elif choice == "5":
                cmd_down(argparse.Namespace())
                _pause()
            elif choice == "6":
                cmd_restart(argparse.Namespace(wait_timeout=180))
                _pause()
            elif choice == "7":
                _configure_project_root_interactive()
                _pause()
            elif choice == "q":
                return
            else:
                print("\nUnknown option.")
                _pause()
        except KeyboardInterrupt:
            print("\nAction interrupted.")
            _pause()
        except Exception as exc:
            _print(f"ERROR: {exc}")
            _pause()


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="STRATUM self-host bundle launcher",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    install_parser = sub.add_parser("install", help="Pull required container images")
    install_parser.set_defaults(func=cmd_install)

    initialize_parser = sub.add_parser(
        "initialize",
        help="Run full setup and then start the self-host stack",
    )
    initialize_parser.add_argument(
        "--wait-timeout",
        type=int,
        default=180,
        help="Seconds to wait for backend readiness",
    )
    initialize_parser.set_defaults(func=cmd_initialize)

    up_parser = sub.add_parser("up", help="Start the full self-host stack")
    up_parser.add_argument(
        "--wait-timeout",
        type=int,
        default=180,
        help="Seconds to wait for backend readiness",
    )
    up_parser.set_defaults(func=cmd_up)

    down_parser = sub.add_parser("down", help="Stop and remove running stack containers")
    down_parser.set_defaults(func=cmd_down)

    restart_parser = sub.add_parser("restart", help="Restart the self-host stack")
    restart_parser.add_argument(
        "--wait-timeout",
        type=int,
        default=180,
        help="Seconds to wait for backend readiness",
    )
    restart_parser.set_defaults(func=cmd_restart)

    ps_parser = sub.add_parser("ps", help="Show compose service process status")
    ps_parser.set_defaults(func=cmd_ps)

    status_parser = sub.add_parser("status", help="Show process + runtime status summary")
    status_parser.set_defaults(func=cmd_status)

    logs_parser = sub.add_parser("logs", help="Show compose logs")
    logs_parser.add_argument("service", nargs="?", help="Optional service name")
    logs_parser.add_argument("--follow", action="store_true", help="Follow log stream")
    logs_parser.set_defaults(func=cmd_logs)

    ui_parser = sub.add_parser("ui", help="Open interactive terminal control panel")
    ui_parser.set_defaults(func=cmd_ui)

    root_parser = sub.add_parser(
        "set-root",
        help="Set project root folder containing selfhost-compose.yml",
    )
    root_parser.add_argument("path", help="Absolute or relative path to project root")
    root_parser.set_defaults(
        func=lambda args: _print(
            f"Project root configured: {_set_project_root(Path(args.path), persist=True)}"
        )
    )

    return parser


def _opened_from_macos_app_bundle() -> bool:
    executable_path = Path(sys.executable).as_posix()
    return sys.platform == "darwin" and ".app/Contents/MacOS/" in executable_path


def _stdout_is_tty() -> bool:
    stream = getattr(sys, "stdout", None)
    if stream is None:
        return False
    isatty = getattr(stream, "isatty", None)
    if not callable(isatty):
        return False
    try:
        return bool(isatty())
    except Exception:
        return False


def _escape_applescript(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _maybe_open_terminal_for_macos_app_launch() -> bool:
    """If launched by double-clicking the .app, open Terminal with interactive UI."""
    if len(sys.argv) > 1:
        return False
    if not _opened_from_macos_app_bundle():
        return False
    if _stdout_is_tty():
        return False

    launcher_path = shlex.quote(str(Path(sys.executable)))
    shell_command = f"{launcher_path} ui"

    script_lines = [
        'tell application "Terminal" to activate',
        f'tell application "Terminal" to do script "{_escape_applescript(shell_command)}"',
    ]

    args: list[str] = ["osascript"]
    for line in script_lines:
        args.extend(["-e", line])

    subprocess.run(args, check=False)
    return True


def main() -> None:
    if _maybe_open_terminal_for_macos_app_launch():
        return

    parser = _build_parser()
    args = parser.parse_args()

    try:
        args.func(args)
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if exc.stderr else ""
        _fail(stderr or f"Command failed with exit code {exc.returncode}", exc.returncode)


if __name__ == "__main__":
    main()
