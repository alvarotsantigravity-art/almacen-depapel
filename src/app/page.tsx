"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Zap,
  Database,
  Cloud,
  FileSpreadsheet,
  Key,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { ActiveAlbaranHeader } from "@/components/ActiveAlbaranHeader";
import { BobinasListTable } from "@/components/BobinasListTable";
import { PdfViewerStation } from "@/components/PdfViewerStation";
import { RecepcionPasivaView } from "@/components/RecepcionPasivaView";
import { UploadModal } from "@/components/UploadModal";
import { ImportPreviewModal } from "@/components/ImportPreviewModal";
import { ApiKeyModal } from "@/components/ApiKeyModal";
import { GoogleDriveConfigModal } from "@/components/GoogleDriveConfigModal";
import { HistoricoClientesView } from "@/components/HistoricoClientesView";
import { AutoSyncControl } from "@/components/AutoSyncControl";
import { useAutoSyncDrive } from "@/hooks/useAutoSyncDrive";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"recepcion" | "pasiva" | "historico">("recepcion");

  const [albaranes, setAlbaranes] = useState<any[]>([]);
  const [activeAlbaranId, setActiveAlbaranId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [driveLitAlbaranId, setDriveLitAlbaranId] = useState<string | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [driveWebhookUrl, setDriveWebhookUrl] = useState("");

  // Estado del Modal de Revisión / Personalización de OCR
  const [pendingOcrPayload, setPendingOcrPayload] = useState<{
    ocrData: any;
    pdf_nombre: string;
    pdf_data?: string;
  } | null>(null);

  const isAnyModalOpen = isUploadOpen || isKeyModalOpen || isDriveModalOpen || !!pendingOcrPayload;
  const autoSync = useAutoSyncDrive(isAnyModalOpen);

  // Cargar configuración de localStorage si existe
  useEffect(() => {
    const savedKey = localStorage.getItem("GEMINI_API_KEY");
    if (savedKey) setApiKey(savedKey);

    const savedDriveUrl = localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL");
    if (savedDriveUrl) setDriveWebhookUrl(savedDriveUrl);
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("GEMINI_API_KEY", key);
  };

  const handleSaveDriveWebhookUrl = (url: string) => {
    setDriveWebhookUrl(url);
    localStorage.setItem("GOOGLE_DRIVE_WEBHOOK_URL", url);
  };

  const fetchAlbaranes = async () => {
    try {
      const res = await fetch("/api/albaranes");
      const data = await res.json();
      if (data.albaranes) {
        setAlbaranes(data.albaranes);
        // Preservar exactamente el albarán activo seleccionado sin resetear ni forzar si está en inicio (null)
        setActiveAlbaranId((currentId) => {
          if (currentId && data.albaranes.some((a: any) => a.id === currentId)) {
            return currentId;
          }
          return null;
        });
      }
    } catch (err) {
      console.error("Error al cargar albaranes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbaranes();
  }, []);

  // Escuchar eventos de sincronización automática desde Google Drive
  useEffect(() => {
    const handleDriveSynced = () => {
      fetchAlbaranes();
    };
    window.addEventListener("app:drive-synced", handleDriveSynced);
    return () => window.removeEventListener("app:drive-synced", handleDriveSynced);
  }, []);

  const activeAlbaran = albaranes.find((a) => a.id === activeAlbaranId) || null;

  const handleDeleteAlbaran = async (id: string) => {
    try {
      const albToDelete = albaranes.find((a) => a.id === id);
      const driveUrl = typeof window !== "undefined" ? localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL") : null;

      if (driveUrl && albToDelete?.numero_albaran) {
        fetch("/api/google-drive-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl: driveUrl,
            mode: "delete_single",
            numero_albaran: albToDelete.numero_albaran,
          }),
        }).catch((errDrive) => console.error("Error borrando en Drive:", errDrive));
      }

      const res = await fetch(`/api/albaranes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAlbaranes();
      }
    } catch (err) {
      console.error("Error al borrar albarán:", err);
    }
  };

  const handleDeleteBobina = async (id: string) => {
    try {
      const res = await fetch(`/api/bobinas?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAlbaranes();

        // Resincronizar albarán activo en Google Drive para actualizar filas de bobinas
        const driveUrl = typeof window !== "undefined" ? localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL") : null;
        if (driveUrl && activeAlbaranId) {
          fetch("/api/google-drive-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              webhookUrl: driveUrl,
              mode: "sync_single",
              albaranId: activeAlbaranId,
              allow_overwrite: true,
            }),
          }).catch((errDrive) => console.error("Error resincronizando en Drive:", errDrive));
        }
      }
    } catch (err) {
      console.error("Error al borrar bobina:", err);
    }
  };

  const handleUpdateBobina = async (id: string, peso_kg: number, estado?: string) => {
    try {
      const res = await fetch("/api/bobinas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, peso_kg, estado }),
      });
      if (res.ok) {
        fetchAlbaranes();
      }
    } catch (err) {
      console.error("Error al actualizar bobina:", err);
    }
  };

  const handleVerifyAllBobinas = async () => {
    if (!activeAlbaranId) return;
    try {
      const res = await fetch("/api/bobinas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albaran_id: activeAlbaranId }),
      });
      if (res.ok) {
        setDriveLitAlbaranId(activeAlbaranId);
        fetchAlbaranes();
      }
    } catch (err) {
      console.error("Error verificando todas las bobinas:", err);
    }
  };

  const handleUploadActiveToDrive = async () => {
    if (!activeAlbaranId) return;
    const driveUrl = typeof window !== "undefined" ? localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL") : null;
    if (!driveUrl) {
      setIsDriveModalOpen(true);
      return;
    }
    try {
      const res = await fetch("/api/google-drive-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: driveUrl,
          mode: "sync_single",
          albaranId: activeAlbaranId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDriveLitAlbaranId(null);
        setActiveAlbaranId(null);
        alert(data.message || "¡Albarán subido exitosamente a Google Drive!");
        fetchAlbaranes();
      }
    } catch (e: any) {
      alert(e.message || "Error al subir a Google Drive.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1e1e1e] flex flex-col selection:bg-[#0098f2]/15 selection:text-[#0098f2]">
      {/* Barra de Navegación Flotante Estilo Acctual */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#ccd1da] shadow-[0_1px_3px_rgba(10,13,20,0.03)] px-4 sm:px-8 py-3 transition-all">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Marca Acctual Style */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0d111b] flex items-center justify-center text-white shadow-[0_2px_4px_rgba(13,17,27,0.2)]">
                <span className="font-bold text-base tracking-tighter text-[#0098f2]">A</span>
                <span className="font-extrabold text-sm tracking-tighter text-white">P</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold tracking-tight text-[#1e1e1e]">
                    <span className="text-[#0098f2]">Almacén</span> de Papel
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f7fafc] border border-[#ccd1da] text-[10px] font-semibold text-[#666666]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0098f2]" />
                    Activo
                  </span>
                </div>
                <p className="text-[11px] text-[#666666] font-medium tracking-tight">
                  Control de Bobinas & Albaranes
                </p>
              </div>
            </div>

            {/* Pestañas de Navegación Píldora */}
            <nav className="hidden md:flex items-center p-1 bg-[#f7fafc] rounded-full border border-[#ccd1da] gap-1">
              <button
                onClick={() => setActiveTab("recepcion")}
                className={`acctual-nav-pill ${activeTab === "recepcion" ? "active" : ""}`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Recepción Activa</span>
              </button>
              <button
                onClick={() => setActiveTab("pasiva")}
                className={`acctual-nav-pill ${activeTab === "pasiva" ? "active" : ""}`}
              >
                <Zap className="w-3.5 h-3.5 text-[#0098f2]" />
                <span>Recepción Pasiva</span>
              </button>
              <button
                onClick={() => setActiveTab("historico")}
                className={`acctual-nav-pill ${activeTab === "historico" ? "active" : ""}`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Histórico y Clientes</span>
              </button>
              <button
                onClick={() => {
                  const sheetUrl = localStorage.getItem("GOOGLE_DRIVE_SHEET_URL");
                  const targetUrl = sheetUrl || "https://drive.google.com/drive/search?q=BD_Almacen_Papel";
                  window.open(targetUrl, "_blank");
                }}
                className="acctual-nav-pill hover:text-[#0098f2]"
                title="Abrir Hoja de Cálculo en Google Drive"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0098f2]" />
                <span>Hoja Google Drive</span>
              </button>
            </nav>
          </div>

          {/* Selector de Albarán y Herramientas */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Navegación Móvil */}
            <div className="flex md:hidden items-center p-1 bg-[#f7fafc] rounded-full border border-[#ccd1da]">
              <button
                onClick={() => setActiveTab("recepcion")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  activeTab === "recepcion"
                    ? "bg-[#0d111b] text-white"
                    : "text-[#666666] hover:text-[#1e1e1e]"
                }`}
              >
                Activa
              </button>
              <button
                onClick={() => setActiveTab("pasiva")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  activeTab === "pasiva"
                    ? "bg-[#0d111b] text-white"
                    : "text-[#666666] hover:text-[#1e1e1e]"
                }`}
              >
                Pasiva
              </button>
              <button
                onClick={() => setActiveTab("historico")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  activeTab === "historico"
                    ? "bg-[#0d111b] text-white"
                    : "text-[#666666] hover:text-[#1e1e1e]"
                }`}
              >
                Histórico
              </button>
            </div>

            {/* Selector de Albarán Activo */}
            {activeTab === "recepcion" && (
              <div className="relative">
                <select
                  value={activeAlbaranId || ""}
                  onChange={(e) => setActiveAlbaranId(e.target.value || null)}
                  className="appearance-none bg-white border border-[#ccd1da] hover:border-[#afb0b1] rounded-full pl-3.5 pr-8 py-1.5 text-xs font-semibold text-[#1e1e1e] focus:outline-none focus:ring-2 focus:ring-[#0098f2]/20 focus:border-[#0098f2] transition cursor-pointer max-w-[200px] sm:max-w-xs truncate shadow-sm"
                >
                  <option value="">-- Seleccionar Albarán --</option>
                  {albaranes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.cliente?.nombre_empresa} • {a.numero_albaran}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#666666] absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            )}

            {/* Control de Auto-Sync con Google Drive */}
            <AutoSyncControl
              autoSync={autoSync}
              hasDriveConfigured={!!driveWebhookUrl}
              onOpenDriveConfig={() => setIsDriveModalOpen(true)}
            />

            {/* Botón Gemini API Key */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              title="Configuración de Gemini API Key para OCR"
              className={`p-2 rounded-full border text-xs font-medium transition cursor-pointer ${
                apiKey
                  ? "bg-[#f7fafc] border-[#ccd1da] text-[#0098f2] hover:border-[#0098f2]"
                  : "bg-[#f7fafc] border-[#ccd1da] text-[#8d8d8d] hover:text-[#1e1e1e]"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
            </button>

            {/* Botón Google Drive */}
            <button
              onClick={() => setIsDriveModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-tight transition cursor-pointer ${
                driveWebhookUrl
                  ? "bg-[rgba(0,152,242,0.08)] border-[rgba(0,152,242,0.3)] text-[#0098f2] hover:bg-[rgba(0,152,242,0.14)]"
                  : "bg-[#f7fafc] border-[#ccd1da] text-[#666666] hover:border-[#afb0b1] hover:text-[#1e1e1e]"
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-[#0098f2]" />
              <span className="hidden sm:inline">
                {driveWebhookUrl ? "Drive Conectado" : "Conectar Drive"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1560px] w-full mx-auto animate-fade-in-up">
        {activeTab === "recepcion" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Información del Albarán y Lista de Bobinas */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <ActiveAlbaranHeader
                albaran={activeAlbaran}
                onDeleteAlbaran={handleDeleteAlbaran}
                onOpenUploadModal={() => setIsUploadOpen(true)}
                onOpenDriveModal={() => setIsDriveModalOpen(true)}
                isDriveButtonLit={Boolean(activeAlbaranId && driveLitAlbaranId && driveLitAlbaranId === activeAlbaranId && (activeAlbaran?.bobinas?.length || 0) > 0)}
                onDriveUploaded={() => {
                  setDriveLitAlbaranId(null);
                  setActiveAlbaranId(null);
                  fetchAlbaranes();
                }}
              />
              <BobinasListTable
                activeAlbaranId={activeAlbaranId}
                bobinas={activeAlbaran?.bobinas || []}
                onDeleteBobina={handleDeleteBobina}
                onUpdateBobina={handleUpdateBobina}
                onVerifyAllBobinas={handleVerifyAllBobinas}
              />
            </div>

            {/* Columna Derecha: Visor Dedicado del Albarán Digital y Estado */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <PdfViewerStation
                activeAlbaranId={activeAlbaranId}
                activeAlbaran={activeAlbaran}
              />
            </div>
          </div>
        ) : activeTab === "pasiva" ? (
          /* Módulo Recepción Pasiva: Creación Manual y Escaneo */
          <RecepcionPasivaView />
        ) : (
          /* Módulo Histórico y Clientes */
          <HistoricoClientesView />
        )}
      </main>

      {/* Modales */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onOcrSuccess={(payload) => {
          setPendingOcrPayload(payload);
        }}
        apiKey={apiKey}
      />

      <ImportPreviewModal
        isOpen={!!pendingOcrPayload}
        onClose={() => setPendingOcrPayload(null)}
        ocrPayload={pendingOcrPayload}
        onSuccess={(newAlbaran) => {
          fetchAlbaranes();
          if (newAlbaran?.id) {
            setActiveAlbaranId(newAlbaran.id);
          }
        }}
      />

      <GoogleDriveConfigModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        webhookUrl={driveWebhookUrl}
        onSaveWebhookUrl={handleSaveDriveWebhookUrl}
      />

      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        currentKey={apiKey}
        onSaveKey={handleSaveApiKey}
      />

      {/* Footer Minimalista Acctual */}
      <footer className="mt-auto border-t border-[#ccd1da] bg-[#f7fafc] px-6 py-3.5 text-xs text-[#666666] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium">
          <span className="font-semibold text-[#1e1e1e]">Almacén de Papel</span>
          <span>•</span>
          <span>Terminal de Recepción Industrial</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span>Versión <strong className="text-[#1e1e1e] font-semibold">4.0 (Acctual)</strong></span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-[#ccd1da] font-medium text-[#1e1e1e]">
            <CheckCircle2 className="w-3 h-3 text-[#0098f2]" />
            Sistema en Línea
          </span>
        </div>
      </footer>
    </div>
  );
}

