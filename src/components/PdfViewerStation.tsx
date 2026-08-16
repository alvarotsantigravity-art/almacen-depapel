"use client";

import { useState } from "react";
import {
  FileText,
  Maximize2,
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  Building2,
} from "lucide-react";

interface PdfViewerStationProps {
  activeAlbaranId: string | null;
  activeAlbaran?: {
    id: string;
    numero_albaran: string;
    pdf_nombre?: string | null;
    pdf_data?: string | null;
    bobinas?: {
      id: string;
      identificador_bobina: string;
      peso_kg?: number | null;
      estado: string;
    }[];
    cliente?: {
      nombre_empresa: string;
    };
    almacen?: string;
    calle?: string;
  } | null;
}

export function PdfViewerStation({
  activeAlbaranId,
  activeAlbaran,
}: PdfViewerStationProps) {
  const [isFullscreenDoc, setIsFullscreenDoc] = useState(false);

  const bobinas = activeAlbaran?.bobinas || [];
  const totalBobinas = bobinas.length;
  const verificadas = bobinas.filter((b) => b.estado === "VERIFICADA").length;
  const pendientes = totalBobinas - verificadas;
  const porcentaje = totalBobinas > 0 ? Math.round((verificadas / totalBobinas) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Tarjeta de Resumen de Verificación */}
      <div className="acctual-card p-5 bg-white border border-[#ccd1da]">
        <div className="flex items-center justify-between gap-3 border-b border-[#ccd1da]/60 pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[rgba(0,152,242,0.1)] text-[#0098f2] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1e1e1e]">Estado de Verificación OCR</h3>
              <p className="text-[11px] text-[#666666]">
                {activeAlbaran ? `Albarán N° ${activeAlbaran.numero_albaran}` : "Sin albarán seleccionado"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#f7fafc] rounded-full border border-[#ccd1da]">
            <span className="font-mono text-xs font-bold text-[#0098f2]">{porcentaje}%</span>
            <span className="text-[10px] text-[#666666] font-medium">Verificado</span>
          </div>
        </div>

        {/* Barra de Progreso */}
        <div className="w-full bg-[#f7fafc] border border-[#ccd1da]/80 rounded-full h-2 overflow-hidden mb-4">
          <div
            className="bg-[#0098f2] h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${porcentaje}%` }}
          />
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-2.5 bg-[#f7fafc] rounded-xl border border-[#ccd1da]/60">
            <div className="text-[10px] uppercase font-semibold text-[#666666]">Total</div>
            <div className="text-sm font-mono font-bold text-[#1e1e1e]">{totalBobinas}</div>
          </div>
          <div className="p-2.5 bg-[rgba(93,156,6,0.06)] rounded-xl border border-[rgba(93,156,6,0.2)]">
            <div className="text-[10px] uppercase font-semibold text-[#5d9c06] flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Verificadas
            </div>
            <div className="text-sm font-mono font-bold text-[#5d9c06]">{verificadas}</div>
          </div>
          <div className="p-2.5 bg-[rgba(255,168,0,0.08)] rounded-xl border border-[rgba(255,168,0,0.25)]">
            <div className="text-[10px] uppercase font-semibold text-[#d48b00] flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Pendientes
            </div>
            <div className="text-sm font-mono font-bold text-[#d48b00]">{pendientes}</div>
          </div>
        </div>
      </div>

      {/* Visor de Documento PDF */}
      <div className="acctual-card p-5 bg-white border border-[#ccd1da] flex flex-col min-h-[460px]">
        <div className="flex items-center justify-between gap-3 border-b border-[#ccd1da]/60 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[rgba(255,99,99,0.1)] text-[#ff6363] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1e1e1e]">Documento Digital del Albarán</h3>
              <p className="text-[11px] text-[#666666] truncate max-w-[200px]">
                {activeAlbaran?.pdf_nombre || "Archivo escaneado"}
              </p>
            </div>
          </div>

          {activeAlbaran?.pdf_data && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreenDoc(true)}
                className="acctual-btn-secondary px-3 py-1 text-xs font-semibold gap-1.5 shadow-sm"
                title="Ver a pantalla completa"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pantalla Completa</span>
              </button>
            </div>
          )}
        </div>

        {/* Contenedor del PDF */}
        <div className="flex-1 rounded-xl border border-[#ccd1da] bg-[#f7fafc] overflow-hidden flex items-center justify-center min-h-[350px]">
          {activeAlbaran?.pdf_data ? (
            activeAlbaran.pdf_data.includes("data:image/") ? (
              <img
                src={activeAlbaran.pdf_data}
                alt="Albarán"
                className="w-full h-full object-contain max-h-[500px]"
              />
            ) : (
              <iframe
                src={activeAlbaran.pdf_data}
                className="w-full h-full min-h-[450px] border-0"
                title="Visor de Albarán PDF"
              />
            )
          ) : (
            <div className="text-center p-8 text-[#8d8d8d]">
              <FileText className="w-12 h-12 text-[#ccd1da] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#1e1e1e]">No hay documento PDF asociado</p>
              <p className="text-xs text-[#666666] mt-1 max-w-xs mx-auto">
                Este albarán fue creado sin adjunto digital o importado sin vista previa.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Pantalla Completa para Documento */}
      {isFullscreenDoc && activeAlbaran?.pdf_data && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fade-in-up">
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/20">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-[#0098f2]" />
              <span className="font-bold text-base">
                {activeAlbaran.pdf_nombre || `Albaran_${activeAlbaran.numero_albaran}.pdf`}
              </span>
            </div>
            <button
              onClick={() => setIsFullscreenDoc(false)}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 mt-4 rounded-xl overflow-hidden bg-white">
            {activeAlbaran.pdf_data.includes("data:image/") ? (
              <img
                src={activeAlbaran.pdf_data}
                alt="Albarán Full"
                className="w-full h-full object-contain"
              />
            ) : (
              <iframe
                src={activeAlbaran.pdf_data}
                className="w-full h-full border-0"
                title="Visor Albarán Full"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
