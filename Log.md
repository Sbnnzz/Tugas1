# SIMRS × SATUSEHAT PACS Hub — Dev Log & Current State

**Repo:** https://github.com/Sbnnzz/Tugas1 (branch: `main`)
**What it is:** SIMRS mockup PACS / Instalasi Radiologi integrated with **SATUSEHAT**
(Kemenkes) via **HL7 FHIR R4**, environment **Sandbox**.

---

## Architecture (final)

```
Tugas1/
├─ Frontend/                 # HTML/CSS/JS, no build. DICOM viewing via DWV (CDN).
│   ├─ index.html            # Main menu
│   ├─ instalasi.html        # Input pemeriksaan + upload + real NIK lookup + Kirim
│   ├─ pacs.html             # PACS viewer: grid + real DWV DICOM (scroll, W/L, MPR)
│   └─ sample-chest.dcm, sample-ct.dcm   # single-slice demo files
├─ Backend/                  # FastAPI
│   ├─ main.py               # routes + serves Frontend + /api/normalize-series
│   ├─ satusehat.py          # OAuth2 + full FHIR radiology chain (live/mock)
│   ├─ config.py             # reads .env → MODE LIVE/MOCK
│   ├─ requirements.txt       # fastapi, uvicorn, httpx, python-dotenv, python-multipart, pydicom
│   └─ .env                  # SANDBOX creds — GITIGNORED, never commit
├─ reference/react-aistudio/ # original Google AI Studio React app (ARCHIVE, unused)
├─ README.md, TODO.md, Log.md
```

## Run
```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 --host 0.0.0.0
```
→ open http://localhost:8000  (API at /api/*, LAN-accessible). `.env` empty = MOCK mode.

---

## ✅ What works (all verified)

- **Frontend**: 4 pages, clean clinical dark UI (Siemens/Philips-style), cross-linked nav.
  Cartoon scan placeholders replaced with professional empty-viewport look.
- **Real DICOM viewer (DWV)** in pacs.html + viewer.html:
  - Open `.dcm` / `.ima` / `.dic` / extensionless DICOM (relabels to .dcm for DWV)
  - Window/Level (drag + presets: Abdomen/Lung/Bone/Brain/Mediastinum/Soft)
  - Zoom/Pan, tools wired to DWV
  - **Multi-slice scroll** (mouse wheel) for series
  - **MPR** — volumes auto-switch to 2×2 axial/coronal/sagittal; single images = 1 view
- **Backend (FastAPI)**:
  - SATUSEHAT bridge: OAuth2 + **full radiology chain** Patient→Encounter→ServiceRequest
    (ACSN)→ImagingStudy→Observation→DiagnosticReport, LOINC + ICD-10 + DICOM UIDs.
    Live (creds in .env) or realistic MOCK.
  - **`POST /api/normalize-series`** (pydicom): unifies FrameOfReferenceUID across uploaded
    slices so quirky datasets (e.g. Siemens .IMA with per-slice FoR) stack into a scrollable
    volume. Frontend routes folder/multi uploads through it.
  - Local PACS archive: `/api/studies` (upload/list), `/api/studies/{id}/file`.
- **Frontend↔backend wired**: "Kirim ke SATUSEHAT" (all 3 pages) POSTs to `/api/satusehat/send-study`,
  renders real request/response in the API console, falls back to mock animation if backend down.

## Key technical solutions
- DICOM non-.dcm (Siemens .IMA): relabel File→.dcm before DWV (frontend `asDicom`).
- Slices not stacking = **different FrameOfReferenceUID per slice** → pydicom unifies it (backend normalize).
- MPR: DWV `setDataViewConfigs` with axial/coronal/sagittal orientations, applied on `loadend`
  (not `load`, which fires early), inside `requestAnimationFrame` so cells are sized first.

## ⚠️ Known non-blocking issues
- MPR layout swap logs 2 non-fatal DWV console errors (`getEventType`, transient
  `zero sized container layerGroup1`) — everything still renders correctly. Cosmetic; could be polished.
- Folder/multi-slice scroll + MPR **require the backend running** (normalization is server-side).
  Single files work frontend-only.
- Multi-study accumulation: loading a 2nd study without closing keeps the 1st in the app (open one at a time).

## What's left / notes for the team
- Fill `Backend/.env` with real sandbox creds → flips MOCK→LIVE; do one **LIVE smoke test** (watch for 422s).
- Optional: mask the full bearer token before returning it to the browser (satusehat.py — low risk on sandbox).
- Optional polish: eliminate the 2 MPR console errors; clear previous study on new load.
- Demo: samples are single-slice (no scroll/MPR) — load a real multi-slice series (e.g. an MRI folder) to show scroll + MPR.
- Sample MATLAB MRI data is NOT in the repo (not ours to redistribute) — load it locally at demo time.

## Git / handoff
- History was rewritten once (removed messy/offensive commits) — anyone with an old clone must **re-clone**.
- Friends work on feature branches → merge to `main` (Task 2 and Task 3 merged this way).
- `.env` is gitignored (verified). `Backend/data/` (archive + normalized series) gitignored.
- See `TODO.md` for the Claude-Code-ready task handoff.
