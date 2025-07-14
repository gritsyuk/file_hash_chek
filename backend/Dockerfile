# Используем официальный образ с uv и Python 3.12
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Кэшируем зависимости
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Копируем только файлы зависимостей для кэширования слоёв
COPY pyproject.toml uv.lock ./

# Устанавливаем зависимости (без dev)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# Копируем исходный код приложения
COPY src ./src

EXPOSE 8000

# Запускаем FastAPI через uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

