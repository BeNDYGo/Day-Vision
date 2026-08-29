# DayVision

DayVision — дневник в формате Telegram Mini App. Пользователь выбирает день в календаре, пишет форматированную заметку, добавляет фотографии, хештеги и собственный цвет дня. Изменения сохраняются автоматически.

## Архитектура

```text
Telegram Mini App
       │ HTTPS
       ▼
Cloudflare Tunnel
       │ http://127.0.0.1:8750
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

Открыть `http://127.0.0.1:8750`. `DEV_USER_ID` используется только локально, чтобы запускать приложение без Telegram.

## Запуск на VPS

После однократной установки зависимостей сервер запускается в фоне привычным способом:

```sh
export BOT_TOKEN=токен_из_BotFather
nohup .venv/bin/python main.py &
nohup cloudflared tunnel --url http://localhost:8750 &
tail -n 50 nohup.out
```

Скопировать из вывода адрес `https://….trycloudflare.com` и указать его в BotFather как URL Mini App. Nginx для этой схемы не нужен.

По умолчанию база создаётся рядом с проектом. Другой путь задаётся переменной `DATABASE_PATH`:

```sh
export DATABASE_PATH=/var/lib/dayvision/dayvision.sqlite
```
