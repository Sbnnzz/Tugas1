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
import io
import json
import uuid
import datetime
from typing import List

import pydicom
from pydicom.uid import generate_uid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import auth
import config
import operations
import nifti
import orders
from satusehat import client as sehat

app = FastAPI(title="SATUSEHAT PACS Hub API", version="1.0")

# allow the frontend to call the API when opened from file:// or another port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_stale_pages(request: Request, call_next):
    """Make browsers re-check pages and scripts on every load (a 304 when unchanged), so they
    never show a copy saved before the last update."""
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response

os.makedirs(config.UPLOAD_DIR, exist_ok=True)
auth.init_db()
operations.init_db()
orders.init_db()

# Who may call what. Pages hide what a role cannot use; these checks are the real guard.
ADMIN = ("admin",)
REPORTERS = ("radiolog", "admin")                         # write the reading, send to SATUSEHAT
ARCHIVE_WRITE = ("radiografer", "admin")                  # register + upload studies
ARCHIVE_READ = ("radiografer", "radiolog", "dokter_bedah", "admin")
READING_FIELDS = ("icd10", "diagnosis", "finding")
BEDAH = ("dokter_bedah", "admin")                           # surgery schedule + operation report
ORDERERS = ("dokter_bedah", "admin")                        # request radiology exams
EXAM_MODALITIES = ("DX", "CT", "MR", "US")


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


def update_study(sid, fields):
    studies = load_studies()
    for study in studies:
        if study["id"] == sid:
            study.update(fields)
            save_studies(studies)
            return study
    return None


# ---------- login ----------
class LoginBody(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def login(body: LoginBody, response: Response):
    user = auth.authenticate(body.username.strip(), body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = auth.create_session(user["username"])
    # cookie = this browser's default login; the token = this tab's own login (kept in sessionStorage)
    response.set_cookie(auth.SESSION_COOKIE, token, max_age=auth.SESSION_TTL, httponly=True, samesite="lax")
    return {**user, "token": token}


@app.post("/api/auth/tab-session")
def tab_session(request: Request):
    """A separate login for one browser tab, as the account this browser is logged in with."""
    user = auth.session_user(request.cookies.get(auth.SESSION_COOKIE, ""))
    if user is None:
        raise HTTPException(status_code=401, detail="Belum login di browser ini")
    return {**user, "token": auth.create_session(user["username"])}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    """Ends only this tab's login; other tabs keep theirs."""
    token = auth.request_token(request)
    auth.end_session(token)
    if request.cookies.get(auth.SESSION_COOKIE, "") == token:
        response.delete_cookie(auth.SESSION_COOKIE)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: dict = Depends(auth.current_user)):
    return user


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
async def token(user: dict = Depends(auth.require_roles(*ADMIN))):
    return await sehat.get_token()


@app.get("/api/satusehat/patient")
async def patient(nik: str, user: dict = Depends(auth.require_roles(*ARCHIVE_READ))):
    return await sehat.search_patient(nik)


@app.post("/api/satusehat/imaging-study")
async def imaging_study(payload: dict, user: dict = Depends(auth.require_roles(*ADMIN))):
    return await sehat.create("ImagingStudy", payload)


@app.post("/api/satusehat/diagnostic-report")
async def diagnostic_report(payload: dict, user: dict = Depends(auth.require_roles(*ADMIN))):
    return await sehat.create("DiagnosticReport", payload)


@app.post("/api/satusehat/send-study")
async def send_study(body: dict, user: dict = Depends(auth.require_roles(*REPORTERS))):
    """Build ImagingStudy + DiagnosticReport from a study and POST both.
    body: {name, nik, modality, description, icd10, diagnosis, finding, instalasi}
    Returns a step-by-step log for the frontend API console."""
    if body.get("archive_id"):
        study = next((st for st in load_studies() if st["id"] == body["archive_id"]), None)
        if study is not None and study.get("sent"):
            # sending again would create a second set of records in SATUSEHAT
            raise HTTPException(status_code=409, detail="Studi ini sudah dibaca dan dikirim ke SATUSEHAT")
    result = await sehat.send_study(body)
    if result.get("ok") and body.get("archive_id"):
        # keep the radiologist's reading with the archived study; the surgeon reads it in Bedah
        study = update_study(body["archive_id"], {
            **{key: body.get(key, "") for key in READING_FIELDS},
            "sent": True, "reported_by": user["username"],
            "imaging_study_id": result.get("imaging_study_id", ""),
            "diagnostic_report_id": result.get("diagnostic_report_id", ""),
        })
        if study and study.get("order_id"):
            orders.set_reported(study["order_id"])
    return result


# ---------- radiology requests (permintaan radiologi) ----------
@app.get("/api/orders")
def list_orders(status: str = "", nik: str = "", user: dict = Depends(auth.require_roles(*ARCHIVE_READ))):
    """Requests, newest first, each with its archive study (and the reading, once sent) attached."""
    studies = {st["id"]: st for st in load_studies()}
    result = []
    for order in orders.list_orders(status or None, nik or None):
        study = studies.get(order["study_id"] or "")
        order["study"] = ({key: study.get(key) for key in ("id", "file", "created", "modality", "sent",
                                                          "icd10", "diagnosis", "finding", "reported_by")}
                          if study else None)
        result.append(order)
    return result


@app.post("/api/orders")
def create_order(body: dict, user: dict = Depends(auth.require_roles(*ORDERERS))):
    """A doctor requests an exam. body: {patient{nik,name,gender,birthDate}, exam{modality,description},
    indication{icd10,text}, priority, note}"""
    patient, exam = body.get("patient") or {}, body.get("exam") or {}
    if not str(patient.get("nik", "")).strip() or not str(exam.get("description", "")).strip():
        raise HTTPException(status_code=400, detail="NIK pasien dan jenis pemeriksaan wajib diisi")
    if exam.get("modality") not in EXAM_MODALITIES:
        raise HTTPException(status_code=400, detail="Modality harus salah satu dari " + ", ".join(EXAM_MODALITIES))
    data = {"patient": patient, "exam": exam, "indication": body.get("indication") or {},
            "priority": body.get("priority") or "Biasa", "note": body.get("note") or "",
            "requester": user["full_name"]}
    return orders.create_order(data, user["username"])


# ---------- Instalasi Bedah (surgery) ----------
@app.get("/api/operations")
def list_operations(user: dict = Depends(auth.require_roles(*BEDAH))):
    return operations.list_operations()


@app.post("/api/operations")
def save_operation(body: dict, user: dict = Depends(auth.require_roles(*BEDAH))):
    """Create or update an operation. body: {id?, patient, schedule, report}"""
    data = {key: body.get(key) or {} for key in ("patient", "schedule", "report")}
    try:
        return operations.save_operation(body.get("id"), data, user["username"])
    except operations.AlreadySent:
        raise HTTPException(status_code=409, detail="Operasi sudah dikirim ke SATUSEHAT; buat laporan baru")


@app.post("/api/satusehat/send-procedure")
async def send_procedure(body: dict, user: dict = Depends(auth.require_roles(*BEDAH))):
    """Send a saved operation as Encounter + Procedure. body: {operation_id}"""
    op = operations.get_operation(body.get("operation_id") or "")
    if op is None:
        raise HTTPException(status_code=404, detail="Operasi belum disimpan")
    if op["status"] == "sent":
        raise HTTPException(status_code=409, detail="Operasi sudah dikirim ke SATUSEHAT")
    result = await sehat.send_procedure(op["data"])
    if result["ok"]:
        operations.mark_sent(op["id"], result["encounter_id"], result["procedure_id"])
    result["operation"] = operations.get_operation(op["id"])
    return result


# ---------- local PACS archive ----------
@app.get("/api/studies")
def list_studies(user: dict = Depends(auth.require_roles(*ARCHIVE_READ))):
    return load_studies()


@app.post("/api/studies")
async def add_study(file: UploadFile = File(None), meta: str = Form("{}"),
                    user: dict = Depends(auth.require_roles(*ARCHIVE_WRITE))):
    try:
        m = json.loads(meta or "{}")
    except ValueError:
        m = {}
    if user["role"] not in REPORTERS:
        # only a radiologist writes the reading; drop it if someone else sends one
        for key in READING_FIELDS:
            m.pop(key, None)
    m["saved_by"] = user["username"]
    order_id = m.get("order_id") or ""
    if order_id:
        order = orders.get_order(order_id)
        if order is None:
            raise HTTPException(status_code=404, detail="Permintaan radiologi tidak ditemukan")
        if order["status"] != "requested":
            raise HTTPException(status_code=409, detail="Permintaan ini sudah diproses")
        # the request is the source of truth for the patient and what was ordered
        patient, exam = order["data"].get("patient", {}), order["data"].get("exam", {})
        m.update({"name": patient.get("name", ""), "nik": patient.get("nik", ""),
                  "gender": patient.get("gender", ""), "birthDate": patient.get("birthDate", ""),
                  "modality": exam.get("modality", ""), "description": exam.get("description", ""),
                  "doctor": order["data"].get("requester", ""),
                  "clinical": order["data"].get("indication", {}).get("text", ""), "order_id": order_id})
    elif user["role"] == "radiografer":
        raise HTTPException(status_code=400, detail="Pilih permintaan radiologi terlebih dulu")
    sid = uuid.uuid4().hex[:12]
    filename = None
    if file is not None:
        raw = await file.read()
        if not (nifti.is_dicom(raw) or nifti.is_nifti(raw)):
            raise HTTPException(status_code=400,
                                detail="Hanya berkas DICOM (.dcm, .ima) atau NIfTI (.nii, .nii.gz) yang diterima")
        safe = os.path.basename(file.filename or "study.dcm")
        filename = f"{sid}_{safe}"
        with open(os.path.join(config.UPLOAD_DIR, filename), "wb") as f:
            f.write(raw)
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
    if order_id:
        try:
            orders.set_imaged(order_id, sid)
        except orders.NotRequested:
            pass  # finished by someone else at the same moment; the study is kept
    return study


@app.get("/api/studies/{sid}/file")
def study_file(sid: str, user: dict = Depends(auth.require_roles(*ARCHIVE_READ))):
    study = next((s for s in load_studies() if s["id"] == sid), None)
    if not study or not study.get("file"):
        raise HTTPException(status_code=404, detail="file not found")
    path = os.path.join(config.UPLOAD_DIR, study["file"])
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="file missing on disk")
    return FileResponse(path, media_type="application/dicom", filename=study["file"])


# ---------- DICOM series normalization (pydicom) ----------
# Some datasets give each slice a different FrameOfReferenceUID, which stops the
# viewer (DWV) from stacking them into one scrollable volume. We unify the FoR
# UID across the uploaded slices (nothing else is touched), sort by instance
# number, and serve them back so they stack + scroll.
SERIES_DIR = os.path.join(config.DATA_DIR, "series")


@app.post("/api/normalize-series")
async def normalize_series(files: List[UploadFile] = File(...),
                           user: dict = Depends(auth.require_roles(*REPORTERS))):  # PACS users
    sid = uuid.uuid4().hex[:12]
    out = os.path.join(SERIES_DIR, sid)
    os.makedirs(out, exist_ok=True)
    for_uid = generate_uid()
    parsed = []
    for uf in files:
        raw = await uf.read()
        if nifti.is_nifti(raw):
            try:
                parsed.extend(nifti.nifti_to_datasets(raw))  # a NIfTI volume -> DICOM slices
            except Exception:
                pass  # unreadable NIfTI: skip it
            continue
        try:
            parsed.append(pydicom.dcmread(io.BytesIO(raw)))
        except Exception:
            continue  # skip non-DICOM / unreadable files

    def _order(ds):
        try:
            return int(getattr(ds, "InstanceNumber", 0) or 0)
        except (TypeError, ValueError):
            return 0
    parsed.sort(key=_order)

    urls = []
    for i, ds in enumerate(parsed, 1):
        ds.FrameOfReferenceUID = for_uid          # the only change: unify FoR
        name = f"{i:04d}.dcm"
        ds.save_as(os.path.join(out, name))
        urls.append(f"/api/series/{sid}/{name}")
    return {"series_id": sid, "count": len(urls), "urls": urls}


@app.get("/api/studies/{sid}/slices")
def study_slices(sid: str, user: dict = Depends(auth.require_roles(*REPORTERS))):
    """URLs of the DICOM images for one archived study. A NIfTI study is converted once into
    DICOM slices (cached under data/series) so the viewer can show it as a volume."""
    study = next((s for s in load_studies() if s["id"] == sid), None)
    if not study or not study.get("file"):
        raise HTTPException(status_code=404, detail="file not found")
    path = os.path.join(config.UPLOAD_DIR, study["file"])
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="file missing on disk")
    with open(path, "rb") as f:
        raw = f.read()
    if not nifti.is_nifti(raw):
        return {"count": 1, "urls": [f"/api/studies/{sid}/file"]}
    key = "nifti-" + os.path.basename(sid)
    out = os.path.join(SERIES_DIR, key)
    if not (os.path.isdir(out) and os.listdir(out)):
        os.makedirs(out, exist_ok=True)
        for i, ds in enumerate(nifti.nifti_to_datasets(raw, study), 1):
            ds.save_as(os.path.join(out, f"{i:04d}.dcm"))
    names = sorted(os.listdir(out))
    return {"count": len(names), "urls": [f"/api/series/{key}/{n}" for n in names]}


@app.get("/api/series/{sid}/{name}")
def series_file(sid: str, name: str, user: dict = Depends(auth.require_roles(*REPORTERS))):
    path = os.path.join(SERIES_DIR, os.path.basename(sid), os.path.basename(name))
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="slice not found")
    return FileResponse(path, media_type="application/dicom")


# ---------- serve the frontend (must be mounted LAST) ----------
if os.path.isdir(config.FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
