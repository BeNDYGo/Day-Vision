import json
import os
import sqlite3
from pathlib import Path


DATABASE_PATH = os.getenv("DATABASE_PATH", Path(__file__).with_name("dayvision.sqlite"))
DEFAULT_COLORS = ["#77ae8a", "#cfe7bf", "#d8a94f", "#f6e8a9", "#b66f73", "#e29a96", "#9fc7dc", "#c9b3dc"]


def connect():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def initialize():
    with connect() as database:
        database.executescript("""
            CREATE TABLE IF NOT EXISTS entries (
                user_id INTEGER NOT NULL,
                day TEXT NOT NULL,
                data TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, day)
            ) STRICT;
            CREATE TABLE IF NOT EXISTS palettes (
                user_id INTEGER PRIMARY KEY,
                colors TEXT NOT NULL
            ) STRICT;
        """)


def get_month(user_id, month):
    with connect() as database:
        rows = database.execute(
            "SELECT day, data FROM entries WHERE user_id = ? AND day LIKE ? ORDER BY day",
            (user_id, f"{month}-%"),
        ).fetchall()
    return {day: json.loads(data) for day, data in rows}


def save_entry(user_id, day, entry, updated_at):
    with connect() as database:
        database.execute("""
            INSERT INTO entries (user_id, day, data, updated_at) VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id, day) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        """, (user_id, day, json.dumps(entry, ensure_ascii=False), updated_at))


def get_palette(user_id):
    with connect() as database:
        row = database.execute("SELECT colors FROM palettes WHERE user_id = ?", (user_id,)).fetchone()
    return json.loads(row[0]) if row else DEFAULT_COLORS


def save_palette(user_id, colors):
    with connect() as database:
        database.execute("""
            INSERT INTO palettes (user_id, colors) VALUES (?, ?)
            ON CONFLICT (user_id) DO UPDATE SET colors = excluded.colors
        """, (user_id, json.dumps(colors)))
