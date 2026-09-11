"""Patient registry (master pasien): patients registered at this hospital, each linked to
SATUSEHAT by NIK and IHS number. Doctors pick patients from this list instead of typing them.

SATUSEHAT only returns an IHS number and a masked name for a NIK, so the full identity
(name, sex, birth date, contact) is kept here. Stored in Backend/data/simrs.db (gitignored).
"""
import contextlib
import datetime
import json
import os
import sqlite3

import config

GENDERS = ("Laki-laki", "Perempuan")


class AlreadyRegistered(Exception):
    """Raised when a NIK is registered a second time."""


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
            CREATE TABLE IF NOT EXISTS patients (
                nik        TEXT PRIMARY KEY,
                ihs_number TEXT NOT NULL,      -- SATUSEHAT Patient id
                satusehat  TEXT NOT NULL,      -- found (already in SATUSEHAT) | created (registered by us)
                created    TEXT NOT NULL,
                created_by TEXT NOT NULL,
                data       TEXT NOT NULL       -- JSON: name, gender, birthDate, phone, address, city, birthPlace
            )
            """
        )


def _public(row):
    return {"nik": row["nik"], "ihs_number": row["ihs_number"], "satusehat": row["satusehat"],
            "created": row["created"], "created_by": row["created_by"], **json.loads(row["data"])}


def list_patients():
    with _db() as con:
        rows = con.execute("SELECT * FROM patients").fetchall()
    return sorted((_public(r) for r in rows), key=lambda p: p.get("name", "").lower())


def get_patient(nik):
    with _db() as con:
        row = con.execute("SELECT * FROM patients WHERE nik = ?", (str(nik or "").strip(),)).fetchone()
    return _public(row) if row else None


def add_patient(nik, ihs_number, satusehat, data, username):
    try:
        with _db() as con:
            con.execute("INSERT INTO patients VALUES (?, ?, ?, ?, ?, ?)",
                        (nik, ihs_number, satusehat, datetime.datetime.now().isoformat(timespec="seconds"),
                         username, json.dumps(data, ensure_ascii=False)))
    except sqlite3.IntegrityError:
        raise AlreadyRegistered(nik)
    return get_patient(nik)


def order_patient(p):
    """The patient block stored on a request / operation."""
    return {"nik": p["nik"], "name": p.get("name", ""), "gender": p.get("gender", ""),
            "birthDate": p.get("birthDate", ""), "ihs": p.get("ihs_number", "")}
