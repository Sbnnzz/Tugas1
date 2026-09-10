import React from 'react';
import {
  Server,
  Activity,
  Scissors,
  Database,
  Eye,
  User,
  ShieldCheck,
  X,
  Layers,
  Inbox,
  HardDrive
} from 'lucide-react';
import { InstallationType, DicomStudy } from '../types';

interface SidebarProps {
  activeTab: InstallationType;
  onSelectTab: (tab: InstallationType) => void;
  selectedStudy: DicomStudy | null;
  onOpenViewer: () => void;
  userRole: string;
  onRoleChange: (role: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedStudy,
  onOpenViewer,
  userRole,
  onRoleChange,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'pacs' as InstallationType,
      label: 'PACS Hub',
      sublabel: 'Arsip & Routing DICOM',
      icon: Database,
    },
    {
      id: 'radiologi' as InstallationType,
      label: 'Instalasi Radiologi',
      sublabel: 'Worklist & Ekspertise',
      icon: Activity,
    },
    {
      id: 'bedah' as InstallationType,
      label: 'Instalasi Bedah',
      sublabel: 'Kamar Operasi & Pre-Op',
      icon: Scissors,
    },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#252a33] border-r border-[#38404d] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
        isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-[#38404d] bg-[#21252d] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-wide">PACS WORKSTATION</div>
            <div className="text-xs text-sky-400 font-medium">SatuSehat Kemenkes RI</div>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Tabs (Sidebar) */}
      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Modul Instalasi
          </div>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`sidebar-tab-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition cursor-pointer ${
                    isActive
                      ? 'bg-[#1b3149] text-sky-300 font-bold border border-sky-500/80 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-[#2e343f] font-medium'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-sky-600 text-white' : 'bg-[#1e232b] text-slate-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-slate-400 truncate">{item.sublabel}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Selected Study & Viewer Launch Shortcut */}
        {selectedStudy && (
          <div className="p-4 bg-[#1d2128] rounded-xl border border-[#38404d] space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Pasien Terpilih
            </div>

            <div>
              <div className="font-bold text-white text-sm truncate">
                {selectedStudy.patientName}
              </div>
              <div className="text-xs text-sky-400 font-mono font-medium mt-0.5">
                {selectedStudy.patientId} • {selectedStudy.modality}
              </div>
              <div className="text-xs text-slate-300 truncate mt-1">
                {selectedStudy.studyDescription}
              </div>
            </div>

            <button
              id="sidebar-btn-open-viewer"
              onClick={onOpenViewer}
              className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Buka DICOM Workstation</span>
            </button>
          </div>
        )}

        {/* User Role Switcher */}
        <div className="p-3 bg-[#1e232b] rounded-xl border border-[#38404d]">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <User className="w-3.5 h-3.5 text-sky-400" />
            <span>Operator Radiologi</span>
          </div>
          <select
            id="sidebar-role-switcher"
            value={userRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="w-full text-xs font-medium text-slate-200 bg-[#282e37] border border-[#3e4755] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
          >
            <option value="dr. Raden Arya, Sp.Rad(K)">dr. Raden Arya, Sp.Rad(K) (Radiologi)</option>
            <option value="dr. Sarah, Sp.B(K)Onk">dr. Sarah, Sp.B(K)Onk (Bedah Toraks)</option>
            <option value="dr. Tri Budianto, Sp.OT(K)">dr. Tri Budianto, Sp.OT(K) (Bedah Ortopedi)</option>
            <option value="Administrator Sistem PACS">Administrator Sistem PACS</option>
          </select>
        </div>
      </div>

      {/* SatuSehat Compliance Footer in Sidebar */}
      <div className="p-4 border-t border-[#38404d] bg-[#20242b]">
        <div className="flex items-center gap-2 text-xs font-medium text-sky-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>SATUSEHAT FHIR R4 Aktif</span>
        </div>
        <div className="text-xs text-slate-400 mt-1">
          RSUPN Dr. Cipto Mangunkusumo
        </div>
      </div>
    </aside>
  );
};
