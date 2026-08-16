"use client";

import { useState, useRef, useEffect } from "react";
import {
  QrCode,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Camera,
  Eye,
  Maximize2,
  X,
  FileText,
  ExternalLink,
} from "lucide-react";
import { playSuccessBeep, playErrorBeep } from "@/lib/audioService";
import { CameraScannerModal } from "@/components/CameraScannerModal";

interface ScannerStationProps {
  activeAlbaranId: string | null;
  activeAlbaran?: {
    id: string;
    numero_albaran: string;
    pdf_nombre?: string | null;
    pdf_data?: string | null;
  } | null;
  onBobinaAdded: () => void;
}

export function ScannerStation({
  activeAlbaranId,
  activeAlbaran,
  onBobinaAdded,
}: ScannerStationProps) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFullscreenDoc, setIsFullscreenDoc] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    identificador?: string;
    peso?: number | null;
    formato?: string;
    message?: string;
  } | null>(null);
  const [pendingManualEdit, setPendingManualEdit] = useState<{
    id: string;
    identificador: string;
    pesoInput: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus continuo en la caja de escaneo para la pistola láser de planta
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !isCameraOpen &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        inputRef.current?.focus();
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [isCameraOpen]);

  const processScanCode = async (rawCode: string) => {
    if (!rawCode || !activeAlbaranId) return;

    setBarcodeInput("");

    try {
      const res = await fetch("/api/bobinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albaran_id: activeAlbaranId,
          codigo_barras_raw: rawCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        playErrorBeep();
        setLastScanResult({
          success: false,
          message: data.error || "Error al procesar el código.",
        });
        return;
      }

      const bobina = data.bobina;
      const requiereManual = data.requiere_edicion_manual;

      if (requiereManual) {
        playErrorBeep();
        setLastScanResult({
          success: true,
          identificador: bobina.identificador_bobina,
          peso: null,
          formato: data.formato_detectado,
          message: "Formato desconocido. Introduce el peso manualmente.",
        });

        setPendingManualEdit({
          id: bobina.id,
          identificador: bobina.identificador_bobina,
          pesoInput: "",
        });
      } else {
        playSuccessBeep();
        setLastScanResult({
          success: true,
          identificador: bobina.identificador_bobina,
          peso: bobina.peso_kg,
          formato: data.formato_detectado,
          message: "Bobina verificada correctamente.",
        });
      }

      onBobinaAdded();
    } catch (err: any) {
      playErrorBeep();
      setLastScanResult({
        success: false,
        message: err.message || "Error de conexión con el lector.",
      });
    } finally {
      inputRef.current?.focus();
    }
  };

  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    processScanCode(barcodeInput.trim());
  };

  const handleSaveManualWeight = async () => {
    if (!pendingManualEdit || !pendingManualEdit.pesoInput) return;

    try {
      const res = await fetch("/api/bobinas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingManualEdit.id,
          peso_kg: parseFloat(pendingManualEdit.pesoInput),
          estado: "VERIFICADA",
        }),
      });

      if (res.ok) {
        playSuccessBeep();
        setPendingManualEdit(null);
        onBobinaAdded();
      } else {
        playErrorBeep();
      }
    } catch {
      playErrorBeep();
    }
  };

  return (
    <div className="acctual-card p-6 sm:p-7 flex flex-col flex-1 h-fit space-y-6 relative bg-white">
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#0098f2]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1e1e1e] tracking-tight">Estación de Verificación</h3>
              <p className="text-xs text-[#666666]">Pistola Láser & Escáner Óptico</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-[#f7fafc] text-[#666666] font-medium px-3 py-1.5 rounded-full border border-[#ccd1da]">
            <Volume2 className="w-3.5 h-3.5 text-[#0098f2]" /> Audio API
          </div>
        </div>

        {/* Botón Escáner por Cámara */}
        <div className="mb-4">
          <button
            onClick={() => setIsCameraOpen(true)}
            disabled={!activeAlbaranId}
            className="w-full py-2.5 acctual-btn-secondary text-xs sm:text-sm font-semibold tracking-tight gap-2 disabled:opacity-40 shadow-sm"
          >
            <Camera className="w-4 h-4 text-[#0098f2]" />
            <span>Escanear con Cámara de Tablet</span>
          </button>
        </div>

        {/* Formulario de Escaneo Láser */}
        <form onSubmit={handleScanSubmit} className="mb-6">
          <label className="block text-xs font-semibold text-[#666666] mb-2 uppercase tracking-wider">
            Disparar Pistola Láser:
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              disabled={!activeAlbaranId}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder={
                activeAlbaranId
                  ? "Apunta y dispara la pistola láser..."
                  : "Selecciona un albarán primero..."
              }
              className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-full pl-4 pr-28 py-2.5 text-[#1e1e1e] font-mono text-xs placeholder-[#8d8d8d] focus:outline-none focus:ring-2 focus:ring-[#0098f2]/20 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!activeAlbaranId || !barcodeInput.trim()}
              className="absolute right-1 top-1 bottom-1 px-4 bg-[#0d111b] hover:bg-[#1e2538] text-white font-semibold rounded-full transition-all disabled:opacity-30 flex items-center gap-1.5 text-xs cursor-pointer shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 text-[#0098f2]" />
              <span>Registrar</span>
            </button>
          </div>
        </form>

        {/* Vista Previa del Albarán Activo */}
        {activeAlbaran && (
          <div className="mb-6 bg-[#f7fafc] border border-[#ccd1da] rounded-2xl p-4 relative flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className="text-xs font-bold text-[#1e1e1e] uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#0098f2]" /> Albarán N° {activeAlbaran.numero_albaran}
              </span>
              {activeAlbaran.pdf_data && (
                <div className="flex items-center gap-2">
                  {activeAlbaran.pdf_data.startsWith("data:application/pdf") && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          const parts = activeAlbaran.pdf_data!.split(",");
                          const bytes = new Uint8Array(atob(parts[1]).split("").map((c) => c.charCodeAt(0)));
                          const blob = new Blob([bytes], { type: "application/pdf" });
                          const url = URL.createObjectURL(blob);
                          window.open(url, "_blank");
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="text-xs font-semibold text-[#0098f2] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" /> Abrir PDF
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsFullscreenDoc(true);
                    }}
                    className="text-xs font-semibold text-[#666666] hover:text-[#1e1e1e] flex items-center gap-1 transition cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" /> Ampliar
                  </button>
                </div>
              )}
            </div>

            <div className="h-[480px] sm:h-[540px] bg-white rounded-xl border border-[#ccd1da] overflow-hidden flex items-center justify-center relative shadow-inner">
              {/* Animación del Rayo Láser Escaneando la Extensión Completa del PDF */}
              <div className="paper-laser-scanner" />

              {activeAlbaran.pdf_data ? (
                activeAlbaran.pdf_data.startsWith("data:image/") ? (
                  <img
                    src={activeAlbaran.pdf_data}
                    alt="Albarán Activo"
                    className="object-contain w-full h-full cursor-pointer"
                    onClick={() => setIsFullscreenDoc(true)}
                  />
                ) : (
                  <object
                    data={activeAlbaran.pdf_data}
                    type="application/pdf"
                    className="w-full h-full border-0 pointer-events-auto"
                  >
                    <div className="flex flex-col items-center justify-center p-4 text-center text-[#666666]">
                      <FileText className="w-8 h-8 mb-1 text-[#0098f2]" />
                      <span className="text-xs font-bold text-[#1e1e1e]">{activeAlbaran.pdf_nombre || "Albarán PDF"}</span>
                      <span className="text-xs text-[#8d8d8d]">N° {activeAlbaran.numero_albaran}</span>
                    </div>
                  </object>
                )
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-[#8d8d8d]">
                  <FileText className="w-8 h-8 mb-1 text-[#afb0b1]" />
                  <span className="text-xs font-semibold">{activeAlbaran.pdf_nombre || "Documento registrado"}</span>
                  <span className="text-xs text-[#8d8d8d] mt-1">N° {activeAlbaran.numero_albaran}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feedback Visual del Último Escaneo */}
        {lastScanResult && (
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2.5 transition-all shadow-sm animate-fade-in ${
              lastScanResult.success
                ? lastScanResult.peso === null
                  ? "bg-[rgba(245,166,35,0.08)] border-[rgba(245,166,35,0.3)] text-[#c97a00]"
                  : "bg-[rgba(0,152,242,0.08)] border-[rgba(0,152,242,0.3)] text-[#0098f2]"
                : "bg-[rgba(255,99,99,0.08)] border-[rgba(255,99,99,0.3)] text-[#ff6363]"
            }`}
          >
            <div className="flex items-start gap-3">
              {lastScanResult.success ? (
                lastScanResult.peso === null ? (
                  <AlertTriangle className="w-5 h-5 text-[#c97a00] shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#0098f2] shrink-0 mt-0.5" />
                )
              ) : (
                <AlertTriangle className="w-5 h-5 text-[#ff6363] shrink-0 mt-0.5" />
              )}

              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-sm text-[#1e1e1e]">{lastScanResult.message}</span>
                  {lastScanResult.formato && (
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-white rounded-full border border-[#ccd1da] text-[#666666]">
                      {lastScanResult.formato}
                    </span>
                  )}
                </div>

                {lastScanResult.identificador && (
                  <div className="mt-1 font-mono text-xs opacity-90 flex flex-wrap items-center gap-2">
                    <span>ID: <strong className="text-[#1e1e1e]">{lastScanResult.identificador}</strong></span>
                    {lastScanResult.peso !== null && lastScanResult.peso !== undefined && (
                      <span className="font-semibold text-[#0098f2] bg-white px-2 py-0.5 rounded-full border border-[#ccd1da]">
                        Peso: {lastScanResult.peso} kg
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Ecualizador Visual / Respuesta Sonora */}
            <div className="flex items-center justify-between pt-2 border-t border-[#ccd1da]/40 text-xs">
              <span className="flex items-center gap-1.5 text-[#666666]">
                <span className={`w-2 h-2 rounded-full ${lastScanResult.success ? 'bg-[#0098f2]' : 'bg-[#ff6363]'}`} />
                Sonido (Audio API): {lastScanResult.success ? "1200Hz (Tono Agudo)" : "150Hz (Tono Grave)"}
              </span>
              <div className="flex items-end gap-1 h-3">
                <span className={`w-1 rounded-full ${lastScanResult.success ? 'bg-[#0098f2] h-3' : 'bg-[#ff6363] h-2'}`} />
                <span className={`w-1 rounded-full ${lastScanResult.success ? 'bg-[#0098f2] h-2' : 'bg-[#ff6363] h-3'}`} />
                <span className={`w-1 rounded-full ${lastScanResult.success ? 'bg-[#0098f2] h-3' : 'bg-[#ff6363] h-1'}`} />
                <span className={`w-1 rounded-full ${lastScanResult.success ? 'bg-[#0098f2] h-1.5' : 'bg-[#ff6363] h-2.5'}`} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edición Manual Si el Peso es Null */}
      {pendingManualEdit && (
        <div className="p-4 bg-[rgba(245,166,35,0.08)] border border-[rgba(245,166,35,0.3)] rounded-xl">
          <div className="flex items-center gap-2 text-[#c97a00] font-bold text-sm mb-1.5">
            <Zap className="w-4 h-4 text-[#c97a00]" /> Edición Manual de Peso (Requerido)
          </div>
          <p className="text-xs text-[#666666] mb-3">
            El código <span className="font-mono font-bold text-[#1e1e1e]">{pendingManualEdit.identificador}</span> no especifica el peso automáticamente. Introduce los kilogramos:
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.1"
                value={pendingManualEdit.pesoInput}
                onChange={(e) =>
                  setPendingManualEdit({
                    ...pendingManualEdit,
                    pesoInput: e.target.value,
                  })
                }
                placeholder="Ej: 485.5"
                className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-4 py-2 text-[#1e1e1e] font-mono text-sm focus:outline-none"
              />
              <span className="absolute right-3 top-2.5 text-xs text-[#8d8d8d]">kg</span>
            </div>

            <button
              onClick={handleSaveManualWeight}
              disabled={!pendingManualEdit.pesoInput}
              className="acctual-btn-primary px-5 py-2 text-xs font-semibold tracking-tight disabled:opacity-40 cursor-pointer shadow-sm"
            >
              Guardar Peso
            </button>
          </div>
        </div>
      )}

      {/* Modal de Cámara */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanCode={(code) => {
          setIsCameraOpen(false);
          processScanCode(code);
        }}
      />

      {/* Modal Ampliado de Documento Albarán */}
      {isFullscreenDoc && activeAlbaran?.pdf_data && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col p-4 sm:p-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-white">
              Vista Previa — Albarán N° {activeAlbaran.numero_albaran}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsFullscreenDoc(false);
              }}
              className="p-2 text-white bg-white/10 hover:bg-white/20 rounded-full cursor-pointer transition"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 w-full h-full rounded-2xl overflow-hidden bg-white border border-[#ccd1da]">
            {activeAlbaran.pdf_data.startsWith("data:image/") ? (
              <img src={activeAlbaran.pdf_data} alt="Full Doc" className="w-full h-full object-contain" />
            ) : (
              <iframe src={activeAlbaran.pdf_data} title="Full PDF" className="w-full h-full border-0" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

