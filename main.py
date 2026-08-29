import os
import re
import time

from flask import Flask, jsonify, request

import database


HEX_COLOR = re.compile(r"^#[0-9a-f]{6}$", re.IGNORECASE)
IMAGE = re.compile(r"^data:image/(?:png|jpeg|webp|gif);base64,", re.IGNORECASE)
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH = re.compile(r"^\d{4}-\d{2}$")
USER_ID = 1

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 8_000_000
database.initialize()


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


@app.after_request
def cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, OPTIONS"
    return response


@app.get("/api/health")
def health():
    return jsonify(ok=True)


@app.get("/api/month/<month>")
def month(month):
    if not MONTH.fullmatch(month):
        raise ValueError("Invalid month")
    return jsonify(database.get_month(USER_ID, month))


@app.put("/api/entries/<day>")
def entry(day):
    if not DAY.fullmatch(day):
        raise ValueError("Invalid day")
    value = valid_entry(request.get_json())
    database.save_entry(USER_ID, day, value, int(time.time() * 1000))
    return jsonify(value)


@app.get("/api/palette")
def get_palette():
    return jsonify(database.get_palette(USER_ID))


@app.put("/api/palette")
def save_palette():
    colors = request.get_json()
    if not isinstance(colors, list) or len(colors) > 32 or any(not isinstance(color, str) or not HEX_COLOR.fullmatch(color) for color in colors):
        raise ValueError("Invalid palette")
    database.save_palette(USER_ID, colors)
    return jsonify(colors)


if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8750")), debug=False)
