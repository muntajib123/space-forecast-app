FROM python:3.10-slim-bullseye

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY ./backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY ./backend /app/backend

RUN python /app/backend/manage.py collectstatic --noinput || true

EXPOSE 8000

CMD ["sh", "-c", "python /app/backend/manage.py migrate --noinput && gunicorn forecast_project.wsgi:application --chdir /app/backend --bind 0.0.0.0:8000 --workers 3"]
