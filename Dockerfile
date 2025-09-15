FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy entire repo, then set workdir to backend where manage.py and forecast_project live
COPY . /app/
WORKDIR /app/backend

# collectstatic (won't fail if no static)
RUN python manage.py collectstatic --noinput || true

# Run gunicorn against the Django project inside backend
CMD ["gunicorn", "forecast_project.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
