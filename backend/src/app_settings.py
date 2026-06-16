"""In-app system settings store for the desktop application.

The desktop build lets users configure LLM providers (API keys / models) and a
handful of system environment options from the GUI instead of hand-editing a
``.env`` file. Settings are persisted as JSON (location overridable via the
``LGB_SETTINGS_PATH`` env var so the Electron shell can keep them in the
per-user data directory) and applied to ``os.environ`` so the rest of the
backend — which reads configuration through ``os.getenv`` — picks them up.

The LLM value formats here intentionally mirror how ``src/llm.py:get_llm``
parses ``LLM_MODEL_CONFIG_<MODEL>`` so a configured model is immediately usable.
"""

import json
import logging
import os
import re
import threading

# Ordered field definition per provider. The field order MUST match the
# comma-separated value layout expected by ``get_llm`` in ``src/llm.py``.
# ``key_prefix`` guarantees the generated model key contains the substring that
# ``get_llm`` switches on (e.g. "openai", "azure"), so routing is always correct.
PROVIDERS = [
    {
        "id": "openai",
        "key_prefix": "openai",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "api_key", "secret": True},
        ],
    },
    {
        # OpenAI-compatible endpoints (DeepSeek, Kimi/Moonshot, Zhipu, local
        # vLLM / LM Studio, ...). Routed through get_llm's default branch, which
        # expects "model_name,api_endpoint,api_key".
        "id": "openai_compatible",
        "key_prefix": "custom",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "api_endpoint", "secret": False},
            {"name": "api_key", "secret": True},
        ],
    },
    {
        "id": "anthropic",
        "key_prefix": "anthropic",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "api_key", "secret": True},
        ],
    },
    {
        "id": "groq",
        "key_prefix": "groq",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "base_url", "secret": False},
            {"name": "api_key", "secret": True},
        ],
    },
    {
        "id": "fireworks",
        "key_prefix": "fireworks",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "api_key", "secret": True},
        ],
    },
    {
        "id": "azure",
        "key_prefix": "azure_ai",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "api_endpoint", "secret": False},
            {"name": "api_key", "secret": True},
            {"name": "api_version", "secret": False},
        ],
    },
    {
        "id": "bedrock",
        "key_prefix": "bedrock",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "aws_access_key", "secret": True},
            {"name": "aws_secret_key", "secret": True},
            {"name": "region_name", "secret": False},
        ],
    },
    {
        "id": "ollama",
        "key_prefix": "ollama",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "base_url", "secret": False},
        ],
    },
    {
        "id": "diffbot",
        "key_prefix": "diffbot",
        "fields": [
            {"name": "model_name", "secret": False},
            {"name": "api_key", "secret": True},
        ],
    },
    {
        # Uses Google Cloud application-default credentials (Vertex AI), so only
        # the model name is stored here.
        "id": "gemini",
        "key_prefix": "gemini",
        "fields": [
            {"name": "model_name", "secret": False},
        ],
    },
]

PROVIDERS_BY_ID = {p["id"]: p for p in PROVIDERS}

# System environment keys that may be edited from the settings panel. Anything
# outside this allow-list is ignored when applying settings.
ALLOWED_ENV_KEYS = [
    "EMBEDDING_MODEL",
    "EMBEDDING_PROVIDER",
    "IS_EMBEDDING",
    "OPENAI_API_KEY",
    "KNN_MIN_SCORE",
    "DUPLICATE_SCORE_VALUE",
    "DUPLICATE_TEXT_DISTANCE",
    "GRAPH_CLEANUP_MODEL",
    "DEFAULT_DIFFBOT_CHAT_MODEL",
    "MAX_TOKEN_CHUNK_SIZE",
    "UPDATE_GRAPH_CHUNKS_PROCESSED",
    "ENTITY_EMBEDDING",
    "EFFECTIVE_SEARCH_RATIO",
    "NEO4J_URI",
    "NEO4J_USERNAME",
    "NEO4J_PASSWORD",
    "NEO4J_DATABASE",
]

SECRET_ENV_KEYS = {"OPENAI_API_KEY", "NEO4J_PASSWORD"}

_lock = threading.Lock()


def settings_path():
    """Resolve the JSON settings file path (overridable for the desktop app)."""
    override = os.environ.get("LGB_SETTINGS_PATH")
    if override:
        return override
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(backend_dir, "app_settings.json")


def _slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")
    return slug


def model_key_for(provider_id, name):
    """Build a stable model key whose prefix routes correctly in get_llm."""
    provider = PROVIDERS_BY_ID.get(provider_id)
    prefix = provider["key_prefix"] if provider else _slugify(provider_id) or "model"
    slug = _slugify(name)
    return f"{prefix}_{slug}" if slug else prefix


def env_key_for(model_key):
    return "LLM_MODEL_CONFIG_" + str(model_key).upper().replace(".", "_")


def build_llm_value(provider_id, fields):
    """Join a model's fields into the comma-separated value get_llm expects."""
    provider = PROVIDERS_BY_ID.get(provider_id)
    if not provider:
        return ""
    fields = fields or {}
    return ",".join(str(fields.get(f["name"], "") or "") for f in provider["fields"])


def _normalize(data):
    """Coerce arbitrary input into the canonical settings structure."""
    data = data or {}
    models_out = []
    seen_keys = set()
    for entry in data.get("llm_models") or []:
        if not isinstance(entry, dict):
            continue
        provider_id = entry.get("provider")
        if provider_id not in PROVIDERS_BY_ID:
            continue
        name = entry.get("name") or ""
        raw_fields = entry.get("fields") or {}
        fields = {
            f["name"]: str(raw_fields.get(f["name"], "") or "")
            for f in PROVIDERS_BY_ID[provider_id]["fields"]
        }
        key = entry.get("key") or model_key_for(provider_id, name)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        models_out.append({"key": key, "provider": provider_id, "name": name, "fields": fields})

    env_in = data.get("env") or {}
    env_out = {}
    for k in ALLOWED_ENV_KEYS:
        if k in env_in and env_in[k] is not None:
            env_out[k] = str(env_in[k])
    return {"llm_models": models_out, "env": env_out}


def load_settings():
    path = settings_path()
    if not os.path.exists(path):
        return {"llm_models": [], "env": {}}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return _normalize(json.load(fh))
    except Exception as exc:  # noqa: BLE001 - corrupt file should not crash startup
        logging.warning("Failed to read app settings at %s: %s", path, exc)
        return {"llm_models": [], "env": {}}


def save_settings(data):
    normalized = _normalize(data)
    path = settings_path()
    with _lock:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(normalized, fh, ensure_ascii=False, indent=2)
    return normalized


def apply_settings(data):
    """Apply settings to ``os.environ`` so the running backend picks them up."""
    normalized = _normalize(data)
    for model in normalized["llm_models"]:
        os.environ[env_key_for(model["key"])] = build_llm_value(model["provider"], model["fields"])
    for key, value in normalized["env"].items():
        if value != "":
            os.environ[key] = value
    return normalized


def apply_saved_settings():
    """Load persisted settings and apply them. Called once at startup."""
    try:
        return apply_settings(load_settings())
    except Exception as exc:  # noqa: BLE001 - never block startup on settings
        logging.warning("Failed to apply saved app settings: %s", exc)
        return {"llm_models": [], "env": {}}


def configured_models(data):
    return [m["key"] for m in (data.get("llm_models") or [])]


def get_state():
    """Everything the settings UI needs: catalog + current values + model keys."""
    settings = load_settings()
    return {
        "providers": PROVIDERS,
        "allowed_env_keys": ALLOWED_ENV_KEYS,
        "secret_env_keys": sorted(SECRET_ENV_KEYS),
        "settings": settings,
        "configured_models": configured_models(settings),
    }
