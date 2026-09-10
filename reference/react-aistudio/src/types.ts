export type InstallationType = 'pacs' | 'radiologi' | 'bedah';

export type ModalityType = 'CT' | 'MRI' | 'DX' | 'CR' | 'XA' | 'US';

export type StudyStatus = 'Acquired' | 'In_Reporting' | 'Verified' | 'Sent_To_OR' | 'Archived';

export type WindowPreset = 'LUNG' | 'BONE' | 'BRAIN' | 'SOFT_TISSUE' | 'ANGIO' | 'DEFAULT';

export interface DicomSlice {
  sliceIndex: number;
  sliceLocation: number; // in mm
  thickness: number; // in mm
  kvp: number;
  ma: number;
  imageType: 'thorax_ct' | 'brain_mri' | 'ortho_xray' | 'c_arm_fluoro' | 'spine_ct';
  svgRendererType: string;
}

export interface DicomSeries {
  seriesInstanceUid: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: ModalityType;
  numberOfInstances: number;
  slices: DicomSlice[];
}

export interface RadiologyReport {
  id?: string;
  studyId?: string;
  radiologistName?: string;
  radiologist?: string;
  reportDate?: string;
  clinicalHistory: string;
  technique?: string;
  findings: string;
  conclusion?: string;
  impression?: string;
  status?: 'DRAFT' | 'FINAL';
  criticalFinding?: boolean;
  verifiedAt?: string;
  satuSehatStatus: 'SYNCED' | 'PENDING' | 'ERROR';
}

export interface SurgicalNotes {
  surgeonName?: string;
  preOpPlan: string;
  targetLesion?: string;
  intraOpFinding: string;
  postOpStatus?: string;
  postOpInstructions?: string;
  cArmCapturesCount: number;
  syncToPacsTimestamp?: string;
}

export interface DicomStudy {
  id: string;
  studyInstanceUid: string;
  patientId: string; // No. Rekam Medis (RM)
  nik: string; // NIK SatuSehat (16 digits)
  satuSehatId?: string; // FHIR ImagingStudy/ihs-...
  patientName: string;
  gender: 'L' | 'P';
  birthDate: string;
  age: number;
  studyDate: string;
  studyTime: string;
  modality: ModalityType;
  studyDescription: string;
  bodyPart: string;
  referringPhysician: string;
  accessionNumber: string;
  institutionName: string;
  status: StudyStatus;
  urgency: 'CITO' | 'URGENT' | 'ELEKTIF';
  assignedRadiologist?: string;
  assignedSurgeon?: string;
  operatingRoom?: string; // e.g. "OK-03 (Bedah Toraks & Vaskuler)"
  operationSchedule?: string;
  radiologyReport?: RadiologyReport;
  surgicalNotes?: SurgicalNotes;
  fileSizeMb: number;
  series: DicomSeries[];
}

export interface Measurement {
  id: string;
  type: 'length' | 'angle' | 'roi';
  points: { x: number; y: number }[];
  valueLabel: string;
  huAverage?: number;
}

export interface ViewerToolState {
  activeTool: 'window' | 'pan' | 'zoom' | 'measure' | 'pointer' | 'angle' | 'roi' | 'crosshair' | 'annotate';
  windowLevel: number;
  windowWidth: number;
  zoom: number;
  panX: number;
  panY: number;
  inverted: boolean;
  rotation: number;
  flipH: boolean;
  currentSliceIndex: number;
  isPlayingCine: boolean;
  cineSpeed: number; // fps
  measurements: Measurement[];
  selectedPreset: WindowPreset;
}
