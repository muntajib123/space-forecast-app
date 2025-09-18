FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install minimal build tools (needed for some pip packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code into the image
COPY . /app

WORKDIR /app

# collectstatic if present (won't fail)
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# On container start: run migrations, then start Gunicorn
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn forecast_project.wsgi:application --bind 0.0.0.0:8000 --workers 3"]
