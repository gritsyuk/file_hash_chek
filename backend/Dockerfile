# Используем официальный образ с uv и Python 3.13
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

# устанавливаем путь к проекту что бы src был доступен при импорте
ENV PYTHONPATH=/app:$PYTHONPATH
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

CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
