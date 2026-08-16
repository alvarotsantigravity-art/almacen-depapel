"use client";

import { useState, useRef, useEffect } from "react";
import {
  RefreshCw,
  Clock,
  Check,
  ChevronDown,
  PauseCircle,
  Zap,
  Cloud,
  AlertCircle,
} from "lucide-react";
import { AutoSyncState } from "@/hooks/useAutoSyncDrive";

interface AutoSyncControlProps {
  autoSync: AutoSyncState;
  hasDriveConfigured: boolean;
  onOpenDriveConfig: () => void;
}

const INTERVAL_OPTIONS = [
  { label: "30 segundos", seconds: 30 },
  { label: "1 minuto (Predeterminado)", seconds: 60 },
  { label: "2 minutos", seconds: 120 },
  { label: "5 minutos", seconds: 300 },
  { label: "Desactivado", seconds: 0 },
];

function formatTime(date: Date | null): string {
  if (!date) return "Pendiente";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function AutoSyncControl({
  autoSync,
  hasDriveConfigured,
  onOpenDriveConfig,
}: AutoSyncControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { intervalSeconds, isSyncing, lastSyncTime, error, syncNow, setIntervalSeconds } = autoSync;

  // Cerrar el desplegable al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentOption = INTERVAL_OPTIONS.find((o) => o.seconds === intervalSeconds) || INTERVAL_OPTIONS[1];
  const isEnabled = intervalSeconds > 0 && hasDriveConfigured;

  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      {/* Botón Principal Selector */}
      <div className="inline-flex items-center bg-[#f7fafc] border border-[#ccd1da] rounded-xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => {
            if (!hasDriveConfigured) {
              onOpenDriveConfig();
            } else {
              setIsOpen(!isOpen);
            }
          }}
          className="px-2.5 py-1.5 flex items-center gap-2 hover:bg-[#edf2f7] transition text-xs font-semibold text-[#1e1e1e] cursor-pointer"
          title={
            !hasDriveConfigured
              ? "Configura Google Drive para activar Auto-Sync"
              : `Auto-Sync: ${currentOption.label} • Última: ${formatTime(lastSyncTime)}`
          }
        >
          {/* Indicador de Estado en Vivo */}
          <span className="relative flex h-2 w-2 shrink-0">
            {isEnabled && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSyncing ? "bg-[#0098f2]" : "bg-[#5d9c06]"}`} />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                !hasDriveConfigured
                  ? "bg-[#8d8d8d]"
                  : isEnabled
                  ? isSyncing
                    ? "bg-[#0098f2]"
                    : "bg-[#5d9c06]"
                  : "bg-amber-500"
              }`}
            />
          </span>

          <span className="hidden sm:inline text-[11px] text-[#666666] font-medium">Auto-Sync:</span>
          <span className="text-[11px] font-bold">
            {!hasDriveConfigured ? "Sin Drive" : intervalSeconds === 0 ? "OFF" : `${intervalSeconds}s`}
          </span>

          <ChevronDown className="w-3 h-3 text-[#666666]" />
        </button>

        {/* Botón Rápido de Sincronización Manual Inmediata */}
        <button
          type="button"
          onClick={() => {
            if (!hasDriveConfigured) {
              onOpenDriveConfig();
            } else {
              syncNow();
            }
          }}
          disabled={isSyncing}
          className="px-2 py-1.5 border-l border-[#ccd1da]/60 hover:bg-[#edf2f7] text-[#0098f2] transition cursor-pointer disabled:opacity-50"
          title={lastSyncTime ? `Sincronizado: ${formatTime(lastSyncTime)} (clic para refrescar)` : "Sincronizar ahora con Google Drive"}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Menú Desplegable de Intervalos */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-[#ccd1da] rounded-xl shadow-xl z-50 p-2 animate-fade-in-up">
          <div className="px-2.5 py-1.5 border-b border-[#ccd1da]/60 mb-1">
            <div className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">
              Frecuencia de Auto-Sync
            </div>
            <div className="text-[11px] text-[#1e1e1e] flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-[#0098f2]" />
              <span>Última: <strong>{formatTime(lastSyncTime)}</strong></span>
            </div>
          </div>

          <div className="space-y-0.5">
            {INTERVAL_OPTIONS.map((opt) => {
              const isSelected = intervalSeconds === opt.seconds;
              return (
                <button
                  key={opt.seconds}
                  type="button"
                  onClick={() => {
                    setIntervalSeconds(opt.seconds);
                    setIsOpen(false);
                    if (opt.seconds > 0) {
                      syncNow();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-[#0098f2]/10 text-[#0098f2] font-bold"
                      : "text-[#1e1e1e] hover:bg-[#f7fafc]"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {opt.seconds > 0 ? (
                      <Zap className={`w-3.5 h-3.5 ${isSelected ? "text-[#0098f2]" : "text-[#8d8d8d]"}`} />
                    ) : (
                      <PauseCircle className="w-3.5 h-3.5 text-[#8d8d8d]" />
                    )}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#0098f2]" />}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-2 p-2 bg-[rgba(255,99,99,0.08)] border border-[rgba(255,99,99,0.2)] rounded-lg text-[10px] text-[#ff6363] flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
