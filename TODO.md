# TODO — Backend & Integrasi (buat tim)

Frontend + backend udah jadi. Yang tersisa: **konekin frontend ke backend** dan
**bikin LIVE ke SATUSEHAT**. Urut dari atas.

> ⚠️ **PENTING dulu:** history git udah dibersihin (di-rewrite).
> **Hapus folder lama kalian, terus `git clone` ulang** dari
> https://github.com/Sbnnzz/Tugas1 — kalau nggak, `git pull` bakal error.

---

## 0. Setup (semua orang) — 5 menit
- [ ] Re-clone repo (lihat warning di atas)
- [ ] Install Python deps:
  ```bash
  cd Backend
  pip install -r requirements.txt
  ```
- [ ] Jalanin full app:
  ```bash
  uvicorn main:app --reload --port 8000 --host 0.0.0.0
  ```
- [ ] Buka **http://localhost:8000** → harus muncul Menu. Cek juga
  **http://localhost:8000/api/health** → harus `{"mode":"MOCK",...}`

## 1. Bikin LIVE ke SATUSEHAT (1 orang) — creds
- [ ] Login `satusehat.kemkes.go.id/platform` → environment **Sandbox** →
  menu **Kode Akses API**
- [ ] `cd Backend && cp .env.example .env`
- [ ] Isi `.env`: `SATUSEHAT_ORG_ID`, `SATUSEHAT_CLIENT_ID`, `SATUSEHAT_CLIENT_SECRET`
- [ ] Restart uvicorn → `/api/health` harus jadi `"mode":"LIVE"`
- [ ] **JANGAN commit `.env`** (udah di-gitignore, biarin)

## 2. Wire tombol "Kirim ke SATUSEHAT" → backend (inti tugas)
Sekarang tombol Kirim di frontend masih **animasi mock**. Ganti biar beneran
manggil backend.
- [ ] Di `Frontend/pacs.html`, `viewer.html`, `instalasi.html` — cari fungsi
  tombol `#sendBtn`
- [ ] Ganti animasi mock jadi `fetch` ke backend:
  ```js
  const res = await fetch('/api/satusehat/send-study', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'SUTRISNO, Budi', nik: '3578012504780003',
      modality: 'CR', description: 'X-Ray Thorax',
      icd10: document.querySelector('.icd').value,
      diagnosis: '...', finding: '...', instalasi: 'Radiologi'
    })
  });
  const data = await res.json();   // { ok, mode, logs, imaging_study_id, diagnostic_report_id }
  // tampilin data.logs di console panel
  ```
- [ ] Tampilin `data.logs` (request/response asli) di panel "API Console"
- [ ] **Verifikasi:** klik Kirim → cek `imaging_study_id` & `diagnostic_report_id`
  balik dari backend (kalau LIVE, itu ID asli dari Kemenkes)

## 3. Arsip PACS beneran (opsional / nilai plus)
Biar series rail & worklist nggak fake lagi.
- [ ] Pas upload DICOM di `instalasi.html`, POST file ke `/api/studies`
  (multipart: `file` + `meta` JSON)
- [ ] Di `pacs.html`, `GET /api/studies` → render jadi kartu di series rail /
  worklist (ganti data fake)
- [ ] Klik studi → buka DICOM-nya via `/api/studies/{id}/file` (loadURLs ke DWV)

## 4. Demo & laporan
- [ ] Tes end-to-end: buka DICOM → isi diagnosis (ICD-10) → Kirim → lihat respons
- [ ] Screenshot API Console (bukti nyambung ke `api-satusehat-stg.dto.kemkes.go.id`)
- [ ] (Kalau perlu laporan) tulis alur: Patient → ImagingStudy → DiagnosticReport

---

### Referensi cepat
| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | cek mode LIVE/MOCK |
| `POST /api/satusehat/send-study` | kirim ImagingStudy + DiagnosticReport |
| `GET /api/satusehat/patient?nik=` | cari pasien by NIK |
| `GET/POST /api/studies` | arsip PACS lokal |

Detail lengkap ada di `README.md`.
