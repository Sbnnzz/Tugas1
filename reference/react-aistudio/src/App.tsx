import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { PacsHubView } from './components/PacsHubView';
import { RadiologiView } from './components/RadiologiView';
import { InstalasiBedahView } from './components/InstalasiBedahView';
import { DicomViewer } from './components/DicomViewer';
import { INITIAL_STUDIES } from './data/mockDicomData';
import { InstallationType, DicomStudy } from './types';
import {
  Search,
  CheckCircle2,
  Menu,
  X,
  Mail,
  User,
  Maximize2,
  HardDrive,
  SlidersHorizontal,
  Bell
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<InstallationType>('pacs');
  const [studies, setStudies] = useState<DicomStudy[]>(INITIAL_STUDIES);
  const [selectedStudyId, setSelectedStudyId] = useState<string>(INITIAL_STUDIES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('dr. Raden Arya, Sp.Rad(K)');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning';
  } | null>(null);

  const selectedStudy = studies.find((s) => s.id === selectedStudyId) || studies[0];

  const showNotification = (
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' = 'success'
  ) => {
    const id = Date.now().toString();
    setNotification({ id, title, message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.id === id ? null : curr));
    }, 4000);
  };

  // Route study from PACS or Radiologi to Instalasi Bedah (Kamar Operasi)
  const handleRouteToOr = (studyId: string, roomName: string) => {
    setStudies((prev) =>
      prev.map((s) => {
        if (s.id === studyId) {
          return {
            ...s,
            status: 'Sent_To_OR',
            operatingRoom: roomName,
          };
        }
        return s;
      })
    );
    showNotification(
      'Studi Terkirim ke Kamar Bedah',
      `Studi pasien ${selectedStudy.patientName} berhasil dialirkan ke ${roomName}.`,
      'success'
    );
  };

  // Route to Radiologi tab & open study
  const handleRouteToRad = (studyId: string) => {
    setSelectedStudyId(studyId);
    setActiveTab('radiologi');
  };

  // Save radiology report
  const handleSaveReport = (studyId: string, report: DicomStudy['radiologyReport']) => {
    setStudies((prev) =>
      prev.map((s) => {
        if (s.id === studyId) {
          return {
            ...s,
            status: 'Verified',
            radiologyReport: report,
          };
        }
        return s;
      })
    );
    showNotification(
      'Ekspertise Radiologi Terverifikasi',
      `Hasil pembacaan radiologi berhasil disimpan dan disinkronkan ke SatuSehat.`,
      'success'
    );
  };

  // Save surgical notes
  const handleSaveSurgicalNotes = (studyId: string, notes: DicomStudy['surgicalNotes']) => {
    setStudies((prev) =>
      prev.map((s) => {
        if (s.id === studyId) {
          return {
            ...s,
            surgicalNotes: notes,
          };
        }
        return s;
      })
    );
    showNotification(
      'Catatan Bedah Tersimpan',
      `Perencanaan pra-bedah dan catatan intra-operatif berhasil disinkronkan ke PACS.`,
      'success'
    );
  };

  // Capture intra-op fluoroscopy snapshot in OR
  const handleCaptureIntraOp = (studyId: string) => {
    setStudies((prev) =>
      prev.map((s) => {
        if (s.id === studyId) {
          const currentCaptures = (s.surgicalNotes?.cArmCapturesCount || 0) + 1;
          const updatedSeries = [...s.series];
          if (updatedSeries[0]) {
            updatedSeries[0] = {
              ...updatedSeries[0],
              numberOfInstances: updatedSeries[0].numberOfInstances + 1,
              slices: [
                ...updatedSeries[0].slices,
                {
                  sliceIndex: updatedSeries[0].slices.length + 1,
                  sliceLocation: 0,
                  thickness: 0,
                  kvp: 72,
                  ma: 5.0,
                  imageType: 'c_arm_fluoro',
                  svgRendererType: 'c_arm_fluoro',
                },
              ],
            };
          }
          return {
            ...s,
            series: updatedSeries,
            surgicalNotes: {
              ...s.surgicalNotes!,
              cArmCapturesCount: currentCaptures,
              intraOpFinding:
                (s.surgicalNotes?.intraOpFinding ? s.surgicalNotes.intraOpFinding + ' | ' : '') +
                `Snapshot C-Arm #${currentCaptures} (${new Date().toLocaleTimeString('id-ID')})`,
            },
          };
        }
        return s;
      })
    );
    showNotification(
      'Tangkapan C-Arm Tersimpan',
      `Citra fluoroskopi intra-operatif berhasil dikonversi ke DICOM dan masuk ke arsip PACS.`,
      'success'
    );
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'pacs':
        return {
          title: 'PACS Central Hub',
          description: 'Pusat Penyimpanan, Manajemen, dan Routing Citra Medis DICOM',
        };
      case 'radiologi':
        return {
          title: 'Instalasi Radiologi',
          description: 'Daftar Kerja Diagnostik & Pembuatan Laporan Ekspertise Terstandar',
        };
      case 'bedah':
        return {
          title: 'Instalasi Bedah Sentral',
          description: 'Monitor Kamar Operasi, Panduan Citra Pre-Op, & C-Arm Fluoroskopi',
        };
    }
  };

  const currentTabInfo = getTabTitle();

  return (
    <div className="min-h-screen bg-[#1e2229] text-slate-200 flex font-sans selection:bg-sky-500 selection:text-white">
      {/* Mobile backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedStudy={selectedStudy}
        onOpenViewer={() => setIsViewerOpen(true)}
        userRole={userRole}
        onRoleChange={setUserRole}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Hospital PACS Top Bar (Gray Theme like Reference Photo) */}
        <header className="bg-[#252a33] border-b border-[#38404d] sticky top-0 z-20 px-6 py-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-300 hover:bg-[#2e3540] rounded-lg cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white tracking-wide">{currentTabInfo.title}</h1>
                <p className="text-xs text-slate-400">{currentTabInfo.description}</p>
              </div>
            </div>

            {/* Middle & Right: Search and Hospital PACS Utility Header Icons */}
            <div className="flex items-center gap-3">
              <div className="relative w-64 sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="global-pacs-search-input"
                  type="text"
                  placeholder="Cari Pasien, No. RM, atau NIK..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-[#1b1f26] focus:bg-[#181b22] text-xs text-white placeholder-slate-400 rounded-lg border border-[#38404d] focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Utility Icons matching the reference PACS photo */}
              <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-[#38404d] text-slate-300">
                <button
                  onClick={() => setIsViewerOpen(true)}
                  className="p-2 hover:bg-[#2e3540] rounded-lg text-sky-400 hover:text-sky-300 transition cursor-pointer"
                  title="Buka DICOM Workstation Viewer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => showNotification('Sistem Pesan Radiologi', 'Tidak ada pesan mendesak dari Instalasi Bedah.', 'info')}
                  className="p-2 hover:bg-[#2e3540] rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
                  title="Pesan Klinis & Notifikasi"
                >
                  <Mail className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-full bg-[#1b1f26] border border-[#38404d] flex items-center justify-center text-xs font-bold text-sky-400 ml-1">
                  RA
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* View Component */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'pacs' && (
            <PacsHubView
              studies={studies}
              selectedStudyId={selectedStudyId}
              onSelectStudy={(s) => setSelectedStudyId(s.id)}
              onOpenViewer={(s) => {
                setSelectedStudyId(s.id);
                setIsViewerOpen(true);
              }}
              onRouteToOr={handleRouteToOr}
              onRouteToRad={handleRouteToRad}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'radiologi' && (
            <RadiologiView
              studies={studies}
              selectedStudy={selectedStudy}
              onSelectStudy={(s) => setSelectedStudyId(s.id)}
              onOpenViewer={(s) => {
                setSelectedStudyId(s.id);
                setIsViewerOpen(true);
              }}
              onSendToOr={handleRouteToOr}
              onSaveReport={handleSaveReport}
              userRole={userRole}
            />
          )}

          {activeTab === 'bedah' && (
            <InstalasiBedahView
              studies={studies}
              selectedStudy={selectedStudy}
              onSelectStudy={(s) => setSelectedStudyId(s.id)}
              onOpenViewer={(s) => {
                setSelectedStudyId(s.id);
                setIsViewerOpen(true);
              }}
              onCaptureIntraOp={handleCaptureIntraOp}
              onSaveSurgicalNotes={handleSaveSurgicalNotes}
              userRole={userRole}
            />
          )}
        </main>
      </div>

      {/* Global Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#252a33] border border-sky-600/70 rounded-xl p-4 shadow-2xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#18293d] text-sky-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-xs">{notification.title}</div>
            <div className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {notification.message}
            </div>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* High-Resolution DICOM Workstation Modal */}
      {isViewerOpen && (
        <DicomViewer
          study={selectedStudy}
          onClose={() => setIsViewerOpen(false)}
          onSendToOr={() => {
            handleRouteToOr(
              selectedStudy.id,
              selectedStudy.operatingRoom || 'OK-02 (Bedah Toraks & Vaskuler)'
            );
          }}
          onSendToRad={() => {
            setActiveTab('radiologi');
            setIsViewerOpen(false);
          }}
        />
      )}
    </div>
  );
}
