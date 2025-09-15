import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Use DJANGO_SECRET_KEY (what you set on Render). Fallback kept for local dev.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', os.environ.get('SECRET_KEY', 'fallback-secret-key'))

# DEBUG from env (Render: "false")
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'corsheaders',
    'rest_framework',

    # Local apps
    'forecast',
    'api',   # <-- added api app so /api/ routes work
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',

    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'forecast_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'forecast_project.wsgi.application'

# -----------------------------
# MongoDB configuration
# -----------------------------
# Use MONGODB_URI (what we used earlier in Render). Keep old fallback for local/dev.
MONGODB_URI = os.environ.get(
    'MONGODB_URI',
    os.environ.get(
        'MONGO_URI',
        'mongodb://muntajib:7081567123Muntajib@localhost:27018/noaa_database?authSource=noaa_database'
    )
)

DATABASES = {
    'default': {
        'ENGINE': 'djongo',
        'NAME': os.environ.get('MONGO_DBNAME', 'noaa_database'),
        'ENFORCE_SCHEMA': False,
        'CLIENT': {
            'host': MONGODB_URI,
        }
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS (allow all for now - change to specific origins when frontend is ready)
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
