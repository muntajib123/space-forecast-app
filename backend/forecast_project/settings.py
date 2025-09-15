# settings.py (updated)
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# -----------------------------
# Security / Keys
# -----------------------------
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    os.environ.get("SECRET_KEY", "change-me-locally-only")
)

# DEBUG: accept 'True', 'true', '1' to enable
DEBUG = str(os.environ.get("DEBUG", "False")).lower() in ("true", "1", "yes")

# ALLOWED_HOSTS: comma separated, default to '*' (useful for quick deploys)
_raw_allowed = os.environ.get("ALLOWED_HOSTS", "*")
if _raw_allowed.strip() == "":
    ALLOWED_HOSTS = ["*"]
else:
    # split and strip whitespace
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
# Set MONGODB_URI in Render environment variables (preferred).
# Example (Atlas): mongodb+srv://<user>:<pass>@cluster0.xyz.mongodb.net/noaa_database?retryWrites=true&w=majority
MONGODB_URI = os.environ.get(
    "MONGODB_URI",
    os.environ.get(
        "MONGO_URI",
        "mongodb://muntajib:7081567123Muntajib@localhost:27018/noaa_database?authSource=noaa_database"
    )
)

# Optionally allow invalid TLS certs (helpful for some test clusters).
# Set MONGO_TLS_ALLOW_INVALID=true only if you understand the security implications.
MONGO_TLS_ALLOW_INVALID = str(os.environ.get("MONGO_TLS_ALLOW_INVALID", "False")).lower() in ("true", "1", "yes")

DATABASES = {
    "default": {
        "ENGINE": "djongo",
        "NAME": os.environ.get("MONGO_DBNAME", "noaa_database"),
        "ENFORCE_SCHEMA": False,
        "CLIENT": {
            "host": MONGODB_URI,
            # If using Atlas SRV, djongo/pymongo negotiates TLS automatically,
            # but we expose this option for compatibility/testing.
            "tls": True if "mongodb+srv" in MONGODB_URI or os.environ.get("MONGO_TLS", "").lower() == "true" else False,
            # set from env if needed
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
# Logging (send to stdout so Render captures it)
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
        # Django default
        "django": {
            "handlers": ["console"],
            "level": "INFO" if not DEBUG else "DEBUG",
            "propagate": False,
        },
        # Your app
        "api": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}

# -----------------------------
# Helpful runtime checks / notes
# -----------------------------
# If you see ModuleNotFoundError: No module named 'api.models'
#   1) ensure backend/api/models.py exists and defines Forecast3Day
#   2) ensure api has an __init__.py (it does, according to your screenshot)
#   3) ensure "api" is in INSTALLED_APPS (it is above)
#
# Environment variables to set on Render:
#  - DJANGO_SECRET_KEY  (or SECRET_KEY)
#  - DEBUG (True/False)
#  - ALLOWED_HOSTS (comma separated)
#  - MONGODB_URI (your Atlas connection string)
#  - optionally: MONGO_TLS_ALLOW_INVALID (True/False)
