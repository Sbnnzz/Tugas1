"""Radiology requests (permintaan radiologi): a doctor orders an exam, the radiographer
performs it, the radiologist reads it.

Status: requested (waiting for the radiographer) -> imaged (waiting for the radiologist)
-> reported (reading sent to SATUSEHAT). Stored in Backend/data/simrs.db (gitignored).
"""
import contextlib
import datetime
import json
import os
import sqlite3
import uuid

import config

STATUSES = ("requested", "imaged", "reported")


class NotRequested(Exception):
    """Raised when an image is attached to a request that is no longer waiting for one."""


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
            CREATE TABLE IF NOT EXISTS orders (
                id         TEXT PRIMARY KEY,
                created    TEXT NOT NULL,
                updated    TEXT NOT NULL,
                created_by TEXT NOT NULL,
                status     TEXT NOT NULL,       -- requested | imaged | reported
                data       TEXT NOT NULL,       -- JSON: patient, exam, indication, priority, note, requester
                study_id   TEXT                 -- archive study made from this request
            )
            """
        )


def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def _public(row):
    return {"id": row["id"], "created": row["created"], "updated": row["updated"],
            "created_by": row["created_by"], "status": row["status"], "study_id": row["study_id"],
            "data": json.loads(row["data"])}


def list_orders(status=None, nik=None):
    with _db() as con:
        rows = [_public(r) for r in con.execute("SELECT * FROM orders ORDER BY created DESC")]
    if status:
        rows = [o for o in rows if o["status"] == status]
    if nik:
        rows = [o for o in rows if o["data"].get("patient", {}).get("nik") == nik]
    return rows


def get_order(order_id):
    with _db() as con:
        row = con.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    return _public(row) if row else None


def create_order(data, username):
    order_id = "RQ-" + datetime.datetime.now().strftime("%y%m%d") + "-" + uuid.uuid4().hex[:4].upper()
    with _db() as con:
        con.execute("INSERT INTO orders VALUES (?, ?, ?, ?, 'requested', ?, NULL)",
                    (order_id, _now(), _now(), username, json.dumps(data, ensure_ascii=False)))
    return get_order(order_id)


def set_imaged(order_id, study_id):
    """The radiographer attached an image. Only allowed while the request is still waiting."""
    with _db() as con:
        changed = con.execute("UPDATE orders SET status = 'imaged', study_id = ?, updated = ? "
                              "WHERE id = ? AND status = 'requested'", (study_id, _now(), order_id)).rowcount
    if changed != 1:
        raise NotRequested(order_id)


def set_reported(order_id):
    with _db() as con:
        con.execute("UPDATE orders SET status = 'reported', updated = ? WHERE id = ?", (_now(), order_id))
