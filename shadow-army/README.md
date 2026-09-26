# Shadow Army v0.1

Первое техническое ядро «Теневой армии».

## M0 — Foundation

Цель: безопасно заложить отдельный backend, не затрагивая существующие страницы FastGo и Personal Dashboard.

### Первые тени
- Commander E — оркестрация запросов.
- Keeper E — долговременная структурированная память и Context Pack.
- Manager E — проекты, этапы, квесты, задачи и зависимости.

### Стек
- Python 3.12
- FastAPI
- PostgreSQL
- SQLAlchemy 2
- Alembic
- Pydantic Settings

### Безопасность
- Секреты только через environment variables.
- Тени не получают прямого неограниченного доступа к внешним действиям.
- Значимые внешние действия проходят через Approval Gate.
- Существующие страницы сайта не изменяются этим модулем.

### Структура
```
shadow-army/
  app/
    main.py
    config.py
    db.py
    models.py
    schemas.py
    audit.py
  migrations/
  tests/
  .env.example
  requirements.txt
  docker-compose.yml
```

## Проверка M0
После запуска `GET /health` должен вернуть статус `ok`. Следующий этап — миграции и Keeper E.
