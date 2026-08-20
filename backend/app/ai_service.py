"""
STRATUM AI Service.

Provides a unified interface for calling multiple AI providers
via round-robin load balancing across configured API keys.

Keys are read from environment variables at module load time:
  STRATUMAI_APIKEY_1=<key>      STRATUMAI_PROVIDER_1=ANTHROPIC
  STRATUMAI_APIKEY_2=<key>      STRATUMAI_PROVIDER_2=GEMINI
  ...

Supported providers (case-insensitive): ANTHROPIC, GEMINI

Use the model constants below at each call site to select the
appropriate tier for the task.
"""

import os
import threading
from typing import NamedTuple

import httpx
from dotenv import dotenv_values

# Optional: the self-host image installs requirements-selfhost.txt, which
# leaves out the cloud AI SDKs. Importing it eagerly made the whole API fail
# to boot there, so absence is handled at the call site instead.
try:
    import anthropic
except ModuleNotFoundError:  # pragma: no cover - depends on install profile
    anthropic = None

# ---------------------------------------------------------------------------
# Model constants - import and pass to generate_summary() at each call site
# ---------------------------------------------------------------------------

# Anthropic Claude
CLAUDE_HAIKU = "claude-haiku-4-5-20251001"  # fast, cheap - routine tasks
CLAUDE_SONNET = "claude-sonnet-4-6"  # balanced - most tasks
CLAUDE_OPUS = "claude-opus-4-7"  # most capable - complex reasoning

# Google Gemini
GEMINI_FLASH_LITE = "gemini-2.0-flash-lite"  # fast, high RPM
GEMINI_FLASH = "gemini-2.0-flash"  # standard

# ---------------------------------------------------------------------------
# Provider defaults (used when the caller passes model=None)
# ---------------------------------------------------------------------------
_PROVIDER_DEFAULT_MODELS: dict[str, str] = {
    "ANTHROPIC": CLAUDE_HAIKU,
    "GEMINI": GEMINI_FLASH_LITE,
}

_GEMINI_BASE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

# Path to the backend .env file (two levels up: app/ → backend/)
_ENV_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
)


class _KeyConfig(NamedTuple):
    api_key: str
    provider: str  # normalised to uppercase


def _load_configs() -> list[_KeyConfig]:
    # pydantic-settings does NOT set os.environ for undeclared fields, so read
    # the .env file directly and merge with os.environ (env wins on overlap).
    env = {**dotenv_values(_ENV_FILE), **os.environ}
    configs: list[_KeyConfig] = []
    n = 1
    while True:
        key = env.get(f"STRATUMAI_APIKEY_{n}", "").strip()
        provider = env.get(f"STRATUMAI_PROVIDER_{n}", "").strip().upper()
        if not key or not provider:
            break
        configs.append(_KeyConfig(api_key=key, provider=provider))
        n += 1
    return configs


_configs: list[_KeyConfig] = _load_configs()
_counter: int = 0
_lock = threading.Lock()


def is_configured() -> bool:
    return bool(_configs)


def active_provider() -> str | None:
    if not _configs:
        return None
    with _lock:
        return _configs[_counter % len(_configs)].provider


def _next() -> _KeyConfig | None:
    global _counter
    if not _configs:
        return None
    with _lock:
        cfg = _configs[_counter % len(_configs)]
        _counter += 1
    return cfg


async def generate_summary(
    prompt: str, model: str | None = None, max_tokens: int = 1024
) -> tuple[str, str]:
    """
    Call the next configured AI provider in round-robin order.

    Args:
        prompt:     The full prompt text to send.
        model:      Explicit model name (e.g. CLAUDE_HAIKU). Uses the provider
                    default when None.
        max_tokens: Maximum tokens in the response (default 1024; use 3000+ for
                    long-form history narratives).

    Returns:
        (response_text, display_provider_name).

    Raises:
        ValueError              - misconfiguration (no keys, unsupported provider).
        anthropic.APIStatusError - Anthropic HTTP / API errors.
        httpx.HTTPStatusError   - Gemini HTTP errors.
    """
    cfg = _next()
    if cfg is None:
        raise ValueError(
            "No AI API keys configured. "
            "Add STRATUMAI_APIKEY_1 and STRATUMAI_PROVIDER_1 to backend/.env"
        )

    resolved_model = model or _PROVIDER_DEFAULT_MODELS.get(cfg.provider)

    if cfg.provider == "ANTHROPIC":
        resolved_model = resolved_model or CLAUDE_HAIKU
        text = await _call_anthropic(cfg.api_key, prompt, resolved_model, max_tokens)
        tier = resolved_model.split("-")[
            1
        ].capitalize()  # haiku -> Haiku, sonnet -> Sonnet
        return text, f"Claude {tier}"

    if cfg.provider == "GEMINI":
        resolved_model = resolved_model or GEMINI_FLASH_LITE
        text = await _call_gemini(cfg.api_key, prompt, resolved_model, max_tokens)
        return text, f"Gemini ({resolved_model})"

    raise ValueError(
        f"Provider '{cfg.provider}' is not yet supported. "
        "Supported providers: ANTHROPIC, GEMINI"
    )


async def _call_anthropic(
    api_key: str, prompt: str, model: str, max_tokens: int = 1024
) -> str:
    if anthropic is None:
        raise ValueError(
            "Anthropic support is not installed on this server "
            "(pip install anthropic to enable AI summaries)."
        )
    client = anthropic.AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


async def _call_gemini(
    api_key: str, prompt: str, model: str, max_tokens: int = 1024
) -> str:
    url = _GEMINI_BASE_URL.format(model=model)
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": api_key,
    }
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens},
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if not resp.is_success:
            try:
                body = resp.json()
            except Exception:
                body = resp.text
            raise httpx.HTTPStatusError(
                f"Gemini {resp.status_code}: {body}",
                request=resp.request,
                response=resp,
            )
        data = resp.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise ValueError(f"Unexpected Gemini response structure: {exc}") from exc
