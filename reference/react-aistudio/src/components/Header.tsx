import React from 'react';
import {
  Server,
  Activity,
  Scissors,
  Search,
  CheckCircle2,
  ShieldCheck,
  Building2,
  User,
  MonitorPlay,
  ArrowRightLeft,
  Bell
} from 'lucide-react';
import { InstallationType, DicomStudy } from '../types';

interface HeaderProps {
  activeTab: InstallationType;
  onSelectTab: (tab: InstallationType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedStudy: DicomStudy | null;
  onOpenViewer: () => void;
  userRole: string;
  onRoleChange: (role: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
  selectedStudy,
  onOpenViewer,
  userRole,
  onRoleChange,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Top Meta Bar: SatuSehat & Kemenkes Identity */}
      <div className="bg-slate-50 border-b border-slate-100 px-6 py-1.5 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[10px] shadow-sm">
              S
            </span>
            <span className="font-semibold text-slate-800 tracking-tight">SATUSEHAT</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-medium">Sistem Integrasi Radiologi & PACS Terpadu (Kemenkes RI)</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-teal-700 bg-teal-50/80 px-2.5 py-0.5 rounded-full border border-teal-200/60 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping"></span>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span className="font-medium">FHIR R4 ImagingStudy Bridge: Terkoneksi Real-time</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-slate-500">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-700">RSUPN Dr. Cipto Mangunkusumo</span>
            <span className="text-slate-400 text-[10px]">(Faskes ID: 3171012)</span>
          </div>

          <div className="h-3 w-px bg-slate-200"></div>

          {/* Quick role switcher */}
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-600" />
            <select
              id="role-switcher-select"
              value={userRole}
              onChange={(e) => onRoleChange(e.target.value)}
              className="bg-transparent border-0 text-slate-700 font-medium text-xs focus:ring-0 cursor-pointer pr-2 hover:text-teal-700"
            >
              <option value="dr. Raden Arya, Sp.Rad(K)">dr. Raden Arya, Sp.Rad(K) [Radiologi]</option>
              <option value="dr. Sarah, Sp.B(K)Onk">dr. Sarah, Sp.B(K)Onk [Bedah Toraks]</option>
              <option value="dr. Tri Budianto, Sp.OT(K)">dr. Tri Budianto, Sp.OT(K) [Bedah Ortopedi]</option>
              <option value="Administrator Sistem PACS">Administrator Sistem PACS [IT Medis]</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Bar: Brand, Search, Installation Tabs & Viewer Shortcut */}
      <div className="px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 text-white flex items-center justify-center shadow-sm shadow-teal-700/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-slate-900 tracking-tight">PACS HUB</span>
                <span className="bg-teal-500/10 text-teal-700 font-bold text-[10px] px-1.5 py-0.5 rounded border border-teal-300/40">
                  v3.4 PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Hub DICOM Radiologi & Bedah Sentral
              </p>
            </div>
          </div>
        </div>

        {/* Search input for patient / study */}
        <div className="hidden md:flex flex-1 max-w-md mx-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="global-pacs-search-input"
              type="text"
              placeholder="Cari No. Rekam Medis (RM), NIK, Nama Pasien, atau No. Aksesi..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600 transition"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Minimalist Installation Tabs (PACS Hub, Radiologi, Bedah) */}
        <nav className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 shrink-0">
          {/* Tab 1: PACS Hub */}
          <button
            id="tab-btn-pacs"
            onClick={() => onSelectTab('pacs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'pacs'
                ? 'bg-white text-teal-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Server className={`w-4 h-4 ${activeTab === 'pacs' ? 'text-teal-600' : 'text-slate-400'}`} />
            <span>PACS Central Hub</span>
          </button>

          {/* Tab 2: Instalasi Radiologi */}
          <button
            id="tab-btn-radiologi"
            onClick={() => onSelectTab('radiologi')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'radiologi'
                ? 'bg-white text-teal-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Activity className={`w-4 h-4 ${activeTab === 'radiologi' ? 'text-teal-600' : 'text-slate-400'}`} />
            <span>Instalasi Radiologi</span>
          </button>

          {/* Tab 3: Instalasi Bedah */}
          <button
            id="tab-btn-bedah"
            onClick={() => onSelectTab('bedah')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'bedah'
                ? 'bg-white text-teal-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Scissors className={`w-4 h-4 ${activeTab === 'bedah' ? 'text-teal-600' : 'text-slate-400'}`} />
            <span>Instalasi Bedah (OK)</span>
          </button>
        </nav>

        {/* Quick Launch Workstation Viewer Button */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedStudy ? (
            <button
              id="header-open-viewer-btn"
              onClick={onOpenViewer}
              className="flex items-center gap-2 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
              title="Buka studi aktif di DICOM Viewer resolusi tinggi"
            >
              <MonitorPlay className="w-4 h-4" />
              <span className="hidden xl:inline">Workstation Viewer:</span>
              <span className="font-mono">{selectedStudy.patientId}</span>
            </button>
          ) : (
            <button
              disabled
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-xs font-medium cursor-not-allowed"
            >
              <MonitorPlay className="w-4 h-4 text-slate-300" />
              <span>Pilih Studi DICOM</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
