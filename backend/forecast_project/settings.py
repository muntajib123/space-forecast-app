# settings.py (complete, ready to paste)
import os
from pathlib import Path
from urllib.parse import urlparse, unquote

BASE_DIR = Path(__file__).resolve().parent.parent

# -----------------------------
# Security / Keys
# -----------------------------
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    os.environ.get("SECRET_KEY", "change-me-locally-only"),
)

# DEBUG: accept 'True', 'true', '1', 'yes' to enable
DEBUG = str(os.environ.get("DEBUG", "False")).lower() in ("true", "1", "yes")

# ALLOWED_HOSTS: comma separated, default to '*'
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
    "corsheaders",
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
# Expected environment variables:
#   - MONGODB_URI  (full connection string, e.g. mongodb+srv://user:pass@cluster0.../forecast3day?...)
#   - MONGO_DBNAME (optional, e.g. forecast3day) - if not provided we try to extract from URI
#   - MONGO_TLS_ALLOW_INVALID (optional: True/False) - only for testing; don't use in production

# Read URI from environment (Render uses the exact variable name you created)
MONGODB_URI = os.environ.get("MONGODB_URI", "").strip() or None

# TLS invalid certificates flag (False by default)
MONGO_TLS_ALLOW_INVALID = str(
    os.environ.get("MONGO_TLS_ALLOW_INVALID", "False")
).lower() in ("true", "1", "yes")

def _extract_dbname_from_uri(uri: str) -> str | None:
    """
    Try to extract the database name from a mongodb URI.
    Examples:
      - mongodb+srv://user:pass@host/mydb?retryWrites=true
         -> "mydb"
      - mongodb://user:pass@host:27017/mydb
         -> "mydb"
      - if no path/db in URI, returns None
    """
    try:
        # urlparse will put the path as '/mydb'
        parsed = urlparse(uri)
        path = parsed.path or ""
        if path.startswith("/"):
            db = path[1:]
            if db:
                # remove query leftovers (shouldn't be any here)
                db = db.split("?")[0]
                return db
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

# If user supplied an Atlas style URI that included the DB name after the host,
# djongo expects the client host to be the entire URI (including db if present).
# We will pass the whole URI to CLIENT.host and set "NAME" to MONGO_DBNAME.
# For Atlas SRV we enable TLS automatically.
_db_client_host = MONGODB_URI or f"mongodb://localhost:27017/{MONGO_DBNAME}"

DATABASES = {
    "default": {
        "ENGINE": "djongo",
        "NAME": MONGO_DBNAME,
        "ENFORCE_SCHEMA": False,
        "CLIENT": {
            "host": _db_client_host,
            # If using Atlas SRV or the URI includes +srv, ensure TLS True
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
# CORS
# -----------------------------
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# -----------------------------
# Logging (send to stdout so Render / other PaaS captures it)
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
# - Make sure MONGODB_URI is set in your Render environment variables exactly as shown in Atlas.
# - If your Atlas password contains special characters (like @), it must be URL-encoded.
#   Example: password = 'P@ssw0rd' -> encoded becomes 'P%40ssw0rd'
# - In Render, set:
#     MONGODB_URI = mongodb+srv://username:URL_ENCODED_PASSWORD@cluster0.ixzdh.mongodb.net/forecast3day?retryWrites=true&w=majority
#     MONGO_DBNAME = forecast3day
# - If you see authentication errors in logs, check:
#     1) DB user exists and password matches (in Atlas -> Database Access)
#     2) Your network access allows the Render host (Atlas -> Network Access). Use 0.0.0.0/0 for testing (not recommended for production)
#
# Quick runtime debug prints (only when DEBUG=True):
if DEBUG:
    import logging as _logging
    _logging.getLogger("django").info("DEBUG mode on")
    _logging.getLogger("django").info("MONGO_DBNAME=%s", MONGO_DBNAME)
    _logging.getLogger("django").info("Using MONGODB_URI set? %s", bool(MONGODB_URI))
