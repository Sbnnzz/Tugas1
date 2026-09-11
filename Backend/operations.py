"""Instalasi Bedah records: operation schedule + operation report.

Stored in the same SQLite file as the accounts (Backend/data/simrs.db, gitignored).
Each row keeps the form as JSON (patient / schedule / report) plus its status and, once
sent, the SATUSEHAT Encounter and Procedure ids. A sent operation is read-only.
"""
import contextlib
import datetime
import json
import os
import sqlite3
import uuid

import config


class AlreadySent(Exception):
    """Raised when someone tries to change an operation that was already sent to SATUSEHAT."""


@contextlib.contextmanager
def _db():
    os.makedirs(config.DATA_DIR, exist_ok=True)
    con = sqlite3.connect(config.DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db():
    with _db() as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS operations (
                id           TEXT PRIMARY KEY,
                created      TEXT NOT NULL,
                updated      TEXT NOT NULL,
                created_by   TEXT NOT NULL,
                status       TEXT NOT NULL,          -- scheduled | sent
                data         TEXT NOT NULL,          -- JSON: patient, schedule, report
                encounter_id TEXT,
                procedure_id TEXT
            )
            """
        )


def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def _public(row):
    return {"id": row["id"], "created": row["created"], "updated": row["updated"],
            "created_by": row["created_by"], "status": row["status"],
            "encounter_id": row["encounter_id"], "procedure_id": row["procedure_id"],
            "data": json.loads(row["data"])}


def list_operations():
    with _db() as con:
        return [_public(r) for r in con.execute("SELECT * FROM operations ORDER BY updated DESC")]


def get_operation(op_id):
    with _db() as con:
        row = con.execute("SELECT * FROM operations WHERE id = ?", (op_id,)).fetchone()
    return _public(row) if row else None


def save_operation(op_id, data, username):
    """Create a new operation (op_id empty/unknown) or update an unsent one. Returns it."""
    payload = json.dumps(data, ensure_ascii=False)
    with _db() as con:
        row = con.execute("SELECT status FROM operations WHERE id = ?", (op_id,)).fetchone() if op_id else None
        if row is not None:
            if row["status"] == "sent":
                raise AlreadySent(op_id)
            con.execute("UPDATE operations SET data = ?, updated = ? WHERE id = ?", (payload, _now(), op_id))
        else:
            op_id = "OP-" + datetime.datetime.now().strftime("%y%m%d") + "-" + uuid.uuid4().hex[:4].upper()
            con.execute("INSERT INTO operations VALUES (?, ?, ?, ?, 'scheduled', ?, NULL, NULL)",
                        (op_id, _now(), _now(), username, payload))
    return get_operation(op_id)


def mark_sent(op_id, encounter_id, procedure_id):
    with _db() as con:
        con.execute("UPDATE operations SET status = 'sent', encounter_id = ?, procedure_id = ?, updated = ? WHERE id = ?",
                    (encounter_id, procedure_id, _now(), op_id))
