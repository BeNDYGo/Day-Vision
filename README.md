# DayVision

Личный веб-дневник: календарь, форматированные записи, фотографии, хештеги и пользовательские цвета дней. Фронтенд хранится на GitHub Pages, записи — в SQLite на VPS.

## Архитектура

```text
GitHub Pages                 VPS
index.html ──┐
styles.css ──┼── HTTPS ──► Cloudflare Tunnel ──► main.py:8750 ──► database.py ──► dayvision.sqlite
app.js ──────┘
```

- `index.html`, `styles.css`, `app.js` — статический сайт.
- `main.py` — принимает API-запросы с сайта; авторизации нет.
- `database.py` — читает и перезаписывает данные в SQLite.
- `dayvision.sqlite` — создаётся автоматически и не попадает в Git.

## Backend на VPS

Один раз установить зависимости:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Запустить API и Cloudflare Tunnel в фоне:

```sh
nohup .venv/bin/python main.py &
nohup cloudflared tunnel --url http://localhost:8750 &
tail -n 100 nohup.out
```

Из вывода скопировать адрес вида `https://example.trycloudflare.com`.

## Frontend на GitHub Pages

В репозитории GitHub открыть **Settings → Pages**, выбрать публикацию из нужной ветки и корневой папки. После публикации один раз открыть сайт с адресом API:

```text
https://USER.github.io/REPOSITORY/?api=https://example.trycloudflare.com
```

Сайт запомнит адрес API в текущем браузере. В другом браузере ссылку с `?api=` нужно открыть ещё раз. Когда адрес быстрого Cloudflare Tunnel изменится, достаточно снова открыть сайт с новым параметром.

## Локальная проверка

В первом терминале:

```sh
nohup .venv/bin/python main.py &
```

Во втором:

```sh
python3 -m http.server 8080
```

Открыть `http://localhost:8080`. Без параметра `?api=` локальный сайт обращается к `http://localhost:8750`.
