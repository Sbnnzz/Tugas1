import React, { useState } from 'react';
import {
  Scissors,
  Eye,
  Camera,
  Layers,
  Save,
  Clock,
  Send,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { DicomStudy, SurgicalNotes } from '../types';

interface InstalasiBedahViewProps {
  studies: DicomStudy[];
  selectedStudy: DicomStudy;
  onSelectStudy: (study: DicomStudy) => void;
  onOpenViewer: (study: DicomStudy) => void;
  onCaptureIntraOp: (studyId: string) => void;
  onSaveSurgicalNotes: (studyId: string, notes: SurgicalNotes) => void;
  userRole: string;
}

export const InstalasiBedahView: React.FC<InstalasiBedahViewProps> = ({
  studies,
  selectedStudy,
  onSelectStudy,
  onOpenViewer,
  onCaptureIntraOp,
  onSaveSurgicalNotes,
  userRole,
}) => {
  const existingNotes = selectedStudy.surgicalNotes;

  const [preOpPlan, setPreOpPlan] = useState(
    existingNotes?.preOpPlan ||
      'Torakotomi eksplorasi lobus superior kanan, isolasi vaskular segmental, diseksi KGB stasiun 4R & 7.'
  );
  const [intraOpFinding, setIntraOpFinding] = useState(
    existingNotes?.intraOpFinding ||
      'Massa padat kenyal diameter 3.2 cm pada segmen apikal lobus superior pulmo dextra. Tidak tampak infiltrasi ke dinding dada.'
  );
  const [postOpInstructions, setPostOpInstructions] = useState(
    existingNotes?.postOpInstructions ||
      'Rawat ICU Bedah 24 jam pertama, pasang WSD 2 selang dengan suction -15 cmH2O. Kontrol foto toraks portable 4 jam post-op.'
  );
  const [isCapturing, setIsCapturing] = useState(false);

  const orStudies = studies.filter(
    (s) => s.status === 'Sent_To_OR' || s.operatingRoom !== undefined
  );

  const handleCaptureClick = () => {
    setIsCapturing(true);
    setTimeout(() => {
      onCaptureIntraOp(selectedStudy.id);
      setIsCapturing(false);
    }, 600);
  };

  const handleSaveNotes = () => {
    const notes: SurgicalNotes = {
      surgeonName: userRole,
      preOpPlan,
      intraOpFinding,
      postOpInstructions,
      cArmCapturesCount: existingNotes?.cArmCapturesCount || 0,
      syncToPacsTimestamp: new Date().toISOString(),
    };
    onSaveSurgicalNotes(selectedStudy.id, notes);
  };

  return (
    <div id="bedah-view-container" className="space-y-6">
      {/* Top Banner: OR Status Overview */}
      <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#342718] text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-800/40 shrink-0">
            <Scissors className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-white tracking-wide">
                Kamar Operasi: {selectedStudy.operatingRoom || 'OK-02 (Bedah Toraks & Vaskuler)'}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800/50">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Operasi Berlangsung
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
              <span className="font-semibold text-white">{selectedStudy.patientName}</span>
              <span>•</span>
              <span className="text-sky-400 font-mono font-semibold">{selectedStudy.patientId}</span>
              <span>•</span>
              <span>{selectedStudy.studyDescription}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="bedah-open-viewer-btn"
            onClick={() => onOpenViewer(selectedStudy)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Tampilkan di Monitor Kamar Bedah</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left OR Worklist, Right Pre-Op & Intra-Op Fluoroscopy capture */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Patients in OR Suites (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Pasien di Kamar Operasi</h3>
              </div>
              <span className="text-xs text-slate-400">{orStudies.length} Pasien</span>
            </div>

            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              {orStudies.map((s) => {
                const isSelected = s.id === selectedStudy.id;

                return (
                  <div
                    key={s.id}
                    id={`bedah-patient-${s.id}`}
                    onClick={() => onSelectStudy(s)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#1b3149] border-sky-500/80 shadow-xs'
                        : 'bg-[#1e232b] border-[#38404d] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-white text-xs truncate">{s.patientName}</div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#161a20] text-amber-400 shrink-0 border border-[#3e4755]">
                        {s.operatingRoom ? s.operatingRoom.split(' ')[0] : 'OK-01'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 truncate mt-1">
                      {s.studyDescription}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-[#2e3540]">
                      <span className="font-mono text-sky-400 font-semibold">{s.patientId}</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Citra Ready
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Intra-op Fluoroscopy (C-Arm) Live Capture Box */}
          <div className="bg-[#252a33] rounded-xl border border-sky-700/80 p-5 shadow-xs bg-gradient-to-br from-[#252a33] to-[#1a2c42]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-sky-400" />
                <h4 className="text-sm font-bold text-white">C-Arm Live Ingest</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-sky-600 text-white font-semibold">
                Instalasi Bedah
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Ambil tangkapan citra fluoroskopi intra-operatif langsung dari mesin C-Arm OK dan simpan otomatis ke PACS.
            </p>

            <div className="p-3 bg-[#171b22] rounded-xl border border-[#38404d] mb-3 flex items-center justify-between text-xs">
              <span className="text-slate-400">Tangkapan Tersimpan:</span>
              <span className="font-bold font-mono text-sky-400">
                {selectedStudy.surgicalNotes?.cArmCapturesCount || 0} Snapshot DICOM
              </span>
            </div>

            <button
              id="bedah-capture-carm-btn"
              onClick={handleCaptureClick}
              disabled={isCapturing}
              className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Camera className={`w-4 h-4 ${isCapturing ? 'animate-bounce' : ''}`} />
              <span>{isCapturing ? 'Menyimpan ke PACS...' : 'Capture Snapshot Fluoroskopi'}</span>
            </button>
          </div>
        </div>

        {/* Right: Surgical Planning & Operative Notes (8 cols) */}
        <div className="lg:col-span-8 bg-[#252a33] rounded-xl border border-[#38404d] p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#38404d]">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  Catatan Bedah & Panduan Citra Intra-Operatif
                </h3>
              </div>
              <div className="text-xs text-slate-400">
                Operator: <strong className="text-slate-200">{userRole}</strong>
              </div>
            </div>

            {/* Radiology report preview for reference */}
            {selectedStudy.radiologyReport && (
              <div className="p-3.5 bg-[#1b2533] rounded-xl border border-sky-800/60">
                <div className="text-xs font-bold text-sky-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>Referensi Ekspertise Radiologi:</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-mono">
                  {selectedStudy.radiologyReport.conclusion}
                </p>
              </div>
            )}

            {/* Pre-Op Planning */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Perencanaan Pra-Bedah (Pre-Operative Plan)
              </label>
              <textarea
                rows={3}
                value={preOpPlan}
                onChange={(e) => setPreOpPlan(e.target.value)}
                placeholder="Rencana insisi, reseksi, dan pendekatan anatomis..."
                className="w-full p-3 bg-[#1e232b] text-white text-xs rounded-xl border border-[#38404d] focus:outline-none focus:ring-2 focus:ring-sky-500/40 leading-relaxed"
              />
            </div>

            {/* Intra-Op Findings */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Temuan Intra-Operatif & Prosedur Dilakukan
              </label>
              <textarea
                rows={4}
                value={intraOpFinding}
                onChange={(e) => setIntraOpFinding(e.target.value)}
                placeholder="Deskripsi temuan bedah, eksisi, perdarahan..."
                className="w-full p-3 bg-[#1e232b] text-white text-xs rounded-xl border border-[#38404d] focus:outline-none focus:ring-2 focus:ring-sky-500/40 leading-relaxed font-mono"
              />
            </div>

            {/* Post-Op Instructions */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Instruksi Pasca-Bedah (Post-Op Care & Follow-Up Radiologi)
              </label>
              <textarea
                rows={2}
                value={postOpInstructions}
                onChange={(e) => setPostOpInstructions(e.target.value)}
                placeholder="Instruksi perawatan, monitoring WSD, foto kontrol..."
                className="w-full p-3 bg-[#1e232b] text-white text-xs rounded-xl border border-[#38404d] focus:outline-none focus:ring-2 focus:ring-sky-500/40 leading-relaxed"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 pt-4 border-t border-[#38404d] flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Sinkronisasi real-time ke PACS Workstation & Rekam Medis Elektronik
            </div>

            <button
              id="bedah-save-notes-btn"
              onClick={handleSaveNotes}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Catatan Bedah ke PACS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
