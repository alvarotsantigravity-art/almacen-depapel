"use client";

import { useState } from "react";
import { Key, Check, ShieldAlert, X } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey: string;
  onSaveKey: (key: string) => void;
}

export function ApiKeyModal({ isOpen, onClose, currentKey, onSaveKey }: ApiKeyModalProps) {
  const [keyInput, setKeyInput] = useState(currentKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKey(keyInput.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#ccd1da] rounded-2xl p-6 sm:p-7 max-w-md w-full text-[#1e1e1e] shadow-2xl relative animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#666666] hover:text-[#1e1e1e] p-1.5 rounded-full hover:bg-[#f7fafc] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 text-[#1e1e1e]">
          <div className="w-10 h-10 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#0098f2]">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1e1e1e] tracking-tight">Clave API de Gemini</h2>
            <p className="text-xs text-[#666666]">OCR e Interpretación de Albaranes</p>
          </div>
        </div>

        <p className="text-[#666666] text-xs mb-4 leading-relaxed">
          Para que el escáner inteligente pueda interpretar automáticamente los albaranes PDF y fotos de proveedores, introduce tu clave API de Google Gemini.
        </p>

        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1.5">
            Gemini API Key:
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#1e1e1e] focus:outline-none shadow-xs"
          />
        </div>

        <div className="bg-[#f7fafc] rounded-xl p-3 mb-6 flex items-start gap-2.5 border border-[#ccd1da]">
          <ShieldAlert className="w-4 h-4 text-[#0098f2] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#666666]">
            Esta clave se guardará únicamente de forma local en tu navegador.
          </p>
        </div>

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="acctual-btn-ghost px-4 py-2 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="acctual-btn-primary px-5 py-2 text-xs font-semibold gap-1.5 shadow-sm"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-[#0098f2]" /> <span>Guardado</span>
              </>
            ) : (
              "Guardar Clave"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

