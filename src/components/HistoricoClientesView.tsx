"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Scale,
  Eye,
  Trash2,
  X,
  ShieldCheck,
  CloudDownload,
  Loader2,
  CheckCircle2,
  Calendar,
  Search,
  RotateCcw,
  Pencil,
  ExternalLink,
  Download,
} from "lucide-react";
import { exportToExcel, exportToPDF, ExportAlbaran } from "@/lib/exportService";
import { EditAlbaranModal } from "@/components/EditAlbaranModal";

function formatDisplayDate(rawDate: string | undefined | null): string {
  if (!rawDate) return "—";
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {}
  if (typeof rawDate === "string" && rawDate.includes("-")) {
    const parts = rawDate.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return String(rawDate).slice(0, 10);
}

function parseModifiedFields(jsonStr: string | null | undefined): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function HistoricoClientesView() {
  const [albaranes, setAlbaranes] = useState<ExportAlbaran[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre_empresa: string }[]>([]);
  const [almacenesList, setAlmacenesList] = useState<string[]>(["ROTOMADRID"]);
  const [loading, setLoading] = useState(true);
  const [syncingFromDrive, setSyncingFromDrive] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Estados de Filtros Multi-Concepto
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [searchNumeroAlbaran, setSearchNumeroAlbaran] = useState("");
  const [searchAlmacen, setSearchAlmacen] = useState("");
  const [searchCalle, setSearchCalle] = useState("");
  const [searchTipoPapel, setSearchTipoPapel] = useState("");
  const [searchAncho, setSearchAncho] = useState("");
  const [searchGramaje, setSearchGramaje] = useState("");
  const [searchCertificacion, setSearchCertificacion] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Modal para ver detalle completo de albarán
  const [selectedAlbaranDetail, setSelectedAlbaranDetail] = useState<ExportAlbaran | null>(null);
  // Modal para ver documento original PDF
  const [viewingPdfAlbaran, setViewingPdfAlbaran] = useState<ExportAlbaran | null>(null);
  const [blobPdfUrl, setBlobPdfUrl] = useState<string | null>(null);
  // Modal para editar/personalizar albarán
  const [editingAlbaran, setEditingAlbaran] = useState<ExportAlbaran | null>(null);

  useEffect(() => {
    if (!viewingPdfAlbaran?.pdf_data) {
      setBlobPdfUrl(null);
      return;
    }

    const rawData = viewingPdfAlbaran.pdf_data;
    if (rawData.startsWith("data:image/")) {
      setBlobPdfUrl(rawData);
      return;
    }

    try {
      let base64Content = rawData;
      if (rawData.includes(",")) {
        base64Content = rawData.split(",")[1];
      }
      const binaryStr = atob(base64Content);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      setBlobPdfUrl(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    } catch (err) {
      console.error("Error creating PDF blob URL:", err);
      setBlobPdfUrl(rawData);
    }
  }, [viewingPdfAlbaran]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  const fetchHistorico = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClienteId) params.append("clienteId", selectedClienteId);
      if (searchNumeroAlbaran) params.append("numeroAlbaran", searchNumeroAlbaran);
      if (searchAlmacen) params.append("almacen", searchAlmacen);
      if (searchCalle) params.append("calle", searchCalle);
      if (searchTipoPapel) params.append("tipoPapel", searchTipoPapel);
      if (searchAncho) params.append("anchoMin", searchAncho);
      if (searchGramaje) params.append("gramaje", searchGramaje);
      if (searchCertificacion) params.append("certificacion", searchCertificacion);
      if (fechaDesde) params.append("fechaDesde", fechaDesde);
      if (fechaHasta) params.append("fechaHasta", fechaHasta);

      const res = await fetch(`/api/historico?${params.toString()}`);
      const data = await res.json();
      if (data.albaranes) setAlbaranes(data.albaranes);
      if (data.clientes) setClientes(data.clientes);
      if (data.almacenes && Array.isArray(data.almacenes)) {
        setAlmacenesList(Array.from(new Set(["ROTOMADRID", ...data.almacenes])));
      }

      // Auto-sincronización inicial desde la nube si la DB local está vacía
      const driveUrl = localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL");
      if (data.albaranes && data.albaranes.length === 0 && driveUrl && !syncingFromDrive && !hasAutoSynced) {
        setHasAutoSynced(true);
        handleSyncFromDrive(true);
      }
    } catch (err) {
      console.error("Error al cargar el histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorico();
  }, [
    selectedClienteId,
    searchNumeroAlbaran,
    searchAlmacen,
    searchCalle,
    searchTipoPapel,
    searchAncho,
    searchGramaje,
    searchCertificacion,
    fechaDesde,
    fechaHasta,
  ]);

  // Escuchar eventos de sincronización automática desde Google Drive (en segundo plano y silencioso)
  useEffect(() => {
    const handleDriveSynced = () => {
      // Si el usuario no está editando en un modal, actualizar datos en segundo plano sin parpadeo
      if (!editingAlbaran && !selectedAlbaranDetail) {
        fetchHistorico(true);
      }
    };
    window.addEventListener("app:drive-synced", handleDriveSynced);
    return () => window.removeEventListener("app:drive-synced", handleDriveSynced);
  }, [
    editingAlbaran,
    selectedAlbaranDetail,
    selectedClienteId,
    searchNumeroAlbaran,
    searchAlmacen,
    searchCalle,
    searchTipoPapel,
    searchAncho,
    searchGramaje,
    searchCertificacion,
    fechaDesde,
    fechaHasta,
  ]);

  const handleSyncFromDrive = async (isAuto = false) => {
    const driveUrl = localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL");
    if (!driveUrl) {
      if (!isAuto) {
        alert("Configura primero la URL de Google Drive haciendo clic en 'Conectar Drive' en la barra superior.");
      }
      return;
    }

    setSyncingFromDrive(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      const res = await fetch("/api/google-drive-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: driveUrl, mode: "import_from_drive" }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        const errMsg = data?.error || "Error al sincronizar desde Google Drive.";
        if (!isAuto) {
          setSyncError(errMsg);
          setTimeout(() => setSyncError(null), 8000);
        }
        setSyncingFromDrive(false);
        return;
      }

      setSyncMessage(data.message);
      setTimeout(() => setSyncMessage(null), 6000);

      // Recargar histórico local
      const resHist = await fetch("/api/historico");
      const dataHist = await resHist.json();
      if (dataHist.albaranes) setAlbaranes(dataHist.albaranes);
      if (dataHist.clientes) setClientes(dataHist.clientes);
      if (dataHist.almacenes && Array.isArray(dataHist.almacenes)) {
        setAlmacenesList(Array.from(new Set(["ROTOMADRID", ...dataHist.almacenes])));
      }
    } catch (err: any) {
      console.error("Error al sincronizar desde Google Drive:", err);
      if (!isAuto) {
        setSyncError(err.message || "Error de conexión al sincronizar desde Google Drive.");
        setTimeout(() => setSyncError(null), 8000);
      }
    } finally {
      setSyncingFromDrive(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedClienteId("");
    setSearchNumeroAlbaran("");
    setSearchAlmacen("");
    setSearchCalle("");
    setSearchTipoPapel("");
    setSearchAncho("");
    setSearchGramaje("");
    setSearchCertificacion("");
    setFechaDesde("");
    setFechaHasta("");
  };

  // Cálculos de Resumen
  const totalAlbaranes = albaranes.length;
  const totalBobinas = albaranes.reduce((acc, a) => acc + a.bobinas.length, 0);
  const totalPesoKg = albaranes.reduce((acc, a) => acc + a.bobinas.reduce((bAcc, b) => bAcc + (b.peso_kg || 0), 0), 0);
  const totalToneladas = (totalPesoKg / 1000).toFixed(2);

  const handleDeleteAlbaran = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este albarán? Se eliminará tanto del sistema como de la hoja de cálculo de Google Drive.")) return;
    try {
      const albToDelete = albaranes.find((a) => a.id === id);
      const driveUrl = typeof window !== "undefined" ? localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL") : "";

      // Actualizar estado visual inmediatamente
      setAlbaranes((prev) => prev.filter((a) => a.id !== id));

      const queryParams = new URLSearchParams({ id });
      if (driveUrl) queryParams.append("drive_webhook_url", driveUrl);

      const res = await fetch(`/api/albaranes?${queryParams.toString()}`, { method: "DELETE" });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("app:drive-synced"));
        fetchHistorico();
      }
    } catch (err) {
      console.error("Error borrando albarán:", err);
      fetchHistorico();
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensaje Flotante de Sincronización */}
      {syncMessage && (
        <div className="p-3.5 bg-[rgba(0,152,242,0.08)] border border-[rgba(0,152,242,0.3)] rounded-xl flex items-center justify-between gap-3 text-[#0098f2] text-xs font-semibold shadow-sm animate-fade-in-up">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0098f2]" />
            <span>{syncMessage}</span>
          </div>
          <button onClick={() => setSyncMessage(null)} className="text-[#0098f2] hover:text-[#1e1e1e] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {syncError && (
        <div className="p-3.5 bg-[rgba(255,99,99,0.08)] border border-[rgba(255,99,99,0.3)] rounded-xl flex items-center justify-between gap-3 text-[#ff6363] text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-[#ff6363]" />
            <span>{syncError}</span>
          </div>
          <button onClick={() => setSyncError(null)} className="text-[#ff6363] hover:text-[#1e1e1e] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tarjetas de Métricas Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="acctual-card p-5 bg-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#0098f2]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#666666] font-semibold uppercase tracking-wider">Total Albaranes</div>
            <div className="text-2xl font-mono font-bold text-[#1e1e1e]">{totalAlbaranes}</div>
          </div>
        </div>

        <div className="acctual-card p-5 bg-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#6c56fc]">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#666666] font-semibold uppercase tracking-wider">Total Bobinas</div>
            <div className="text-2xl font-mono font-bold text-[#1e1e1e]">{totalBobinas}</div>
          </div>
        </div>

        <div className="acctual-card p-5 bg-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#5d9c06]">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#666666] font-semibold uppercase tracking-wider">Masa Registrada</div>
            <div className="text-2xl font-mono font-bold text-[#1e1e1e]">
              {totalToneladas} <span className="text-xs font-normal text-[#666666]">toneladas ({totalPesoKg.toLocaleString()} kg)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de Filtros y Acciones */}
      <div className="acctual-card p-5 sm:p-6 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ccd1da]/60 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#0098f2]" />
            <h3 className="text-base font-bold text-[#1e1e1e] tracking-tight">Filtros de Búsqueda</h3>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleSyncFromDrive(false)}
              disabled={syncingFromDrive}
              className="acctual-btn-secondary px-3.5 py-1.5 text-xs font-semibold gap-1.5 shadow-sm"
              title="Descargar y sincronizar albaranes desde la hoja de Google Drive"
            >
              {syncingFromDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0098f2]" /> : <CloudDownload className="w-3.5 h-3.5 text-[#0098f2]" />}
              <span>{syncingFromDrive ? "Sincronizando..." : "Traer de Drive"}</span>
            </button>

            <button
              onClick={() => exportToExcel(albaranes, "Historico_Albaranes_Papel.xlsx")}
              className="acctual-btn-secondary px-3.5 py-1.5 text-xs font-semibold gap-1.5 shadow-sm"
              title="Exportar registros filtrados a Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#5d9c06]" />
              <span>Excel</span>
            </button>

            <button
              onClick={() => exportToPDF(albaranes, "Informe_Historico_Papel.pdf")}
              className="acctual-btn-secondary px-3.5 py-1.5 text-xs font-semibold gap-1.5 shadow-sm"
              title="Generar PDF resumen del histórico filtrado"
            >
              <FileText className="w-3.5 h-3.5 text-[#ff6363]" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleResetFilters}
              className="acctual-btn-ghost px-3 py-1.5 text-xs gap-1"
              title="Restablecer todos los filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        {/* Inputs de Filtro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Cliente</label>
            <select
              value={selectedClienteId}
              onChange={(e) => setSelectedClienteId(e.target.value)}
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            >
              <option value="">Todos los Clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_empresa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">N° Albarán</label>
            <input
              type="text"
              value={searchNumeroAlbaran}
              onChange={(e) => setSearchNumeroAlbaran(e.target.value)}
              placeholder="Buscar por número..."
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Almacén</label>
            <select
              value={searchAlmacen}
              onChange={(e) => setSearchAlmacen(e.target.value)}
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            >
              <option value="">Todos los Almacenes</option>
              {almacenesList.map((alm) => (
                <option key={alm} value={alm}>
                  {alm}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Calle / Pasillo</label>
            <input
              type="text"
              value={searchCalle}
              onChange={(e) => setSearchCalle(e.target.value)}
              placeholder="Ej: 0, A-12..."
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Tipo / Marca</label>
            <input
              type="text"
              value={searchTipoPapel}
              onChange={(e) => setSearchTipoPapel(e.target.value)}
              placeholder="Offset, Estucado..."
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Certificación</label>
            <select
              value={searchCertificacion}
              onChange={(e) => setSearchCertificacion(e.target.value)}
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            >
              <option value="">Todas</option>
              <option value="PEFC">PEFC</option>
              <option value="FSC">FSC</option>
              <option value="SIN_CERTIFICACION">Sin Certificación</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Ancho (mm)</label>
            <input
              type="number"
              value={searchAncho}
              onChange={(e) => setSearchAncho(e.target.value)}
              placeholder="Ej: 800..."
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Gramaje (gsm)</label>
            <input
              type="number"
              value={searchGramaje}
              onChange={(e) => setSearchGramaje(e.target.value)}
              placeholder="Ej: 70..."
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Fecha Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Fecha Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
            />
          </div>
        </div>
      </div>

      {/* Tabla del Histórico */}
      <div className="acctual-card bg-white overflow-hidden border border-[#ccd1da]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-[#f7fafc] text-[#666666] text-xs uppercase font-semibold tracking-wider border-b border-[#ccd1da]">
                <th className="p-3.5 pl-5 w-28">Fecha</th>
                <th className="p-3.5 w-36">N° Albarán</th>
                <th className="p-3.5 min-w-[160px]">Cliente</th>
                <th className="p-3.5 w-36">Ubicación</th>
                <th className="p-3.5 min-w-[140px]">Fabricante / Tipo</th>
                <th className="p-3.5 w-32">Especificaciones</th>
                <th className="p-3.5 w-32">Certificación</th>
                <th className="p-3.5 w-20 text-center">Bobinas</th>
                <th className="p-3.5 w-28 text-right">Peso Total</th>
                <th className="p-3.5 w-40 text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ccd1da]/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-[#666666]">
                    <Loader2 className="w-6 h-6 text-[#0098f2] animate-spin mx-auto mb-2" />
                    <span className="text-xs">Cargando registros...</span>
                  </td>
                </tr>
              ) : albaranes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-[#8d8d8d] text-xs">
                    No se encontraron albaranes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                albaranes.map((alb) => {
                  const pesoTotal = alb.bobinas.reduce((acc, b) => acc + (b.peso_kg || 0), 0);
                  const hasCert = alb.certificacion_tipo && alb.certificacion_tipo !== "SIN_CERTIFICACION";
                  const almacenTexto = alb.almacen || "ROTOMADRID";
                  const calleTexto = alb.calle !== undefined && alb.calle !== null ? String(alb.calle) : "0";

                  const camposModificados = parseModifiedFields(alb.campos_modificados);
                  const isCustom = alb.es_personalizado || camposModificados.length > 0;
                  const isClientChanged = alb.cliente_original && alb.cliente_original !== alb.cliente?.nombre_empresa;

                  return (
                    <tr
                      key={alb.id}
                      className={`transition-colors ${
                        isCustom
                          ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.07] border-l-4 border-l-amber-500"
                          : "hover:bg-[#f7fafc]"
                      }`}
                    >
                      {/* Fecha */}
                      <td className="p-3.5 pl-5 font-mono text-xs text-[#1e1e1e] whitespace-nowrap font-medium">
                        <div className="flex items-center gap-1">
                          <span>{formatDisplayDate(alb.fecha)}</span>
                          {camposModificados.includes("Fecha") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Fecha personalizada" />
                          )}
                        </div>
                      </td>

                      {/* N° Albarán (Hipervínculo a Documento PDF Original) */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setViewingPdfAlbaran(alb)}
                            title="Ver documento original PDF de este albarán"
                            className="font-mono font-bold text-[#0098f2] hover:text-[#007ec9] hover:underline whitespace-nowrap flex items-center gap-1.5 cursor-pointer text-left group"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#0098f2] group-hover:scale-110 transition shrink-0" />
                            <span>{alb.numero_albaran}</span>
                          </button>
                          {camposModificados.includes("N° Albarán") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="N° Albarán modificado" />
                          )}
                          {isCustom && (
                            <span
                              title={
                                camposModificados.length > 0
                                  ? `Personalizado: ${camposModificados.join(", ")}`
                                  : "Albarán personalizado"
                              }
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100/90 text-amber-800 border border-amber-300 shadow-xs cursor-help"
                            >
                              <Pencil className="w-2.5 h-2.5 text-amber-600" />
                              <span>Personalizado</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#1e1e1e]">{alb.cliente.nombre_empresa}</span>
                          {camposModificados.includes("Cliente") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Cliente modificado" />
                          )}
                        </div>
                        {isClientChanged && (
                          <div
                            title={`Cliente original registrado: ${alb.cliente_original}`}
                            className="text-[10px] font-semibold text-amber-700 mt-0.5 flex items-center gap-1"
                          >
                            <span>Antes: {alb.cliente_original}</span>
                          </div>
                        )}
                      </td>

                      {/* Ubicación */}
                      <td className="p-3.5">
                        <div className="font-semibold text-[#1e1e1e] text-xs flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-[#0098f2]" />
                          <span>{almacenTexto}</span>
                          {camposModificados.includes("Almacén") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Almacén modificado" />
                          )}
                        </div>
                        <div className="text-xs font-mono text-[#666666] mt-0.5 flex items-center gap-1">
                          <span>{calleTexto.toLowerCase().startsWith("calle") ? calleTexto : `Calle ${calleTexto}`}</span>
                          {camposModificados.includes("Calle") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Calle modificada" />
                          )}
                        </div>
                      </td>

                      {/* Fabricante / Tipo */}
                      <td className="p-3.5">
                        <div className="font-semibold text-[#1e1e1e] text-xs flex items-center gap-1">
                          <span>{alb.fabricante}</span>
                          {camposModificados.includes("Fabricante") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Fabricante modificado" />
                          )}
                        </div>
                        <div className="text-xs text-[#666666] flex items-center gap-1">
                          <span>{alb.marca_papel} ({alb.tipo_papel})</span>
                          {(camposModificados.includes("Marca Papel") || camposModificados.includes("Tipo Papel")) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Marca o tipo modificado" />
                          )}
                        </div>
                      </td>

                      {/* Especificaciones */}
                      <td className="p-3.5 font-mono text-xs text-[#666666] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span>{alb.ancho_papel_mm} mm</span>
                          {camposModificados.includes("Ancho (mm)") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Ancho modificado" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{alb.gramaje_papel_gsm} gsm</span>
                          {camposModificados.includes("Gramaje (gsm)") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Gramaje modificado" />
                          )}
                        </div>
                      </td>

                      {/* Certificación */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1">
                          {hasCert ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[rgba(93,156,6,0.1)] text-[#5d9c06] border border-[rgba(93,156,6,0.25)]">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {alb.certificacion_tipo}
                            </span>
                          ) : (
                            <span className="text-xs text-[#8d8d8d]">—</span>
                          )}
                          {camposModificados.includes("Certificación") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Certificación modificada" />
                          )}
                        </div>
                      </td>

                      {/* Bobinas */}
                      <td className="p-3.5 text-center font-mono font-semibold text-[#1e1e1e]">
                        <div className="inline-flex items-center justify-center gap-1">
                          <span>{alb.bobinas.length}</span>
                          {camposModificados.includes("Bobinas") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Bobinas modificadas" />
                          )}
                        </div>
                      </td>

                      {/* Peso Total */}
                      <td className="p-3.5 text-right font-mono font-bold text-[#0098f2] whitespace-nowrap">
                        {pesoTotal.toLocaleString()} <span className="text-xs font-normal text-[#666666]">kg</span>
                      </td>

                      {/* Acciones */}
                      <td className="p-3.5 text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingPdfAlbaran(alb)}
                            title="Ver Albarán Original PDF"
                            className="p-1.5 text-[#0098f2] hover:bg-[rgba(0,152,242,0.08)] rounded-lg transition cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingAlbaran(alb)}
                            title="Personalizar / Editar Albarán"
                            className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedAlbaranDetail(alb)}
                            title="Ver Detalle Completo"
                            className="p-1.5 text-[#4a5568] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => exportToExcel([alb], `Albaran_${alb.numero_albaran}.xlsx`)}
                            title="Exportar a Excel"
                            className="p-1.5 text-[#5d9c06] hover:bg-[rgba(93,156,6,0.08)] rounded-lg transition cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => exportToPDF([alb], `Informe_Albaran_${alb.numero_albaran}.pdf`)}
                            title="Generar Informe PDF de Bobinas"
                            className="p-1.5 text-[#6c56fc] hover:bg-[rgba(108,86,252,0.08)] rounded-lg transition cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAlbaran(alb.id)}
                            title="Eliminar"
                            className="p-1.5 text-[#ff6363] hover:bg-[rgba(255,99,99,0.08)] rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle Completo de Albarán */}
      {selectedAlbaranDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#ccd1da] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#f7fafc] border-b border-[#ccd1da] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#1e1e1e]">
                  Detalle del Albarán: <span className="font-mono text-[#0098f2]">{selectedAlbaranDetail.numero_albaran}</span>
                </h3>
                <p className="text-xs text-[#666666] mt-0.5">
                  Cliente: <span className="font-medium text-[#1e1e1e]">{selectedAlbaranDetail.cliente.nombre_empresa}</span> | Fecha: <span className="font-medium text-[#1e1e1e]">{formatDisplayDate(selectedAlbaranDetail.fecha)}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedAlbaranDetail(null)}
                className="p-1 text-[#666666] hover:text-[#1e1e1e] hover:bg-[#eaeef4] rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da]">
                  <div className="text-[10px] uppercase font-semibold text-[#666666]">Almacén</div>
                  <div className="text-xs font-bold text-[#1e1e1e] truncate">{selectedAlbaranDetail.almacen || "ROTOMADRID"}</div>
                </div>
                <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da]">
                  <div className="text-[10px] uppercase font-semibold text-[#666666]">Calle</div>
                  <div className="text-xs font-mono font-bold text-[#1e1e1e] truncate">
                    {selectedAlbaranDetail.calle !== undefined && selectedAlbaranDetail.calle !== null ? String(selectedAlbaranDetail.calle) : "0"}
                  </div>
                </div>
                <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da]">
                  <div className="text-[10px] uppercase font-semibold text-[#666666]">Fabricante</div>
                  <div className="text-xs font-bold text-[#1e1e1e] truncate">{selectedAlbaranDetail.fabricante}</div>
                </div>
                <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da]">
                  <div className="text-[10px] uppercase font-semibold text-[#666666]">Marca / Tipo</div>
                  <div className="text-xs font-bold text-[#1e1e1e] truncate">{selectedAlbaranDetail.marca_papel} ({selectedAlbaranDetail.tipo_papel})</div>
                </div>
                <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da]">
                  <div className="text-[10px] uppercase font-semibold text-[#666666]">Ancho</div>
                  <div className="text-xs font-mono font-bold text-[#1e1e1e]">{selectedAlbaranDetail.ancho_papel_mm} mm</div>
                </div>
                <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da]">
                  <div className="text-[10px] uppercase font-semibold text-[#666666]">Gramaje</div>
                  <div className="text-xs font-mono font-bold text-[#1e1e1e]">{selectedAlbaranDetail.gramaje_papel_gsm} gsm</div>
                </div>
              </div>

              {/* Tabla de Bobinas del Albarán */}
              <div className="rounded-xl border border-[#ccd1da] overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f7fafc] text-[#666666] font-semibold border-b border-[#ccd1da]">
                      <th className="p-3 pl-4">#</th>
                      <th className="p-3">ID Bobina</th>
                      <th className="p-3">Peso (kg)</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ccd1da]/60">
                    {selectedAlbaranDetail.bobinas.map((b, idx) => (
                      <tr key={b.id || idx} className="hover:bg-[#f7fafc]">
                        <td className="p-3 pl-4 font-mono text-[#8d8d8d]">{idx + 1}</td>
                        <td className="p-3 font-mono font-semibold text-[#1e1e1e]">{b.identificador_bobina}</td>
                        <td className="p-3 font-mono font-bold text-[#1e1e1e]">{b.peso_kg !== null ? `${b.peso_kg} kg` : "—"}</td>
                        <td className="p-3">
                          <span className={b.estado === "VERIFICADA" ? "acctual-badge-verified text-[10px]" : "acctual-badge-pending text-[10px]"}>
                            {b.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-2 flex-wrap">
                <button
                  onClick={() => {
                    const alb = selectedAlbaranDetail;
                    setViewingPdfAlbaran(alb);
                  }}
                  className="acctual-btn-secondary px-4 py-2 text-xs font-semibold gap-1.5 shadow-sm text-[#0098f2] border-[#0098f2]/30 hover:bg-[rgba(0,152,242,0.08)]"
                >
                  <FileText className="w-4 h-4 text-[#0098f2]" /> Ver Albarán Original
                </button>
                <button
                  onClick={() => {
                    const alb = selectedAlbaranDetail;
                    setSelectedAlbaranDetail(null);
                    setEditingAlbaran(alb);
                  }}
                  className="acctual-btn-secondary px-4 py-2 text-xs font-semibold gap-1.5 shadow-sm text-amber-800 border-amber-300 hover:bg-amber-50"
                >
                  <Pencil className="w-4 h-4 text-amber-600" /> Personalizar Albarán
                </button>
                <button
                  onClick={() => exportToExcel([selectedAlbaranDetail], `Albaran_${selectedAlbaranDetail.numero_albaran}.xlsx`)}
                  className="acctual-btn-secondary px-4 py-2 text-xs font-semibold gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#5d9c06]" /> Exportar a Excel
                </button>
                <button
                  onClick={() => exportToPDF([selectedAlbaranDetail], `Informe_Albaran_${selectedAlbaranDetail.numero_albaran}.pdf`)}
                  className="acctual-btn-primary px-4 py-2 text-xs font-semibold gap-1.5 shadow-sm"
                >
                  <Download className="w-4 h-4" /> Exportar a PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visor de Albarán Original PDF */}
      {viewingPdfAlbaran && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#ccd1da] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#f7fafc] border-b border-[#ccd1da] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,152,242,0.1)] text-[#0098f2] flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[#1e1e1e]">
                      Albarán Original: <span className="font-mono text-[#0098f2]">{viewingPdfAlbaran.numero_albaran}</span>
                    </h3>
                    {viewingPdfAlbaran.pdf_nombre && (
                      <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        {viewingPdfAlbaran.pdf_nombre}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#666666] mt-0.5">
                    Cliente: <span className="font-medium text-[#1e1e1e]">{viewingPdfAlbaran.cliente.nombre_empresa}</span> | Fecha: <span className="font-medium text-[#1e1e1e]">{formatDisplayDate(viewingPdfAlbaran.fecha)}</span> | Bobinas: <span className="font-medium text-[#1e1e1e]">{viewingPdfAlbaran.bobinas.length}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {blobPdfUrl && (
                  <>
                    <button
                      onClick={() => {
                        window.open(blobPdfUrl, "_blank");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0098f2] bg-[rgba(0,152,242,0.08)] hover:bg-[rgba(0,152,242,0.15)] rounded-xl transition cursor-pointer"
                      title="Abrir en pestaña nueva del navegador"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir en Pestaña</span>
                    </button>

                    <a
                      href={blobPdfUrl}
                      download={viewingPdfAlbaran.pdf_nombre || `Albaran_${viewingPdfAlbaran.numero_albaran}.pdf`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0098f2] hover:bg-[#007ec9] rounded-xl transition shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar PDF</span>
                    </a>
                  </>
                )}

                {viewingPdfAlbaran.pdf_url && (
                  <a
                    href={viewingPdfAlbaran.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0098f2] hover:bg-[#007ec9] rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver en Google Drive</span>
                  </a>
                )}

                <button
                  onClick={() => setViewingPdfAlbaran(null)}
                  className="p-1.5 text-[#666666] hover:text-[#1e1e1e] hover:bg-[#eaeef4] rounded-xl transition cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-900 p-2 overflow-hidden flex items-center justify-center relative">
              {blobPdfUrl ? (
                blobPdfUrl.startsWith("data:image/") ? (
                  <img
                    src={blobPdfUrl}
                    alt={`Albarán ${viewingPdfAlbaran.numero_albaran}`}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : (
                  <object
                    data={`${blobPdfUrl}#toolbar=1&navpanes=0`}
                    type="application/pdf"
                    className="w-full h-full rounded-xl bg-white"
                  >
                    <iframe
                      src={`${blobPdfUrl}#toolbar=1`}
                      className="w-full h-full rounded-xl bg-white border-0"
                      title={`PDF ${viewingPdfAlbaran.numero_albaran}`}
                    >
                      <div className="text-center p-8 bg-white rounded-xl">
                        <p className="text-sm font-semibold text-slate-800 mb-3">Tu navegador no pudo incrustar el visor de PDF directamente.</p>
                        <a
                          href={blobPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0098f2] text-white rounded-xl font-semibold text-xs"
                        >
                          <ExternalLink className="w-4 h-4" /> Abrir PDF en Nueva Pestaña
                        </a>
                      </div>
                    </iframe>
                  </object>
                )
              ) : viewingPdfAlbaran.pdf_url ? (
                <div className="text-center p-8 bg-white rounded-2xl max-w-md shadow-lg border border-[#ccd1da]">
                  <FileText className="w-16 h-16 text-[#0098f2] mx-auto mb-4" />
                  <h4 className="font-bold text-lg text-[#1e1e1e] mb-2">Documento en Google Drive</h4>
                  <p className="text-xs text-[#666666] mb-6">
                    Este albarán fue sincronizado desde Google Drive. Puedes abrir el documento original en una pestaña nueva con el siguiente enlace:
                  </p>
                  <a
                    href={viewingPdfAlbaran.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0098f2] hover:bg-[#007ec9] text-white text-sm font-semibold rounded-xl transition shadow-md"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir Documento en Google Drive</span>
                  </a>
                </div>
              ) : (
                <div className="text-center p-8 bg-white rounded-2xl max-w-md shadow-lg border border-[#ccd1da]">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h4 className="font-bold text-lg text-[#1e1e1e] mb-2">Sin Archivo PDF Original</h4>
                  <p className="text-xs text-[#666666] mb-6">
                    Este albarán no contiene un archivo PDF original adjunto en la base de datos local ni en la nube.
                  </p>
                  <button
                    onClick={() => exportToPDF([viewingPdfAlbaran], `Informe_Albaran_${viewingPdfAlbaran.numero_albaran}.pdf`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6c56fc] hover:bg-[#5b46ea] text-white text-sm font-semibold rounded-xl transition shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Generar y Descargar Informe PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición / Personalización Integral de Albarán */}
      <EditAlbaranModal
        isOpen={!!editingAlbaran}
        albaran={editingAlbaran}
        clientesList={clientes}
        almacenesList={almacenesList}
        onClose={() => setEditingAlbaran(null)}
        onSaveSuccess={(updated, msg) => {
          setSyncMessage(msg);
          setTimeout(() => setSyncMessage(null), 6000);
          if (updated) {
            setAlbaranes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          }
          fetchHistorico();
        }}
      />
    </div>
  );
}
