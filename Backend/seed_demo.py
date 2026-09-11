"""Fill the app with demo data: radiology requests and studies for SATUSEHAT sandbox dummy
patients, across X-ray, CT and MRI.

Run from Backend/:
    python seed_demo.py --reset   back up Backend/data, clear studies / requests / operations
                                  (accounts are kept), then add the demo data

Result:
    - 3 studies already imaged, waiting for the radiologist (PACS worklist)
    - 3 requests waiting for the radiographer (Instalasi). For each, a ready-to-upload DICOM
      file is written to Backend/data/demo_films/ with that patient's name and NIK inside.
Images come from Backend/seed_samples/ and Frontend/ (see seed_samples/SOURCES.md); the
copies get the demo patient's name, NIK, birth date, sex, accession number and exam.
"""
import datetime
import json
import os
import shutil
import sqlite3
import sys
import uuid

import pydicom
from pydicom.uid import generate_uid

import auth
import config
import operations
import orders

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = {
    "chest_cr": os.path.join(HERE, "..", "Frontend", "sample-chest.dcm"),
    "ct_neck": os.path.join(HERE, "..", "Frontend", "sample-ct.dcm"),
    "ct_spine": os.path.join(HERE, "seed_samples", "ct_thoracic_spine.dcm"),
    "mr_brain_1": os.path.join(HERE, "seed_samples", "mr_brain_sagittal_1.dcm"),
    "mr_brain_2": os.path.join(HERE, "seed_samples", "mr_brain_sagittal_2.dcm"),
}
REQUESTER_USER, REQUESTER_NAME, REQUESTER_DICOM = "bedah", "dr. Bima Santoso, Sp.B", "SANTOSO^BIMA"
FILMS_DIR = os.path.join(config.DATA_DIR, "demo_films")

# (NIK, name, sex, birth date) are SATUSEHAT's sandbox dummy patients.
# state "imaged": image already taken, waiting for the radiologist.
# state "requested": waiting for the radiographer; a matching film is prepared for upload.
DEMO = [
    (("9271060312000001", "Ardianto Putra", "Laki-laki", "1992-01-09"), ("DX", "Foto Thorax PA"),
     ("R05", "Batuk 3 minggu, curiga pneumonia"), "Biasa", "chest_cr", "imaged"),
    (("9204014804000002", "Claudia Sintia", "Perempuan", "1989-11-03"), ("MR", "MRI Kepala Sagital T1"),
     ("R51", "Nyeri kepala kronik"), "Biasa", "mr_brain_1", "imaged"),
    (("9210060207000010", "Syarif Muhammad", "Laki-laki", "1988-11-02"), ("CT", "CT Vertebra Torakal"),
     ("M54.6", "Nyeri punggung atas setelah jatuh"), "Biasa", "ct_spine", "imaged"),
    (("9104224509000003", "Elizabeth Dior", "Perempuan", "1976-07-07"), ("CT", "CT Leher"),
     ("R22.1", "Benjolan leher kanan"), "Biasa", "ct_neck", "requested"),
    (("9201076407000009", "Nancy Wang", "Perempuan", "1955-10-10"), ("MR", "MRI Kepala"),
     ("I63.9", "Kelemahan anggota gerak kiri mendadak, curiga stroke"), "CITO", "mr_brain_2", "requested"),
    (("9104223107000004", "Dr. Alan Bagus Prasetya", "Laki-laki", "1977-09-03"), ("DX", "Foto Thorax PA"),
     ("Z01.8", "Foto thorax pra-operasi (rencana kolesistektomi)"), "Biasa", "chest_cr", "requested"),
]


def dicom_person_name(full_name):
    """'Ardianto Putra' -> 'PUTRA^ARDIANTO' (DICOM family^given)."""
    words = full_name.replace("Dr. ", "").split()
    return (words[-1] + "^" + " ".join(words[:-1])).upper() if len(words) > 1 else full_name.upper()


def write_film(sample, dest, patient, exam, accession):
    """Copy a sample image with this patient and request written into its header."""
    nik, name, sex, birth = patient
    ds = pydicom.dcmread(SAMPLES[sample])
    ds.PatientName = dicom_person_name(name)
    ds.PatientID = nik
    ds.PatientBirthDate = birth.replace("-", "")
    ds.PatientSex = "M" if sex == "Laki-laki" else "F"
    ds.AccessionNumber = accession
    ds.StudyDescription = exam[1]
    ds.InstitutionName = "RSUD Dr. Soetomo"
    ds.ReferringPhysicianName = REQUESTER_DICOM
    ds.StudyDate = datetime.date.today().strftime("%Y%m%d")
    ds.StudyInstanceUID, ds.SeriesInstanceUID, ds.SOPInstanceUID = generate_uid(), generate_uid(), generate_uid()
    if getattr(ds, "file_meta", None) is not None and "MediaStorageSOPInstanceUID" in ds.file_meta:
        ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
    ds.save_as(dest)


def reset():
    """Back up Backend/data, then clear studies, uploads, films, requests and operations."""
    backup = os.path.join(config.DATA_DIR, "backup_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S"))
    os.makedirs(backup)
    for name in ("studies.json", "simrs.db"):
        path = os.path.join(config.DATA_DIR, name)
        if os.path.exists(path):
            shutil.copy2(path, backup)
    for sub in ("uploads", "demo_films"):
        path = os.path.join(config.DATA_DIR, sub)
        if os.path.isdir(path):
            shutil.copytree(path, os.path.join(backup, sub))
            shutil.rmtree(path)
    if os.path.exists(config.STUDIES_DB):
        os.remove(config.STUDIES_DB)
    con = sqlite3.connect(config.DB_PATH)
    con.execute("DELETE FROM orders")
    con.execute("DELETE FROM operations")
    con.commit()
    con.close()
    return backup


def main(argv):
    auth.init_db()
    orders.init_db()
    operations.init_db()
    if "--reset" in argv:
        print("backup:", reset())
    elif os.path.exists(config.STUDIES_DB) or orders.list_orders():
        sys.exit("Data already present. Run: python seed_demo.py --reset   (backs up first, keeps accounts)")
    missing = [p for p in SAMPLES.values() if not os.path.exists(p)]
    if missing:
        sys.exit("Missing sample files: " + ", ".join(missing))
    os.makedirs(config.UPLOAD_DIR, exist_ok=True)
    os.makedirs(FILMS_DIR, exist_ok=True)

    now = datetime.datetime.now().isoformat(timespec="seconds")
    studies = []
    for patient, exam, indication, priority, sample, state in DEMO:
        nik, name, sex, birth = patient
        order = orders.create_order({
            "patient": {"nik": nik, "name": name, "gender": sex, "birthDate": birth},
            "exam": {"modality": exam[0], "description": exam[1]},
            "indication": {"icd10": indication[0], "text": indication[1]},
            "priority": priority, "note": "", "requester": REQUESTER_NAME,
        }, REQUESTER_USER)
        safe = name.replace("Dr. ", "").replace(" ", "_")
        if state == "requested":
            film = f"{order['id']}_{safe}_{exam[0]}.dcm"
            write_film(sample, os.path.join(FILMS_DIR, film), patient, exam, order["id"])
            print(f"  {order['id']}  {exam[0]}  {exam[1]:22} {name:24} waiting for radiographer  (film: data/demo_films/{film})")
        else:
            sid = uuid.uuid4().hex[:12]
            filename = f"{sid}_{safe}_{exam[0]}.dcm"
            write_film(sample, os.path.join(config.UPLOAD_DIR, filename), patient, exam, order["id"])
            studies.append({"id": sid, "created": now, "file": filename, "sent": False,
                            "name": name, "nik": nik, "gender": sex, "birthDate": birth,
                            "modality": exam[0], "description": exam[1], "doctor": REQUESTER_NAME,
                            "clinical": indication[1], "instalasi": "Instalasi Radiologi",
                            "order_id": order["id"], "saved_by": "radiografer"})
            orders.set_imaged(order["id"], sid)
            print(f"  {order['id']}  {exam[0]}  {exam[1]:22} {name:24} imaged, waiting for radiologist")

    with open(config.STUDIES_DB, "w", encoding="utf-8") as f:
        json.dump(studies, f, indent=2, ensure_ascii=False)
    print(f"done: {len(DEMO)} requests, {len(studies)} studies in the archive, films in {FILMS_DIR}")


if __name__ == "__main__":
    main(sys.argv)
