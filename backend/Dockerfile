FROM python:3.10-slim

# install minimal build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install python deps (requirements.txt is in backend/)
COPY ./backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend into /app/backend
COPY ./backend /app/backend

# collectstatic (use absolute path)
RUN python /app/backend/manage.py collectstatic --noinput || true

EXPOSE 8000

# On container start: use absolute path to manage.py so it always works
CMD ["sh", "-c", "python /app/backend/manage.py migrate --noinput && gunicorn forecast_project.wsgi:application --chdir /app/backend --bind 0.0.0.0:8000 --workers 3"]
