"""SATUSEHAT PACS Hub — FastAPI backend.

Two jobs:
  1. SATUSEHAT bridge  — OAuth2 + FHIR calls (live sandbox, or mock).
  2. Local PACS archive — store uploaded DICOM studies + metadata so the
     "arsip" (series rail / worklist) can become real, shared over LAN.

Also serves the Frontend/ folder as static files, so one command runs
the whole app:   uvicorn main:app --reload --port 8000 --host 0.0.0.0
Then open http://localhost:8000/   (API lives under /api/*).
"""
import os
import json
import uuid
import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import config
from satusehat import client as sehat

app = FastAPI(title="SATUSEHAT PACS Hub API", version="1.0")

# allow the frontend to call the API when opened from file:// or another port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(config.UPLOAD_DIR, exist_ok=True)


# ---------- archive helpers ----------
def load_studies():
    if os.path.exists(config.STUDIES_DB):
        try:
            with open(config.STUDIES_DB, "r", encoding="utf-8") as f:
                return json.load(f)
        except (ValueError, OSError):
            return []
    return []


def save_studies(studies):
    os.makedirs(config.DATA_DIR, exist_ok=True)
    with open(config.STUDIES_DB, "w", encoding="utf-8") as f:
        json.dump(studies, f, indent=2, ensure_ascii=False)


# ---------- status ----------
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "mode": config.MODE,               # LIVE or MOCK
        "org_id_set": bool(config.ORG_ID),
        "base": config.SATUSEHAT_BASE,
        "studies": len(load_studies()),
    }


# ---------- SATUSEHAT bridge ----------
@app.post("/api/satusehat/token")
async def token():
    return await sehat.get_token()


@app.get("/api/satusehat/patient")
async def patient(nik: str):
    return await sehat.search_patient(nik)


@app.post("/api/satusehat/imaging-study")
async def imaging_study(payload: dict):
    return await sehat.create("ImagingStudy", payload)


@app.post("/api/satusehat/diagnostic-report")
async def diagnostic_report(payload: dict):
    return await sehat.create("DiagnosticReport", payload)


@app.post("/api/satusehat/send-study")
async def send_study(body: dict):
    """Build ImagingStudy + DiagnosticReport from a study and POST both.
    body: {name, nik, modality, description, icd10, diagnosis, finding, instalasi}
    Returns a step-by-step log for the frontend API console."""
    return await sehat.send_study(body)


# ---------- local PACS archive ----------
@app.get("/api/studies")
def list_studies():
    return load_studies()


@app.post("/api/studies")
async def add_study(file: UploadFile = File(None), meta: str = Form("{}")):
    try:
        m = json.loads(meta or "{}")
    except ValueError:
        m = {}
    sid = uuid.uuid4().hex[:12]
    filename = None
    if file is not None:
        safe = os.path.basename(file.filename or "study.dcm")
        filename = f"{sid}_{safe}"
        with open(os.path.join(config.UPLOAD_DIR, filename), "wb") as f:
            f.write(await file.read())
    study = {
        "id": sid,
        "created": datetime.datetime.now().isoformat(timespec="seconds"),
        "file": filename,
        "sent": False,
        **m,
    }
    studies = load_studies()
    studies.insert(0, study)
    save_studies(studies)
    return study


@app.get("/api/studies/{sid}/file")
def study_file(sid: str):
    study = next((s for s in load_studies() if s["id"] == sid), None)
    if not study or not study.get("file"):
        raise HTTPException(status_code=404, detail="file not found")
    path = os.path.join(config.UPLOAD_DIR, study["file"])
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="file missing on disk")
    return FileResponse(path, media_type="application/dicom", filename=study["file"])


# ---------- serve the frontend (must be mounted LAST) ----------
if os.path.isdir(config.FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
