FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install minimal build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# Install python deps (requirements.txt in backend/)
COPY ./backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend into /app/backend
COPY ./backend /app/backend

# Use the backend folder as the working dir (where manage.py lives)
WORKDIR /app/backend

# collectstatic if present
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# On container start: run migrations then start gunicorn
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn forecast_project.wsgi:application --bind 0.0.0.0:8000 --workers 3"]
