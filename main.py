import hashlib
import hmac
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import parse_qsl

from flask import Flask, jsonify, request, send_from_directory

import database


ROOT = Path(__file__).parent
BOT_TOKEN = os.getenv("BOT_TOKEN")
DEV_USER_ID = os.getenv("DEV_USER_ID")
HEX_COLOR = re.compile(r"^#[0-9a-f]{6}$", re.IGNORECASE)
IMAGE = re.compile(r"^data:image/(?:png|jpeg|webp|gif);base64,", re.IGNORECASE)
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH = re.compile(r"^\d{4}-\d{2}$")
STATIC_FILES = {"app.js", "styles.css"}

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 8_000_000
database.initialize()


def telegram_user_id():
    if DEV_USER_ID:
        return int(DEV_USER_ID)
    if not BOT_TOKEN:
        raise ValueError("BOT_TOKEN is not configured")

    authorization = request.headers.get("Authorization", "")
    raw = authorization[4:] if authorization.startswith("tma ") else ""
    values = dict(parse_qsl(raw, keep_blank_values=True))
    received_hash = values.pop("hash", "")
    data_check = "\n".join(f"{key}={values[key]}" for key in sorted(values))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    if not received_hash or not hmac.compare_digest(received_hash, expected_hash):
        raise PermissionError("Invalid Telegram signature")
    if abs(time.time() - int(values.get("auth_date", 0))) > 86400:
        raise PermissionError("Expired Telegram session")
    user = json.loads(values.get("user", "null"))
    if not isinstance(user, dict) or not isinstance(user.get("id"), int):
        raise PermissionError("Missing Telegram user")
    return user["id"]


def valid_entry(value):
    if not isinstance(value, dict) or not isinstance(value.get("html"), str) or len(value["html"]) > 100_000:
        raise ValueError("Invalid entry")
    tags = value.get("tags")
    photos = value.get("photos")
    color = value.get("color", "")
    if not isinstance(tags, list) or len(tags) > 50 or any(not isinstance(tag, str) or len(tag) > 50 for tag in tags):
        raise ValueError("Invalid tags")
    if color and (not isinstance(color, str) or not HEX_COLOR.fullmatch(color)):
        raise ValueError("Invalid color")
    # ponytail: photos stay in SQLite JSON; use object storage when database size becomes a real problem.
    if not isinstance(photos, list) or len(photos) > 12 or any(not isinstance(photo, str) or not IMAGE.match(photo) for photo in photos):
        raise ValueError("Invalid photos")
    return {"html": value["html"], "tags": tags, "color": color, "photos": photos}


@app.errorhandler(ValueError)
def bad_request(error):
    return jsonify(error=str(error)), 400


@app.errorhandler(PermissionError)
def unauthorized(error):
    return jsonify(error=str(error)), 401


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:name>")
def static_file(name):
    if name not in STATIC_FILES:
        return jsonify(error="Not found"), 404
    return send_from_directory(ROOT, name)


@app.get("/api/health")
def health():
    return jsonify(ok=True)


@app.get("/api/month/<month>")
def month(month):
    if not MONTH.fullmatch(month):
        raise ValueError("Invalid month")
    return jsonify(database.get_month(telegram_user_id(), month))


@app.put("/api/entries/<day>")
def entry(day):
    if not DAY.fullmatch(day):
        raise ValueError("Invalid day")
    value = valid_entry(request.get_json())
    database.save_entry(telegram_user_id(), day, value, int(time.time() * 1000))
    return jsonify(value)


@app.get("/api/palette")
def get_palette():
    return jsonify(database.get_palette(telegram_user_id()))


@app.put("/api/palette")
def save_palette():
    colors = request.get_json()
    if not isinstance(colors, list) or len(colors) > 32 or any(not isinstance(color, str) or not HEX_COLOR.fullmatch(color) for color in colors):
        raise ValueError("Invalid palette")
    database.save_palette(telegram_user_id(), colors)
    return jsonify(colors)


if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")), debug=False)
