# SIMRS × SATUSEHAT — PACS Hub

Tugas SIMRS: sistem informasi RS (mockup **PACS / Instalasi Radiologi**) yang
terintegrasi dengan platform **SATUSEHAT** (Kemenkes) lewat standar **HL7 FHIR R4**.

- **Frontend:** HTML/CSS/JS (tanpa build) + **DWV** (viewer DICOM asli)
- **Backend:** FastAPI — jembatan SATUSEHAT (OAuth2 + FHIR) + arsip PACS lokal
- **Environment:** SATUSEHAT **Sandbox** (data uji, aman)

---

## Struktur

```
Tugas1/
├─ Frontend/                 # buka di browser — tanpa build
│   ├─ index.html            # Menu utama
│   ├─ instalasi.html        # Workstation input pemeriksaan + upload
│   ├─ pacs.html             # PACS Viewer (grid + DWV real DICOM)
│   ├─ viewer.html           # Live DICOM Viewer (DWV)
│   └─ sample-*.dcm          # contoh DICOM untuk tes
├─ Backend/                  # FastAPI
│   ├─ main.py               # routes + serve frontend
│   ├─ satusehat.py          # OAuth2 + FHIR client (live/mock)
│   ├─ config.py             # baca .env
│   ├─ requirements.txt
│   └─ .env                  # creds SANDBOX (JANGAN commit — sudah gitignore)
├─ reference/react-aistudio/ # app React AI Studio (arsip, tidak dipakai)
└─ Log.md                    # catatan pengembangan
```

## Menjalankan

### Cara cepat (frontend saja, tanpa backend)
Buka `Frontend/index.html` langsung di browser. Semua tampilan jalan; tombol
"Kirim ke SATUSEHAT" memakai animasi mock, dan viewer DICOM (DWV) tetap berfungsi
(butuh internet untuk memuat pustaka DWV dari CDN).

### Full stack (frontend + backend)
```bash
cd Backend
pip install -r requirements.txt
cp .env.example .env        # lalu isi creds sandbox (opsional; kosong = MOCK)
uvicorn main:app --reload --port 8000 --host 0.0.0.0
```
Buka **http://localhost:8000/** — backend menyajikan frontend + API di `/api/*`.
`--host 0.0.0.0` membuatnya bisa diakses lewat **LAN** (teman satu wifi).

## Kredensial SATUSEHAT (LIVE)

Tanpa creds → **MOCK** (respons FHIR palsu yang realistis, demo jalan offline).
Untuk **LIVE**: daftar di `satusehat.kemkes.go.id/platform` → environment **Sandbox**
→ menu **Kode Akses API** → salin Org ID / Client ID / Client Secret ke `Backend/.env`.
Cek mode aktif di `GET /api/health`.

## Endpoint utama (backend)

| Method | Path | Fungsi |
|---|---|---|
| GET  | `/api/health` | status + mode (LIVE/MOCK) |
| POST | `/api/satusehat/token` | ambil access token OAuth2 |
| GET  | `/api/satusehat/patient?nik=` | cari pasien by NIK → IHS |
| POST | `/api/satusehat/send-study` | build + kirim ImagingStudy + DiagnosticReport |
| GET/POST | `/api/studies` | arsip PACS lokal (list / upload) |
| GET  | `/api/studies/{id}/file` | ambil berkas DICOM |

## Status fitur

- ✅ Viewer DICOM asli (buka `.dcm`, window/level, preset, zoom, scroll series)
- ✅ Backend SATUSEHAT bridge (OAuth2 + FHIR, live/mock)
- ✅ Arsip PACS lokal (upload → simpan → list)
- ⏳ Wiring tombol frontend "Kirim" → `/api/satusehat/send-study` (lihat Log.md)

---
Sandbox only — bukan untuk data pasien nyata / diagnosis.
