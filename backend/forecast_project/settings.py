# settings.py (fixed — copy & paste entire file)
import os
from pathlib import Path
from urllib.parse import urlparse

# Optional: load local .env for development
try:
    from dotenv import load_dotenv  # pip install python-dotenv
except Exception:
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(BASE_DIR / ".env")

# -----------------------------
# Security / Keys
# -----------------------------
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    os.environ.get("SECRET_KEY", "change-me-locally-only"),
)

# DEBUG: accept 'True', 'true', '1', 'yes' to enable
DEBUG = str(os.environ.get("DEBUG", "False")).lower() in ("true", "1", "yes")

# ALLOWED_HOSTS: comma separated, default to '*' (use env in production)
_raw_allowed = os.environ.get("ALLOWED_HOSTS", "*")
if _raw_allowed.strip() == "":
    ALLOWED_HOSTS = ["*"]
else:
    ALLOWED_HOSTS = [h.strip() for h in _raw_allowed.split(",") if h.strip()]
    if not ALLOWED_HOSTS:
        ALLOWED_HOSTS = ["*"]

# -----------------------------
# Installed apps
# -----------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "corsheaders",       # pip install django-cors-headers
    "rest_framework",

    # Local apps
    "forecast",
    "api",
]

# -----------------------------
# Middleware
# -----------------------------
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

# -----------------------------
# Root / Templates / WSGI
# -----------------------------
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
# Supported environment variables:
#  - MONGO_URI or MONGODB_URI  (full connection string, e.g. mongodb+srv://user:pass@host/db?...)
#  - MONGO_DBNAME (optional) - if not provided we'll try to extract from URI
#  - MONGO_TLS_ALLOW_INVALID (optional: True/False) - only for testing

# Prefer MONGO_URI, then MONGODB_URI
_raw_mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI")
MONGODB_URI = _raw_mongo_uri.strip() if _raw_mongo_uri and str(_raw_mongo_uri).strip() else None

# TLS invalid certificates flag (False by default)
MONGO_TLS_ALLOW_INVALID = str(
    os.environ.get("MONGO_TLS_ALLOW_INVALID", "False")
).lower() in ("true", "1", "yes")

def _extract_dbname_from_uri(uri: str) -> str | None:
    """
    Extract database name from a mongodb URI if present, otherwise None.
    """
    try:
        parsed = urlparse(uri)
        path = parsed.path or ""
        if path.startswith("/"):
            db = path[1:].split("?")[0]
            return db or None
    except Exception:
        pass
    return None

# Choose DB name:
MONGO_DBNAME = os.environ.get("MONGO_DBNAME", "").strip() or None
if not MONGO_DBNAME and MONGODB_URI:
    MONGO_DBNAME = _extract_dbname_from_uri(MONGODB_URI)

# Final fallback DB name (useful for local dev)
if not MONGO_DBNAME:
    MONGO_DBNAME = "forecast3day"

# If using Atlas SRV (+srv) or URI includes DB, pass full URI as host.
_db_client_host = MONGODB_URI or f"mongodb://localhost:27017/{MONGO_DBNAME}"

DATABASES = {
    "default": {
        "ENGINE": "djongo",
        "NAME": MONGO_DBNAME,
        "ENFORCE_SCHEMA": False,
        "CLIENT": {
            "host": _db_client_host,
            "tls": True if (MONGODB_URI and "mongodb+srv" in MONGODB_URI) else False,
            "tlsAllowInvalidCertificates": MONGO_TLS_ALLOW_INVALID,
        },
    }
}

# -----------------------------
# Misc
# -----------------------------
AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# -----------------------------
# CORS configuration
# -----------------------------
# Behavior:
#  - If DEBUG=True -> allow all origins (convenient for local dev)
#  - If DEBUG=False -> read CORS_ALLOWED_ORIGINS env var (comma separated) or fail closed
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOW_CREDENTIALS = True
    # Provide CORS_ALLOWED_ORIGINS as a comma-separated env var in production.
    _cors_allowed = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    if _cors_allowed.strip():
        CORS_ALLOWED_ORIGINS = [u.strip() for u in _cors_allowed.split(",") if u.strip()]
    else:
        # If nothing set, keep empty list (block cross-origin in prod).
        CORS_ALLOWED_ORIGINS = []

# -----------------------------
# Logging (send to stdout so PaaS captures it)
# -----------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "%(levelname)s %(asctime)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO" if not DEBUG else "DEBUG",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO" if not DEBUG else "DEBUG",
            "propagate": False,
        },
        "api": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}

# -----------------------------
# Helpful runtime notes (for quick debugging)
# -----------------------------
# - Make sure MONGO_URI or MONGODB_URI is set in your environment.
# - If your Atlas password contains special characters (like @), URL-encode it (e.g. '@' -> '%40').
# - In Render / other PaaS, set:
#     MONGODB_URI = mongodb+srv://username:URL_ENCODED_PASSWORD@cluster0.../forecast3day?retryWrites=true&w=majority
#     MONGO_DBNAME = forecast3day
# - In production set:
#     ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS environment variables (comma-separated lists)
# - If you see authentication/network errors:
#     1) Check Atlas -> Database Access (user exists, password correct)
#     2) Check Atlas -> Network Access (add your host or 0.0.0.0/0 for testing)
#
if DEBUG:
    import logging as _logging
    _logging.getLogger("django").info("DEBUG mode on")
    _logging.getLogger("django").info("MONGO_DBNAME=%s", MONGO_DBNAME)
    _logging.getLogger("django").info("Using MONGODB_URI set? %s", bool(MONGODB_URI))
