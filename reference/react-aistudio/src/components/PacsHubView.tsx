import React, { useState } from 'react';
import {
  Server,
  HardDrive,
  Database,
  UploadCloud,
  CheckCircle2,
  Clock,
  Eye,
  Activity,
  Scissors,
  CheckCheck,
  RefreshCw
} from 'lucide-react';
import { DicomStudy } from '../types';
import { MOCK_PACSSERVER_STATUS } from '../data/mockDicomData';

interface PacsHubViewProps {
  studies: DicomStudy[];
  selectedStudyId: string | null;
  onSelectStudy: (study: DicomStudy) => void;
  onOpenViewer: (study: DicomStudy) => void;
  onRouteToOr: (studyId: string, roomName: string) => void;
  onRouteToRad: (studyId: string) => void;
  searchQuery: string;
}

export const PacsHubView: React.FC<PacsHubViewProps> = ({
  studies,
  selectedStudyId,
  onSelectStudy,
  onOpenViewer,
  onRouteToOr,
  onRouteToRad,
  searchQuery,
}) => {
  const [selectedModality, setSelectedModality] = useState<string>('ALL');
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [syncedIds, setSyncedIds] = useState<Record<string, boolean>>({});
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Filter studies based on modality & search query
  const filteredStudies = studies.filter((study) => {
    const matchesModality = selectedModality === 'ALL' || study.modality === selectedModality;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesModality;
    return (
      matchesModality &&
      (study.patientName.toLowerCase().includes(query) ||
        study.patientId.toLowerCase().includes(query) ||
        study.nik.includes(query) ||
        study.accessionNumber.toLowerCase().includes(query) ||
        study.studyDescription.toLowerCase().includes(query))
    );
  });

  const handleManualSync = (id: string) => {
    setSyncedIds((prev) => ({ ...prev, [id]: true }));
  };

  const handleSyncAllSatuSehat = () => {
    setIsSyncingAll(true);
    setTimeout(() => {
      setIsSyncingAll(false);
      const all: Record<string, boolean> = {};
      studies.forEach((s) => (all[s.id] = true));
      setSyncedIds(all);
    }, 1200);
  };

  return (
    <div id="pacs-hub-view-container" className="space-y-6">
      {/* Telemetry & Server Summary (PACS Medical Gray Theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Studies */}
        <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Arsip DICOM
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#182638] text-sky-400 flex items-center justify-center border border-sky-800/40">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {MOCK_PACSSERVER_STATUS.totalStudiesCount.toLocaleString('id-ID')}
            </span>
            <span className="text-sm text-sky-400 font-semibold">Studi</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            +{MOCK_PACSSERVER_STATUS.todayIngestedCount} studi baru hari ini
          </div>
        </div>

        {/* Metric 2: Storage Gauge */}
        <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Kapasitas Storage PACS
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#182638] text-sky-400 flex items-center justify-center border border-sky-800/40">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {MOCK_PACSSERVER_STATUS.storageUsedTb} TB
            </span>
            <span className="text-xs text-slate-400">
              / {MOCK_PACSSERVER_STATUS.storageCapacityTb} TB (40%)
            </span>
          </div>
          <div className="mt-2 w-full bg-[#181c22] rounded-full h-2 overflow-hidden">
            <div
              className="bg-sky-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${(MOCK_PACSSERVER_STATUS.storageUsedTb / MOCK_PACSSERVER_STATUS.storageCapacityTb) * 100}%`,
              }}
            ></div>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Kompresi Lossless JPEG 2000
          </div>
        </div>

        {/* Metric 3: Server AE Title */}
        <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              DICOM Server
            </span>
            <div className="w-9 h-9 rounded-lg bg-[#162c26] text-emerald-400 flex items-center justify-center border border-emerald-800/40">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 font-mono font-bold text-lg text-white">
            {MOCK_PACSSERVER_STATUS.aeTitle}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Port {MOCK_PACSSERVER_STATUS.port} Aktif
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">C-STORE / C-FIND</span>
          </div>
        </div>

        {/* Metric 4: SatuSehat Gateway */}
        <div className="bg-[#252a33] rounded-xl border border-sky-700/80 p-5 shadow-xs bg-gradient-to-br from-[#252a33] to-[#1a2c42] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-300 uppercase tracking-wider">
                SATUSEHAT FHIR R4
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-sky-600 text-white font-semibold">
                Kemenkes RI
              </span>
            </div>
            <div className="mt-2 text-sm font-bold text-white">
              ImagingStudy Interkoneksi
            </div>
          </div>
          <button
            id="pacs-sync-all-btn"
            onClick={handleSyncAllSatuSehat}
            disabled={isSyncingAll}
            className="mt-3 w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>{isSyncingAll ? 'Menyinkronkan...' : 'Sinkronkan Batch SatuSehat'}</span>
          </button>
        </div>
      </div>

      {/* Connected Nodes List */}
      <div className="bg-[#252a33] rounded-xl border border-[#38404d] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">
              Jaringan Modalitas & Instalasi Terhubung
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            DICOMweb: {MOCK_PACSSERVER_STATUS.dicomWebUrl}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {MOCK_PACSSERVER_STATUS.nodes.map((node) => (
            <div
              key={node.aeTitle}
              className="bg-[#1b1f26] rounded-xl p-3.5 border border-[#38404d] flex flex-col justify-between text-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-200 truncate" title={node.name}>
                    {node.name}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                </div>
                <div className="font-mono text-xs text-sky-400 font-semibold">
                  {node.aeTitle}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  IP: {node.ip}
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#2e3540] flex items-center justify-between text-xs text-slate-400">
                <span>{node.pingMs} ms</span>
                <span className="text-sky-400 font-medium">{node.lastTransfer}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Central Studies Worklist / DICOM Hub Table */}
      <div className="bg-[#252a33] rounded-xl border border-[#38404d] shadow-xs overflow-hidden">
        {/* Controls: Modality Filters & Ingest */}
        <div className="p-4 border-b border-[#38404d] flex flex-wrap items-center justify-between gap-3 bg-[#1e232b]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Modalitas:</span>
            <div className="flex items-center gap-1 bg-[#282e38] p-1 rounded-lg border border-[#38404d]">
              {['ALL', 'CT', 'MRI', 'DX', 'CR', 'XA'].map((mod) => (
                <button
                  key={mod}
                  id={`filter-modality-${mod.toLowerCase()}`}
                  onClick={() => setSelectedModality(mod)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    selectedModality === mod
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-[#343b48]'
                  }`}
                >
                  {mod === 'ALL' ? 'Semua' : mod}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Menampilkan <strong className="text-white">{filteredStudies.length}</strong> studi
            </span>

            <button
              id="pacs-btn-upload-dicom"
              onClick={() => setShowIngestModal(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#2a303c] hover:bg-[#343c4a] text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer border border-[#3e4755] shadow-xs"
            >
              <UploadCloud className="w-4 h-4 text-sky-400" />
              <span>Ingest DICOM Manual</span>
            </button>
          </div>
        </div>

        {/* Clean Hospital PACS Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-[#1b1f26] border-b border-[#38404d] text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Pasien & No. RM</th>
                <th className="py-3 px-4">Deskripsi Pemeriksaan</th>
                <th className="py-3 px-4">Modalitas</th>
                <th className="py-3 px-4">Waktu Studi</th>
                <th className="py-3 px-4">Status Alur</th>
                <th className="py-3 px-4">SatuSehat</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#323945] font-normal">
              {filteredStudies.map((study) => {
                const isSelected = study.id === selectedStudyId;
                const isSynced =
                  syncedIds[study.id] || study.radiologyReport?.satuSehatStatus === 'SYNCED';

                return (
                  <tr
                    key={study.id}
                    id={`study-row-${study.id}`}
                    onClick={() => onSelectStudy(study)}
                    className={`hover:bg-[#2c333e] transition cursor-pointer ${
                      isSelected ? 'bg-[#1b2f48]/70 border-l-4 border-l-sky-500 font-medium' : ''
                    }`}
                  >
                    {/* Patient info */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{study.patientName}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="font-mono text-sky-400 font-semibold">{study.patientId}</span>
                        <span>•</span>
                        <span>{study.age} th ({study.gender})</span>
                      </div>
                    </td>

                    {/* Study description */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-slate-200 truncate" title={study.studyDescription}>
                        {study.studyDescription}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        No. Aksesi: {study.accessionNumber} ({study.series.reduce((a, b) => a + b.numberOfInstances, 0)} Img)
                      </div>
                    </td>

                    {/* Modality badge */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#1b1f26] text-slate-200 border border-[#3e4755]">
                        {study.modality}
                      </span>
                    </td>

                    {/* Study Date & Time */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-slate-200 font-medium text-xs">{study.studyDate}</div>
                      <div className="text-xs text-slate-400 font-mono">{study.studyTime} WIB</div>
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4">
                      {study.status === 'Sent_To_OR' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-700/80">
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Kamar Bedah (OK)</span>
                        </span>
                      )}
                      {study.status === 'Verified' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950/70 text-sky-300 border border-sky-700/80">
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Terverifikasi Rad</span>
                        </span>
                      )}
                      {study.status === 'In_Reporting' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/70 text-blue-300 border border-blue-700/80">
                          <Activity className="w-3.5 h-3.5" />
                          <span>Sedang Ekspertise</span>
                        </span>
                      )}
                      {study.status === 'Acquired' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1d222a] text-slate-300 border border-[#38404d]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Arsip Masuk</span>
                        </span>
                      )}
                    </td>

                    {/* SatuSehat Sync */}
                    <td className="py-3.5 px-4">
                      {isSynced ? (
                        <span className="inline-flex items-center gap-1.5 text-sky-400 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-sky-400" />
                          <span>Tersinkron</span>
                        </span>
                      ) : (
                        <button
                          id={`sync-btn-${study.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleManualSync(study.id);
                          }}
                          className="px-2.5 py-1 bg-[#1c2c3e] hover:bg-[#233a54] text-sky-300 border border-sky-700/70 rounded-md text-xs font-semibold transition cursor-pointer"
                        >
                          Sinkronkan
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          id={`action-view-${study.id}`}
                          onClick={() => onOpenViewer(study)}
                          className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition cursor-pointer shadow-xs"
                          title="Buka DICOM Workstation Viewer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          id={`action-send-or-${study.id}`}
                          onClick={() =>
                            onRouteToOr(study.id, study.operatingRoom || 'OK-01 (Kamar Bedah Sentral)')
                          }
                          className="p-2 bg-[#2d241d] hover:bg-[#3d3024] text-amber-300 border border-amber-700/70 rounded-lg transition cursor-pointer"
                          title="Kirim ke Kamar Bedah"
                        >
                          <Scissors className="w-4 h-4" />
                        </button>

                        <button
                          id={`action-send-rad-${study.id}`}
                          onClick={() => onRouteToRad(study.id)}
                          className="p-2 bg-[#2a303c] hover:bg-[#343c4a] text-slate-300 border border-[#3e4755] rounded-lg transition cursor-pointer"
                          title="Buka di Instalasi Radiologi"
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DICOM Manual Ingest Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#252a33] rounded-2xl max-w-lg w-full border border-[#3e4755] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#38404d]">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-base">Ingest File DICOM (.dcm)</h3>
              </div>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 p-8 border-2 border-dashed border-sky-600/70 rounded-xl bg-[#1b2533] text-center">
              <UploadCloud className="w-10 h-10 text-sky-400 mx-auto mb-2" />
              <div className="font-semibold text-slate-200 text-sm">
                Tarik file DICOM (.dcm) atau folder studi ke sini
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Mendukung standar CT, MRI, DR Thorax, dan C-Arm Fluoroskopi
              </p>
              <button
                onClick={() => {
                  alert('File DICOM berhasil dimasukkan ke antrian PACS Hub.');
                  setShowIngestModal(false);
                }}
                className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Pilih File dari Komputer
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2 text-sky-300 font-medium">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <span>Auto-ekstraksi Header DICOM (PatientID, PatientName, Modality)</span>
              </div>
              <div className="flex items-center gap-2 text-sky-300 font-medium">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <span>Sinkronisasi otomatis ke SatuSehat Patient Registry</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
