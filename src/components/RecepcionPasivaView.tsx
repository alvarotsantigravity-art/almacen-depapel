"use client";

import { useState, useRef, useEffect } from "react";
import {
  Layers,
  Building2,
  QrCode,
  Zap,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Trash2,
  Edit2,
  Check,
  X,
  Plus,
  RotateCcw,
  Loader2,
  FileSpreadsheet,
  FileText,
  Save,
  Scale,
  ShieldCheck,
  ChevronDown,
  Info,
} from "lucide-react";
import { playSuccessBeep, playErrorBeep } from "@/lib/audioService";
import { CameraScannerModal } from "@/components/CameraScannerModal";

interface Cliente {
  id: string;
  nombre_empresa: string;
}

interface Bobina {
  id: string;
  identificador_bobina: string;
  peso_kg: number | null;
  estado: string;
  albaran_id: string;
}

interface AlbaranManual {
  id: string;
  numero_albaran: string;
  fecha: string;
  fabricante: string;
  marca_papel: string;
  tipo_papel: string;
  ancho_papel_mm: number;
  gramaje_papel_gsm: number;
  almacen: string;
  calle: string;
  certificacion_tipo: string;
  certificacion_codigo?: string | null;
  certificacion_porcentaje?: number | null;
  cliente: Cliente;
  bobinas: Bobina[];
}

export function RecepcionPasivaView() {
  const [albaranes, setAlbaranes] = useState<AlbaranManual[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [almacenesList, setAlmacenesList] = useState<string[]>(["ROTOMADRID"]);
  const [loading, setLoading] = useState(true);

  // Albarán actualmente activo en la sesión manual
  const [selectedAlbaranId, setSelectedAlbaranId] = useState<string | null>(null);

  // Estados del Formulario Manual
  const [clienteSelect, setClienteSelect] = useState<string>("");
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState<string>("");
  const [numeroAlbaran, setNumeroAlbaran] = useState<string>("");
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split("T")[0]);
  const [almacenSelect, setAlmacenSelect] = useState<string>("ROTOMADRID");
  const [customAlmacen, setCustomAlmacen] = useState<string>("");
  const [calle, setCalle] = useState<string>("0");
  const [fabricante, setFabricante] = useState<string>("");
  const [marcaPapel, setMarcaPapel] = useState<string>("");
  const [tipoPapel, setTipoPapel] = useState<string>("Offset");
  const [anchoPapel, setAnchoPapel] = useState<string>("");
  const [gramajePapel, setGramajePapel] = useState<string>("");
  const [certificacionTipo, setCertificacionTipo] = useState<string>("SIN_CERTIFICACION");
  const [certificacionCodigo, setCertificacionCodigo] = useState<string>("");
  const [certificacionPorcentaje, setCertificacionPorcentaje] = useState<string>("");

  const [savingAlbaran, setSavingAlbaran] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // Estados del Escáner (Pistola Láser + Cámara Tablet)
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
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

  // Edición en línea de peso en la tabla de bobinas
  const [editingBobinaId, setEditingBobinaId] = useState<string | null>(null);
  const [editingPeso, setEditingPeso] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar albaranes y clientes
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/albaranes");
      const data = await res.json();
      if (data.albaranes) {
        setAlbaranes(data.albaranes);
      }

      const resHist = await fetch("/api/historico");
      const dataHist = await resHist.json();
      if (dataHist.clientes) setClientes(dataHist.clientes);
      if (dataHist.almacenes && Array.isArray(dataHist.almacenes)) {
        setAlmacenesList(Array.from(new Set(["ROTOMADRID", ...dataHist.almacenes])));
      }
    } catch (err) {
      console.error("Error al cargar datos en Recepción Pasiva:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Albarán activo seleccionado
  const activeAlbaran = albaranes.find((a) => a.id === selectedAlbaranId) || null;

  // Auto-focus continuo en la caja de escaneo para la pistola láser
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        selectedAlbaranId &&
        !isCameraOpen &&
        !editingBobinaId &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        inputRef.current?.focus();
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [selectedAlbaranId, isCameraOpen, editingBobinaId]);

  // Cuando se selecciona un albarán existente, cargar sus datos en el formulario
  const handleSelectAlbaran = (id: string) => {
    if (!id) {
      handleResetForm();
      return;
    }
    const alb = albaranes.find((a) => a.id === id);
    if (alb) {
      setSelectedAlbaranId(alb.id);
      setClienteSelect(alb.cliente.id);
      setNuevoClienteNombre("");
      setNumeroAlbaran(alb.numero_albaran);
      setFecha(alb.fecha || new Date().toISOString().split("T")[0]);
      setAlmacenSelect(alb.almacen || "ROTOMADRID");
      setCustomAlmacen("");
      setCalle(alb.calle !== undefined && alb.calle !== null ? alb.calle : "0");
      setFabricante(alb.fabricante || "");
      setMarcaPapel(alb.marca_papel || "");
      setTipoPapel(alb.tipo_papel || "Offset");
      setAnchoPapel(alb.ancho_papel_mm ? String(alb.ancho_papel_mm) : "");
      setGramajePapel(alb.gramaje_papel_gsm ? String(alb.gramaje_papel_gsm) : "");
      setCertificacionTipo(alb.certificacion_tipo || "SIN_CERTIFICACION");
      setCertificacionCodigo(alb.certificacion_codigo || "");
      setCertificacionPorcentaje(alb.certificacion_porcentaje ? String(alb.certificacion_porcentaje) : "");
    }
  };

  const handleResetForm = () => {
    setSelectedAlbaranId(null);
    setClienteSelect("");
    setNuevoClienteNombre("");
    setNumeroAlbaran("");
    setFecha(new Date().toISOString().split("T")[0]);
    setAlmacenSelect("ROTOMADRID");
    setCustomAlmacen("");
    setCalle("0");
    setFabricante("");
    setMarcaPapel("");
    setTipoPapel("Offset");
    setAnchoPapel("");
    setGramajePapel("");
    setCertificacionTipo("SIN_CERTIFICACION");
    setCertificacionCodigo("");
    setCertificacionPorcentaje("");
    setFormSuccessMessage(null);
    setFormErrorMessage(null);
    setLastScanResult(null);
  };

  // Crear o actualizar el albarán manual
  const handleSaveAlbaran = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setFormErrorMessage(null);
    setFormSuccessMessage(null);

    // Validación
    let finalClienteNombre = "";
    if (clienteSelect === "NEW") {
      if (!nuevoClienteNombre.trim()) {
        setFormErrorMessage("Por favor, introduce el nombre del nuevo cliente.");
        return;
      }
      finalClienteNombre = nuevoClienteNombre.trim();
    } else if (clienteSelect) {
      const cli = clientes.find((c) => c.id === clienteSelect);
      finalClienteNombre = cli ? cli.nombre_empresa : "";
    }

    if (!finalClienteNombre) {
      setFormErrorMessage("Por favor, selecciona o introduce un cliente.");
      return;
    }

    if (!numeroAlbaran.trim()) {
      setFormErrorMessage("Por favor, introduce el número de albarán.");
      return;
    }

    const finalAlmacen = almacenSelect === "CUSTOM"
      ? (customAlmacen.trim() || "ROTOMADRID")
      : almacenSelect;

    setSavingAlbaran(true);

    try {
      const payload = {
        nombre_cliente: finalClienteNombre,
        numero_albaran: numeroAlbaran.trim(),
        fecha: fecha,
        almacen: finalAlmacen,
        calle: calle.trim() || "0",
        fabricante: fabricante.trim() || "Fabricante Desconocido",
        marca_papel: marcaPapel.trim() || "Estándar",
        tipo_papel: tipoPapel.trim() || "Offset",
        ancho_papel_mm: parseFloat(anchoPapel) || 0,
        gramaje_papel_gsm: parseFloat(gramajePapel) || 0,
        certificacion_tipo: certificacionTipo,
        certificacion_codigo: certificacionCodigo.trim() || null,
        certificacion_porcentaje: certificacionPorcentaje ? parseFloat(certificacionPorcentaje) : null,
        bobinas: activeAlbaran?.bobinas?.map((b) => ({
          identificador_bobina: b.identificador_bobina,
          peso_kg: b.peso_kg,
        })) || [],
      };

      const res = await fetch("/api/albaranes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setFormErrorMessage(data.error || "Error al guardar el albarán.");
        return;
      }

      setFormSuccessMessage(`¡Albarán ${numeroAlbaran} listo! Puedes comenzar a escanear bobinas.`);
      setSelectedAlbaranId(data.albaran.id);

      // Recargar lista de albaranes y clientes
      await fetchData();
      setTimeout(() => setFormSuccessMessage(null), 5000);
    } catch (err: any) {
      setFormErrorMessage(err.message || "Error de red al guardar el albarán.");
    } finally {
      setSavingAlbaran(false);
    }
  };

  // Procesar código de barras escaneado (Pistola o Cámara)
  const processScanCode = async (rawCode: string) => {
    if (!rawCode || !selectedAlbaranId) return;

    setBarcodeInput("");

    try {
      const res = await fetch("/api/bobinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albaran_id: selectedAlbaranId,
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
          formato: data.formato_detectado,
          message: "Código estándar sin peso. Introduce el peso manualmente.",
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
          message: `Bobina agregada exitosamente (${bobina.peso_kg} kg)`,
        });
      }

      // Recargar albaranes para refrescar la lista
      await fetchData();
    } catch (err: any) {
      playErrorBeep();
      setLastScanResult({
        success: false,
        message: err.message || "Error al escanear código.",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (barcodeInput.trim()) {
        processScanCode(barcodeInput.trim());
      }
    }
  };

  const handleManualWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingManualEdit || !pendingManualEdit.pesoInput) return;

    try {
      const pesoNum = parseFloat(pendingManualEdit.pesoInput.replace(",", "."));
      if (isNaN(pesoNum) || pesoNum <= 0) {
        alert("Por favor, introduce un peso numérico válido.");
        return;
      }

      const res = await fetch("/api/bobinas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingManualEdit.id,
          peso_kg: pesoNum,
          estado: "VERIFICADA",
        }),
      });

      if (res.ok) {
        playSuccessBeep();
        setPendingManualEdit(null);
        await fetchData();
      }
    } catch (err) {
      console.error("Error al actualizar peso:", err);
    }
  };

  const handleDeleteBobina = async (bobinaId: string) => {
    if (!confirm("¿Deseas eliminar esta bobina escaneada?")) return;
    try {
      const res = await fetch(`/api/bobinas?id=${bobinaId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Error al eliminar bobina:", err);
    }
  };

  const handleSavePesoInline = async (bobinaId: string) => {
    const pesoNum = parseFloat(editingPeso.replace(",", "."));
    if (isNaN(pesoNum) || pesoNum < 0) {
      alert("Por favor, introduce un peso válido.");
      return;
    }

    try {
      const res = await fetch("/api/bobinas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bobinaId,
          peso_kg: pesoNum,
          estado: "VERIFICADA",
        }),
      });

      if (res.ok) {
        setEditingBobinaId(null);
        setEditingPeso("");
        await fetchData();
      }
    } catch (err) {
      console.error("Error al editar peso inline:", err);
    }
  };

  // Cálculos en vivo
  const bobinasList = activeAlbaran?.bobinas || [];
  const totalBobinas = bobinasList.length;
  const totalPesoKg = bobinasList.reduce((acc, b) => acc + (b.peso_kg || 0), 0);
  const totalToneladas = (totalPesoKg / 1000).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Barra de Selección y Estado */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#ccd1da] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(0,152,242,0.1)] text-[#0098f2] flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#1e1e1e] tracking-tight">Recepción Pasiva</h2>
            <p className="text-xs text-[#666666]">Creación manual de albaranes y escaneo de bobinas con pistola láser o cámara</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de Albarán Activo */}
          <div className="relative">
            <select
              value={selectedAlbaranId || ""}
              onChange={(e) => handleSelectAlbaran(e.target.value)}
              className="appearance-none bg-[#f7fafc] border border-[#ccd1da] hover:border-[#afb0b1] rounded-full pl-3.5 pr-8 py-2 text-xs font-semibold text-[#1e1e1e] focus:outline-none focus:border-[#0098f2] cursor-pointer min-w-[200px]"
            >
              <option value="">-- Modo Nuevo Albarán --</option>
              {albaranes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.cliente?.nombre_empresa} • {a.numero_albaran} ({a.bobinas?.length || 0} bobinas)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#666666] absolute right-2.5 top-3 pointer-events-none" />
          </div>

          <button
            onClick={handleResetForm}
            className="acctual-btn-secondary px-3.5 py-2 text-xs font-semibold gap-1.5 shadow-sm"
            title="Crear un nuevo albarán manual en blanco"
          >
            <Plus className="w-3.5 h-3.5 text-[#0098f2]" />
            <span>Nuevo Albarán</span>
          </button>
        </div>
      </div>

      {/* Grid Principal Dividido */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Formulario Manual de Albarán (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="acctual-card p-5 sm:p-6 bg-white border border-[#ccd1da] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ccd1da]/60 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0098f2]" />
                <h3 className="text-sm font-bold text-[#1e1e1e]">Datos del Albarán</h3>
              </div>
              {selectedAlbaranId && (
                <span className="acctual-badge-verified text-[10px]">
                  Albarán Activo
                </span>
              )}
            </div>

            {formSuccessMessage && (
              <div className="p-3 rounded-xl bg-[rgba(93,156,6,0.1)] border border-[rgba(93,156,6,0.3)] text-[#5d9c06] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccessMessage}</span>
              </div>
            )}

            {formErrorMessage && (
              <div className="p-3 rounded-xl bg-[rgba(255,99,99,0.1)] border border-[rgba(255,99,99,0.3)] text-[#ff6363] text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formErrorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveAlbaran} className="space-y-3.5">
              {/* Cliente */}
              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Cliente *</label>
                <select
                  value={clienteSelect}
                  onChange={(e) => setClienteSelect(e.target.value)}
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                >
                  <option value="">-- Seleccionar Cliente --</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_empresa}
                    </option>
                  ))}
                  <option value="NEW">+ Añadir nuevo cliente...</option>
                </select>
              </div>

              {clienteSelect === "NEW" && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#0098f2] uppercase mb-1">Nombre de la Nueva Empresa *</label>
                  <input
                    type="text"
                    value={nuevoClienteNombre}
                    onChange={(e) => setNuevoClienteNombre(e.target.value)}
                    placeholder="Ej: Impresiones Madrid S.L."
                    className="w-full bg-[#f7fafc] border-2 border-[#0098f2]/40 rounded-xl px-3 py-2 text-xs font-semibold text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
              )}

              {/* N° Albarán y Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">N° Albarán *</label>
                  <input
                    type="text"
                    value={numeroAlbaran}
                    onChange={(e) => setNumeroAlbaran(e.target.value)}
                    placeholder="Ej: 2024-0891"
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
              </div>

              {/* Almacén y Calle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Almacén</label>
                  <select
                    value={almacenSelect}
                    onChange={(e) => setAlmacenSelect(e.target.value)}
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-semibold text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  >
                    {almacenesList.map((alm, idx) => (
                      <option key={idx} value={alm}>
                        {alm}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Añadir nuevo almacén...</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Calle</label>
                  <input
                    type="text"
                    value={calle}
                    onChange={(e) => setCalle(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-mono font-semibold text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
              </div>

              {almacenSelect === "CUSTOM" && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#0098f2] uppercase mb-1">Nombre del Almacén Personalizado</label>
                  <input
                    type="text"
                    value={customAlmacen}
                    onChange={(e) => setCustomAlmacen(e.target.value)}
                    placeholder="Ej: ALMACEN NORTE"
                    className="w-full bg-[#f7fafc] border-2 border-[#0098f2]/40 rounded-xl px-3 py-2 text-xs font-semibold text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
              )}

              {/* Fabricante y Marca */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Fabricante</label>
                  <input
                    type="text"
                    value={fabricante}
                    onChange={(e) => setFabricante(e.target.value)}
                    placeholder="Ej: Holmen, Stora Enso..."
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Marca / Tipo Papel</label>
                  <input
                    type="text"
                    value={marcaPapel}
                    onChange={(e) => setMarcaPapel(e.target.value)}
                    placeholder="Ej: Holmen UNIQ..."
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
              </div>

              {/* Ancho y Gramaje */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Tipo</label>
                  <select
                    value={tipoPapel}
                    onChange={(e) => setTipoPapel(e.target.value)}
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  >
                    <option value="Offset">Offset</option>
                    <option value="Satinado">Satinado</option>
                    <option value="Heatset">Heatset</option>
                    <option value="Prensa">Prensa</option>
                    <option value="Estucado">Estucado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Ancho (mm)</label>
                  <input
                    type="number"
                    value={anchoPapel}
                    onChange={(e) => setAnchoPapel(e.target.value)}
                    placeholder="Ej: 1450"
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-mono text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Gramaje (gsm)</label>
                  <input
                    type="number"
                    value={gramajePapel}
                    onChange={(e) => setGramajePapel(e.target.value)}
                    placeholder="Ej: 70"
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-mono text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  />
                </div>
              </div>

              {/* Certificación */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Certificación</label>
                  <select
                    value={certificacionTipo}
                    onChange={(e) => setCertificacionTipo(e.target.value)}
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                  >
                    <option value="SIN_CERTIFICACION">Sin Certificación</option>
                    <option value="PEFC">PEFC</option>
                    <option value="FSC">FSC</option>
                  </select>
                </div>
                {certificacionTipo !== "SIN_CERTIFICACION" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Código Licencia</label>
                    <input
                      type="text"
                      value={certificacionCodigo}
                      onChange={(e) => setCertificacionCodigo(e.target.value)}
                      placeholder="Ej: PEFC/14-38-00001"
                      className="w-full bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3 py-2 text-xs font-mono text-[#1e1e1e] focus:outline-none focus:border-[#0098f2]"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingAlbaran}
                  className="w-full acctual-btn-primary py-2.5 text-xs font-bold gap-2 shadow-sm justify-center"
                >
                  {savingAlbaran ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando Albarán...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{selectedAlbaranId ? "Actualizar Albarán" : "Crear y Activar Albarán"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Columna Derecha: Estación de Escaneo Láser / Cámara + Lista de Bobinas en Vivo (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Estación de Escaneo */}
          <div className="acctual-card p-5 sm:p-6 bg-white border border-[#ccd1da] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ccd1da]/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[rgba(0,152,242,0.1)] text-[#0098f2] flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1e1e1e]">Estación de Escaneo Láser & Cámara</h3>
                  <p className="text-[11px] text-[#666666]">
                    {activeAlbaran
                      ? `Asignando a Albarán N° ${activeAlbaran.numero_albaran} (${activeAlbaran.cliente?.nombre_empresa})`
                      : "Crea o selecciona un albarán para comenzar"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCameraOpen(true)}
                disabled={!selectedAlbaranId}
                className={`acctual-btn-secondary px-3.5 py-1.5 text-xs font-semibold gap-1.5 shadow-sm ${
                  !selectedAlbaranId ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title="Escanear código con la cámara de la tablet"
              >
                <Camera className="w-3.5 h-3.5 text-[#0098f2]" />
                <span>Escanear con Cámara</span>
              </button>
            </div>

            {/* Input para Pistola Láser */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!selectedAlbaranId}
                placeholder={
                  selectedAlbaranId
                    ? "Disparar pistola láser aquí o presionar Enter..."
                    : "Crea o selecciona un albarán primero para activar el escáner..."
                }
                className={`w-full font-mono text-sm py-3.5 pl-11 pr-24 rounded-xl border-2 transition focus:outline-none ${
                  selectedAlbaranId
                    ? "bg-[#f7fafc] border-[#0098f2]/40 text-[#1e1e1e] focus:border-[#0098f2] shadow-inner"
                    : "bg-[#f7fafc]/60 border-[#ccd1da] text-[#8d8d8d] cursor-not-allowed"
                }`}
              />
              <Zap className="w-5 h-5 text-[#0098f2] absolute left-3.5 top-3.5 pointer-events-none" />

              {selectedAlbaranId && (
                <span className="absolute right-3.5 top-3 text-[10px] uppercase font-semibold text-[#0098f2] bg-[rgba(0,152,242,0.1)] px-2 py-0.5 rounded-full border border-[rgba(0,152,242,0.2)]">
                  Láser Listo
                </span>
              )}
            </div>

            {/* Feedback de Escaneo */}
            {lastScanResult && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 animate-fade-in-up ${
                  lastScanResult.success
                    ? "bg-[rgba(93,156,6,0.1)] border border-[rgba(93,156,6,0.25)] text-[#5d9c06]"
                    : "bg-[rgba(255,99,99,0.1)] border border-[rgba(255,99,99,0.25)] text-[#ff6363]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {lastScanResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{lastScanResult.message}</span>
                </div>
                {lastScanResult.identificador && (
                  <span className="font-mono font-bold bg-white/80 px-2 py-0.5 rounded-lg border text-[#1e1e1e]">
                    {lastScanResult.identificador}
                  </span>
                )}
              </div>
            )}

            {/* Resumen de Métricas en Vivo */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da] text-center">
                <div className="text-[10px] uppercase font-semibold text-[#666666]">Total Bobinas</div>
                <div className="text-xl font-mono font-black text-[#1e1e1e]">{totalBobinas}</div>
              </div>
              <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da] text-center">
                <div className="text-[10px] uppercase font-semibold text-[#666666]">Peso Total (kg)</div>
                <div className="text-xl font-mono font-black text-[#0098f2]">
                  {totalPesoKg.toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-[#f7fafc] rounded-xl border border-[#ccd1da] text-center">
                <div className="text-[10px] uppercase font-semibold text-[#666666]">Toneladas</div>
                <div className="text-xl font-mono font-black text-[#5d9c06]">{totalToneladas} t</div>
              </div>
            </div>
          </div>

          {/* Tabla de Bobinas Escaneadas en Vivo */}
          <div className="acctual-card bg-white overflow-hidden border border-[#ccd1da]">
            <div className="p-4 border-b border-[#ccd1da]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#0098f2]" />
                <h3 className="text-sm font-bold text-[#1e1e1e]">Bobinas Escaneadas del Albarán</h3>
              </div>
              <span className="text-xs font-mono text-[#666666]">{totalBobinas} registradas</span>
            </div>

            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#f7fafc] z-10">
                  <tr className="text-[#666666] text-xs uppercase font-semibold border-b border-[#ccd1da]">
                    <th className="p-3 pl-4">#</th>
                    <th className="p-3">ID Bobina</th>
                    <th className="p-3">Peso (kg)</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ccd1da]/60 text-xs">
                  {bobinasList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#8d8d8d]">
                        {selectedAlbaranId
                          ? "No hay bobinas escaneadas aún. Dispara la pistola láser o usa la cámara."
                          : "Selecciona o crea un albarán para ver sus bobinas."}
                      </td>
                    </tr>
                  ) : (
                    bobinasList.map((b, idx) => (
                      <tr key={b.id || idx} className="hover:bg-[#f7fafc] transition-colors">
                        <td className="p-3 pl-4 font-mono text-[#8d8d8d]">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-[#1e1e1e]">{b.identificador_bobina}</td>
                        <td className="p-3">
                          {editingBobinaId === b.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editingPeso}
                                onChange={(e) => setEditingPeso(e.target.value)}
                                className="w-20 bg-white border border-[#0098f2] rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-[#1e1e1e]"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSavePesoInline(b.id)}
                                className="p-1 text-[#5d9c06] hover:bg-[rgba(93,156,6,0.1)] rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingBobinaId(null)}
                                className="p-1 text-[#666666] hover:bg-[#ccd1da]/30 rounded cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-[#1e1e1e]">
                              {b.peso_kg !== null ? `${b.peso_kg} kg` : "—"}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={
                              b.estado === "VERIFICADA"
                                ? "acctual-badge-verified text-[10px]"
                                : "acctual-badge-pending text-[10px]"
                            }
                          >
                            {b.estado}
                          </span>
                        </td>
                        <td className="p-3 text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingBobinaId(b.id);
                                setEditingPeso(b.peso_kg ? String(b.peso_kg) : "");
                              }}
                              title="Editar peso"
                              className="p-1.5 text-[#0098f2] hover:bg-[rgba(0,152,242,0.08)] rounded-lg transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBobina(b.id)}
                              title="Eliminar bobina"
                              className="p-1.5 text-[#ff6363] hover:bg-[rgba(255,99,99,0.08)] rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Cámara para Escaneo con Tablet */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanCode={(detectedCode: string) => {
          setIsCameraOpen(false);
          processScanCode(detectedCode);
        }}
      />

      {/* Modal para introducir peso manual tras escaneo no GS1 */}
      {pendingManualEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#ccd1da] max-w-sm w-full p-6 shadow-2xl space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-2.5 text-[#d48b00]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-[#1e1e1e]">Peso Requerido</h3>
            </div>
            <p className="text-xs text-[#666666]">
              La bobina <span className="font-mono font-bold text-[#1e1e1e]">{pendingManualEdit.identificador}</span> tiene un código estándar sin peso embebido. Introduce el peso en kg:
            </p>
            <form onSubmit={handleManualWeightSubmit} className="space-y-3">
              <input
                type="number"
                step="0.1"
                value={pendingManualEdit.pesoInput}
                onChange={(e) =>
                  setPendingManualEdit({ ...pendingManualEdit, pesoInput: e.target.value })
                }
                placeholder="Ej: 1450"
                autoFocus
                className="w-full bg-[#f7fafc] border border-[#0098f2] rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#1e1e1e] focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingManualEdit(null)}
                  className="acctual-btn-ghost px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="acctual-btn-primary px-4 py-1.5 text-xs font-bold"
                >
                  Guardar Peso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
