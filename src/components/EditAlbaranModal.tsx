"use client";

import { useState, useEffect } from "react";
import {
  X,
  Pencil,
  Plus,
  Trash2,
  Save,
  Loader2,
  Building2,
  FileText,
  Layers,
  Scale,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { ExportAlbaran, ExportBobina } from "@/lib/exportService";

interface EditAlbaranModalProps {
  isOpen: boolean;
  albaran: ExportAlbaran | null;
  clientesList: { id: string; nombre_empresa: string }[];
  almacenesList: string[];
  onClose: () => void;
  onSaveSuccess: (updatedAlbaran: ExportAlbaran, message: string) => void;
}

export function EditAlbaranModal({
  isOpen,
  albaran,
  clientesList,
  almacenesList,
  onClose,
  onSaveSuccess,
}: EditAlbaranModalProps) {
  const [nombreCliente, setNombreCliente] = useState("");
  const [isCustomCliente, setIsCustomCliente] = useState(false);
  const [numeroAlbaran, setNumeroAlbaran] = useState("");
  const [fecha, setFecha] = useState("");
  const [almacen, setAlmacen] = useState("ROTOMADRID");
  const [calle, setCalle] = useState("0");
  const [fabricante, setFabricante] = useState("");
  const [marcaPapel, setMarcaPapel] = useState("");
  const [tipoPapel, setTipoPapel] = useState("Offset");
  const [anchoPapelMm, setAnchoPapelMm] = useState<string | number>("");
  const [gramajePapelGsm, setGramajePapelGsm] = useState<string | number>("");
  const [certificacionTipo, setCertificacionTipo] = useState("SIN_CERTIFICACION");
  const [certificacionCodigo, setCertificacionCodigo] = useState("");
  const [certificacionPorcentaje, setCertificacionPorcentaje] = useState<string | number>("");
  const [bobinas, setBobinas] = useState<ExportBobina[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (albaran) {
      const clientName = albaran.cliente?.nombre_empresa || "";
      setNombreCliente(clientName);
      setIsCustomCliente(!clientesList.some((c) => c.nombre_empresa.toLowerCase() === clientName.toLowerCase()));
      setNumeroAlbaran(albaran.numero_albaran || "");
      setFecha(albaran.fecha ? albaran.fecha.split("T")[0] : new Date().toISOString().split("T")[0]);
      setAlmacen(albaran.almacen || "ROTOMADRID");
      setCalle(albaran.calle !== undefined && albaran.calle !== null ? String(albaran.calle) : "0");
      setFabricante(albaran.fabricante || "");
      setMarcaPapel(albaran.marca_papel || "");
      setTipoPapel(albaran.tipo_papel || "Offset");
      setAnchoPapelMm(albaran.ancho_papel_mm ?? "");
      setGramajePapelGsm(albaran.gramaje_papel_gsm ?? "");
      setCertificacionTipo(albaran.certificacion_tipo || "SIN_CERTIFICACION");
      setCertificacionCodigo(albaran.certificacion_codigo || "");
      setCertificacionPorcentaje(albaran.certificacion_porcentaje ?? "");
      setBobinas(
        Array.isArray(albaran.bobinas)
          ? albaran.bobinas.map((b) => ({
              id: b.id,
              identificador_bobina: b.identificador_bobina || "",
              peso_kg: b.peso_kg ?? null,
              estado: b.estado || "VERIFICADA",
              fecha_escaneo: b.fecha_escaneo || new Date().toISOString(),
            }))
          : []
      );
      setErrorMsg(null);
    }
  }, [albaran, clientesList, isOpen]);

  if (!isOpen || !albaran) return null;

  const handleAddBobina = () => {
    setBobinas((prev) => [
      ...prev,
      {
        identificador_bobina: "",
        peso_kg: null,
        estado: "VERIFICADA",
        fecha_escaneo: new Date().toISOString(),
      },
    ]);
  };

  const handleRemoveBobina = (index: number) => {
    setBobinas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBobinaChange = (index: number, field: keyof ExportBobina, value: any) => {
    setBobinas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const totalPesoCalculado = bobinas.reduce((acc, b) => acc + (Number(b.peso_kg) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCliente.trim()) {
      setErrorMsg("El nombre del cliente no puede estar vacío.");
      return;
    }
    if (!numeroAlbaran.trim()) {
      setErrorMsg("El número de albarán es obligatorio.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        id: albaran.id,
        nombre_cliente: nombreCliente.trim(),
        numero_albaran: numeroAlbaran.trim(),
        fecha: fecha || new Date().toISOString().split("T")[0],
        almacen: almacen.trim() || "ROTOMADRID",
        calle: calle.trim() || "0",
        fabricante: fabricante.trim() || "Fabricante Desconocido",
        marca_papel: marcaPapel.trim() || "Estándar",
        tipo_papel: tipoPapel.trim() || "Offset",
        ancho_papel_mm: parseFloat(String(anchoPapelMm)) || 0,
        gramaje_papel_gsm: parseFloat(String(gramajePapelGsm)) || 0,
        certificacion_tipo: certificacionTipo,
        certificacion_codigo: certificacionCodigo.trim() || null,
        certificacion_porcentaje: certificacionPorcentaje !== "" ? parseFloat(String(certificacionPorcentaje)) : null,
        drive_webhook_url: (typeof window !== "undefined" ? localStorage.getItem("GOOGLE_DRIVE_WEBHOOK_URL") : "") || "",
        bobinas: bobinas.map((b) => ({
          identificador_bobina: String(b.identificador_bobina || "").replace(/[-_ ]/g, "").trim(),
          peso_kg: b.peso_kg !== null && b.peso_kg !== undefined && !isNaN(Number(b.peso_kg)) ? Number(b.peso_kg) : null,
          estado: b.estado || "VERIFICADA",
        })),
        sync_to_drive: true,
      };

      const res = await fetch("/api/albaranes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Error al actualizar los datos del albarán.");
      }

      onSaveSuccess(data.albaran, data.message || "¡Albarán actualizado con éxito!");
      onClose();
    } catch (err: any) {
      console.error("Error guardando cambios del albarán:", err);
      setErrorMsg(err.message || "Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-[#ccd1da] rounded-2xl p-6 sm:p-8 max-w-4xl w-full text-[#1e1e1e] shadow-2xl relative my-auto max-h-[92vh] flex flex-col animate-fade-in-up">
        {/* Botón de Cierre Superior */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#666666] hover:text-[#1e1e1e] p-1.5 rounded-full hover:bg-[#f7fafc] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado del Modal */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#ccd1da]/60">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Pencil className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1e1e1e] tracking-tight">Personalizar Albarán</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100/70 text-amber-800 border border-amber-300">
                N° {albaran.numero_albaran}
              </span>
            </div>
            <p className="text-xs text-[#666666]">
              Modifica cualquier dato registrado (Cliente, Ubicación, Especificaciones o Bobinas).
            </p>
          </div>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(255,99,99,0.08)] border border-[rgba(255,99,99,0.3)] flex items-center gap-2.5 text-xs text-[#ff6363] font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* SECCIÓN 1: Datos Generales */}
          <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1e1e1e] border-b border-[#ccd1da]/60 pb-2">
              <FileText className="w-4 h-4 text-[#0098f2]" />
              <span>1. Datos Generales del Albarán</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Cliente */}
              <div className="sm:col-span-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-[#666666] uppercase">Cliente</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCliente(!isCustomCliente)}
                    className="text-[10px] text-[#0098f2] hover:underline font-semibold"
                  >
                    {isCustomCliente ? "Elegir de lista" : "+ Escribir nuevo"}
                  </button>
                </div>

                {isCustomCliente ? (
                  <input
                    type="text"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    placeholder="Escribe el nombre del cliente..."
                    required
                    className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none shadow-xs"
                  />
                ) : (
                  <select
                    value={nombreCliente}
                    onChange={(e) => {
                      if (e.target.value === "__NEW__") {
                        setIsCustomCliente(true);
                        setNombreCliente("");
                      } else {
                        setNombreCliente(e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none shadow-xs"
                  >
                    <option value="">Selecciona un cliente...</option>
                    {clientesList.map((c) => (
                      <option key={c.id} value={c.nombre_empresa}>
                        {c.nombre_empresa}
                      </option>
                    ))}
                    <option value="__NEW__">+ Nuevo Cliente...</option>
                  </select>
                )}
              </div>

              {/* N° Albarán */}
              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">N° Albarán</label>
                <input
                  type="text"
                  value={numeroAlbaran}
                  onChange={(e) => setNumeroAlbaran(e.target.value)}
                  required
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Fecha Albarán</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Ubicación en Almacén */}
          <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1e1e1e] border-b border-[#ccd1da]/60 pb-2">
              <MapPin className="w-4 h-4 text-[#0098f2]" />
              <span>2. Ubicación en Almacén</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Almacén</label>
                <input
                  type="text"
                  value={almacen}
                  onChange={(e) => setAlmacen(e.target.value)}
                  placeholder="Ej: ROTOMADRID..."
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Calle / Pasillo</label>
                <input
                  type="text"
                  value={calle}
                  onChange={(e) => setCalle(e.target.value)}
                  placeholder="Ej: 0, A-12, Calle 4..."
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-mono font-medium text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Especificaciones de Papel */}
          <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1e1e1e] border-b border-[#ccd1da]/60 pb-2">
              <Layers className="w-4 h-4 text-[#0098f2]" />
              <span>3. Especificaciones del Papel</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Fabricante</label>
                <input
                  type="text"
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  placeholder="Ej: Torraspapel..."
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Marca Papel</label>
                <input
                  type="text"
                  value={marcaPapel}
                  onChange={(e) => setMarcaPapel(e.target.value)}
                  placeholder="Ej: Coral Book..."
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Tipo Papel</label>
                <input
                  type="text"
                  value={tipoPapel}
                  onChange={(e) => setTipoPapel(e.target.value)}
                  placeholder="Ej: Offset, Estucado..."
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Ancho (mm)</label>
                <input
                  type="number"
                  step="any"
                  value={anchoPapelMm}
                  onChange={(e) => setAnchoPapelMm(e.target.value)}
                  placeholder="Ej: 1450"
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-mono text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Gramaje (gsm)</label>
                <input
                  type="number"
                  step="any"
                  value={gramajePapelGsm}
                  onChange={(e) => setGramajePapelGsm(e.target.value)}
                  placeholder="Ej: 70"
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-mono text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Certificación */}
          <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1e1e1e] border-b border-[#ccd1da]/60 pb-2">
              <ShieldCheck className="w-4 h-4 text-[#0098f2]" />
              <span>4. Certificación Forestal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Tipo Certificación</label>
                <select
                  value={certificacionTipo}
                  onChange={(e) => setCertificacionTipo(e.target.value)}
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-medium text-[#1e1e1e] focus:outline-none shadow-xs"
                >
                  <option value="SIN_CERTIFICACION">Sin Certificación</option>
                  <option value="PEFC">PEFC</option>
                  <option value="FSC">FSC</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">Código Licencia</label>
                <input
                  type="text"
                  value={certificacionCodigo}
                  onChange={(e) => setCertificacionCodigo(e.target.value)}
                  placeholder="Ej: PEFC/14-38-00001"
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-mono text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#666666] uppercase mb-1">% Certificado</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={certificacionPorcentaje}
                  onChange={(e) => setCertificacionPorcentaje(e.target.value)}
                  placeholder="Ej: 100"
                  className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-3 py-2 text-xs font-mono text-[#1e1e1e] focus:outline-none shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 5: Lista de Bobinas */}
          <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#ccd1da]/60 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#1e1e1e]">
                <Scale className="w-4 h-4 text-[#0098f2]" />
                <span>5. Bobinas del Albarán ({bobinas.length})</span>
              </div>

              <button
                type="button"
                onClick={handleAddBobina}
                className="acctual-btn-secondary px-3 py-1.5 text-xs font-semibold gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#0098f2]" />
                <span>Añadir Bobina</span>
              </button>
            </div>

            {bobinas.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-[#ccd1da] rounded-xl text-xs text-[#8d8d8d]">
                No hay bobinas asignadas. Haz clic en "Añadir Bobina" para registrar una.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#ccd1da] bg-white">
                <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                  <thead>
                    <tr className="bg-[#f7fafc] text-[#666666] font-semibold border-b border-[#ccd1da]">
                      <th className="p-2.5 pl-3 w-10">#</th>
                      <th className="p-2.5 min-w-[200px]">ID Bobina (Sin Guiones)</th>
                      <th className="p-2.5 w-32">Peso (kg)</th>
                      <th className="p-2.5 w-36">Estado</th>
                      <th className="p-2.5 w-14 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ccd1da]/60">
                    {bobinas.map((b, idx) => (
                      <tr key={idx} className="hover:bg-[#f7fafc]/70">
                        <td className="p-2.5 pl-3 font-mono text-[#8d8d8d]">{idx + 1}</td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={b.identificador_bobina}
                            onChange={(e) => handleBobinaChange(idx, "identificador_bobina", e.target.value)}
                            onBlur={(e) =>
                              handleBobinaChange(idx, "identificador_bobina", e.target.value.replace(/[-_ ]/g, "").trim())
                            }
                            placeholder="Identificador alfanumérico..."
                            required
                            className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-[#1e1e1e] focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="any"
                            value={b.peso_kg ?? ""}
                            onChange={(e) => handleBobinaChange(idx, "peso_kg", e.target.value)}
                            placeholder="Ej: 485.5"
                            className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#1e1e1e] focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5">
                          <select
                            value={b.estado}
                            onChange={(e) => handleBobinaChange(idx, "estado", e.target.value)}
                            className="w-full bg-[#f7fafc] border border-[#ccd1da] focus:border-[#0098f2] rounded-lg px-2 py-1.5 text-xs font-medium text-[#1e1e1e] focus:outline-none"
                          >
                            <option value="VERIFICADA">VERIFICADA</option>
                            <option value="PENDIENTE DE VERIFICACIÓN">PENDIENTE</option>
                            <option value="DAÑADA">DAÑADA</option>
                            <option value="CONSUMIDA">CONSUMIDA</option>
                          </select>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBobina(idx)}
                            title="Eliminar Bobina"
                            className="p-1.5 text-[#ff6363] hover:bg-[rgba(255,99,99,0.08)] rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Resumen Total Bobinas */}
            <div className="flex items-center justify-between text-xs text-[#666666] pt-1 font-medium">
              <div>Total Bobinas: <span className="font-bold text-[#1e1e1e]">{bobinas.length}</span></div>
              <div>Peso Total Calculado: <span className="font-bold font-mono text-[#0098f2]">{totalPesoCalculado.toLocaleString()} kg</span></div>
            </div>
          </div>

          {/* Botones de Acción Inferiores */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#ccd1da]/60">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="acctual-btn-ghost px-4 py-2 text-xs font-semibold"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="acctual-btn-primary px-5 py-2 text-xs font-semibold gap-1.5 shadow-sm cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0098f2]" />
                  <span>Guardando Cambios...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-[#0098f2]" />
                  <span>Guardar Modificaciones</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
