"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface AutoSyncState {
  intervalSeconds: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  error: string | null;
  syncNow: () => Promise<void>;
  setIntervalSeconds: (seconds: number) => void;
}

export function useAutoSyncDrive(isPaused = false): AutoSyncState {
  const [intervalSeconds, setIntervalState] = useState<number>(60);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSyncingRef = useRef(false);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Cargar preferencia guardada en localStorage
  useEffect(() => {
    try {
      const savedInterval = localStorage.getItem("AUTO_SYNC_INTERVAL");
      if (savedInterval !== null) {
        const parsed = parseInt(savedInterval, 10);
        if (!isNaN(parsed)) {
          setIntervalState(parsed);
        }
      }
    } catch {}
  }, []);

  const setIntervalSeconds = (seconds: number) => {
    setIntervalState(seconds);
    try {
      localStorage.setItem("AUTO_SYNC_INTERVAL", String(seconds));
    } catch {}
  };

  const syncNow = useCallback(async (isPeriodic = false) => {
    if (typeof window === "undefined") return;

    // Si es sincronización periódica automática y hay modales abiertos o está pausado, omitir este ciclo
    if (isPeriodic) {
      if (isPausedRef.current) return;
      // Comprobar si hay algún modal abierto en el DOM
      const hasOpenModal = !!document.querySelector(".fixed.inset-0");
      if (hasOpenModal) return;
    }

    const driveUrl = localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL");
    if (!driveUrl || !driveUrl.trim()) return;

    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      const res = await fetch("/api/google-drive-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: driveUrl.trim(),
          mode: "import_from_drive",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || "Error en la sincronización periódica con Google Drive.");
      }

      const now = new Date();
      setLastSyncTime(now);

      // Disparar evento global para que las vistas se actualicen de forma silenciosa
      window.dispatchEvent(
        new CustomEvent("app:drive-synced", {
          detail: { timestamp: now.toISOString(), message: data.message },
        })
      );
    } catch (err: any) {
      console.warn("[AutoSyncDrive] Error en sincronización:", err.message);
      setError(err.message || "Error al sincronizar con Google Drive.");
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // Temporizador de sincronización automática periódica
  useEffect(() => {
    if (intervalSeconds <= 0) return;

    const timer = setInterval(() => {
      syncNow(true);
    }, intervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [intervalSeconds, syncNow]);

  // Sincronización al volver a enfocar la ventana/pestaña
  useEffect(() => {
    if (intervalSeconds <= 0) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncNow(true);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    return () => window.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [intervalSeconds, syncNow]);

  return {
    intervalSeconds,
    isSyncing,
    lastSyncTime,
    error,
    syncNow,
    setIntervalSeconds,
  };
}
