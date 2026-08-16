"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Loader2, Sparkles, X, AlertCircle } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOcrSuccess: (ocrPayload: { ocrData: any; pdf_nombre: string; pdf_data?: string }) => void;
  apiKey: string;
}

export function UploadModal({ isOpen, onClose, onOcrSuccess, apiKey }: UploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleFiles, setSampleFiles] = useState<string[]>([]);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/sample-pdfs")
        .then((res) => res.json())
        .then((data) => {
          if (data.samples) setSampleFiles(data.samples);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUploadFile = async (fileToUpload: File) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", fileToUpload);
    if (apiKey) formData.append("apiKey", apiKey);

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Error procesando el albarán.");
      }

      onOcrSuccess({
        ocrData: data.ocrData,
        pdf_nombre: data.pdf_nombre,
        pdf_data: data.pdf_data,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al procesar el albarán mediante OCR.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSample = async (sampleName: string) => {
    setLoadingSample(sampleName);
    setError(null);

    try {
      const res = await fetch("/api/sample-pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: sampleName, apiKey }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Error al procesar albarán de prueba.");
      }

      onOcrSuccess({
        ocrData: data.ocrData,
        pdf_nombre: data.pdf_nombre,
        pdf_data: data.pdf_data,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Error procesando albarán de muestra.");
    } finally {
      setLoadingSample(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#ccd1da] rounded-2xl p-6 sm:p-8 max-w-lg w-full text-[#1e1e1e] shadow-2xl relative animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#666666] hover:text-[#1e1e1e] p-1.5 rounded-full hover:bg-[#f7fafc] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#0098f2]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1e1e1e] tracking-tight">Cargar Albarán de Recepción</h2>
            <p className="text-xs text-[#666666]">Extracción Inteligente por IA (Gemini OCR)</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-[rgba(255,99,99,0.08)] border border-[rgba(255,99,99,0.3)] rounded-xl flex items-center gap-2.5 text-[#ff6363] text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Zona de Drop/Upload */}
        <label className="border-2 border-dashed border-[#ccd1da] hover:border-[#0098f2] bg-[#f7fafc] hover:bg-white rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center group shadow-sm">
          <input
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleUploadFile(e.target.files[0]);
              }
            }}
          />
          {loading ? (
            <div className="flex flex-col items-center py-4">
              <Loader2 className="w-8 h-8 text-[#0098f2] animate-spin mb-3" />
              <span className="text-sm font-bold text-[#1e1e1e]">Analizando albarán con Gemini OCR...</span>
              <span className="text-xs text-[#666666] mt-1">Extrayendo fabricante, cliente y bobinas...</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-white border border-[#ccd1da] flex items-center justify-center text-[#0098f2] mb-3 group-hover:scale-110 transition-transform shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-[#1e1e1e] mb-1">Arrastra tu Albarán PDF o Imagen aquí</span>
              <span className="text-xs text-[#666666]">Soporta documentos PDF y fotos de albarán en alta resolución</span>
            </>
          )}
        </label>
      </div>
    </div>
  );
}

