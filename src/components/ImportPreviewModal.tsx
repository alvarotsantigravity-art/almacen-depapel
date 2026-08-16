"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Building2,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  ShieldCheck,
  Maximize2,
  Loader2,
  AlertCircle,
  Eye,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

interface BobinaItemEdit {
  identificador_bobina: string;
  peso_kg: number | string;
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAlbaran: any) => void;
  ocrPayload: {
    ocrData: any;
    pdf_nombre: string;
    pdf_data?: string;
  } | null;
}

export function ImportPreviewModal({
  isOpen,
  onClose,
  onSuccess,
  ocrPayload,
}: ImportPreviewModalProps) {
  const [nombreCliente, setNombreCliente] = useState("");
  const [numeroAlbaran, setNumeroAlbaran] = useState("");
  const [fecha, setFecha] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [marcaPapel, setMarcaPapel] = useState("");
  const [tipoPapel, setTipoPapel] = useState("");
  const [anchoPapelMm, setAnchoPapelMm] = useState<number | string>("");
  const [gramajePapelGsm, setGramajePapelGsm] = useState<number | string>("");

  // Ubicación: Almacén y Calle
  const [almacen, setAlmacen] = useState("ROTOMADRID");
  const [isCustomAlmacen, setIsCustomAlmacen] = useState(false);
  const [customAlmacenInput, setCustomAlmacenInput] = useState("");
  const [knownAlmacenes, setKnownAlmacenes] = useState<string[]>(["ROTOMADRID"]);
  const [calle, setCalle] = useState("0");

  // Certificación FSC / PEFC
  const [certificacionTipo, setCertificacionTipo] = useState<"PEFC" | "FSC" | "SIN_CERTIFICACION">("SIN_CERTIFICACION");
  const [certificacionCodigo, setCertificacionCodigo] = useState("");
  const [certificacionPorcentaje, setCertificacionPorcentaje] = useState<number | string>("");

  // Bobinas extraídas
  const [bobinas, setBobinas] = useState<BobinaItemEdit[]>([]);

  // Clientes existentes para autocompletado
  const [existingClientes, setExistingClientes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isFullscreenDoc, setIsFullscreenDoc] = useState(false);

  // Estado del Blob URL para vista previa fiable de PDF
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ocrPayload?.pdf_data) {
      setPdfBlobUrl(null);
      return;
    }

    const dataUrl = ocrPayload.pdf_data;
    if (dataUrl.startsWith("data:image/")) {
      setPdfBlobUrl(dataUrl);
      return;
    }

    try {
      const base64Parts = dataUrl.split(",");
      const base64Data = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error("Error al convertir PDF base64 a Blob URL:", err);
      setPdfBlobUrl(dataUrl);
    }
  }, [ocrPayload]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/clientes")
        .then((res) => res.json())
        .then((data) => {
          if (data.clientes) {
            setExistingClientes(data.clientes.map((c: any) => c.nombre_empresa));
          }
        })
        .catch(() => {});

      fetch("/api/historico")
        .then((res) => res.json())
        .then((data) => {
          if (data.almacenes && Array.isArray(data.almacenes)) {
            setKnownAlmacenes(Array.from(new Set(["ROTOMADRID", ...data.almacenes])));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && ocrPayload?.ocrData) {
      const data = ocrPayload.ocrData;
      setNombreCliente(data.nombre_cliente || "");
      setNumeroAlbaran(data.numero_albaran || "");
      setFecha(data.fecha || new Date().toISOString().split("T")[0]);
      setFabricante(data.fabricante || "");
      setMarcaPapel(data.marca_papel || "");
      setTipoPapel(data.tipo_papel || "");
      setAnchoPapelMm(data.ancho_papel_mm || "");
      setGramajePapelGsm(data.gramaje_papel_gsm || "");

      // Almacén y Calle por defecto
      setAlmacen("ROTOMADRID");
      setIsCustomAlmacen(false);
      setCustomAlmacenInput("");
      setCalle("0");

      // Cargar Certificación
      if (data.certificacion_tipo === "PEFC" || data.certificacion_tipo === "FSC") {
        setCertificacionTipo(data.certificacion_tipo);
      } else {
        setCertificacionTipo("SIN_CERTIFICACION");
      }
      setCertificacionCodigo(data.certificacion_codigo || "");
      setCertificacionPorcentaje(data.certificacion_porcentaje || "");

      // Cargar Bobinas extraídas
      if (Array.isArray(data.bobinas)) {
        setBobinas(
          data.bobinas.map((b: any) => ({
            identificador_bobina: b.identificador_bobina || "",
            peso_kg: b.peso_kg !== undefined && b.peso_kg !== null ? b.peso_kg : "",
          }))
        );
      } else {
        setBobinas([]);
      }
      setError(null);
      setDuplicateWarning(null);
    }
  }, [isOpen, ocrPayload]);

  if (!isOpen || !ocrPayload) return null;

  const handleAddBobinaRow = () => {
    setBobinas([...bobinas, { identificador_bobina: "", peso_kg: "" }]);
  };

  const handleRemoveBobinaRow = (index: number) => {
    setBobinas(bobinas.filter((_, i) => i !== index));
  };

  const handleBobinaChange = (index: number, field: keyof BobinaItemEdit, value: string) => {
    const newBobinas = [...bobinas];
    newBobinas[index] = { ...newBobinas[index], [field]: value };
    setBobinas(newBobinas);
  };

  const handleConfirmSave = async (forceOverwrite = false, syncDrive = false) => {
    if (!nombreCliente.trim()) {
      setError("El nombre del cliente / empresa es obligatorio.");
      return;
    }
    if (!numeroAlbaran.trim()) {
      setError("El número de albarán es obligatorio.");
      return;
    }

    const finalAlmacen = isCustomAlmacen && customAlmacenInput.trim()
      ? customAlmacenInput.trim()
      : (almacen || "ROTOMADRID");
    const finalCalle = calle !== undefined && calle !== null && String(calle).trim() !== ""
      ? String(calle).trim()
      : "0";

    setSaving(true);
    setError(null);

    try {
      const payload = {
        nombre_cliente: nombreCliente.trim(),
        numero_albaran: numeroAlbaran.trim(),
        fecha: fecha || new Date().toISOString().split("T")[0],
        fabricante: fabricante.trim(),
        marca_papel: marcaPapel.trim(),
        tipo_papel: tipoPapel.trim(),
        ancho_papel_mm: parseFloat(String(anchoPapelMm)) || 0,
        gramaje_papel_gsm: parseFloat(String(gramajePapelGsm)) || 0,
        almacen: finalAlmacen,
        calle: finalCalle,
        certificacion_tipo: certificacionTipo,
        certificacion_codigo: certificacionCodigo.trim() || null,
        certificacion_porcentaje: parseFloat(String(certificacionPorcentaje)) || null,
        pdf_nombre: ocrPayload.pdf_nombre,
        pdf_data: ocrPayload.pdf_data,
        force_overwrite: forceOverwrite,
        sync_drive: syncDrive,
        drive_webhook_url: localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL") || "",
        bobinas: bobinas.map((b) => ({
          identificador_bobina: b.identificador_bobina.trim(),
          peso_kg: b.peso_kg !== "" && b.peso_kg !== null ? parseFloat(String(b.peso_kg)) : null,
        })),
      };

      const res = await fetch("/api/albaranes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409 || data.duplicate) {
        setDuplicateWarning(data.message || `El albarán N° ${numeroAlbaran} ya fue importado anteriormente.`);
        setSaving(false);
        return;
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || "Error al guardar el albarán.");
      }

      onSuccess(data.albaran);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error guardando albarán.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPdfNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#ccd1da] rounded-2xl p-6 sm:p-8 max-w-5xl w-full text-[#1e1e1e] shadow-2xl relative my-auto max-h-[92vh] flex flex-col animate-fade-in-up">
        {/* Encabezado */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#ccd1da]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#0098f2]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1e1e1e] tracking-tight">Revisión de Albarán Extraído</h2>
              <p className="text-xs text-[#666666]">Verifica y personaliza los datos antes de guardarlos</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#666666] hover:text-[#1e1e1e] hover:bg-[#f7fafc] rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Advertencia de Duplicado */}
        {duplicateWarning && (
          <div className="mb-4 p-4 bg-[rgba(245,166,35,0.08)] border border-[rgba(245,166,35,0.3)] rounded-xl flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#c97a00] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#c97a00] block text-sm">Albarán Duplicado Detectado</strong>
                <p className="text-[#666666] mt-0.5">{duplicateWarning}</p>
              </div>
            </div>
            <button
              onClick={() => handleConfirmSave(true, false)}
              className="px-3 py-1.5 bg-[#0d111b] hover:bg-[#1e2538] text-white font-semibold rounded-full text-xs shrink-0 cursor-pointer shadow-sm"
            >
              Sobrescribir
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 bg-[rgba(255,99,99,0.08)] border border-[rgba(255,99,99,0.3)] rounded-xl flex items-center gap-2.5 text-[#ff6363] text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Contenido en 2 Columnas: Visor PDF + Formulario */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-y-auto pr-1">
          {/* Columna Izquierda: Visor del PDF / Imagen */}
          <div className="lg:col-span-5 flex flex-col bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-3 min-h-[300px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#1e1e1e] flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[#0098f2]" /> Documento Original
              </span>
              <div className="flex items-center gap-2">
                {pdfBlobUrl && !pdfBlobUrl.startsWith("data:image/") && (
                  <button
                    onClick={handleOpenPdfNewTab}
                    className="text-xs font-semibold text-[#0098f2] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir PDF
                  </button>
                )}
                <button
                  onClick={() => setIsFullscreenDoc(true)}
                  className="text-xs text-[#666666] hover:text-[#1e1e1e] flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> Ampliar
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-lg border border-[#ccd1da] overflow-hidden flex items-center justify-center min-h-[320px]">
              {pdfBlobUrl ? (
                pdfBlobUrl.startsWith("data:image/") ? (
                  <img src={pdfBlobUrl} alt="Vista Previa" className="w-full h-full object-contain" />
                ) : (
                  <object data={pdfBlobUrl} type="application/pdf" className="w-full h-full border-0">
                    <div className="p-6 text-center text-[#666666]">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-[#0098f2]" />
                      <span className="text-xs font-semibold">{ocrPayload.pdf_nombre}</span>
                    </div>
                  </object>
                )
              ) : (
                <div className="p-6 text-center text-[#8d8d8d]">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-[#afb0b1]" />
                  <span className="text-xs">Sin archivo adjunto</span>
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Formulario de Metadatos y Bobinas */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Metadatos Generales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">
                  Cliente / Receptor *
                </label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  placeholder="Nombre de la empresa o cliente..."
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] font-semibold text-xs focus:outline-none"
                  list="clientes-list"
                />
                <datalist id="clientes-list">
                  {existingClientes.map((c, i) => (
                    <option key={i} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">N° Albarán *</label>
                <input
                  type="text"
                  value={numeroAlbaran}
                  onChange={(e) => setNumeroAlbaran(e.target.value)}
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] font-mono text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Fabricante</label>
                <input
                  type="text"
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] text-xs focus:outline-none"
                />
              </div>

              {/* Ubicación: Almacén */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-[#666666] uppercase">
                    Almacén *
                  </label>
                  {isCustomAlmacen && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomAlmacen(false);
                        setAlmacen("ROTOMADRID");
                      }}
                      className="text-[10px] text-[#0098f2] hover:underline cursor-pointer"
                    >
                      Elegir de lista
                    </button>
                  )}
                </div>
                {isCustomAlmacen ? (
                  <input
                    type="text"
                    value={customAlmacenInput}
                    onChange={(e) => setCustomAlmacenInput(e.target.value)}
                    placeholder="Escribe nuevo almacén..."
                    autoFocus
                    className="w-full bg-[#f7fafc] border border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] font-semibold text-xs focus:outline-none shadow-xs"
                  />
                ) : (
                  <select
                    value={almacen}
                    onChange={(e) => {
                      if (e.target.value === "+_CUSTOM_+") {
                        setIsCustomAlmacen(true);
                        setCustomAlmacenInput("");
                      } else {
                        setAlmacen(e.target.value);
                      }
                    }}
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] font-semibold text-xs focus:outline-none"
                  >
                    {knownAlmacenes.map((alm, idx) => (
                      <option key={idx} value={alm}>
                        {alm}
                      </option>
                    ))}
                    <option value="+_CUSTOM_+">+ Añadir nuevo almacén...</option>
                  </select>
                )}
              </div>

              {/* Ubicación: Calle */}
              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">
                  Calle / Ubicación *
                </label>
                <input
                  type="text"
                  value={calle}
                  onChange={(e) => setCalle(e.target.value)}
                  placeholder="0 (o Calle 1, 2, A...)"
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] font-mono text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Marca / Tipo</label>
                <input
                  type="text"
                  value={marcaPapel}
                  onChange={(e) => setMarcaPapel(e.target.value)}
                  placeholder="Ej: LWC, Offset..."
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Ancho (mm)</label>
                <input
                  type="number"
                  value={anchoPapelMm}
                  onChange={(e) => setAnchoPapelMm(e.target.value)}
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Gramaje (gsm)</label>
                <input
                  type="number"
                  value={gramajePapelGsm}
                  onChange={(e) => setGramajePapelGsm(e.target.value)}
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] font-mono text-xs focus:outline-none"
                />
              </div>

              {/* Certificación */}
              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Certificación</label>
                <select
                  value={certificacionTipo}
                  onChange={(e: any) => setCertificacionTipo(e.target.value)}
                  className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] text-xs font-semibold focus:outline-none"
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
                    placeholder="Ej: PEFC/14-38-00..."
                    className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-[#1e1e1e] text-xs font-mono focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Tabla de Bobinas Extraídas */}
            <div className="border-t border-[#ccd1da]/60 pt-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#1e1e1e] uppercase tracking-wider">
                  Bobinas Extraídas ({bobinas.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddBobinaRow}
                  className="acctual-btn-secondary px-2.5 py-1 text-xs font-semibold gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#0098f2]" /> Añadir Fila
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-[#ccd1da] bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f7fafc] text-[#666666] font-semibold border-b border-[#ccd1da]">
                      <th className="p-2.5 pl-3 w-8">#</th>
                      <th className="p-2.5">ID Bobina</th>
                      <th className="p-2.5">Peso (kg)</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ccd1da]/60">
                    {bobinas.map((b, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 pl-3 font-mono text-[#8d8d8d]">{idx + 1}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={b.identificador_bobina}
                            onChange={(e) => handleBobinaChange(idx, "identificador_bobina", e.target.value)}
                            className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-lg px-2 py-1 text-xs font-mono font-semibold text-[#1e1e1e] focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.1"
                            value={b.peso_kg}
                            onChange={(e) => handleBobinaChange(idx, "peso_kg", e.target.value)}
                            placeholder="kg..."
                            className="w-24 bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-lg px-2 py-1 text-xs font-mono text-[#1e1e1e] focus:outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBobinaRow(idx)}
                            className="p-1 text-[#8d8d8d] hover:text-[#ff6363] rounded-md transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#ccd1da]/60 mt-4">
          <button
            onClick={onClose}
            className="acctual-btn-ghost px-4 py-2 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleConfirmSave(false, false)}
            disabled={saving}
            className="acctual-btn-primary px-6 py-2 text-xs font-semibold gap-2 shadow-sm"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-[#0098f2]" />}
            <span>{saving ? "Guardando..." : "Confirmar y Guardar Albarán"}</span>
          </button>
        </div>
      </div>

      {/* Modal Fullscreen del Documento */}
      {isFullscreenDoc && pdfBlobUrl && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex flex-col p-4 sm:p-6">
          <div className="flex justify-between items-center mb-3 text-white">
            <span className="text-sm font-semibold">{ocrPayload.pdf_nombre}</span>
            <button
              onClick={() => setIsFullscreenDoc(false)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full cursor-pointer transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 w-full h-full rounded-2xl overflow-hidden bg-white">
            {pdfBlobUrl.startsWith("data:image/") ? (
              <img src={pdfBlobUrl} alt="Full Doc" className="w-full h-full object-contain" />
            ) : (
              <iframe src={pdfBlobUrl} title="Full Doc" className="w-full h-full border-0" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
