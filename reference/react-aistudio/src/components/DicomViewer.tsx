import React, { useState, useRef, useEffect, useId } from 'react';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  Contrast,
  Ruler,
  Play,
  Pause,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Move,
  Eye,
  RefreshCw,
  Square,
  Crosshair,
  Download,
  Share2,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Columns,
  Hand,
  Menu,
  X,
  Plus,
  ExternalLink,
  MousePointer2,
  Zap,
  Box,
  SlidersHorizontal,
  FileText,
  Trash2
} from 'lucide-react';
import { DicomStudy, WindowPreset, ViewerToolState, Measurement } from '../types';

interface DicomViewerProps {
  study: DicomStudy;
  initialSeriesIndex?: number;
  onClose?: () => void;
  isEmbedded?: boolean;
  onSendToOr?: () => void;
  onSendToRad?: () => void;
}

const PRESET_VALUES: Record<WindowPreset, { ww: number; wl: number; label: string }> = {
  DEFAULT: { ww: 400, wl: 40, label: 'Default' },
  LUNG: { ww: 1500, wl: -600, label: 'Paru (Lung)' },
  BONE: { ww: 2000, wl: 350, label: 'Tulang (Bone)' },
  BRAIN: { ww: 80, wl: 40, label: 'Otak (Brain)' },
  SOFT_TISSUE: { ww: 350, wl: 50, label: 'Jaringan Lunak' },
  ANGIO: { ww: 600, wl: 200, label: 'Vaskular / Angio' },
};

export const DicomViewer: React.FC<DicomViewerProps> = ({
  study,
  initialSeriesIndex = 0,
  onClose,
  isEmbedded = false,
  onSendToOr,
  onSendToRad,
}) => {
  const [selectedSeriesIdx, setSelectedSeriesIdx] = useState(initialSeriesIndex);
  const activeSeries = study.series[selectedSeriesIdx] || study.series[0];
  const totalSlices = activeSeries.slices.length;

  const [toolState, setToolState] = useState<ViewerToolState>({
    activeTool: 'window',
    windowLevel: 40,
    windowWidth: 400,
    zoom: 1,
    panX: 0,
    panY: 0,
    inverted: false,
    rotation: 0,
    flipH: false,
    currentSliceIndex: Math.floor(totalSlices / 2),
    isPlayingCine: false,
    cineSpeed: 8,
    measurements: [],
    selectedPreset: 'DEFAULT',
  });

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [currentMeasurePoints, setCurrentMeasurePoints] = useState<{ x: number; y: number }[]>([]);
  const [showDicomInfo, setShowDicomInfo] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'1x1' | '2x1' | '2x2'>('2x2');
  const [activeViewport, setActiveViewport] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Vue PACS Web Client Advanced Tool States (as shown in reference photo)
  const [activeTabName, setActiveTabName] = useState<'Analysis' | 'Viewer'>('Analysis');
  const [activeRibbonMenu, setActiveRibbonMenu] = useState<string | null>(null);
  const [projectionMode, setProjectionMode] = useState<'AVERAGE' | 'MINIMUM' | 'MAXIMUM'>('AVERAGE');
  const [swivelAngle, setSwivelAngle] = useState<number>(0);
  const [isAutoRolling, setIsAutoRolling] = useState<boolean>(false);
  const [isDualWindowing, setIsDualWindowing] = useState<boolean>(false);
  const [relateEnabled, setRelateEnabled] = useState<boolean>(false);
  const [planeReformat, setPlaneReformat] = useState<'AXIAL' | 'SAGITTAL' | 'CORONAL' | 'OBLIQUE'>('AXIAL');
  const [showSwivelMenu, setShowSwivelMenu] = useState<boolean>(false);
  const [showRelateMenu, setShowRelateMenu] = useState<boolean>(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState<boolean>(false);
  const [showReformatMenu, setShowReformatMenu] = useState<boolean>(false);
  const [showZoomMenu, setShowZoomMenu] = useState<boolean>(false);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const currentSlice = activeSeries.slices[toolState.currentSliceIndex] || activeSeries.slices[0];

  // Cine loop timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (toolState.isPlayingCine && totalSlices > 1) {
      interval = setInterval(() => {
        setToolState((prev) => ({
          ...prev,
          currentSliceIndex: (prev.currentSliceIndex + 1) % totalSlices,
        }));
      }, 1000 / toolState.cineSpeed);
    }
    return () => clearInterval(interval);
  }, [toolState.isPlayingCine, toolState.cineSpeed, totalSlices]);

  // 3D Auto Roll effect (from Vue PACS toolbar Auto Roll button)
  useEffect(() => {
    let rollInterval: NodeJS.Timeout;
    if (isAutoRolling) {
      rollInterval = setInterval(() => {
        setToolState((prev) => ({
          ...prev,
          rotation: (prev.rotation + 3) % 360,
        }));
      }, 60);
    }
    return () => clearInterval(rollInterval);
  }, [isAutoRolling]);

  // Apply Window preset
  const applyPreset = (preset: WindowPreset) => {
    const val = PRESET_VALUES[preset];
    setToolState((prev) => ({
      ...prev,
      selectedPreset: preset,
      windowWidth: val.ww,
      windowLevel: val.wl,
    }));
    triggerToast(`Preset: ${val.label} (WW: ${val.ww}, WL: ${val.wl})`);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Reset viewport
  const resetViewer = () => {
    setToolState((prev) => ({
      ...prev,
      zoom: 1,
      panX: 0,
      panY: 0,
      rotation: 0,
      flipH: false,
      inverted: false,
      windowLevel: 40,
      windowWidth: 400,
      selectedPreset: 'DEFAULT',
      measurements: [],
    }));
    setCurrentMeasurePoints([]);
    triggerToast('Viewport di-reset ke nilai default');
  };

  // Mouse drag handling for Windowing, Pan, Zoom, or Measurement
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // only left click
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (toolState.activeTool === 'measure') {
      if (currentMeasurePoints.length === 0) {
        setCurrentMeasurePoints([{ x: clickX, y: clickY }]);
        setIsMeasuring(true);
      } else if (currentMeasurePoints.length === 1) {
        // Complete measurement
        const p1 = currentMeasurePoints[0];
        const p2 = { x: clickX, y: clickY };
        // Estimate mm based on pixel distance (approx 0.6mm per pixel at 1.0 zoom)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const pixelDist = Math.sqrt(dx * dx + dy * dy);
        const mmDist = ((pixelDist * 0.58) / toolState.zoom).toFixed(1);

        const newMeasurement: Measurement = {
          id: `m-${Date.now()}`,
          type: 'length',
          points: [p1, p2],
          valueLabel: `${mmDist} mm`,
        };
        setToolState((prev) => ({
          ...prev,
          measurements: [...prev.measurements, newMeasurement],
        }));
        setCurrentMeasurePoints([]);
        setIsMeasuring(false);
        triggerToast(`Pengukuran tersimpan: ${mmDist} mm`);
      }
      return;
    }

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    if (toolState.activeTool === 'window') {
      setToolState((prev) => ({
        ...prev,
        windowWidth: Math.max(10, prev.windowWidth + deltaX * 3),
        windowLevel: prev.windowLevel + deltaY * 2,
      }));
    } else if (toolState.activeTool === 'pan') {
      setToolState((prev) => ({
        ...prev,
        panX: prev.panX + deltaX,
        panY: prev.panY + deltaY,
      }));
    } else if (toolState.activeTool === 'zoom') {
      const zoomFactor = deltaY < 0 ? 1.02 : 0.98;
      setToolState((prev) => ({
        ...prev,
        zoom: Math.max(0.4, Math.min(6, prev.zoom * zoomFactor)),
      }));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (totalSlices <= 1) return;
    if (e.deltaY > 0) {
      setToolState((prev) => ({
        ...prev,
        currentSliceIndex: Math.min(totalSlices - 1, prev.currentSliceIndex + 1),
      }));
    } else {
      setToolState((prev) => ({
        ...prev,
        currentSliceIndex: Math.max(0, prev.currentSliceIndex - 1),
      }));
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        setToolState((prev) => ({
          ...prev,
          currentSliceIndex: Math.min(totalSlices - 1, prev.currentSliceIndex + 1),
        }));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        setToolState((prev) => ({
          ...prev,
          currentSliceIndex: Math.max(0, prev.currentSliceIndex - 1),
        }));
      } else if (e.key === ' ') {
        e.preventDefault();
        setToolState((prev) => ({ ...prev, isPlayingCine: !prev.isPlayingCine }));
      } else if (e.key.toLowerCase() === 'w') {
        setToolState((prev) => ({ ...prev, activeTool: 'window' }));
      } else if (e.key.toLowerCase() === 'p') {
        setToolState((prev) => ({ ...prev, activeTool: 'pan' }));
      } else if (e.key.toLowerCase() === 'z') {
        setToolState((prev) => ({ ...prev, activeTool: 'zoom' }));
      } else if (e.key.toLowerCase() === 'm') {
        setToolState((prev) => ({ ...prev, activeTool: 'measure' }));
      } else if (e.key.toLowerCase() === 'r') {
        resetViewer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSlices]);

  // Compute CSS filter for windowing brightness/contrast & invert + Projection Mode
  let contrastFactor = Math.max(0.5, Math.min(3.5, 800 / (toolState.windowWidth || 400)));
  let brightnessFactor = Math.max(0.2, Math.min(2.5, 1 + (toolState.windowLevel - 40) / 400));

  if (projectionMode === 'MINIMUM') {
    contrastFactor *= 1.35;
    brightnessFactor *= 0.85;
  } else if (projectionMode === 'MAXIMUM') {
    contrastFactor *= 1.45;
    brightnessFactor *= 1.25;
  }

  const filterStyle = `contrast(${contrastFactor}) brightness(${brightnessFactor}) ${
    toolState.inverted ? 'invert(1)' : ''
  } ${projectionMode === 'MAXIMUM' ? 'drop-shadow(0 0 6px rgba(56,189,248,0.35))' : ''}`;

  // Unique ID for SVG filters
  const filterUniqueId = useId().replace(/:/g, '');

  return (
    <div
      id="dicom-workstation-container"
      className={`flex flex-col bg-[#0d121f] text-slate-100 select-none overflow-hidden font-sans ${
        isEmbedded ? 'h-full w-full rounded-xl border border-[#232d44]' : 'fixed inset-0 z-50'
      }`}
    >
      {/* 1. App Title Bar (as shown in reference photo: Blue Hand Icon + Patient Info + Vue PACS Web Client) */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#dbe4ee] border-b border-[#b7c6d6] text-xs text-slate-800 shrink-0 select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Blue Palm/Hand Icon Badge matching reference photo */}
          <div className="w-5 h-5 rounded bg-[#0081c9] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Hand className="w-3.5 h-3.5 fill-white text-[#0081c9]" />
          </div>
          <span className="font-medium text-slate-900 truncate tracking-tight text-[12px]">
            {study.patientName}, {study.patientId}, {study.studyDate} (Unread) - Vue PACS Web Client
          </span>
        </div>

        {/* Window Chrome Controls */}
        <div className="flex items-center gap-2 text-slate-600 shrink-0">
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            Modality: {study.modality}
          </span>
          <button
            onClick={() => setShowDicomInfo(!showDicomInfo)}
            className="p-1 hover:bg-[#c3d1e0] rounded text-slate-700"
            title="Toggle OSD Annotations"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-rose-500 hover:text-white rounded text-slate-700 transition"
              title="Tutup Viewer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Dark Tab Strip (Hamburger + Cardiac Analysis Tab + Viewer Tab + Plus + Popout) */}
      <div className="flex items-center justify-between px-2 pt-1 bg-[#0c101c] border-b border-[#1b2339] text-xs shrink-0 select-none">
        <div className="flex items-end gap-1">
          {/* Hamburger Menu Icon */}
          <button
            id="btn-pacs-hamburger"
            onClick={() => setIsMenuDrawerOpen(!isMenuDrawerOpen)}
            className="p-1.5 mb-0.5 rounded text-slate-300 hover:text-white hover:bg-[#182138] transition cursor-pointer"
            title="Menu Utama PACS / Detail Studi"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Active Tab: Cardiac Analysis (as shown in reference photo) */}
          <div
            onClick={() => setActiveTabName('Analysis')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer transition text-xs font-semibold ${
              activeTabName === 'Analysis'
                ? 'bg-[#151c2e] text-white border-t-2 border-sky-400 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 bg-[#0f1424]'
            }`}
          >
            <span>Cardiac Analysis</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onClose) onClose();
              }}
              className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition"
              title="Tutup Tab"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Inactive Tab: Viewer */}
          <div
            onClick={() => setActiveTabName('Viewer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md cursor-pointer transition text-xs ${
              activeTabName === 'Viewer'
                ? 'bg-[#151c2e] text-white border-t-2 border-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Viewer</span>
          </div>

          {/* Add Tab (+) Button */}
          <button
            onClick={() => triggerToast('Tab Studi Baru dibuka')}
            className="p-1 mb-1 text-slate-400 hover:text-white hover:bg-[#182138] rounded transition cursor-pointer"
            title="Buka Tab Studi Baru"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate / Popout Layout Button */}
          <button
            onClick={() => triggerToast('Tata Letak Viewport Digandakan')}
            className="p-1 mb-1 text-slate-400 hover:text-white hover:bg-[#182138] rounded transition cursor-pointer"
            title="Popout / Duplikasi Viewport"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick External Actions */}
        <div className="flex items-center gap-2 pb-1">
          {onSendToOr && (
            <button
              id="viewer-btn-send-or"
              onClick={onSendToOr}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#332415] text-amber-300 border border-amber-600/50 hover:bg-[#42311f] rounded text-xs transition cursor-pointer"
              title="Kirim studi ini ke Kamar Operasi (Instalasi Bedah)"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Kirim ke OK Bedah</span>
            </button>
          )}

          {onSendToRad && (
            <button
              id="viewer-btn-send-rad"
              onClick={onSendToRad}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#152438] text-sky-300 border border-sky-600/50 hover:bg-[#1d324d] rounded text-xs transition cursor-pointer"
              title="Buka Lembar Ekspertise Radiologi"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Ekspertise Radiologi</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Sub-Menu Bar (Image | Graphics | Cardiac Analysis | Lesions | Export) */}
      <div className="flex items-center px-4 py-1 bg-[#101524] border-b border-[#1c2438] text-xs text-[#8da2c0] gap-5 shrink-0 select-none">
        {(['Image', 'Graphics', 'Cardiac Analysis', 'Lesions', 'Export'] as const).map((menu) => (
          <button
            key={menu}
            onClick={() => {
              setActiveRibbonMenu(activeRibbonMenu === menu ? null : menu);
              triggerToast(`Menu [${menu}] dibuka`);
            }}
            className={`hover:text-white px-1.5 py-0.5 rounded transition cursor-pointer ${
              activeRibbonMenu === menu ? 'text-sky-300 bg-[#192238] font-medium' : ''
            }`}
          >
            {menu}
          </button>
        ))}
      </div>

      {/* 4. The PACS Toolbar (Exact Replica of Reference Photo) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#141a2b] border-b border-[#232d44] text-xs shrink-0 select-none overflow-x-auto">
        <div className="flex items-center gap-2">
          {/* Zone A: Left Quick-Tool Palette (2 rows x 3 columns) */}
          <div className="grid grid-cols-3 gap-1 bg-[#0e1322] p-1 rounded border border-[#242d45] shrink-0">
            {/* 1. Pointer */}
            <button
              id="tool-pointer"
              onClick={() => setToolState((p) => ({ ...p, activeTool: 'pointer' }))}
              className={`p-1.5 rounded transition flex items-center justify-center cursor-pointer ${
                toolState.activeTool === 'pointer'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-[#1c2438]'
              }`}
              title="Pointer / Selection Tool"
            >
              <MousePointer2 className="w-4 h-4" />
            </button>

            {/* 2. Pan (4-way cross) */}
            <button
              id="tool-pan"
              onClick={() => setToolState((p) => ({ ...p, activeTool: 'pan' }))}
              className={`p-1.5 rounded transition flex items-center justify-center cursor-pointer ${
                toolState.activeTool === 'pan'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-[#1c2438]'
              }`}
              title="Pan / Geser Gambar (Shortcut: P)"
            >
              <Move className="w-4 h-4" />
            </button>

            {/* 3. Zoom with dropdown caret */}
            <button
              id="tool-zoom"
              onClick={() => setToolState((p) => ({ ...p, activeTool: 'zoom' }))}
              className={`p-1.5 rounded transition flex items-center justify-center gap-0.5 cursor-pointer ${
                toolState.activeTool === 'zoom'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-[#1c2438]'
              }`}
              title="Zoom / Perbesar (Shortcut: Z)"
            >
              <ZoomIn className="w-4 h-4" />
              <span className="text-[8px] leading-none">▾</span>
            </button>

            {/* 4. Caliper / Ruler Line */}
            <button
              id="tool-measure"
              onClick={() => {
                setToolState((p) => ({ ...p, activeTool: 'measure' }));
                setCurrentMeasurePoints([]);
                triggerToast('Klik 2 titik pada gambar untuk mengukur jarak (mm)');
              }}
              className={`p-1.5 rounded transition flex items-center justify-center cursor-pointer ${
                toolState.activeTool === 'measure'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-[#1c2438]'
              }`}
              title="Caliper / Jarak Milimeter (Shortcut: M)"
            >
              <Ruler className="w-4 h-4" />
            </button>

            {/* 5. Window / Level Contrast */}
            <button
              id="tool-window"
              onClick={() => setToolState((p) => ({ ...p, activeTool: 'window' }))}
              className={`p-1.5 rounded transition flex items-center justify-center cursor-pointer ${
                toolState.activeTool === 'window'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-[#1c2438]'
              }`}
              title="Window/Level Contrast (Shortcut: W)"
            >
              <Contrast className="w-4 h-4" />
            </button>

            {/* 6. Rotate */}
            <button
              id="tool-rotate"
              onClick={() => {
                setToolState((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }));
                triggerToast('Gambar dirotasi 90° searah jarum jam');
              }}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1c2438] transition flex items-center justify-center cursor-pointer"
              title="Rotasi 90° Clockwise"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Vertical Divider with collapse indicator ◀|▶ */}
          <div className="h-9 w-px bg-[#26314c] mx-1 flex items-center justify-center">
            <span className="text-[8px] text-slate-500 select-none">|</span>
          </div>

          {/* Zone B: Horizontal Ribbon Modules */}
          {/* Module 1: 3D Tools (Swivel, Relate, Roll, Auto Roll) */}
          <div className="flex items-center gap-2">
            {/* Swivel */}
            <button
              id="tool-swivel"
              onClick={() => {
                const angles = [0, 15, 30, 45];
                const nextIdx = (angles.indexOf(swivelAngle) + 1) % angles.length;
                const nextAngle = angles[nextIdx];
                setSwivelAngle(nextAngle);
                triggerToast(`3D Swivel Angulation: ${nextAngle}°`);
              }}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[50px] ${
                swivelAngle !== 0
                  ? 'bg-sky-950/70 border border-sky-500/50 text-sky-300'
                  : 'text-slate-300 hover:text-white hover:bg-[#1a2238]'
              }`}
              title="3D Oblique Swivel Angulation"
            >
              <div className="flex items-center gap-0.5">
                <Box className="w-4 h-4" />
                <span className="text-[8px] text-slate-400">▾</span>
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Swivel</span>
            </button>

            {/* Relate */}
            <button
              id="tool-relate"
              onClick={() => {
                const nextState = !relateEnabled;
                setRelateEnabled(nextState);
                triggerToast(nextState ? 'Relate: Sinkronisasi Crosshair Aktif' : 'Relate: Dinonaktifkan');
              }}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[50px] ${
                relateEnabled
                  ? 'bg-sky-950/70 border border-sky-500/50 text-sky-300'
                  : 'text-slate-300 hover:text-white hover:bg-[#1a2238]'
              }`}
              title="Relate: Multi-viewport Reference Line Sync"
            >
              <div className="flex items-center gap-0.5">
                <Crosshair className="w-4 h-4" />
                <span className="text-[8px] text-slate-400">▾</span>
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Relate</span>
            </button>

            {/* Roll */}
            <button
              id="tool-roll"
              onClick={() => {
                setToolState((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }));
                triggerToast('Roll: Rotasi Kuadran 90°');
              }}
              className="flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[46px] text-slate-300 hover:text-white hover:bg-[#1a2238]"
              title="Roll Viewport Orientation"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Roll</span>
            </button>

            {/* Auto Roll */}
            <button
              id="tool-autoroll"
              onClick={() => {
                const nextAuto = !isAutoRolling;
                setIsAutoRolling(nextAuto);
                triggerToast(nextAuto ? 'Auto Roll: Berjalan (Simulasi 3D C-Arm)' : 'Auto Roll: Berhenti');
              }}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[50px] ${
                isAutoRolling
                  ? 'bg-amber-950/80 border border-amber-500 text-amber-300 animate-pulse'
                  : 'text-slate-300 hover:text-white hover:bg-[#1a2238]'
              }`}
              title="Auto Roll 3D Continuous Rotation"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] mt-0.5 font-medium tracking-tight text-center leading-none">Auto<br />Roll</span>
            </button>
          </div>

          {/* Vertical Divider */}
          <div className="h-8 w-px bg-[#26314c] mx-1"></div>

          {/* Module 2: Display & Windowing (Dual Windowing, Group Layout) */}
          <div className="flex items-center gap-2">
            {/* Dual Windowing */}
            <button
              id="tool-dual-windowing"
              onClick={() => {
                const nextDual = !isDualWindowing;
                setIsDualWindowing(nextDual);
                triggerToast(nextDual ? 'Dual Windowing: Paru + Mediastinum Aktif' : 'Dual Windowing: Off');
              }}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[60px] ${
                isDualWindowing
                  ? 'bg-sky-950/70 border border-sky-500/50 text-sky-300'
                  : 'text-slate-400 hover:text-white hover:bg-[#1a2238]'
              }`}
              title="Dual Windowing: Split Lung/Bone/Soft-Tissue"
            >
              <div className="flex items-center gap-0.5">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-[8px] text-slate-400">▾</span>
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight text-center leading-none">Dual<br />Windowing</span>
            </button>

            {/* Group Layout */}
            <button
              id="tool-group-layout"
              onClick={() => {
                const nextMode = layoutMode === '2x2' ? '1x1' : layoutMode === '1x1' ? '2x1' : '2x2';
                setLayoutMode(nextMode);
                triggerToast(`Group Layout: ${nextMode} Grid`);
              }}
              className="flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[54px] text-slate-300 hover:text-white hover:bg-[#1a2238]"
              title={`Group Layout: Mode ${layoutMode} (Klik untuk berganti 1x1, 2x1, 2x2)`}
            >
              <div className="flex items-center gap-0.5">
                <LayoutGrid className="w-4 h-4 text-sky-400" />
                <span className="text-[8px] text-slate-400">▾</span>
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight text-center leading-none">Group<br />Layout</span>
            </button>
          </div>

          {/* Vertical Divider */}
          <div className="h-8 w-px bg-[#26314c] mx-1"></div>

          {/* Module 3: Projection Modes (Average, Minimum, Maximum) */}
          {/* Average is highlighted in CYAN as in reference photo! */}
          <div className="flex items-center gap-2">
            {/* Average */}
            <button
              id="tool-proj-average"
              onClick={() => {
                setProjectionMode('AVERAGE');
                triggerToast('Mode Proyeksi: Average (Standar Ray Sum)');
              }}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[48px] ${
                projectionMode === 'AVERAGE'
                  ? 'text-[#41c0ea] font-semibold drop-shadow-[0_0_8px_rgba(65,192,234,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Average Intensity Projection"
            >
              <div className="flex items-center justify-center">
                <Layers className={`w-4 h-4 ${projectionMode === 'AVERAGE' ? 'text-[#41c0ea]' : 'text-slate-400'}`} />
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Average</span>
            </button>

            {/* Minimum (MinIP) */}
            <button
              id="tool-proj-minimum"
              onClick={() => {
                setProjectionMode('MINIMUM');
                triggerToast('Mode Proyeksi: Minimum (MinIP - Saluran Napas/Emfisema)');
              }}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[48px] ${
                projectionMode === 'MINIMUM'
                  ? 'text-[#41c0ea] font-semibold drop-shadow-[0_0_8px_rgba(65,192,234,0.3)]'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Minimum Intensity Projection (MinIP)"
            >
              <div className="flex items-center justify-center">
                <Layers className={`w-4 h-4 ${projectionMode === 'MINIMUM' ? 'text-[#41c0ea]' : 'text-slate-400'}`} />
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Minimum</span>
            </button>

            {/* Maximum (MIP) */}
            <button
              id="tool-proj-maximum"
              onClick={() => {
                setProjectionMode('MAXIMUM');
                triggerToast('Mode Proyeksi: Maximum (MIP - Pembuluh Darah/Kalsifikasi)');
              }}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[48px] ${
                projectionMode === 'MAXIMUM'
                  ? 'text-[#41c0ea] font-semibold drop-shadow-[0_0_8px_rgba(65,192,234,0.3)]'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Maximum Intensity Projection (MIP)"
            >
              <div className="flex items-center justify-center">
                <Layers className={`w-4 h-4 ${projectionMode === 'MAXIMUM' ? 'text-[#41c0ea]' : 'text-slate-400'}`} />
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight">Maximum</span>
            </button>
          </div>

          {/* Vertical Divider */}
          <div className="h-8 w-px bg-[#26314c] mx-1"></div>

          {/* Module 4: Advanced Reformat (Plane Reformat...) */}
          <div className="flex items-center">
            <button
              id="tool-plane-reformat"
              onClick={() => {
                const planes: ('AXIAL' | 'SAGITTAL' | 'CORONAL' | 'OBLIQUE')[] = ['AXIAL', 'SAGITTAL', 'CORONAL', 'OBLIQUE'];
                const nextIdx = (planes.indexOf(planeReformat) + 1) % planes.length;
                const nextPlane = planes[nextIdx];
                setPlaneReformat(nextPlane);
                triggerToast(`Plane Reformat: ${nextPlane} MPR`);
              }}
              className="flex flex-col items-center justify-center px-2 py-1 rounded transition cursor-pointer min-w-[80px] text-slate-300 hover:text-white hover:bg-[#1a2238]"
              title={`Multi-Planar Reconstruction (MPR): ${planeReformat}`}
            >
              <div className="flex items-center gap-0.5">
                <Box className="w-4 h-4 text-sky-400" />
                <span className="text-[8px] text-slate-400">▾</span>
              </div>
              <span className="text-[10px] mt-0.5 font-medium tracking-tight text-center truncate">Plane Reformat...</span>
            </button>
          </div>
        </div>

        {/* Right Toolbar Presets & Quick Reset */}
        <div className="hidden xl:flex items-center gap-1.5 shrink-0 pl-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-[#0e1322] px-2 py-1 rounded border border-[#242d45]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Preset:</span>
            {(['LUNG', 'BONE', 'SOFT_TISSUE', 'ANGIO'] as WindowPreset[]).map((preset) => (
              <button
                key={preset}
                id={`preset-${preset.toLowerCase()}`}
                onClick={() => applyPreset(preset)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer ${
                  toolState.selectedPreset === preset
                    ? 'bg-sky-600 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a2238]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            id="btn-reset"
            onClick={resetViewer}
            className="p-1.5 bg-[#172036] hover:bg-[#202c48] text-slate-300 rounded transition cursor-pointer border border-[#242d45]"
            title="Reset Viewport (Shortcut: R)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Workspace Body: Viewports (Left/Center) + Series Panel on Right (like photo) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Central Viewport Area (1x1, 2x1, or 2x2 Grid) */}
        <div
          ref={containerRef}
          id="dicom-canvas-viewport"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="flex-1 bg-[#101318] relative flex overflow-hidden cursor-crosshair p-1.5 gap-1.5"
        >
          {/* Toast Notification */}
          {toastMessage && (
            <div className="absolute top-4 z-40 left-1/2 -translate-x-1/2 bg-[#212732]/95 text-sky-300 border border-sky-500/50 px-3.5 py-1.5 rounded-full text-xs shadow-xl backdrop-blur flex items-center gap-2 animate-fade-in pointer-events-none">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Grid Viewport Layout Rendering */}
          <div
            className={`w-full h-full grid gap-1.5 ${
              layoutMode === '2x2'
                ? 'grid-cols-2 grid-rows-2'
                : layoutMode === '2x1'
                ? 'grid-cols-2 grid-rows-1'
                : 'grid-cols-1 grid-rows-1'
            }`}
          >
            {Array.from({
              length: layoutMode === '2x2' ? 4 : layoutMode === '2x1' ? 2 : 1,
            }).map((_, vIndex) => {
              const isActive = activeViewport === vIndex;
              const sliceOffset = vIndex * 2;
              const displaySliceIndex = Math.min(
                totalSlices - 1,
                Math.max(0, toolState.currentSliceIndex + sliceOffset)
              );
              const vSlice = activeSeries.slices[displaySliceIndex] || currentSlice;

              return (
                <div
                  key={vIndex}
                  onClick={() => setActiveViewport(vIndex)}
                  className={`relative bg-black rounded flex items-center justify-center overflow-hidden transition-all duration-150 ${
                    isActive
                      ? 'border-2 border-amber-400 ring-1 ring-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'border border-[#2d3440] hover:border-slate-500'
                  }`}
                >
                  {/* Corner DICOM OSD Annotations (High-Visibility Clinical Yellow/Cyan matching reference photo) */}
                  {showDicomInfo && (
                    <>
                      {/* TOP LEFT: Patient Demographics */}
                      <div className="absolute top-2 left-3 z-20 pointer-events-none text-xs font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] space-y-0.5 leading-tight">
                        <div className="font-bold text-cyan-300 text-xs sm:text-sm">
                          {study.patientName} ({study.gender})
                        </div>
                        <div className="text-slate-300">ID: {study.patientId}</div>
                        <div className="text-slate-400 text-[10px]">NIK: {study.nik}</div>
                        <div className="text-slate-400 text-[10px]">
                          DOB: {study.birthDate} ({study.age} th)
                        </div>
                      </div>

                      {/* TOP RIGHT: Institution, Date & Modality */}
                      <div className="absolute top-2 right-3 z-20 pointer-events-none text-xs font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] text-right space-y-0.5 leading-tight">
                        <div className="font-bold text-white text-xs">{study.institutionName}</div>
                        <div className="text-slate-300 text-[11px]">{study.studyDate} {study.studyTime}</div>
                        <div className="text-slate-400 text-[10px]">Acc: {study.accessionNumber}</div>
                        <div className="text-sky-300 font-semibold text-[11px]">
                          {vIndex === 0
                            ? `Axial ${planeReformat}`
                            : vIndex === 1
                            ? 'Sagittal T2'
                            : vIndex === 2
                            ? 'Coronal MPR'
                            : '3D Volume MIP'}
                        </div>
                        <div className="text-[10px] text-amber-300/90 font-mono">
                          [{projectionMode === 'AVERAGE' ? 'Avg Ray' : projectionMode === 'MINIMUM' ? 'MinIP' : 'MIP'}]
                          {swivelAngle > 0 && ` 3D Swivel: ${swivelAngle}°`}
                        </div>
                      </div>

                      {/* BOTTOM LEFT: Slice location, Image Matrix & Acquisition (Yellow as in photo) */}
                      <div className="absolute bottom-3 left-3 z-20 pointer-events-none text-xs font-mono text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] space-y-0.5 leading-tight">
                        <div className="font-bold text-amber-300">
                          Images: {displaySliceIndex + 1} / {totalSlices}
                        </div>
                        <div className="text-amber-200/90 text-[11px]">
                          Loc: {vSlice.sliceLocation.toFixed(1)} mm
                        </div>
                        <div className="text-amber-200/80 text-[10px]">
                          Thick: {vSlice.thickness > 0 ? `${vSlice.thickness.toFixed(2)} mm` : '1.00 mm'}
                        </div>
                        <div className="text-amber-200/80 text-[10px]">
                          Zoom: {(toolState.zoom * 100).toFixed(0)}%
                        </div>
                      </div>

                      {/* BOTTOM RIGHT: Window Level, Width & Zoom (Yellow as in photo) */}
                      <div className="absolute bottom-3 right-3 z-20 pointer-events-none text-xs font-mono text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] text-right space-y-0.5 leading-tight">
                        <div className="font-bold text-amber-300">
                          WL: {Math.round(toolState.windowLevel)} WW: {Math.round(toolState.windowWidth)}
                        </div>
                        <div className="text-amber-200/90 text-[11px]">
                          Preset: {toolState.selectedPreset}
                          {isDualWindowing && ' [DUAL]'}
                        </div>
                        <div className="text-slate-400 text-[10px]">Matrix: 512 x 512</div>
                      </div>
                    </>
                  )}

                  {/* Dual Windowing Banner when active */}
                  {isDualWindowing && (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-sky-950/85 border border-sky-500/60 px-2.5 py-0.5 rounded text-[10px] font-mono text-sky-200 whitespace-nowrap shadow-md">
                      DUAL: Bone (WW 2000/WL 350) + Soft (WW 350/WL 50)
                    </div>
                  )}

                  {/* Relate Crosshair Sync Overlay */}
                  {relateEnabled && (
                    <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
                      <div className="w-full h-px border-t border-dashed border-sky-400/50"></div>
                      <div className="h-full w-px border-l border-dashed border-sky-400/50 absolute"></div>
                      <div className="w-6 h-6 border border-sky-400/70 rounded-full absolute"></div>
                    </div>
                  )}

                  {/* Render Medical Scan Image */}
                  <div
                    style={{
                      transform: `translate(${toolState.panX}px, ${toolState.panY}px) scale(${
                        layoutMode === '2x2' ? toolState.zoom * 0.75 : toolState.zoom
                      }) rotate(${toolState.rotation}deg) scaleX(${toolState.flipH ? -1 : 1}) ${
                        swivelAngle !== 0 ? `perspective(700px) rotateY(${swivelAngle}deg) rotateX(${swivelAngle / 2}deg)` : ''
                      }`,
                      filter: filterStyle,
                      transition: isDraggingRef.current ? 'none' : 'transform 0.05s ease-out',
                    }}
                    className="w-[420px] h-[420px] relative pointer-events-none"
                  >
                    <MedicalScanRenderer
                      imageType={vSlice.svgRendererType}
                      sliceIndex={displaySliceIndex}
                      totalSlices={totalSlices}
                      study={study}
                      filterId={`${filterUniqueId}-${vIndex}`}
                    />

                    {/* Measurement overlay lines (on active viewport) */}
                    {isActive && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {toolState.measurements.map((m) => (
                          <g key={m.id}>
                            <line
                              x1={m.points[0].x}
                              y1={m.points[0].y}
                              x2={m.points[1].x}
                              y2={m.points[1].y}
                              stroke="#38bdf8"
                              strokeWidth="2"
                              strokeDasharray="4 2"
                            />
                            <circle
                              cx={m.points[0].x}
                              cy={m.points[0].y}
                              r="4"
                              fill="#0284c7"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            />
                            <circle
                              cx={m.points[1].x}
                              cy={m.points[1].y}
                              r="4"
                              fill="#0284c7"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            />
                            <text
                              x={(m.points[0].x + m.points[1].x) / 2 + 6}
                              y={(m.points[0].y + m.points[1].y) / 2 - 6}
                              fill="#38bdf8"
                              fontSize="12"
                              fontFamily="monospace"
                              fontWeight="bold"
                              filter="drop-shadow(0 1px 2px black)"
                            >
                              {m.valueLabel}
                            </text>
                          </g>
                        ))}

                        {/* In-progress measurement line */}
                        {isMeasuring && currentMeasurePoints.length === 1 && (
                          <circle
                            cx={currentMeasurePoints[0].x}
                            cy={currentMeasurePoints[0].y}
                            r="5"
                            fill="#f59e0b"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                        )}
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Cine loop player controls (bottom center) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#21262f]/95 border border-[#38404d] backdrop-blur px-3 py-1.5 rounded-xl text-xs shadow-2xl">
            <button
              id="cine-btn-prev"
              onClick={() =>
                setToolState((prev) => ({
                  ...prev,
                  currentSliceIndex: Math.max(0, prev.currentSliceIndex - 1),
                }))
              }
              className="p-1 hover:bg-[#2e3540] text-slate-300 rounded cursor-pointer"
              title="Slice Sebelumnya (Panah Kiri)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              id="cine-btn-play"
              onClick={() => setToolState((p) => ({ ...p, isPlayingCine: !p.isPlayingCine }))}
              className={`p-1.5 rounded-lg font-medium flex items-center gap-1 cursor-pointer ${
                toolState.isPlayingCine
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-sky-600 text-white hover:bg-sky-500'
              }`}
              title="Cine Autoplay / Loop (Spasi)"
            >
              {toolState.isPlayingCine ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{toolState.isPlayingCine ? 'Pause' : 'Cine'}</span>
            </button>

            <button
              id="cine-btn-next"
              onClick={() =>
                setToolState((prev) => ({
                  ...prev,
                  currentSliceIndex: Math.min(totalSlices - 1, prev.currentSliceIndex + 1),
                }))
              }
              className="p-1 hover:bg-[#2e3540] text-slate-300 rounded cursor-pointer"
              title="Slice Selanjutnya (Panah Kanan)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Slice range slider */}
            <div className="flex items-center gap-2 px-2 border-l border-r border-[#38404d]">
              <span className="text-[11px] font-mono text-sky-400 w-12 text-right">
                {toolState.currentSliceIndex + 1} / {totalSlices}
              </span>
              <input
                id="slice-slider"
                type="range"
                min={0}
                max={totalSlices - 1}
                value={toolState.currentSliceIndex}
                onChange={(e) =>
                  setToolState((prev) => ({ ...prev, currentSliceIndex: Number(e.target.value) }))
                }
                className="w-32 sm:w-44 h-1.5 bg-[#181b22] accent-sky-500 rounded-lg cursor-pointer"
              />
            </div>

            {/* Frame rate speed toggle */}
            <div className="flex items-center gap-1">
              {[5, 10, 20].map((fps) => (
                <button
                  key={fps}
                  onClick={() => setToolState((p) => ({ ...p, cineSpeed: fps }))}
                  className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                    toolState.cineSpeed === fps
                      ? 'bg-sky-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fps}fps
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Series Thumbnails Panel (Exactly matching the reference PACS photo) */}
        <div className="w-56 bg-[#21262f] border-l border-[#38404d] flex flex-col shrink-0 overflow-hidden">
          {/* Solid Blue Series Header as in photo */}
          <div className="bg-[#0084d1] text-white font-bold px-3.5 py-2.5 flex items-center justify-between text-xs tracking-wide shadow-xs">
            <span className="text-sm font-semibold">Series</span>
            <Layers className="w-4 h-4" />
          </div>

          <div className="p-2 space-y-2.5 overflow-y-auto flex-1">
            {study.series.map((ser, sIdx) => {
              const isSelected = sIdx === selectedSeriesIdx;
              return (
                <div
                  key={ser.seriesInstanceUid}
                  id={`series-thumb-${sIdx}`}
                  onClick={() => {
                    setSelectedSeriesIdx(sIdx);
                    setToolState((prev) => ({
                      ...prev,
                      currentSliceIndex: Math.floor(ser.slices.length / 2),
                    }));
                  }}
                  className={`p-2 rounded-lg border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#18293d] border-sky-500 shadow-md ring-1 ring-sky-500/60'
                      : 'bg-[#181b22] border-[#38404d] hover:border-slate-500'
                  }`}
                >
                  {/* Miniature canvas preview */}
                  <div className="w-full h-24 bg-black rounded border border-[#2d3440] flex items-center justify-center relative overflow-hidden mb-1.5">
                    <MedicalSvgPreview
                      type={ser.slices[0]?.svgRendererType || 'thorax_ct'}
                      filterId={`thumb-${sIdx}`}
                    />
                    <span className="absolute bottom-1 right-1 bg-black/85 px-1.5 py-0.5 rounded text-[10px] font-mono text-sky-400 font-semibold border border-sky-900/50">
                      {ser.numberOfInstances} Image
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {ser.seriesDescription}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                    <span>Series #{ser.seriesNumber}</span>
                    <span className="text-sky-400 font-semibold">{ser.modality}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick study metadata drawer */}
          <div className="p-3 bg-[#1a1e26] border-t border-[#38404d] text-[10px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>SatuSehat FHIR:</span>
              <span className="text-sky-400 font-semibold">Tervalidasi R4</span>
            </div>
            <div className="flex justify-between">
              <span>Ukuran File:</span>
              <span className="text-slate-300 font-mono">{study.fileSizeMb} MB</span>
            </div>
            <div className="flex justify-between">
              <span>Transfer:</span>
              <span className="text-emerald-400 font-medium">Lossless J2K</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Ribbon Dropdown Menu Panel (when a menu in ribbon is active) */}
      {activeRibbonMenu && (
        <div className="absolute top-[82px] left-4 z-50 bg-[#161d2f] border border-[#2b3754] rounded-lg shadow-2xl p-3 w-80 text-xs text-slate-200 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-[#2b3754] pb-2 mb-2">
            <div className="font-semibold text-sky-300 flex items-center gap-1.5">
              <span>Menu: {activeRibbonMenu}</span>
            </div>
            <button
              onClick={() => setActiveRibbonMenu(null)}
              className="p-1 hover:bg-[#232d44] text-slate-400 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeRibbonMenu === 'Image' && (
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setToolState((p) => ({ ...p, inverted: !p.inverted }));
                  triggerToast('LUT Inverted (Monochrome1 / Monochrome2)');
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#212b42] cursor-pointer"
              >
                <span>Invert LUT Grayscale</span>
                <span className="font-mono text-[10px] text-slate-400">{toolState.inverted ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => {
                  setToolState((p) => ({ ...p, flipH: !p.flipH }));
                  triggerToast('Flip Horizontal diaktifkan');
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#212b42] cursor-pointer"
              >
                <span>Flip Horizontal</span>
                <span className="font-mono text-[10px] text-slate-400">{toolState.flipH ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => {
                  setToolState((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }));
                  triggerToast('Rotasi 90° Clockwise');
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#212b42] cursor-pointer"
              >
                <span>Rotate 90° Clockwise</span>
                <span className="font-mono text-[10px] text-slate-400">{toolState.rotation}°</span>
              </button>
              <button
                onClick={() => {
                  resetViewer();
                  setActiveRibbonMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-rose-950/40 text-rose-300 cursor-pointer"
              >
                <span>Reset Transform & Window</span>
                <span className="font-mono text-[10px]">R</span>
              </button>
            </div>
          )}

          {activeRibbonMenu === 'Graphics' && (
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setToolState((p) => ({ ...p, activeTool: 'measure' }));
                  setCurrentMeasurePoints([]);
                  triggerToast('Caliper Linier diaktifkan. Klik 2 titik pada gambar.');
                  setActiveRibbonMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#212b42] cursor-pointer"
              >
                <span>Linear Distance Caliper (mm)</span>
                <span className="font-mono text-[10px] text-sky-400">M</span>
              </button>
              <button
                onClick={() => {
                  triggerToast('Cobb Angle Caliper siap digunakan');
                  setActiveRibbonMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#212b42] cursor-pointer"
              >
                <span>Cobb Angle Tool</span>
                <span className="font-mono text-[10px] text-slate-400">Deg</span>
              </button>
              <button
                onClick={() => {
                  setToolState((p) => ({ ...p, measurements: [] }));
                  triggerToast('Semua anotasi grafis dibersihkan');
                  setActiveRibbonMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-rose-950/40 text-rose-300 cursor-pointer"
              >
                <span>Hapus Semua Anotasi & ROI</span>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeRibbonMenu === 'Cardiac Analysis' && (
            <div className="space-y-2">
              <div className="p-2 bg-[#0e1322] rounded border border-[#2b3754]">
                <div className="text-[11px] font-semibold text-sky-300 mb-1">Left Ventricular Quant (LVEF)</div>
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                  <div className="text-slate-400">EDV: <span className="text-white">124 mL</span></div>
                  <div className="text-slate-400">ESV: <span className="text-white">52 mL</span></div>
                  <div className="text-slate-400">SV: <span className="text-white">72 mL</span></div>
                  <div className="text-emerald-400 font-bold">LVEF: 58.1%</div>
                </div>
              </div>
              <div className="p-2 bg-[#0e1322] rounded border border-[#2b3754]">
                <div className="text-[11px] font-semibold text-amber-300 mb-1">Calcium Scoring (Agatston)</div>
                <div className="text-[10px] font-mono text-slate-300">
                  Total Score: <span className="text-amber-400 font-bold">14.2</span> (Minimal Plaque)
                </div>
              </div>
            </div>
          )}

          {activeRibbonMenu === 'Lesions' && (
            <div className="space-y-2">
              <div className="p-2 bg-[#0e1322] rounded border border-[#2b3754]">
                <div className="text-[11px] font-semibold text-rose-300 mb-1">Target Lesion 1 (RECIST 1.1)</div>
                <div className="text-[10px] font-mono space-y-0.5">
                  <div className="text-slate-400">Lokasi: <span className="text-slate-200">Right Upper Lobe</span></div>
                  <div className="text-slate-400">Long Axis: <span className="text-rose-400 font-bold">34.2 mm</span></div>
                  <div className="text-slate-400">Short Axis: <span className="text-slate-200">22.8 mm</span></div>
                  <div className="text-slate-400">HU Mean: <span className="text-sky-300">+42.5 HU</span> (Soft Mass)</div>
                </div>
              </div>
              <button
                onClick={() => {
                  triggerToast('Lesi target ditambahkan ke laporan ekspertise radiologi');
                  setActiveRibbonMenu(null);
                }}
                className="w-full py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-center text-xs font-semibold cursor-pointer"
              >
                Simpan ke Temuan Ekspertise
              </button>
            </div>
          )}

          {activeRibbonMenu === 'Export' && (
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  triggerToast('Mengekspor berkas DICOM Part 10 (.dcm)');
                  setActiveRibbonMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#212b42] cursor-pointer"
              >
                <span>Export Berkas DICOM (.dcm)</span>
                <span className="font-mono text-[10px] text-sky-400">DCM</span>
              </button>
              <button
                onClick={() => {
                  triggerToast('Gambar kunci (Key Image) disimpan sebagai PNG');
                  setActiveRibbonMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#212b42] cursor-pointer"
              >
                <span>Capture Key Image (PNG)</span>
                <span className="font-mono text-[10px] text-slate-400">PNG</span>
              </button>
              <button
                onClick={() => {
                  triggerToast('Studi sinkron ke endpoint SATUSEHAT Kemenkes');
                  setActiveRibbonMenu(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#212b42] text-sky-300 cursor-pointer"
              >
                <span>Sinkronisasi ke SATUSEHAT PACS</span>
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. Slide-Over Hamburger Menu Drawer (PACS System & Study Details) */}
      {isMenuDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            onClick={() => setIsMenuDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />
          <div className="relative w-80 max-w-[85vw] bg-[#121724] border-r border-[#242d45] text-slate-200 p-4 flex flex-col justify-between shadow-2xl z-10">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#242d45]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#0081c9] text-white flex items-center justify-center">
                    <Hand className="w-4 h-4 fill-white text-[#0081c9]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">Vue PACS Web Client</h3>
                    <p className="text-[10px] text-slate-400 font-mono">SATUSEHAT Integrated</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuDrawerOpen(false)}
                  className="p-1 hover:bg-[#1f283d] rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Study Demographics */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="p-3 bg-[#0d111c] rounded-lg border border-[#242d45] space-y-1">
                  <div className="text-[10px] uppercase text-sky-400 font-bold tracking-wider">Pasien Aktif</div>
                  <div className="font-bold text-white text-sm">{study.patientName}</div>
                  <div className="text-slate-400 text-[11px] font-mono">MRN: {study.patientId}</div>
                  <div className="text-slate-400 text-[11px] font-mono">NIK: {study.nik}</div>
                  <div className="text-slate-400 text-[11px]">IHS Pasien: {study.satusehatPatientIhs}</div>
                </div>

                <div className="p-3 bg-[#0d111c] rounded-lg border border-[#242d45] space-y-1">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Info Pemeriksaan</div>
                  <div className="text-slate-200 font-semibold">{study.studyDescription}</div>
                  <div className="text-slate-400 text-[11px]">Modalitas: <span className="text-sky-400 font-bold">{study.modality}</span></div>
                  <div className="text-slate-400 text-[11px]">Tanggal: {study.studyDate} {study.studyTime}</div>
                  <div className="text-slate-400 text-[11px] font-mono">Accession: {study.accessionNumber}</div>
                </div>

                {/* Keyboard shortcuts helper */}
                <div className="p-3 bg-[#0d111c] rounded-lg border border-[#242d45] space-y-1.5">
                  <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Pintasan Keyboard</div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                    <div><kbd className="px-1 py-0.5 bg-[#1f283d] rounded text-sky-300 font-mono text-[10px]">W</kbd> Window/Level</div>
                    <div><kbd className="px-1 py-0.5 bg-[#1f283d] rounded text-sky-300 font-mono text-[10px]">P</kbd> Pan</div>
                    <div><kbd className="px-1 py-0.5 bg-[#1f283d] rounded text-sky-300 font-mono text-[10px]">Z</kbd> Zoom</div>
                    <div><kbd className="px-1 py-0.5 bg-[#1f283d] rounded text-sky-300 font-mono text-[10px]">M</kbd> Caliper</div>
                    <div><kbd className="px-1 py-0.5 bg-[#1f283d] rounded text-sky-300 font-mono text-[10px]">R</kbd> Reset</div>
                    <div><kbd className="px-1 py-0.5 bg-[#1f283d] rounded text-sky-300 font-mono text-[10px]">Spasi</kbd> Cine Play</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#242d45] text-[10px] text-slate-500 font-mono">
              Monitor Calibration: DICOM GSDF Part 14 OK
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// SVG Preview for series thumbnail
const MedicalSvgPreview: React.FC<{ type: string; filterId: string }> = ({ type, filterId }) => {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {type.includes('thorax') && (
        <g fill="none" stroke="#64748b" strokeWidth="1.5">
          <ellipse cx="50" cy="50" rx="42" ry="36" />
          <path d="M 28 35 Q 24 60 38 65 Q 45 60 45 42 Q 45 35 28 35 Z" fill="#1e293b" />
          <path d="M 72 35 Q 76 60 62 65 Q 55 60 55 42 Q 55 35 72 35 Z" fill="#1e293b" />
          <circle cx="50" cy="74" r="5" fill="#94a3b8" />
        </g>
      )}
      {type.includes('brain') && (
        <g fill="none" stroke="#64748b" strokeWidth="1.5">
          <ellipse cx="50" cy="50" rx="38" ry="42" />
          <ellipse cx="50" cy="50" rx="30" ry="34" fill="#1e293b" />
          <path d="M 40 45 Q 50 38 60 45" stroke="#94a3b8" strokeWidth="1" />
        </g>
      )}
      {type.includes('ortho') && (
        <g fill="none" stroke="#94a3b8" strokeWidth="2">
          <path d="M 30 30 Q 50 45 70 30" />
          <path d="M 40 50 L 40 85" strokeWidth="3" />
          <path d="M 60 50 L 60 85" strokeWidth="3" />
        </g>
      )}
      {type.includes('c_arm') && (
        <g fill="none" stroke="#94a3b8" strokeWidth="2">
          <rect x="35" y="20" width="30" height="60" rx="4" stroke="#0d9488" strokeWidth="1.5" />
          <circle cx="50" cy="35" r="3" fill="#14b8a6" />
          <circle cx="50" cy="50" r="3" fill="#14b8a6" />
          <circle cx="50" cy="65" r="3" fill="#14b8a6" />
        </g>
      )}
    </svg>
  );
};

// High-Fidelity Medical Scan Renderer for Thorax CT, Brain MRI, Ortho X-Ray, C-Arm Fluoro
interface MedicalScanRendererProps {
  imageType: string;
  sliceIndex: number;
  totalSlices: number;
  study: DicomStudy;
  filterId: string;
}

const MedicalScanRenderer: React.FC<MedicalScanRendererProps> = ({
  imageType,
  sliceIndex,
  totalSlices,
  study,
  filterId,
}) => {
  // Slice ratio between 0 and 1 for anatomical transitions
  const ratio = totalSlices > 1 ? sliceIndex / (totalSlices - 1) : 0.5;

  if (imageType.includes('brain')) {
    // Brain MRI (Axial T1+C) with Tumor lesion in Right Parietal lobe
    const tumorRadius = 24 + Math.sin(ratio * Math.PI) * 14;
    const edemaRadius = tumorRadius + 18;
    const ventricleWidth = 14 + Math.sin(ratio * Math.PI) * 12;

    return (
      <svg viewBox="0 0 500 500" className="w-full h-full select-none">
        <defs>
          <radialGradient id={`brain-bg-${filterId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#242c38" />
            <stop offset="60%" stopColor="#181f2a" />
            <stop offset="90%" stopColor="#0a0d12" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <radialGradient id={`tumor-grad-${filterId}`} cx="45%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="40%" stopColor="#334155" />
            <stop offset="70%" stopColor="#f8fafc" />
            <stop offset="90%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
          <radialGradient id={`edema-grad-${filterId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#0f172a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Scalp & Calvarium Skull */}
        <ellipse cx="250" cy="250" rx="190" ry="215" fill="#000000" stroke="#f1f5f9" strokeWidth="8" />
        {/* Diploe bone layer */}
        <ellipse cx="250" cy="250" rx="183" ry="208" fill="#0f172a" stroke="#475569" strokeWidth="3" />

        {/* Brain Parenchyma */}
        <ellipse cx="250" cy="250" rx="176" ry="200" fill={`url(#brain-bg-${filterId})`} />

        {/* Brain Sulci & Gyri (Cerebral Cortex folds) */}
        <g stroke="#334155" strokeWidth="1.5" fill="none" opacity="0.65">
          <path d="M 120 180 Q 160 210 140 250 Q 160 300 130 330" />
          <path d="M 380 180 Q 340 210 360 250 Q 340 300 370 330" />
          <path d="M 210 110 Q 230 150 200 190" />
          <path d="M 290 110 Q 270 150 300 190" />
          <path d="M 190 380 Q 220 340 200 300" />
          <path d="M 310 380 Q 280 340 300 300" />
        </g>

        {/* Interhemispheric Fissure (Midline with Falx Cerebri) */}
        {/* Showing 7mm Midline shift to the Left side caused by mass effect */}
        <path
          d="M 250 55 Q 250 160 238 250 Q 242 340 250 445"
          stroke="#0d9488"
          strokeWidth="2.5"
          strokeDasharray="6 3"
          fill="none"
          opacity="0.8"
        />

        {/* Lateral Ventricles (Frontal Horns & Occipital Horns) */}
        <g fill="#05080c" stroke="#475569" strokeWidth="1">
          {/* Left Ventricle (compressed slightly) */}
          <path
            d={`M 235 210 C 220 230, 220 260, 235 285 C 242 270, 242 225, 235 210 Z`}
          />
          {/* Right Ventricle (pushed by tumor mass) */}
          <path
            d={`M 265 215 C 278 230, 276 260, 263 285 C 258 270, 258 225, 265 215 Z`}
          />
        </g>

        {/* Glioblastoma Pathology in Right Parieto-Occipital Lobe */}
        {ratio > 0.25 && ratio < 0.85 && (
          <g transform="translate(310, 220)">
            {/* Peritumoral Vasogenic Edema Zone */}
            <circle cx="0" cy="0" r={edemaRadius} fill={`url(#edema-grad-${filterId})`} />

            {/* Irregular Ring-Enhancing Tumor Core */}
            <circle
              cx="0"
              cy="0"
              r={tumorRadius}
              fill={`url(#tumor-grad-${filterId})`}
              stroke="#f87171"
              strokeWidth="2.5"
            />
            {/* Central Necrosis */}
            <circle cx="2" cy="-2" r={tumorRadius * 0.45} fill="#05080f" />

            {/* Surgical Navigation Crosshair Marker */}
            <g opacity="0.9">
              <line x1="-30" y1="0" x2="30" y2="0" stroke="#00f5d4" strokeWidth="1.5" strokeDasharray="3 2" />
              <line x1="0" y1="-30" x2="0" y2="30" stroke="#00f5d4" strokeWidth="1.5" strokeDasharray="3 2" />
              <circle cx="0" cy="0" r="4" fill="none" stroke="#00f5d4" strokeWidth="2" />
              <text x="32" y="5" fill="#00f5d4" fontSize="10" fontFamily="monospace">TARGET: 41mm</text>
            </g>
          </g>
        )}
      </svg>
    );
  }

  if (imageType.includes('ortho') || imageType.includes('pelvis')) {
    // Orthopedic Pelvis X-Ray / Hip Fracture
    return (
      <svg viewBox="0 0 500 500" className="w-full h-full select-none">
        {/* Background density */}
        <rect width="500" height="500" fill="#020617" />

        {/* Pelvic Sacrum & Iliac Blades */}
        <path
          d="M 100 130 C 130 90, 220 80, 250 110 C 280 80, 370 90, 400 130 C 430 180, 420 270, 380 290 C 350 250, 330 220, 290 230 C 270 240, 230 240, 210 230 C 170 220, 150 250, 120 290 C 80 270, 70 180, 100 130 Z"
          fill="#334155"
          stroke="#cbd5e1"
          strokeWidth="3.5"
        />

        {/* Sacroiliac Joints and Sacrum */}
        <polygon points="220,110 280,110 270,220 230,220" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
        {/* Obturator Foramen */}
        <ellipse cx="195" cy="275" rx="22" ry="18" fill="#020617" stroke="#94a3b8" strokeWidth="2" />
        <ellipse cx="305" cy="275" rx="22" ry="18" fill="#020617" stroke="#94a3b8" strokeWidth="2" />

        {/* Right Femur (Intact) */}
        <g stroke="#cbd5e1" strokeWidth="3" fill="#475569">
          <circle cx="135" cy="305" r="26" fill="#64748b" />
          <path d="M 125 325 L 85 360 L 80 480 L 120 480 L 115 370 Z" />
        </g>

        {/* Left Femur (FRACTURED COLLUM FEMORIS with Displaced Fragment) */}
        <g>
          {/* Acetabular Cup Left */}
          <path d="M 345 285 C 375 285, 385 315, 370 335" stroke="#cbd5e1" strokeWidth="4" fill="none" />
          {/* Femoral Head (Capital Fragment in Acetabulum) */}
          <circle cx="365" cy="305" r="25" fill="#64748b" stroke="#f1f5f9" strokeWidth="3" />

          {/* Fracture Line Indicator */}
          <path
            d="M 375 320 L 395 345"
            stroke="#ef4444"
            strokeWidth="4"
            strokeDasharray="5 3"
          />

          {/* Shaft Fragment displaced cranially & laterally (Garden IV) */}
          <path
            d="M 405 345 L 435 365 L 420 480 L 380 480 L 390 375 Z"
            fill="#475569"
            stroke="#cbd5e1"
            strokeWidth="3.5"
          />

          {/* Fracture annotation */}
          <g>
            <text x="350" y="375" fill="#ef4444" fontSize="12" fontFamily="monospace" fontWeight="bold">
              FRAKTUR DISPLACED
            </text>
            <line x1="390" y1="365" x2="360" y2="340" stroke="#ef4444" strokeWidth="1.5" />
          </g>
        </g>
      </svg>
    );
  }

  if (imageType.includes('c_arm')) {
    // Fluoroscopy Intra-Operative C-Arm with ORIF Plate and Screws
    return (
      <svg viewBox="0 0 500 500" className="w-full h-full select-none">
        {/* C-Arm Circular Fluoro Mask */}
        <defs>
          <radialGradient id={`carm-grad-${filterId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="70%" stopColor="#0f172a" />
            <stop offset="90%" stopColor="#020617" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
        </defs>

        <circle cx="250" cy="250" r="230" fill={`url(#carm-grad-${filterId})`} stroke="#0d9488" strokeWidth="3" />

        {/* Distal Femur Bone Cortex */}
        <path
          d="M 180 60 L 180 340 C 180 400, 200 440, 240 440 C 270 440, 310 400, 310 340 L 310 60 Z"
          fill="#334155"
          stroke="#94a3b8"
          strokeWidth="3"
        />

        {/* Knee Joint Space / Condyle */}
        <path d="M 190 440 Q 240 460 300 440" stroke="#64748b" strokeWidth="3" fill="none" />

        {/* Locking Compression Plate (LCP Titanium Plate) Radio-opaque */}
        <g stroke="#ffffff" strokeWidth="2" fill="#f8fafc">
          {/* Main Anatomical Plate Profile */}
          <path
            d="M 300 90 L 318 90 L 322 380 C 322 415, 305 430, 280 435 L 280 415 C 300 410, 305 395, 305 380 Z"
            fill="#f1f5f9"
            filter="drop-shadow(0 0 4px rgba(255,255,255,0.7))"
          />

          {/* Locking Screws traversing bi-cortically */}
          {[120, 170, 220, 270, 320, 370, 410].map((y, idx) => (
            <g key={idx}>
              <line
                x1={idx > 4 ? "240" : "185"}
                y1={y}
                x2="318"
                y2={y}
                stroke="#ffffff"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <circle cx="318" cy={y} r="4" fill="#0d9488" stroke="#ffffff" strokeWidth="1" />
            </g>
          ))}
        </g>

        {/* Alignment verification grid in OR */}
        <line x1="250" y1="20" x2="250" y2="480" stroke="#00f5d4" strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />
        <line x1="20" y1="250" x2="480" y2="250" stroke="#00f5d4" strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />

        <text x="50" y="70" fill="#00f5d4" fontSize="11" fontFamily="monospace" fontWeight="bold">
          INTRA-OP C-ARM RUN #{sliceIndex + 1}
        </text>
        <text x="50" y="86" fill="#94a3b8" fontSize="10" fontFamily="monospace">
          LCP 8-HOLE TITANIUM ORIF OK-04
        </text>
      </svg>
    );
  }

  // DEFAULT: High-Resolution Thorax CT (Axial Cross-Section with RUL Mass)
  const lungOpacity = 0.85;
  const noduleRadius = 14 + Math.sin(ratio * Math.PI) * 12;

  return (
    <svg viewBox="0 0 500 500" className="w-full h-full select-none">
      <defs>
        <radialGradient id={`ct-soft-tissue-${filterId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="70%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
      </defs>

      {/* Thoracic Wall & Soft Tissue Outer Boundary */}
      <ellipse
        cx="250"
        cy="245"
        rx="215"
        ry="175"
        fill={`url(#ct-soft-tissue-${filterId})`}
        stroke="#475569"
        strokeWidth="4"
      />

      {/* Ribs (Dense Bone Contrast - Bright White/Grey) */}
      <g stroke="#e2e8f0" strokeWidth="5" fill="none" opacity="0.9" strokeLinecap="round">
        {/* Anterior & Lateral Rib sections */}
        <path d="M 80 170 Q 75 220 90 280" />
        <path d="M 420 170 Q 425 220 410 280" />
        <ellipse cx="140" cy="115" rx="8" ry="5" fill="#e2e8f0" />
        <ellipse cx="360" cy="115" rx="8" ry="5" fill="#e2e8f0" />
        <ellipse cx="100" cy="190" rx="8" ry="5" fill="#e2e8f0" />
        <ellipse cx="400" cy="190" rx="8" ry="5" fill="#e2e8f0" />
        <ellipse cx="120" cy="330" rx="9" ry="5" fill="#e2e8f0" />
        <ellipse cx="380" cy="330" rx="9" ry="5" fill="#e2e8f0" />
        {/* Sternum (anterior) */}
        <path d="M 235 90 L 265 90" strokeWidth="7" />
      </g>

      {/* Thoracic Spine Vertebra & Spinal Canal (Posterior) */}
      <g stroke="#cbd5e1" strokeWidth="2">
        {/* Vertebral body */}
        <path
          d="M 225 350 C 220 335, 280 335, 275 350 C 280 375, 220 375, 225 350 Z"
          fill="#64748b"
        />
        {/* Spinal foramen / canal */}
        <circle cx="250" cy="370" r="10" fill="#020617" />
        {/* Spinous process */}
        <path d="M 250 380 L 250 410" strokeWidth="6" stroke="#94a3b8" />
        {/* Transverse processes */}
        <path d="M 220 365 L 185 385" strokeWidth="4" stroke="#94a3b8" />
        <path d="M 280 365 L 315 385" strokeWidth="4" stroke="#94a3b8" />
      </g>

      {/* Mediastinum & Heart Silhouette */}
      <path
        d="M 250 100 C 220 120, 200 170, 205 240 C 210 300, 240 330, 250 330 C 260 330, 290 300, 285 240 C 280 170, 270 120, 250 100 Z"
        fill="#1e293b"
        stroke="#475569"
        strokeWidth="2"
      />

      {/* Ascending & Descending Aorta */}
      <circle cx="235" cy="180" r="15" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
      <circle cx="270" cy="310" r="12" fill="#334155" stroke="#64748b" strokeWidth="1.5" />

      {/* Trachea / Carina Air Lumen */}
      <ellipse cx="250" cy="205" rx="8" ry="7" fill="#000000" stroke="#475569" strokeWidth="1" />

      {/* LEFT LUNG (Right on screen in radiologic orientation) */}
      <path
        d="M 285 130 C 350 130, 395 190, 385 270 C 375 330, 310 340, 275 320 C 285 270, 285 190, 285 130 Z"
        fill="#05080e"
        stroke="#334155"
        strokeWidth="1.5"
        opacity={lungOpacity}
      />
      {/* Left Bronchovascular Markings */}
      <g stroke="#334155" strokeWidth="1.2" fill="none" opacity="0.6">
        <path d="M 285 220 Q 320 225 360 210" />
        <path d="M 285 235 Q 330 250 355 285" />
        <path d="M 285 210 Q 315 180 340 160" />
      </g>

      {/* RIGHT LUNG (Left on screen) */}
      <path
        d="M 215 130 C 150 130, 105 190, 115 270 C 125 330, 190 340, 225 320 C 215 270, 215 190, 215 130 Z"
        fill="#05080e"
        stroke="#334155"
        strokeWidth="1.5"
        opacity={lungOpacity}
      />
      {/* Right Bronchovascular Markings */}
      <g stroke="#334155" strokeWidth="1.2" fill="none" opacity="0.6">
        <path d="M 215 220 Q 180 225 140 210" />
        <path d="M 215 235 Q 170 250 145 285" />
        <path d="M 215 210 Q 185 180 160 160" />
      </g>

      {/* SOLITARY PULMONARY MASS / LESION (Right Upper Lobe - Thorax Case study-001) */}
      {ratio > 0.15 && ratio < 0.85 && (
        <g transform="translate(165, 185)">
          {/* Spiculated Margins */}
          <path
            d={`M 0 -${noduleRadius + 6} L 4 -${noduleRadius} L ${noduleRadius + 6} 0 L ${noduleRadius} 4 L 0 ${noduleRadius + 6} L -4 ${noduleRadius} L -${noduleRadius + 6} 0 L -${noduleRadius} -4 Z`}
            fill="#64748b"
            opacity="0.8"
          />
          {/* Dense Solid Tumor Body */}
          <circle
            cx="0"
            cy="0"
            r={noduleRadius}
            fill="#e2e8f0"
            stroke="#f87171"
            strokeWidth="2"
          />
          {/* Lesion Measurement Target Anchor */}
          <circle cx="0" cy="0" r="3" fill="#ef4444" />
          <g>
            <line x1="0" y1="0" x2="-25" y2="-25" stroke="#ef4444" strokeWidth="1.5" />
            <text x="-85" y="-30" fill="#fca5a5" fontSize="10" fontFamily="monospace" fontWeight="bold">
              MASSA PARU: 3.4 cm
            </text>
          </g>
        </g>
      )}
    </svg>
  );
};
