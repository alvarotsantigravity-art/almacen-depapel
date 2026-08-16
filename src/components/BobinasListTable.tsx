"use client";

import { useState } from "react";
import {
  Layers,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CheckCheck,
  Clock,
  Check,
  X,
} from "lucide-react";

interface Bobina {
  id: string;
  codigo_barras_raw: string;
  identificador_bobina: string;
  peso_kg: number | null;
  estado: string;
  fecha_escaneo: string;
}

interface BobinasListTableProps {
  activeAlbaranId: string | null;
  bobinas: Bobina[];
  onDeleteBobina: (id: string) => void;
  onUpdateBobina: (id: string, peso_kg: number, estado?: string) => void;
  onVerifyAllBobinas: () => void;
}

export function BobinasListTable({
  activeAlbaranId,
  bobinas,
  onDeleteBobina,
  onUpdateBobina,
  onVerifyAllBobinas,
}: BobinasListTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<string>("");

  const totalBobinas = bobinas.length;
  const verificadas = bobinas.filter((b) => b.estado === "VERIFICADA").length;
  const pendientes = totalBobinas - verificadas;
  const porcentajeVerificado = totalBobinas > 0 ? Math.round((verificadas / totalBobinas) * 100) : 0;

  const pesoTotalKg = bobinas.reduce((acc, b) => acc + (b.peso_kg || 0), 0);

  const handleStartEdit = (b: Bobina) => {
    setEditingId(b.id);
    setEditWeight(b.peso_kg ? b.peso_kg.toString() : "");
  };

  const handleSaveEdit = (id: string) => {
    const p = parseFloat(editWeight);
    if (!isNaN(p)) {
      onUpdateBobina(id, p, "VERIFICADA");
    }
    setEditingId(null);
  };

  // Detección de identificadores de bobinas duplicadas
  const countsMap = bobinas.reduce((acc, b) => {
    const cleanId = (b.identificador_bobina || "").replace(/[-_ ]/g, "").toUpperCase();
    if (cleanId) {
      acc[cleanId] = (acc[cleanId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const hasAnyDuplicates = Object.values(countsMap).some((count) => count > 1);

  return (
    <div className="acctual-card p-6 sm:p-7 flex flex-col flex-1 min-h-[380px] bg-white">
      {/* Resumen Superior y Barra de Progreso */}
      <div className="mb-6 border-b border-[#ccd1da]/60 pb-5">
        {/* Banner de Advertencia si existen duplicados */}
        {hasAnyDuplicates && (
          <div className="mb-4 p-3.5 bg-[rgba(255,99,99,0.08)] border border-[rgba(255,99,99,0.3)] rounded-xl flex items-center justify-between gap-3 text-[#ff6363] text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#ff6363] shrink-0" />
              <span>Atención: Se han detectado números de bobina repetidos en este albarán.</span>
            </div>
            <span className="px-2.5 py-0.5 bg-[#ff6363] text-white rounded-full text-[10px] font-bold uppercase tracking-wider">
              Duplicados
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#0098f2]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1e1e1e] tracking-tight">Bobinas del Albarán</h3>
              <p className="text-xs text-[#666666]">Extraídas del albarán de recepción y verificadas</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {pendientes > 0 && activeAlbaranId && (
              <button
                onClick={onVerifyAllBobinas}
                className="acctual-btn-secondary px-3.5 py-1.5 text-xs font-semibold gap-1.5 shadow-sm"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#0098f2]" />
                <span>Verificar Todas</span>
              </button>
            )}

            <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3.5 py-1.5 text-center">
              <div className="text-[10px] text-[#8d8d8d] uppercase font-semibold tracking-wider">Total Bobinas</div>
              <div className="text-base font-mono font-bold text-[#1e1e1e]">{totalBobinas}</div>
            </div>

            <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl px-3.5 py-1.5 text-center">
              <div className="text-[10px] text-[#8d8d8d] uppercase font-semibold tracking-wider">Peso Acumulado</div>
              <div className="text-base font-mono font-bold text-[#0098f2]">
                {pesoTotalKg.toLocaleString()} <span className="text-xs font-normal text-[#666666]">kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Progreso de Verificación Estilo Acctual */}
        {totalBobinas > 0 && (
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5 text-[#666666]">
              <span>Estado de Verificación:</span>
              <span className="font-mono text-[#0098f2] font-bold">
                {verificadas} / {totalBobinas} verificadas ({porcentajeVerificado}%)
              </span>
            </div>
            <div className="w-full bg-[#f0f4f8] rounded-full h-2 overflow-hidden border border-[#ccd1da]/60">
              <div
                className="bg-[#0098f2] h-full transition-all duration-500 rounded-full"
                style={{ width: `${porcentajeVerificado}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Bobinas Escaneadas / Extraídas */}
      <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[420px] rounded-xl border border-[#ccd1da] bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f7fafc] text-[#666666] text-xs uppercase font-semibold tracking-wider border-b border-[#ccd1da]">
              <th className="p-3.5 pl-5 w-12">#</th>
              <th className="p-3.5">ID Bobina</th>
              <th className="p-3.5">Peso (kg)</th>
              <th className="p-3.5">Estado</th>
              <th className="p-3.5 text-right pr-5">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ccd1da]/60 text-sm">
            {bobinas.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-12 text-[#8d8d8d] text-xs">
                  Carga un albarán PDF para extraer automáticamente todas las bobinas o utiliza la pistola/cámara.
                </td>
              </tr>
            ) : (
              bobinas.map((b, idx) => {
                const cleanId = (b.identificador_bobina || "").replace(/[-_ ]/g, "").toUpperCase();
                const isDuplicate = cleanId && countsMap[cleanId] > 1;

                return (
                  <tr
                    key={b.id}
                    className={`transition-colors ${
                      isDuplicate
                        ? "bg-[rgba(255,99,99,0.04)] hover:bg-[rgba(255,99,99,0.08)]"
                        : "hover:bg-[#f7fafc]"
                    }`}
                  >
                    <td className="p-3.5 pl-5 font-mono text-xs text-[#8d8d8d]">{idx + 1}</td>
                    <td className="p-3.5 font-mono font-semibold text-[#1e1e1e] tracking-tight">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{b.identificador_bobina}</span>
                        {isDuplicate && (
                          <span className="acctual-badge-duplicate text-[10px] py-0.5">
                            <AlertCircle className="w-3 h-3" /> Repetida ({countsMap[cleanId]})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono">
                      {editingId === b.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            className="w-24 bg-white border border-[#0098f2] rounded-lg px-2 py-1 text-[#1e1e1e] text-xs font-mono focus:outline-none ring-2 ring-[#0098f2]/20"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(b.id)}
                            className="p-1 bg-[#0d111b] text-white rounded-md text-xs cursor-pointer hover:bg-[#1e2538]"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-[#666666] hover:bg-[#f7fafc] rounded-md text-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : b.peso_kg !== null ? (
                        <span className="font-semibold text-[#1e1e1e]">{b.peso_kg} kg</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#ff6363] text-xs bg-[rgba(255,99,99,0.08)] px-2.5 py-0.5 rounded-full font-medium border border-[rgba(255,99,99,0.2)]">
                          <AlertCircle className="w-3 h-3" /> Sin Peso
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {b.estado === "VERIFICADA" ? (
                        <span className="acctual-badge-verified">
                          <CheckCircle2 className="w-3.5 h-3.5" /> VERIFICADA
                        </span>
                      ) : (
                        <span className="acctual-badge-pending">
                          <Clock className="w-3.5 h-3.5" /> PENDIENTE
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right pr-5">
                      <div className="flex items-center justify-end gap-1.5">
                        {b.estado !== "VERIFICADA" && (
                          <button
                            onClick={() => onUpdateBobina(b.id, b.peso_kg || 0, "VERIFICADA")}
                            title="Marcar como Verificada"
                            className="px-2.5 py-1 bg-[rgba(0,152,242,0.08)] hover:bg-[rgba(0,152,242,0.16)] text-[#0098f2] rounded-full text-xs font-semibold border border-[rgba(0,152,242,0.25)] transition flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verificar
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(b)}
                          title="Editar Peso"
                          className="p-1.5 text-[#666666] hover:text-[#1e1e1e] hover:bg-[#f7fafc] rounded-lg transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteBobina(b.id)}
                          title="Eliminar Bobina"
                          className="p-1.5 text-[#8d8d8d] hover:text-[#ff6363] hover:bg-[rgba(255,99,99,0.08)] rounded-lg transition cursor-pointer"
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
  );
}

