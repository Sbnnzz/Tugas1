# Demo image sources

Anonymised sample DICOM files used by `seed_demo.py`. They are copied (with the demo
patient's name, NIK, accession number and exam written into the header) — the originals
here are never modified. Sandbox / coursework use only; check each project's licence
before redistributing further.

| File | Content | Source |
|---|---|---|
| `ct_thoracic_spine.dcm` | CT, 128×128, axial slice through a thoracic vertebra | pydicom test data (`CT_small.dcm`), https://github.com/pydicom/pydicom |
| `mr_brain_sagittal_1.dcm` | MR T1 MPRAGE, 256×256, sagittal brain | DWV test data (`bbmri-53323131.dcm`), https://github.com/ivmartel/dwv |
| `mr_brain_sagittal_2.dcm` | MR T1 MPRAGE, 256×256, sagittal brain (neighbouring slice) | DWV test data (`bbmri-53323851.dcm`), https://github.com/ivmartel/dwv |
| `mri_brain_axial.nii.gz` | NIfTI MR, 128×96×24 (first of 2 volumes), axial brain — for testing NIfTI upload | nibabel test data (`example4d.nii.gz`), https://github.com/nipy/nibabel |

Also used, already in `Frontend/`: `sample-chest.dcm` (CR chest X-ray, PA) and
`sample-ct.dcm` (CT, axial slice at neck level).
