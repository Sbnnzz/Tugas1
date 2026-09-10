# Handoff & Instruksi — SIMRS × SATUSEHAT PACS Hub

Tim pakai **Claude Code**. Tiap task di bawah ditulis biar bisa **langsung di-paste
ke Claude Code** dan dikerjain tanpa perlu tau obrolan sebelumnya. Kerjain urut.

---

## 📌 Konteks (Claude: baca ini + `README.md` + `Log.md` dulu)

- **Apa ini:** SIMRS mockup PACS / Instalasi Radiologi yang lapor ke **SATUSEHAT**
  (Kemenkes) via **HL7 FHIR R4**, environment **Sandbox**.
- **Stack:** Frontend HTML/CSS/JS (no build) + **DWV** (viewer DICOM asli, dari CDN).
  Backend **FastAPI** (jembatan SATUSEHAT + arsip PACS lokal + serve frontend).
- **Struktur:**
  - `Frontend/` → `index.html` (menu), `instalasi.html` (input+upload), `pacs.html`
    (viewer grid + DWV), `viewer.html` (live DWV), `sample-*.dcm` (contoh).
  - `Backend/` → `main.py` (FastAPI routes + serve Frontend), `satusehat.py`
    (OAuth2 + FHIR client, live/mock), `config.py` (baca `.env`).
  - `reference/react-aistudio/` → app React lama (arsip, JANGAN dipakai/di-edit).
- **Cara run:** `cd Backend && pip install -r requirements.txt &&
  uvicorn main:app --reload --port 8000 --host 0.0.0.0` → buka `http://localhost:8000`.
- **State sekarang:** viewer DICOM udah jalan (buka .dcm, window/level, preset,
  zoom). Backend udah jalan (default **MOCK**). Yang belum: tombol "Kirim ke
  SATUSEHAT" di frontend masih animasi palsu — belum manggil backend. Arsip
  (series rail/worklist) masih data fake.
- **Aturan:** `Backend/.env` berisi rahasia — **jangan pernah di-commit** (udah
  gitignore). Semua kerjaan di `Frontend/` dan `Backend/`, bukan di `reference/`.

> ⚠️ **Sebelum mulai:** history git udah di-rewrite. Kalau kalian clone lama,
> **hapus & `git clone` ulang** dari https://github.com/Sbnnzz/Tugas1.

---

## ✅ Task 0 — Setup & pastikan jalan
**Paste ke Claude Code:**
> Baca README.md. Jalankan backend (`cd Backend`, install requirements, uvicorn
> port 8000). Buka http://localhost:8000 dan http://localhost:8000/api/health.
> Konfirmasi menu muncul dan health mengembalikan `"mode":"MOCK"`. Laporkan kalau ada error.

**Selesai kalau:** `localhost:8000` nampilin Menu & `/api/health` = 200 `MOCK`.

---

## ✅ Task 1 — Isi credential biar LIVE (butuh akun SATUSEHAT)
Manual + Claude. Ambil creds dari `satusehat.kemkes.go.id/platform` → Sandbox →
**Kode Akses API** (Org ID, Client ID, Client Secret).

**Paste ke Claude Code:**
> Buat `Backend/.env` dari `Backend/.env.example`. Aku akan isi sendiri Org ID,
> Client ID, Client Secret (jangan kamu commit file .env). Setelah aku isi,
> restart uvicorn dan konfirmasi `/api/health` berubah jadi `"mode":"LIVE"`.

**Selesai kalau:** `/api/health` = `"mode":"LIVE"` dan `POST /api/satusehat/token`
balik status 200 dari server Kemenkes.

---

## ✅ Task 2 — Wire tombol "Kirim ke SATUSEHAT" → backend  ⭐ INTI TUGAS
Sekarang handler `#sendBtn` cuma animasi mock. Bikin manggil backend beneran.
Backend endpoint sudah ada: `POST /api/satusehat/send-study`, body JSON
`{name, nik, modality, description, icd10, diagnosis, finding, instalasi}`,
balikannya `{ok, mode, logs, imaging_study_id, diagnostic_report_id}`.

**Paste ke Claude Code:**
> Di `Frontend/pacs.html`, `Frontend/viewer.html`, dan `Frontend/instalasi.html`,
> cari handler tombol `#sendBtn`. Ganti animasi mock jadi panggilan asli:
> `fetch('http://localhost:8000/api/satusehat/send-study', {method:'POST',
> headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})`.
> Ambil `payload` dari field di halaman (ICD-10, diagnosis, temuan, dll).
> Render `data.logs` (request/response asli) ke panel "API Console", dan tampilkan
> `imaging_study_id` + `diagnostic_report_id`. Kalau fetch gagal (backend mati),
> fallback ke animasi mock yang lama. Tes dengan mengklik tombolnya.

**Selesai kalau:** klik "Kirim" → console nampilin log asli dari backend +
ID ImagingStudy & DiagnosticReport. Kalau LIVE, ID-nya asli dari Kemenkes.

---

## ✅ Task 3 — Arsip PACS beneran (opsional, nilai plus)
Series rail & worklist masih fake. Bikin dari data upload asli.

**Paste ke Claude Code:**
> Di `Frontend/instalasi.html`, pas user upload DICOM, POST file-nya ke
> `/api/studies` (multipart: `file` + `meta` JSON berisi pasien/diagnosis).
> Di `Frontend/pacs.html`, saat load panggil `GET /api/studies` dan render
> hasilnya sebagai kartu di series rail + worklist (ganti data fake). Klik satu
> studi → muat DICOM-nya dari `/api/studies/{id}/file` ke DWV (`app.loadURLs`).

**Selesai kalau:** upload sebuah DICOM → muncul di worklist → diklik → tampil di viewer.

---

## ✅ Task 4 — Tes end-to-end & bukti buat penilaian
**Paste ke Claude Code:**
> Lakukan alur lengkap: buka DICOM di pacs.html → isi ICD-10 + diagnosis →
> klik Kirim ke SATUSEHAT → screenshot panel API Console yang nunjukin request
> ke `api-satusehat-stg.dto.kemkes.go.id` dan response 201 Created. Simpan
> screenshot di folder `docs/`. Rangkum alur Patient → ImagingStudy →
> DiagnosticReport untuk laporan.

**Selesai kalau:** ada screenshot bukti integrasi + ringkasan alur.

---

### Referensi endpoint backend
| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/health` | mode LIVE/MOCK |
| POST | `/api/satusehat/token` | access token OAuth2 |
| GET | `/api/satusehat/patient?nik=` | cari pasien by NIK → IHS |
| POST | `/api/satusehat/send-study` | kirim ImagingStudy + DiagnosticReport |
| GET/POST | `/api/studies` | arsip PACS lokal (list / upload) |
| GET | `/api/studies/{id}/file` | ambil berkas DICOM |

Pembagian saran: 1 orang Task 1 (creds), 1–2 orang Task 2 (inti), 1 orang Task 3.
