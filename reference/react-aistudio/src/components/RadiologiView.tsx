import React, { useState } from 'react';
import {
  FileText,
  Activity,
  CheckCircle2,
  Eye,
  Scissors,
  Send,
  Sparkles,
  Download,
  AlertTriangle,
  History,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';
import { DicomStudy, RadiologyReport } from '../types';

interface RadiologiViewProps {
  studies: DicomStudy[];
  selectedStudy: DicomStudy;
  onSelectStudy: (study: DicomStudy) => void;
  onOpenViewer: (study: DicomStudy) => void;
  onSendToOr: (studyId: string, roomName: string) => void;
  onSaveReport: (studyId: string, report: RadiologyReport) => void;
  userRole: string;
}

export const RadiologiView: React.FC<RadiologiViewProps> = ({
  studies,
  selectedStudy,
  onSelectStudy,
  onOpenViewer,
  onSendToOr,
  onSaveReport,
  userRole,
}) => {
  const existingReport = selectedStudy.radiologyReport;

  const [clinicalHistory, setClinicalHistory] = useState(
    existingReport?.clinicalHistory || 'Nyeri dada subakut dan batuk berdahak 3 minggu, evaluasi massa paru vs proses spesifik.'
  );
  const [technique, setTechnique] = useState(
    existingReport?.technique ||
      `Pemeriksaan ${selectedStudy.modality} ${selectedStudy.studyDescription} dengan rekonstruksi multiplanar (MPR).`
  );
  const [findings, setFindings] = useState(
    existingReport?.findings ||
      'Tampak lesi noduler berbatas tegas pada lobus superior pulmo dextra. Corakan bronkhovaskular dalam batas normal. Sinus kostofrenikus lancip bilateral. Cor tidak membesar.'
  );
  const [conclusion, setConclusion] = useState(
    existingReport?.conclusion ||
      'Massa soliter pulmo dextra susp. lesi primer (T2N0M0), disarankan evaluasi histopatologi / biopsi terpandu CT scan atau konsultasi ke Bedah Toraks.'
  );
  const [criticalFinding, setCriticalFinding] = useState(
    existingReport?.criticalFinding || false
  );
  const [selectedOrRoom, setSelectedOrRoom] = useState(
    selectedStudy.operatingRoom || 'OK-02 (Bedah Toraks & Vaskuler)'
  );

  const handleSaveDraft = () => {
    const report: RadiologyReport = {
      id: existingReport?.id || `REP-${Date.now()}`,
      studyId: selectedStudy.id,
      radiologistName: userRole,
      reportDate: new Date().toISOString().split('T')[0],
      clinicalHistory,
      technique,
      findings,
      conclusion,
      status: 'DRAFT',
      criticalFinding,
      satuSehatStatus: 'PENDING',
    };
    onSaveReport(selectedStudy.id, report);
  };

  const handleFinalizeAndSign = () => {
    const report: RadiologyReport = {
      id: existingReport?.id || `REP-${Date.now()}`,
      studyId: selectedStudy.id,
      radiologistName: userRole,
      reportDate: new Date().toISOString().split('T')[0],
      clinicalHistory,
      technique,
      findings,
      conclusion,
      status: 'FINAL',
      criticalFinding,
      satuSehatStatus: 'SYNCED',
    };
    onSaveReport(selectedStudy.id, report);
  };

  return (
    <div id="radiologi-view-container" className="space-y-6">
      {/* Top Clinical Header for Selected Patient Study */}
      <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#1b3149] text-sky-400 flex items-center justify-center font-bold text-lg border border-sky-800/40 shrink-0">
            {selectedStudy.modality}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-white tracking-wide">
                {selectedStudy.patientName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1a232f] text-sky-300 border border-sky-800/50">
                {selectedStudy.patientId}
              </span>
              <span className="text-xs text-slate-400">
                NIK: {selectedStudy.nik}
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
              <span className="font-semibold text-slate-200">{selectedStudy.studyDescription}</span>
              <span>•</span>
              <span>{selectedStudy.studyDate}</span>
              <span>•</span>
              <span className="text-sky-400 font-mono">Aksesi: {selectedStudy.accessionNumber}</span>
            </div>
          </div>
        </div>

        {/* Action button to open viewer */}
        <div className="flex items-center gap-3">
          <button
            id="rad-open-viewer-btn"
            onClick={() => onOpenViewer(selectedStudy)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Buka Workstation Viewer</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout: Worklist Left, Reporting Editor Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Radiology Worklist (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">Worklist Radiologi</h3>
              </div>
              <span className="text-xs text-slate-400">
                {studies.length} Antrian
              </span>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {studies.map((s) => {
                const isSelected = s.id === selectedStudy.id;
                const isDone = s.status === 'Verified';

                return (
                  <div
                    key={s.id}
                    id={`rad-worklist-item-${s.id}`}
                    onClick={() => onSelectStudy(s)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#1b3149] border-sky-500/80 shadow-xs'
                        : 'bg-[#1e232b] border-[#38404d] hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-white text-xs truncate">
                        {s.patientName}
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#161a20] text-slate-300 shrink-0 border border-[#3e4755]">
                        {s.modality}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 truncate mt-1">
                      {s.studyDescription}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-[#2e3540]">
                      <span>{s.studyDate}</span>
                      {isDone ? (
                        <span className="text-sky-400 font-semibold flex items-center gap-1">
                          <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                          <span>Terverifikasi</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">Menunggu Ekspertise</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Route to Surgical OR Box */}
          <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Scissors className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white">Rujuk Citra ke Kamar Bedah</h4>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Kirim citra DICOM langsung ke monitor layar kamar operasi untuk panduan pembedahan.
            </p>
            <div className="space-y-2">
              <select
                value={selectedOrRoom}
                onChange={(e) => setSelectedOrRoom(e.target.value)}
                className="w-full text-xs font-medium text-slate-200 bg-[#1e232b] border border-[#3e4755] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
              >
                <option value="OK-01 (Kamar Bedah Sentral)">OK-01 (Kamar Bedah Sentral)</option>
                <option value="OK-02 (Bedah Toraks & Vaskuler)">OK-02 (Bedah Toraks & Vaskuler)</option>
                <option value="OK-03 (Bedah Ortopedi & Traumatologi)">OK-03 (Bedah Ortopedi & Traumatologi)</option>
                <option value="OK-04 (Bedah Saraf / Neuro)">OK-04 (Bedah Saraf / Neuro)</option>
              </select>

              <button
                id="rad-send-to-or-btn"
                onClick={() => onSendToOr(selectedStudy.id, selectedOrRoom)}
                className="w-full py-2 bg-[#2d241d] hover:bg-[#3d3024] text-amber-300 border border-amber-700/80 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim ke {selectedOrRoom.split(' ')[0]}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Structured Radiology Report Editor (8 cols) */}
        <div className="lg:col-span-8 bg-[#252a33] rounded-xl border border-[#38404d] p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-5">
            {/* Editor Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#38404d]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-base">Lembar Ekspertise Radiologi</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#1b2533] text-sky-400 border border-sky-800/60">
                  {existingReport?.status || 'DRAFT'}
                </span>
              </div>
            </div>

            {/* Clinical History */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Klinis / Indikasi Pemeriksaan
              </label>
              <textarea
                rows={2}
                value={clinicalHistory}
                onChange={(e) => setClinicalHistory(e.target.value)}
                placeholder="Riwayat keluhan klinis pasien..."
                className="w-full p-3 bg-[#1e232b] text-white text-xs rounded-xl border border-[#38404d] focus:outline-none focus:ring-2 focus:ring-sky-500/40 leading-relaxed"
              />
            </div>

            {/* Technique */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Teknik Pemeriksaan
              </label>
              <input
                type="text"
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                className="w-full p-2.5 bg-[#1e232b] text-white text-xs rounded-xl border border-[#38404d] focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>

            {/* Findings */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Deskripsi Temuan / Deskripsi Citra Radiologis
              </label>
              <textarea
                rows={5}
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="Uraikan temuan organ, densitas, kontur, nodul..."
                className="w-full p-3 bg-[#1e232b] text-white text-xs rounded-xl border border-[#38404d] focus:outline-none focus:ring-2 focus:ring-sky-500/40 leading-relaxed font-mono"
              />
            </div>

            {/* Conclusion */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Kesan / Kesimpulan Diagnostik
              </label>
              <textarea
                rows={3}
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                placeholder="Kesimpulan diagnosa..."
                className="w-full p-3 bg-[#1e232b] text-white text-xs rounded-xl border border-[#38404d] focus:outline-none focus:ring-2 focus:ring-sky-500/40 font-semibold leading-relaxed"
              />
            </div>

            {/* Critical finding toggle */}
            <div className="flex items-center gap-3 p-3 bg-[#1e232b] rounded-xl border border-[#38404d]">
              <input
                type="checkbox"
                id="critical-finding-checkbox"
                checked={criticalFinding}
                onChange={(e) => setCriticalFinding(e.target.checked)}
                className="w-4 h-4 text-rose-600 bg-slate-900 border-slate-700 rounded focus:ring-rose-500 cursor-pointer"
              />
              <label htmlFor="critical-finding-checkbox" className="text-xs text-slate-300 font-medium cursor-pointer">
                Tandai sebagai <strong className="text-rose-400">Critical Result (Hasil Kritis)</strong> - Segera kirim alert ke dokter pengirim
              </label>
            </div>
          </div>

          {/* Action Bar Footer */}
          <div className="mt-6 pt-4 border-t border-[#38404d] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Dokter Pemeriksa: <strong>{userRole}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="rad-btn-draft"
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-[#2a303c] hover:bg-[#343c4a] text-slate-200 rounded-lg text-xs font-semibold transition border border-[#3e4755] cursor-pointer"
              >
                Simpan Draf
              </button>

              <button
                id="rad-btn-finalize"
                onClick={handleFinalizeAndSign}
                className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Verifikasi & Tanda Tangan Digital</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
