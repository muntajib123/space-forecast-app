import os
import json
from pathlib import Path
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(BASE_DIR / ".env")

# -----------------------------
# Basic settings
# -----------------------------
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    os.environ.get("SECRET_KEY", "change-me-locally-only"),
)

DEBUG = str(os.environ.get("DEBUG", "False")).lower() in ("true", "1", "yes")

# -----------------------------
# ALLOWED_HOSTS (robust parsing)
# -----------------------------
_raw_allowed = os.environ.get("ALLOWED_HOSTS", "*")
_raw_allowed = _raw_allowed.strip() if isinstance(_raw_allowed, str) else _raw_allowed

ALLOWED_HOSTS = []
if _raw_allowed:
    try:
        parsed = json.loads(_raw_allowed)
        if isinstance(parsed, (list, tuple)):
            ALLOWED_HOSTS = [str(h).strip() for h in parsed if str(h).strip()]
    except Exception:
        cleaned = _raw_allowed.strip()
        if cleaned.startswith("[") and cleaned.endswith("]"):
            cleaned = cleaned[1:-1]
        parts = [p.strip().strip(' "\'') for p in cleaned.split(",") if p.strip()]
        ALLOWED_HOSTS = [p for p in parts if p]

if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ["*"]

# -----------------------------
# Installed apps & middleware
# -----------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "forecast",
    "api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "forecast_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "forecast_project.wsgi.application"

# -----------------------------
# Database: MongoDB (djongo)
# -----------------------------
_raw_mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI")
MONGODB_URI = _raw_mongo_uri.strip() if _raw_mongo_uri and str(_raw_mongo_uri).strip() else None

MONGO_TLS_ALLOW_INVALID = str(
    os.environ.get("MONGO_TLS_ALLOW_INVALID", "False")
).lower() in ("true", "1", "yes")


def _extract_dbname_from_uri(uri: str) -> str | None:
    try:
        parsed = urlparse(uri)
        path = parsed.path or ""
        if path.startswith("/"):
            db = path[1:].split("?")[0]
            return db or None
    except Exception:
        pass
    return None


MONGO_DBNAME = os.environ.get("MONGO_DBNAME", "").strip() or None
if not MONGO_DBNAME and MONGODB_URI:
    MONGO_DBNAME = _extract_dbname_from_uri(MONGODB_URI)
if not MONGO_DBNAME:
    MONGO_DBNAME = "noaa_database"

_db_client_host = MONGODB_URI or f"mongodb://localhost:27017/{MONGO_DBNAME}"
_is_atlas = MONGODB_URI and "mongodb+srv" in MONGODB_URI

client_cfg = {"host": _db_client_host}
if _is_atlas:
    client_cfg.update(
        {
            "tls": True,
            "tlsAllowInvalidCertificates": MONGO_TLS_ALLOW_INVALID,
        }
    )
else:
    client_cfg.update({"tls": False})

DATABASES = {
    "default": {
        "ENGINE": "djongo",
        "NAME": MONGO_DBNAME,
        "ENFORCE_SCHEMA": False,
        "CLIENT": client_cfg,
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# -----------------------------
# CORS configuration (robust parsing)
# -----------------------------
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOW_CREDENTIALS = True

    raw = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
    CORS_ALLOWED_ORIGINS = []
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, (list, tuple)):
                CORS_ALLOWED_ORIGINS = [str(u).strip() for u in parsed if str(u).strip()]
        except Exception:
            cleaned = raw
            if cleaned.startswith("[") and cleaned.endswith("]"):
                cleaned = cleaned[1:-1]
            parts = [p.strip().strip(' "\'') for p in cleaned.split(",") if p.strip()]
            CORS_ALLOWED_ORIGINS = [p for p in parts if p]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https?:\/\/.*\.vercel\.app$",
]

# -----------------------------
# Logging
# -----------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "%(levelname)s %(asctime)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": "INFO" if not DEBUG else "DEBUG"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO" if not DEBUG else "DEBUG", "propagate": False},
        "api": {"handlers": ["console"], "level": "DEBUG" if DEBUG else "INFO", "propagate": False},
    },
}

if DEBUG:
    import logging as _logging
    _logging.getLogger("django").info("DEBUG mode on")
    _logging.getLogger("django").info("MONGO_DBNAME=%s", MONGO_DBNAME)
    _logging.getLogger("django").info("Using MONGODB_URI set? %s", bool(MONGODB_URI))

# -----------------------------
# End of settings.py
# -----------------------------
