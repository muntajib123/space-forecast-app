import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# -----------------------------
# Security / Keys
# -----------------------------
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    os.environ.get("SECRET_KEY", "fallback-secret-key")
)

DEBUG = os.environ.get("DEBUG", "False").lower() == "true"

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "*").split(",")
if ALLOWED_HOSTS == [""]:
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
# Database: MongoDB (Atlas or local)
# -----------------------------
MONGODB_URI = os.environ.get(
    "MONGODB_URI",
    os.environ.get(
        "MONGO_URI",
        "mongodb://muntajib:7081567123Muntajib@localhost:27018/noaa_database?authSource=noaa_database"
    )
)

DATABASES = {
    "default": {
        "ENGINE": "djongo",
        "NAME": os.environ.get("MONGO_DBNAME", "noaa_database"),
        "ENFORCE_SCHEMA": False,
        "CLIENT": {
            "host": MONGODB_URI,
            "tls": True if "mongodb+srv" in MONGODB_URI else False,
            # Sometimes needed for Atlas, especially with SRV
            "tlsAllowInvalidCertificates": True,
        },
    }
}

# -----------------------------
# Misc
# -----------------------------
AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
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
