# DayVision

DayVision — дневник в формате Telegram Mini App. Пользователь выбирает день в календаре, пишет форматированную заметку, добавляет фотографии, хештеги и собственный цвет дня. Изменения сохраняются автоматически.

## Архитектура

```text
Telegram Mini App
       │ HTTPS
       ▼
Cloudflare Tunnel
       │ http://127.0.0.1:8000
       ▼
main.py ─────── фронтенд: index.html, styles.css, app.js
       │
       ▼
database.py ─── dayvision.sqlite
```

`main.py` раздаёт интерфейс, принимает API-запросы и проверяет подпись Telegram. `database.py` создаёт таблицы и читает или записывает данные в SQLite. Записи разных пользователей разделяются по Telegram ID.

## Файлы

- `index.html`, `styles.css`, `app.js` — интерфейс Mini App.
- `main.py` — HTTP API, авторизация Telegram и раздача фронтенда.
- `database.py` — работа с SQLite.
- `dayvision.sqlite` — база, создаётся при первом запуске и не добавляется в Git.
- `requirements.txt` — Flask и Gunicorn.

## Локальный запуск

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
DEV_USER_ID=1 python main.py
```

Открыть `http://127.0.0.1:8000`. `DEV_USER_ID` используется только локально, чтобы запускать приложение без Telegram.

## Запуск на VPS

```sh
source .venv/bin/activate
BOT_TOKEN=токен_из_BotFather gunicorn --bind 127.0.0.1:8000 main:app
```

В Cloudflare Tunnel нужно связать публичный hostname с `http://localhost:8000`. Полученный HTTPS-адрес указывается в BotFather как URL Mini App. Nginx для этой схемы не нужен.

По умолчанию база создаётся рядом с проектом. Другой путь задаётся переменной `DATABASE_PATH`:

```sh
DATABASE_PATH=/var/lib/dayvision/dayvision.sqlite BOT_TOKEN=... gunicorn --bind 127.0.0.1:8000 main:app
```
