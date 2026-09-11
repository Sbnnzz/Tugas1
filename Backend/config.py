"""Configuration for the SATUSEHAT PACS Hub backend.

Loads credentials from Backend/.env. If credentials are missing (or
SATUSEHAT_MOCK is set), the backend runs in MOCK mode and returns
realistic FHIR-shaped responses so the demo works fully offline.
"""
import os
from dotenv import load_dotenv

_HERE = os.path.dirname(__file__)
load_dotenv(os.path.join(_HERE, ".env"))

# --- SATUSEHAT endpoints ---
SATUSEHAT_BASE = os.getenv(
    "SATUSEHAT_BASE", "https://api-satusehat-stg.dto.kemkes.go.id"
).rstrip("/")
OAUTH_URL = f"{SATUSEHAT_BASE}/oauth2/v1"
FHIR_URL = f"{SATUSEHAT_BASE}/fhir-r4/v1"

# --- credentials ---
CLIENT_ID = os.getenv("SATUSEHAT_CLIENT_ID", "").strip()
CLIENT_SECRET = os.getenv("SATUSEHAT_CLIENT_SECRET", "").strip()
ORG_ID = os.getenv("SATUSEHAT_ORG_ID", "").strip()

_PLACEHOLDERS = {
    "", "paste_your_org_id_here",
    "paste_your_client_id_here", "paste_your_client_secret_here",
}
_HAS_CREDS = CLIENT_ID not in _PLACEHOLDERS and CLIENT_SECRET not in _PLACEHOLDERS
_FORCE_MOCK = os.getenv("SATUSEHAT_MOCK", "").strip().lower() in ("1", "true", "yes", "on")

# LIVE when real creds are present and mock isn't forced; otherwise MOCK.
MOCK = _FORCE_MOCK or not _HAS_CREDS
MODE = "MOCK" if MOCK else "LIVE"

# --- sandbox actors used by the radiology chain ---
# Defaults are SATUSEHAT's published sandbox dummies; override in .env when needed.
PRACTITIONER_ID = os.getenv("SATUSEHAT_PRACTITIONER_ID", "").strip() or "10009880728"
PRACTITIONER_NAME = os.getenv("SATUSEHAT_PRACTITIONER_NAME", "").strip() or "dr. Alexander"
DEFAULT_PATIENT_ID = os.getenv("SATUSEHAT_PATIENT_ID", "").strip() or "P02478375538"
DEFAULT_PATIENT_NAME = os.getenv("SATUSEHAT_PATIENT_NAME", "").strip() or "Ardianto Putra"
# Empty = use the org's first Location, or create "Instalasi Radiologi" once.
LOCATION_ID = os.getenv("SATUSEHAT_LOCATION_ID", "").strip()

# --- local storage (the "instalasi / PACS archive") ---
DATA_DIR = os.path.join(_HERE, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
STUDIES_DB = os.path.join(DATA_DIR, "studies.json")
# staff accounts + login sessions (SQLite)
DB_PATH = os.path.join(DATA_DIR, "simrs.db")

# --- frontend location (served as static files) ---
FRONTEND_DIR = os.path.join(os.path.dirname(_HERE), "Frontend")
