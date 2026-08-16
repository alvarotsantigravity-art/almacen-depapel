"use client";

import { AlertTriangle, X, ShieldAlert, Layers } from "lucide-react";

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: { id: string; count: number }[];
  onProceedAnyway?: () => void;
}

export function DuplicateWarningModal({
  isOpen,
  onClose,
  duplicates,
  onProceedAnyway,
}: DuplicateWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-[#ccd1da] rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl relative animate-fade-in-up">
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(255,99,99,0.08)] border border-[rgba(255,99,99,0.3)] flex items-center justify-center text-[#ff6363]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-[#ff6363] font-semibold tracking-wider uppercase">
                Alerta de Duplicados
              </div>
              <h2 className="text-lg font-bold text-[#1e1e1e] tracking-tight">
                Bobinas Repetidas Detectadas
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#666666] hover:text-[#1e1e1e] hover:bg-[#f7fafc] rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explicación del Alerta */}
        <div className="p-3.5 bg-[rgba(255,99,99,0.06)] border border-[rgba(255,99,99,0.2)] rounded-xl text-xs text-[#666666] space-y-1.5">
          <p className="font-semibold text-[#ff6363] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff6363]" />
            Se ha pausado el envío a Google Drive para evitar registros repetidos.
          </p>
          <p>
            Los siguientes identificadores de bobina aparecen repetidos en el albarán activo:
          </p>
        </div>

        {/* Lista de Bobinas Duplicadas */}
        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
          {duplicates.map((dup, idx) => (
            <div
              key={idx}
              className="p-3 bg-[#f7fafc] border border-[#ccd1da] rounded-xl flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 text-[#1e1e1e] font-mono font-semibold">
                <Layers className="w-4 h-4 text-[#ff6363]" />
                <span>{dup.id}</span>
              </div>
              <span className="px-2.5 py-0.5 bg-[rgba(255,99,99,0.1)] text-[#ff6363] border border-[rgba(255,99,99,0.25)] text-[10px] font-bold rounded-full uppercase">
                {dup.count} coincidencias
              </span>
            </div>
          ))}
        </div>

        {/* Botones de Acción */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          {onProceedAnyway && (
            <button
              onClick={onProceedAnyway}
              className="w-full sm:w-auto acctual-btn-ghost px-4 py-2 text-xs font-semibold text-[#666666]"
            >
              Ignorar y Subir
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-[#0d111b] hover:bg-[#1e2538] text-white text-xs font-semibold rounded-full shadow-sm cursor-pointer transition"
          >
            Revisar y Corregir
          </button>
        </div>
      </div>
    </div>
  );
}

