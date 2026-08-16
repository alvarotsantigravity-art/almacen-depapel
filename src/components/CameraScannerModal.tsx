"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, Zap, ShieldAlert } from "lucide-react";

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanCode: (code: string) => void;
}

export function CameraScannerModal({ isOpen, onClose, onScanCode }: CameraScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (isOpen) {
      setErrorMsg(null);
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({
            video: { facingMode: "environment" },
          })
          .then((s) => {
            activeStream = s;
            setStream(s);
            if (videoRef.current) {
              videoRef.current.srcObject = s;
            }
          })
          .catch((err) => {
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
              setErrorMsg("Permiso de cámara denegado. Activa el permiso en el navegador o introduce el código con la pistola láser.");
            } else {
              setErrorMsg("No se detectó cámara disponible. Puedes introducir el código manualmente o usar la pistola láser.");
            }
          });
      } else {
        setErrorMsg("El navegador no soporta acceso a la cámara. Usa la pistola láser de planta.");
      }
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScanCode(manualCode.trim());
    setManualCode("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#ccd1da] rounded-2xl p-6 sm:p-7 max-w-lg w-full text-[#1e1e1e] shadow-2xl relative animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#666666] hover:text-[#1e1e1e] p-1.5 rounded-full hover:bg-[#f7fafc] transition z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#0098f2]">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1e1e1e] tracking-tight">Escáner con Cámara</h2>
            <p className="text-xs text-[#666666]">Lector óptico para tablets y smartphones</p>
          </div>
        </div>

        {errorMsg ? (
          <div className="p-3.5 bg-[rgba(245,166,35,0.08)] border border-[rgba(245,166,35,0.3)] rounded-xl flex items-start gap-2.5 text-[#c97a00] text-xs mb-4">
            <ShieldAlert className="w-4 h-4 text-[#c97a00] shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-[#ccd1da] bg-black aspect-video mb-4 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Mira de enfoque central */}
            <div className="absolute inset-x-12 inset-y-8 border-2 border-dashed border-[#0098f2] rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-[10px] uppercase font-semibold bg-white/90 text-[#1e1e1e] px-3 py-1 rounded-full border border-[#ccd1da] shadow-xs">
                Apunta al código de barras
              </span>
            </div>
          </div>
        )}

        {/* Formulario alternativo */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="O escribe el código aquí..."
            className="flex-1 bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3.5 py-2 text-xs font-mono text-[#1e1e1e] focus:outline-none shadow-xs"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="acctual-btn-primary px-5 py-2 text-xs font-semibold gap-1.5 shadow-sm disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5 text-[#0098f2]" />
            <span>Verificar</span>
          </button>
        </form>
      </div>
    </div>
  );
}

