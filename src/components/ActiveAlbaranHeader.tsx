"use client";

import { useState } from "react";
import {
  Building2,
  FileText,
  FileSpreadsheet,
  Factory,
  Layers,
  Maximize2,
  Scale,
  Trash2,
  ShieldCheck,
  CloudUpload,
  Loader2,
  CheckCircle2,
  Upload,
  MapPin,
} from "lucide-react";
import { exportToExcel } from "@/lib/exportService";
import { DuplicateWarningModal } from "@/components/DuplicateWarningModal";

interface ActiveAlbaranHeaderProps {
  albaran: {
    id: string;
    numero_albaran: string;
    fecha: string;
    fabricante: string;
    marca_papel: string;
    tipo_papel: string;
    ancho_papel_mm: number;
    gramaje_papel_gsm: number;
    almacen?: string;
    calle?: string;
    certificacion_tipo?: string | null;
    certificacion_codigo?: string | null;
    certificacion_porcentaje?: number | null;
    pdf_nombre?: string;
    cliente: {
      nombre_empresa: string;
    };
    bobinas: any[];
  } | null;
  onDeleteAlbaran: (id: string) => void;
  onOpenUploadModal?: () => void;
  onOpenDriveModal?: () => void;
  isDriveButtonLit?: boolean;
  onDriveUploaded?: () => void;
}

export function ActiveAlbaranHeader({
  albaran,
  onDeleteAlbaran,
  onOpenUploadModal,
  onOpenDriveModal,
  isDriveButtonLit = false,
  onDriveUploaded,
}: ActiveAlbaranHeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [duplicateList, setDuplicateList] = useState<{ id: string; count: number }[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  if (!albaran) {
    return (
      <div className="acctual-card p-8 sm:p-10 text-center shrink-0 border-dashed border-[#ccd1da] flex flex-col items-center justify-center space-y-4 bg-[#f7fafc]">
        <div className="w-14 h-14 rounded-full bg-white border border-[#ccd1da] flex items-center justify-center shadow-sm">
          <FileText className="w-7 h-7 text-[#0098f2]" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-[#1e1e1e] tracking-tight">
            No hay ningún albarán activo seleccionado
          </h3>
          <p className="text-xs sm:text-sm text-[#666666] max-w-md mx-auto">
            Carga un nuevo albarán en PDF para extraer las bobinas con IA o selecciona uno registrado.
          </p>
        </div>
        <button
          onClick={onOpenUploadModal}
          className="acctual-btn-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-wider gap-2 shadow-sm"
        >
          <Upload className="w-4 h-4" />
          <span>Cargar Albarán PDF</span>
        </button>
      </div>
    );
  }

  const hasCert = albaran.certificacion_tipo && albaran.certificacion_tipo !== "SIN_CERTIFICACION";
  const almacenNombre = albaran.almacen || "ROTOMADRID";
  const calleNumero = albaran.calle !== undefined && albaran.calle !== null ? albaran.calle : "0";

  const isLitUp = Boolean(isDriveButtonLit && albaran && albaran.bobinas && albaran.bobinas.length > 0);

  const checkDuplicates = () => {
    if (!albaran || !albaran.bobinas) return [];
    const map: Record<string, number> = {};
    albaran.bobinas.forEach((b: any) => {
      const clean = (b.identificador_bobina || "").replace(/[-_ ]/g, "").toUpperCase();
      if (clean) map[clean] = (map[clean] || 0) + 1;
    });

    return Object.entries(map)
      .filter(([_, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
  };

  const handleUploadToDrive = async (forceProceed = false) => {
    if (!forceProceed) {
      const dups = checkDuplicates();
      if (dups.length > 0) {
        setDuplicateList(dups);
        setIsDuplicateModalOpen(true);
        return;
      }
    }

    setIsDuplicateModalOpen(false);
    const driveUrl = localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL");
    if (!driveUrl) {
      if (onOpenDriveModal) {
        onOpenDriveModal();
      } else {
        alert("Por favor, abre 'Conectar Drive' en la barra superior para configurar la conexión.");
      }
      return;
    }

    setSyncing(true);
    setSyncMsg(null);

    try {
      const res = await fetch("/api/google-drive-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: driveUrl,
          mode: "sync_single",
          albaranId: albaran.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Error al subir a Google Drive.");
      }

      if (onDriveUploaded) onDriveUploaded();
      setSyncMsg(data.message || `Albarán N° ${albaran.numero_albaran} guardado y sincronizado en Google Drive.`);
      setTimeout(() => setSyncMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Error al subir a Google Drive.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="acctual-card p-6 sm:p-7 relative shrink-0 space-y-6 bg-white">
      {syncMsg && (
        <div className="p-3.5 bg-[rgba(0,152,242,0.08)] border border-[rgba(0,152,242,0.25)] rounded-xl flex items-center gap-2.5 text-[#0098f2] text-xs font-semibold animate-fade-in-up">
          <CheckCircle2 className="w-4 h-4 text-[#0098f2] shrink-0" />
          <span>{syncMsg}</span>
        </div>
      )}

      {/* Cabecera Principal del Albarán */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ccd1da]/60 pb-5">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 text-[#666666] font-semibold uppercase text-[11px] tracking-wider mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[#6c56fc]" />
            CLIENTE / RECEPTOR
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1e1e1e] tracking-tight flex flex-wrap items-center gap-2.5">
            <span className="break-words">{albaran.cliente.nombre_empresa}</span>
            {hasCert && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[rgba(93,156,6,0.1)] text-[#5d9c06] border border-[rgba(93,156,6,0.25)] rounded-full text-xs font-bold shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                {albaran.certificacion_tipo}
                {albaran.certificacion_porcentaje ? ` (${albaran.certificacion_porcentaje}%)` : ""}
              </span>
            )}
          </h2>
          {hasCert && albaran.certificacion_codigo && (
            <div className="text-xs font-medium text-[#666666] mt-1">
              Licencia / Cod: <span className="font-mono text-[#1e1e1e] font-semibold">{albaran.certificacion_codigo}</span>
            </div>
          )}
        </div>

        {/* Acciones del Albarán */}
        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <button
            onClick={onOpenUploadModal}
            className="acctual-btn-primary px-4 py-2 text-xs font-semibold tracking-tight gap-1.5 shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nuevo Albarán PDF</span>
          </button>

          <button
            onClick={() => exportToExcel([albaran], `Albaran_${albaran.cliente.nombre_empresa}_${albaran.numero_albaran}.xlsx`)}
            title="Exportar Albarán y Bobinas a Excel (.xlsx)"
            className="acctual-btn-secondary px-3.5 py-2 text-xs font-semibold gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#5d9c06]" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => handleUploadToDrive(false)}
            disabled={syncing}
            title={
              isLitUp
                ? "¡Todas las bobinas verificadas! Clic para subir a Google Drive"
                : "Subir este albarán a Google Drive"
            }
            className={`px-3.5 py-2 text-xs font-semibold gap-1.5 rounded-xl transition cursor-pointer flex items-center shadow-sm disabled:opacity-40 ${
              isLitUp
                ? "bg-gradient-to-r from-[#0098f2] to-[#007ec9] text-white border border-transparent shadow-[0_0_18px_rgba(0,152,242,0.6)] ring-2 ring-[#0098f2]/60 animate-pulse hover:shadow-[0_0_24px_rgba(0,152,242,0.85)] hover:scale-[1.02]"
                : "acctual-btn-secondary"
            }`}
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0098f2]" />
            ) : (
              <CloudUpload className={`w-3.5 h-3.5 ${isLitUp ? "text-white animate-bounce" : "text-[#0098f2]"}`} />
            )}
            <span className={isLitUp ? "font-extrabold tracking-tight text-white" : ""}>
              {syncing ? "Subiendo..." : isLitUp ? "Subir a Drive ✨" : "Subir a Drive"}
            </span>
          </button>

          <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3.5 py-1.5 text-right">
            <div className="text-[10px] text-[#8d8d8d] font-semibold uppercase tracking-wider">N° ALBARÁN</div>
            <div className="text-sm font-mono font-bold text-[#1e1e1e]">{albaran.numero_albaran}</div>
          </div>

          <button
            onClick={() => {
              if (confirm(`¿Estás seguro de eliminar el albarán N° ${albaran.numero_albaran}? Se eliminará localmente y de Google Drive.`)) {
                onDeleteAlbaran(albaran.id);
              }
            }}
            title="Eliminar Albarán"
            className="p-2 text-[#ff6363] hover:bg-[rgba(255,99,99,0.1)] border border-transparent hover:border-[rgba(255,99,99,0.3)] rounded-xl transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grilla de Metadatos Estilo Acctual */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-3.5 transition-all">
          <div className="flex items-center gap-1.5 text-[#666666] text-xs font-semibold mb-1 uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-[#0098f2]" /> ALMACÉN
          </div>
          <div className="text-sm font-bold text-[#1e1e1e] truncate" title={almacenNombre}>
            {almacenNombre}
          </div>
        </div>

        <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-3.5 transition-all">
          <div className="flex items-center gap-1.5 text-[#666666] text-xs font-semibold mb-1 uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-[#0098f2]" /> CALLE
          </div>
          <div className="text-sm font-mono font-bold text-[#1e1e1e]">
            {calleNumero.toLowerCase().startsWith("calle") ? calleNumero : `Calle ${calleNumero}`}
          </div>
        </div>

        <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-3.5 transition-all">
          <div className="flex items-center gap-1.5 text-[#666666] text-xs font-semibold mb-1 uppercase tracking-wider">
            <Factory className="w-3.5 h-3.5 text-[#0098f2]" /> FABRICANTE
          </div>
          <div className="text-sm font-bold text-[#1e1e1e] truncate">{albaran.fabricante}</div>
        </div>

        <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-3.5 transition-all">
          <div className="flex items-center gap-1.5 text-[#666666] text-xs font-semibold mb-1 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-[#6c56fc]" /> MARCA / TIPO
          </div>
          <div className="text-sm font-bold text-[#1e1e1e] truncate">
            {albaran.marca_papel} <span className="text-xs font-normal text-[#666666]">({albaran.tipo_papel})</span>
          </div>
        </div>

        <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-3.5 transition-all">
          <div className="flex items-center gap-1.5 text-[#666666] text-xs font-semibold mb-1 uppercase tracking-wider">
            <Maximize2 className="w-3.5 h-3.5 text-[#0098f2]" /> ANCHO
          </div>
          <div className="text-sm font-mono font-bold text-[#1e1e1e]">
            {albaran.ancho_papel_mm} <span className="text-xs font-normal text-[#666666]">mm</span>
          </div>
        </div>

        <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-3.5 transition-all">
          <div className="flex items-center gap-1.5 text-[#666666] text-xs font-semibold mb-1 uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5 text-[#0098f2]" /> GRAMAJE
          </div>
          <div className="text-sm font-mono font-bold text-[#1e1e1e]">
            {albaran.gramaje_papel_gsm} <span className="text-xs font-normal text-[#666666]">gsm</span>
          </div>
        </div>
      </div>

      {/* Modal de Advertencia de Duplicados */}
      <DuplicateWarningModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        duplicates={duplicateList}
        onProceedAnyway={() => handleUploadToDrive(true)}
      />
    </div>
  );
}

