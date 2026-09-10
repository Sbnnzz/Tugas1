# SIMRS × SATUSEHAT — Dev Log

**Project:** Tugas1 — SIMRS (mockup PACS / Radiology Information System) integrated with SATUSEHAT
**Repo:** https://github.com/Sbnnzz/Tugas1
**Deadline:** besok, sebelum kelas

---

## Konsep

Mini **PACS / Instalasi Radiologi** yang melapor imaging study ke SATUSEHAT.
App menyimpan datanya sendiri (instalasi DB lokal); SATUSEHAT = tujuan sync (bukan sumber data).

## Core Flow (the target)

```
form + upload  →  save to local instalasi DB  →  [Kirim ke SATUSEHAT]  →  push DiagnosticReport + ImagingStudy  →  show JSON proof
```

Langkah detail:
1. **Input form** — demografi (NIK, nama, gender, tgl lahir) + dokter + diagnosis (ICD-10) + asal RS
2. **Upload** citra (DICOM / X-ray)
3. **View / slice** citra
4. **Save** ke local instalasi DB (PACS lokal)
5. **Kirim ke SATUSEHAT** — push `ImagingStudy` + `DiagnosticReport`
6. **JSON console** — tampilkan request/response mentah = bukti integrasi

---

## Tech stack (locked)

- **Frontend:** HTML / CSS / JS + `mockstore.js` (local instalasi DB via localStorage)
- **Backend:** FastAPI (Python) = jembatan SATUSEHAT (OAuth2 + FHIR calls)
- **Run:** localhost / LAN via uvicorn
- Struktur folder sudah dibuat: `Backend/` (config.py, main.py, satusehat.py), `Frontend/` (app.js, index.html, mockstore.js, styles.css)

## Build order

1. **App dulu** — SIMRS/PACS jalan standalone (form, upload, view, save ke mock DB). Tanpa API.
2. **API belakangan** — wire SATUSEHAT sebagai layer tipis di atas (tombol "Kirim ke SATUSEHAT").

Catatan: saat bikin form, pastikan sudah menangkap field yang SATUSEHAT butuh (NIK, nama, gender, tgl lahir, kode ICD-10) supaya wiring akhir gampang.

---

## SATUSEHAT — fakta penting

- **Auth:** OAuth2 `client_credentials` → dapat Bearer token → dipasang di tiap FHIR call.
- **Sandbox endpoints:**
  - OAuth: `https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1`
  - FHIR:  `https://api-satusehat-stg.dto.kemkes.go.id/fhir-r4/v1`
- **Creds:** sudah punya (Sandbox). Semua (Org ID, Client ID, Client Secret) disimpan di `Backend/.env` (gitignored — JANGAN commit / JANGAN tulis di file yang ke-push).
- **Sandbox = playground terisolasi.** Data test tidak menyentuh produksi. Aman kirim data "sampah".

### Resource radiologi (peta ke flow)
- `ServiceRequest` — order pemeriksaan (mis. chest X-ray, modality DX)
- `ImagingStudy` — metadata studi citra (referensi ServiceRequest)
- `DiagnosticReport` — bacaan radiolog + temuan + ICD-10

> Penting: **pixel citra tidak dikirim ke SATUSEHAT.** Citra tetap di PACS lokal; SATUSEHAT hanya simpan metadata + report + referensi ke lokasi citra. (Ini justru bikin demo lebih otentik.)

---

## Keputusan DICOM / viewer

| Opsi | Upload | "Slice" | Tooling | Effort |
|---|---|---|---|---|
| A | PNG/JPEG X-ray | tampil saja (2D) | `<img>` | 🟢 low |
| B | `.dcm` X-ray tunggal | render dcm→PNG | `pydicom` + Pillow (Python) | 🟡 med |
| C | seri CT/MRI (`.dcm` stack) | **slider scroll antar slice** | Cornerstone.js | 🔴 high |

- **C# fo-dicom → TIDAK** (stack Python/JS, jangan campur .NET).
- X-ray = citra 2D tunggal → tidak ada "slice". Slider slice = fitur CT/MRI (Opsi C).
- Rekomendasi deadline: **Opsi A** dulu; upgrade ke B/C kalau ada waktu.

## DECIDED ✅

- **Opsi A (X-ray PNG/JPEG) dulu** — tampil citra 2D, no slicing. Prioritas utama.
- **CT/MRI (Opsi C, slider antar-slice) = stretch goal** kalau masih ada waktu.
- Konteks: low-stakes, "vibecode" — dosen (dokter) cuma minta dibikin. Fokus: jalan + kelihatan nyambung ke SATUSEHAT.

---

## Aturan kerja

- Claude **tidak menulis kode app** sampai diperintah "build".
- `.env` tidak pernah di-commit (sudah di `.gitignore`, verified aman).
- Bangun **real integration + mock fallback** (bukan fake murni) — sama effort-nya, jauh lebih aman & bulletproof buat demo.

---

## Riwayat / catatan

- Repo dibuat via GitHub Desktop, `.gitignore` Python, `.env` aman (ignored, not tracked). Sudah di-publish & dibagikan ke grup.
