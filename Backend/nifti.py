"""NIfTI (.nii / .nii.gz) -> DICOM slices, so the DICOM viewer (DWV) can show NIfTI volumes.

nibabel reads the volume and its affine (voxel -> RAS+ world, in mm). Every slice along the third
voxel axis becomes one DICOM MR/CT image whose position, orientation and pixel spacing come from the
affine (converted to DICOM's LPS axes), so the slices stack into one volume and the axial /
coronal / sagittal views line up. A 4-D file uses its first volume.

Very large volumes (e.g. a 512 x 512 x 444 CT) are too heavy for the browser viewer, so they are
shown at reduced resolution: every n-th voxel is kept and the affine is scaled to match, which keeps
the anatomy in the right place and size. The uploaded file itself is never changed.

Also: small content checks (is_dicom / is_nifti) used to refuse uploads that are not medical images.
"""
import datetime
import gzip
import io
import struct

import nibabel as nib
import numpy as np
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

MR_IMAGE_STORAGE = "1.2.840.10008.5.1.4.1.1.4"
CT_IMAGE_STORAGE = "1.2.840.10008.5.1.4.1.1.2"
_LPS = np.diag([-1.0, -1.0, 1.0])  # RAS (NIfTI) -> LPS (DICOM)
MAX_VOXELS = 20_000_000            # above this the browser viewer becomes too slow


def _gunzip(raw, limit=None):
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as g:
        return g.read(limit) if limit else g.read()


def is_nifti(raw):
    """NIfTI-1 / NIfTI-2 header: sizeof_hdr (348 or 540) in the first 4 bytes, either byte order."""
    head = raw[:4]
    if raw[:2] == b"\x1f\x8b":
        try:
            head = _gunzip(raw, 4)
        except (OSError, EOFError):
            return False
    if len(head) < 4:
        return False
    return struct.unpack("<i", head)[0] in (348, 540) or struct.unpack(">i", head)[0] in (348, 540)


def is_dicom(raw):
    """DICOM Part-10 file ('DICM' after the preamble), or a preamble-less DICOM dataset."""
    if len(raw) > 132 and raw[128:132] == b"DICM":
        return True
    try:
        ds = pydicom.dcmread(io.BytesIO(raw), force=True, stop_before_pixels=True)
        return "SOPClassUID" in ds or "Modality" in ds
    except Exception:
        return False


def _ceil_div(a, b):
    return -(-a // b)


def _steps(nx, ny, nz):
    """How many voxels to step over so the volume fits MAX_VOXELS: first in-plane down to about
    256 x 256, then along the slices. (1, 1) means full resolution."""
    sxy, sz = 1, 1
    while _ceil_div(nx, sxy) * _ceil_div(ny, sxy) * _ceil_div(nz, sz) > MAX_VOXELS:
        if _ceil_div(nx, sxy) > 256 or _ceil_div(ny, sxy) > 256:
            sxy += 1
        else:
            sz += 1
    return sxy, sz


def _load(raw):
    """Returns (volume as float32 [x, y, z], matching affine, (in-plane step, slice step))."""
    data = _gunzip(raw) if raw[:2] == b"\x1f\x8b" else raw
    sizeof_hdr = struct.unpack("<i", data[:4])[0]
    if sizeof_hdr not in (348, 540):
        sizeof_hdr = struct.unpack(">i", data[:4])[0]
    cls = nib.Nifti2Image if sizeof_hdr == 540 else nib.Nifti1Image
    img = cls.from_bytes(data)
    shape = tuple(img.shape) + (1,) * max(0, 3 - len(img.shape))
    sxy, sz = _steps(*shape[:3])
    # read only the voxels that are kept (first volume of a 4-D file); scaling is applied by nibabel
    index = (slice(None, None, sxy), slice(None, None, sxy), slice(None, None, sz))[:len(img.shape)]
    index += (0,) * max(0, len(img.shape) - 3)
    vol = np.asarray(img.dataobj[index], dtype=np.float32)
    while vol.ndim < 3:
        vol = vol[..., np.newaxis]
    affine = img.affine.copy()
    affine[:3, 0] *= sxy
    affine[:3, 1] *= sxy
    affine[:3, 2] *= sz
    return np.nan_to_num(vol), affine, (sxy, sz)


def _dicom_name(name):
    words = str(name or "").replace("Dr. ", "").split()
    return (words[-1] + "^" + " ".join(words[:-1])).upper() if len(words) > 1 else (str(name or "ANONYMOUS").upper())


def nifti_to_datasets(raw, info=None):
    """Convert a NIfTI file (bytes) into a list of DICOM datasets, one per slice.
    info (optional): archive study dict - name, nik, gender, birthDate, description, modality, order_id."""
    info = info or {}
    vol, affine, (sxy, sz) = _load(raw)
    nx, ny, nz = vol.shape

    # pixel values: keep integers as they are when they fit, otherwise scale into int16
    lo, hi = float(vol.min()), float(vol.max())
    whole = bool(np.allclose(vol, np.round(vol)))
    if whole and lo >= -32768 and hi <= 32767:
        stored, slope, intercept = vol.astype(np.int16), 1.0, 0.0
    else:
        slope = (hi - lo) / 32767.0 if hi > lo else 1.0
        intercept = lo
        stored = np.round((vol - lo) / slope).astype(np.int16)
    # Hounsfield units (air near -1000, bone above +300) mean the volume is a CT, whatever was ordered
    is_ct = whole and lo <= -500 and hi >= 300
    if is_ct:
        center, width = 40.0, 400.0  # soft-tissue window
    else:
        p_lo, p_hi = np.percentile(vol, [2, 98])
        width = max(float(p_hi - p_lo), 1.0)
        center = float(p_lo) + width / 2

    # geometry from the affine: along a row = voxel axis i, down a column = voxel axis j
    sx, sy, sz_mm = (float(np.linalg.norm(affine[:3, a])) or 1.0 for a in range(3))
    row_cos = _LPS @ affine[:3, 0] / sx
    col_cos = _LPS @ affine[:3, 1] / sy
    orientation = [round(float(v), 6) for v in (*row_cos, *col_cos)]

    study_uid, series_uid, for_uid = generate_uid(), generate_uid(), generate_uid()
    today = datetime.date.today().strftime("%Y%m%d")
    modality = (info.get("modality") or "MR").upper()
    if is_ct:
        modality = "CT"
    elif modality not in ("CT", "MR"):
        modality = "MR"  # a NIfTI volume is not a projection X-ray or ultrasound image
    sop_class = CT_IMAGE_STORAGE if modality == "CT" else MR_IMAGE_STORAGE
    sex = {"Laki-laki": "M", "Perempuan": "F"}.get(info.get("gender", ""), "O")
    series_desc = "dari NIfTI" + (f" (resolusi dikurangi {sxy}x / {sz}x)" if (sxy, sz) != (1, 1) else "")

    datasets = []
    for k in range(nz):
        meta = FileMetaDataset()
        meta.MediaStorageSOPClassUID = sop_class
        meta.MediaStorageSOPInstanceUID = generate_uid()
        meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds = FileDataset(None, {}, file_meta=meta, preamble=b"\x00" * 128)
        ds.SOPClassUID = sop_class
        ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
        ds.Modality = modality
        ds.StudyInstanceUID, ds.SeriesInstanceUID, ds.FrameOfReferenceUID = study_uid, series_uid, for_uid
        ds.PatientName = _dicom_name(info.get("name"))
        ds.PatientID = str(info.get("nik", ""))
        ds.PatientBirthDate = str(info.get("birthDate", "")).replace("-", "")
        ds.PatientSex = sex
        ds.AccessionNumber = str(info.get("order_id", ""))[:16]
        ds.StudyDescription = str(info.get("description", "NIfTI volume"))[:64]
        ds.SeriesDescription = series_desc[:64]
        ds.InstitutionName = "RSUD Dr. Soetomo"
        ds.StudyDate = ds.SeriesDate = ds.ContentDate = today
        ds.SeriesNumber, ds.InstanceNumber = 1, k + 1
        position = _LPS @ (affine @ np.array([0.0, 0.0, float(k), 1.0]))[:3]
        ds.ImagePositionPatient = [round(float(v), 6) for v in position]  # 6 decimals keeps the slice spacing exactly even
        ds.ImageOrientationPatient = orientation
        ds.PixelSpacing = [round(sy, 6), round(sx, 6)]
        ds.SliceThickness = round(sz_mm, 6)
        ds.SliceLocation = round(float(position[2]), 4)
        ds.Rows, ds.Columns = ny, nx
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 16, 15, 1
        ds.RescaleSlope, ds.RescaleIntercept = round(slope, 8), round(intercept, 4)
        ds.WindowCenter, ds.WindowWidth = round(center, 2), round(width, 2)
        ds.PixelData = np.ascontiguousarray(stored[:, :, k].T).astype("<i2").tobytes()  # rows = j, columns = i
        datasets.append(ds)
    return datasets
