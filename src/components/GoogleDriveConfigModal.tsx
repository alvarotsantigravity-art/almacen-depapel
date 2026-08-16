"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Cloud,
  CheckCircle2,
  X,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { normalizeWebhookUrl } from "@/lib/googleDriveService";

interface GoogleDriveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookUrl: string;
  onSaveWebhookUrl: (url: string) => void;
}

const APPS_SCRIPT_CODE = `/**
 * SERVICIO GOOGLE APPS SCRIPT - ALMACÉN DE PAPEL
 * BD: BD_Almacen_Papel | Carpeta PDFs: ALBARANES PDF
 * 
 * MAPEO DE COLUMNAS EXACTO (18 COLUMNAS: A - R):
 * Col A (1):  Fecha Registro
 * Col B (2):  Cliente
 * Col C (3):  N° Albarán (Click PDF)
 * Col D (4):  Fecha Albarán
 * Col E (5):  Fabricante
 * Col F (6):  Marca Papel
 * Col G (7):  Tipo Papel
 * Col H (8):  Ancho (mm)
 * Col I (9):  Gramaje (gsm)
 * Col J (10): Certificación
 * Col K (11): Código Licencia
 * Col L (12): % Certificado
 * Col M (13): ID Bobina (Sin Guiones)
 * Col N (14): Peso Bobina (kg)
 * Col O (15): Estado Bobina
 * Col P (16): Total Bobinas Albarán
 * Col Q (17): Almacén
 * Col R (18): Calle
 */
const SHEET_NAME_MASTER = "BD_Almacen_Papel";
const FOLDER_NAME_PDFS = "ALBARANES PDF";

/**
 * Función principal de inicialización de la hoja de cálculo y carpetas.
 * Puedes ejecutar esta función manualmente en el editor de Google Apps Script.
 */
function setupDatabase() {
  var files = DriveApp.getFilesByName(SHEET_NAME_MASTER);
  var spreadsheet = files.hasNext() ? SpreadsheetApp.open(files.next()) : SpreadsheetApp.create(SHEET_NAME_MASTER);

  getOrCreateFolder(FOLDER_NAME_PDFS);

  var sheetAlbaranes = spreadsheet.getSheetByName("Albaranes") || spreadsheet.insertSheet("Albaranes");
  updateHeaders(sheetAlbaranes);

  var sheetBobinas = spreadsheet.getSheetByName("Bobinas");
  if (sheetBobinas && spreadsheet.getSheets().length > 1) {
    spreadsheet.deleteSheet(sheetBobinas);
  }

  var defaultSheet = spreadsheet.getSheetByName("Hoja 1") || spreadsheet.getSheetByName("Sheet1");
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    spreadsheet.deleteSheet(defaultSheet);
  }

  Logger.log("Base de datos lista en: " + spreadsheet.getUrl());
  return spreadsheet.getUrl();
}

function getOrCreateFolder(folderName) {
  var name = (typeof folderName === "string" && folderName.trim()) ? folderName.trim() : FOLDER_NAME_PDFS;
  try {
    var folders = DriveApp.getFoldersByName(name);
    if (folders.hasNext()) {
      return folders.next();
    }
    return DriveApp.createFolder(name);
  } catch (e) {
    return DriveApp.getRootFolder();
  }
}

function updateHeaders(sheetAlbaranes) {
  if (!sheetAlbaranes) return;
  var headers = [
    "Fecha Registro",
    "Cliente",
    "N° Albarán (Click PDF)",
    "Fecha Albarán",
    "Fabricante",
    "Marca Papel",
    "Tipo Papel",
    "Ancho (mm)",
    "Gramaje (gsm)",
    "Certificación",
    "Código Licencia",
    "% Certificado",
    "ID Bobina (Sin Guiones)",
    "Peso Bobina (kg)",
    "Estado Bobina",
    "Total Bobinas Albarán",
    "Almacén",
    "Calle"
  ];
  sheetAlbaranes.getRange(1, 1, 1, 18).setValues([headers]);
  sheetAlbaranes.getRange(1, 1, 1, 18).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");

  // Limpiar cualquier encabezado residual sobrante en columnas posteriores (ej. col 19, 20)
  var lastCol = sheetAlbaranes.getLastColumn();
  if (lastCol > 18) {
    sheetAlbaranes.getRange(1, 19, 1, lastCol - 18).clearContent().setBackground(null);
  }
}

function extractAlbaranNumber(cellVal) {
  if (cellVal === null || cellVal === undefined) return "";
  var str = String(cellVal).trim();
  if (!str) return "";
  var match = str.match(/,\\s*"([^"]+)"\\s*\\)$/) || str.match(/;\\s*"([^"]+)"\\s*\\)$/) || str.match(/"([^"]+)"/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return str;
}

function doGet(e) {
  try {
    var files = DriveApp.getFilesByName(SHEET_NAME_MASTER);
    if (!files.hasNext()) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, albaranes: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var spreadsheet = SpreadsheetApp.open(files.next());
    var sheetAlbaranes = spreadsheet.getSheetByName("Albaranes") || spreadsheet.getSheets()[0];

    var albRows = sheetAlbaranes ? sheetAlbaranes.getDataRange().getValues() : [];
    var albaranesMap = {};

    for (var i = 1; i < albRows.length; i++) {
      var r = albRows[i];
      var numAlbaran = extractAlbaranNumber(r[2]) || extractAlbaranNumber(r[3]);

      if (!numAlbaran || !String(r[1] || "").trim()) continue;

      var certTipo = String(r[9] || "SIN_CERTIFICACION");
      if (certTipo.includes("PEFC")) certTipo = "PEFC";
      else if (certTipo.includes("FSC")) certTipo = "FSC";
      else certTipo = "SIN_CERTIFICACION";

      // Almacén: Col Q (índice 16), con fallback a Col S (índice 18) si existía formato previo
      var almacenVal = String(r[16] || r[18] || "ROTOMADRID").trim();

      // Calle: Col R (índice 17), con fallback a Col T (índice 19) si existía formato previo
      var rawCalle = (r[17] !== undefined && r[17] !== null && String(r[17]).trim() !== "")
        ? r[17]
        : (r[19] !== undefined && r[19] !== null && String(r[19]).trim() !== "" ? r[19] : "0");
      var calleVal = String(rawCalle).trim();

      if (!albaranesMap[numAlbaran]) {
        albaranesMap[numAlbaran] = {
          numero_albaran: numAlbaran,
          fecha: String(r[3] || "").split("T")[0],
          nombre_cliente: String(r[1] || "Cliente Genérico"),
          fabricante: String(r[4] || "Fabricante Desconocido"),
          marca_papel: String(r[5] || "Estándar"),
          tipo_papel: String(r[6] || "Offset"),
          ancho_papel_mm: parseFloat(r[7]) || 0,
          gramaje_papel_gsm: parseFloat(r[8]) || 0,
          certificacion_tipo: certTipo,
          certificacion_codigo: String(r[10] || "") || null,
          certificacion_porcentaje: parseFloat(r[11]) || null,
          almacen: almacenVal || "ROTOMADRID",
          calle: calleVal || "0",
          pdf_nombre: "Albaran_" + numAlbaran + ".pdf",
          bobinas: []
        };
      }

      var idBobina = String(r[12] || "").replace(/[-_ ]/g, "").trim();
      var pesoKg = parseFloat(r[13]);
      if (idBobina && idBobina !== "Sin Bobinas") {
        albaranesMap[numAlbaran].bobinas.push({
          identificador_bobina: idBobina,
          peso_kg: isNaN(pesoKg) ? null : pesoKg,
          estado: String(r[14] || "VERIFICADA")
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      albaranes: Object.values(albaranesMap)
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var files = DriveApp.getFilesByName(SHEET_NAME_MASTER);
    var spreadsheet;

    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.open(files.next());
    } else {
      setupDatabase();
      spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName(SHEET_NAME_MASTER).next());
    }

    var sheetAlbaranes = spreadsheet.getSheetByName("Albaranes");
    if (!sheetAlbaranes) {
      setupDatabase();
      spreadsheet = SpreadsheetApp.open(DriveApp.getFilesByName(SHEET_NAME_MASTER).next());
      sheetAlbaranes = spreadsheet.getSheetByName("Albaranes") || spreadsheet.getSheets()[0];
    }

    updateHeaders(sheetAlbaranes);

    var numAlbaran = String(data.numero_albaran || "").trim();
    if (!numAlbaran) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Número de albarán no especificado."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var clienteNombre = String(data.nombre_cliente || "").trim();

    // BUSCAR FILAS EXISTENTES DEL MISMO ALBARÁN
    var dataRange = sheetAlbaranes.getDataRange().getValues();
    var matchingRowIndices = [];

    for (var i = 1; i < dataRange.length; i++) {
      var cellValC = extractAlbaranNumber(dataRange[i][2]);
      var cellValD = extractAlbaranNumber(dataRange[i][3]);

      if ((cellValC && cellValC.toUpperCase() === numAlbaran.toUpperCase()) ||
          (cellValD && cellValD.toUpperCase() === numAlbaran.toUpperCase())) {
        matchingRowIndices.push(i + 1);
      }
    }

    // SI YA EXISTÍA ESTE ALBARÁN: BORRAR SUS FILAS ANTERIORES
    if (matchingRowIndices.length > 0) {
      for (var k = matchingRowIndices.length - 1; k >= 0; k--) {
        sheetAlbaranes.deleteRow(matchingRowIndices[k]);
      }
    }

    // SI LA ACCIÓN SOLICITADA ES BORRAR: FINALIZAR TRAS ELIMINAR LAS FILAS
    if (data.action === "delete") {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "¡Albarán N° " + numAlbaran + " eliminado exitosamente de Google Drive!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ALMACENAR EL PDF EN LA CARPETA 'ALBARANES PDF' Y OBTENER HIPERVÍNCULO
    var pdfUrl = "";
    var pdfFileName = data.pdf_nombre || ("Albaran_" + numAlbaran + ".pdf");

    if (data.pdf_data && data.pdf_data.indexOf("data:") === 0) {
      try {
        var pdfFolder = getOrCreateFolder(FOLDER_NAME_PDFS);
        var base64Parts = data.pdf_data.split(",");
        var mimeType = base64Parts[0].split(":")[1].split(";")[0];
        var bytes = Utilities.base64Decode(base64Parts[1]);
        var blob = Utilities.newBlob(bytes, mimeType, pdfFileName);
        
        var pdfFile = pdfFolder.createFile(blob);
        pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        pdfUrl = pdfFile.getUrl();
      } catch (errPdf) {
        Logger.log("Error guardando archivo PDF: " + errPdf);
      }
    }

    var now = new Date().toLocaleString();
    var certTexto = data.certificacion_tipo && data.certificacion_tipo !== "SIN_CERTIFICACION"
      ? data.certificacion_tipo
      : "Sin Certificación";

    var albaranCellVal = pdfUrl ? '=HYPERLINK("' + pdfUrl + '", "' + numAlbaran + '")' : numAlbaran;

    var bobinasList = Array.isArray(data.bobinas) && data.bobinas.length > 0
      ? data.bobinas
      : [{ identificador_bobina: "Sin Bobinas", peso_kg: 0, estado: "N/A" }];

    var totalBobinas = bobinasList.length;

    // ESCRIBIR LAS FILAS DE BOBINAS ACTUALIZADAS (COLUMNAS A hasta R, 18 COLUMNAS EXACTAS)
    bobinasList.forEach(function(b) {
      var idLimpio = String(b.identificador_bobina || "").replace(/[-_ ]/g, "").trim();
      var pesoVal = b.peso_kg !== null && b.peso_kg !== undefined ? b.peso_kg : "";

      sheetAlbaranes.appendRow([
        now,                                                                        // Col A (1):  Fecha Registro
        clienteNombre,                                                              // Col B (2):  Cliente
        albaranCellVal,                                                             // Col C (3):  N° Albarán (Click PDF)
        data.fecha || "",                                                           // Col D (4):  Fecha Albarán
        data.fabricante || "",                                                      // Col E (5):  Fabricante
        data.marca_papel || "",                                                     // Col F (6):  Marca Papel
        data.tipo_papel || "",                                                      // Col G (7):  Tipo Papel
        data.ancho_papel_mm || 0,                                                   // Col H (8):  Ancho (mm)
        data.gramaje_papel_gsm || 0,                                                // Col I (9):  Gramaje (gsm)
        certTexto,                                                                  // Col J (10): Certificación
        data.certificacion_codigo || "",                                            // Col K (11): Código Licencia
        data.certificacion_porcentaje !== null && data.certificacion_porcentaje !== undefined ? data.certificacion_porcentaje : "", // Col L (12): % Certificado
        idLimpio,                                                                   // Col M (13): ID Bobina (Sin Guiones)
        pesoVal,                                                                    // Col N (14): Peso Bobina (kg)
        b.estado || "VERIFICADA",                                                   // Col O (15): Estado Bobina
        totalBobinas,                                                               // Col P (16): Total Bobinas Albarán
        data.almacen || "ROTOMADRID",                                               // Col Q (17): Almacén
        data.calle !== undefined && data.calle !== null ? String(data.calle) : "0" // Col R (18): Calle
      ]);
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "¡Albarán N° " + numAlbaran + " guardado y actualizado con éxito en Google Drive (" + totalBobinas + " bobinas)!",
      pdf_url: pdfUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export function GoogleDriveConfigModal({
  isOpen,
  onClose,
  webhookUrl,
  onSaveWebhookUrl,
}: GoogleDriveConfigModalProps) {
  const [urlInput, setUrlInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setUrlInput(webhookUrl || "");
  }, [webhookUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getCleanUrl = () => {
    const normalized = normalizeWebhookUrl(urlInput);
    if (normalized !== urlInput) setUrlInput(normalized);
    return normalized;
  };

  const handleSaveUrl = () => {
    const finalUrl = getCleanUrl();
    onSaveWebhookUrl(finalUrl);
    setStatusMsg({ type: "success", text: "URL / ID guardado y configurado en la aplicación." });
  };

  const handleTestConnection = async () => {
    const finalUrl = getCleanUrl();

    if (!finalUrl) {
      setStatusMsg({ type: "error", text: "Pega la URL o ID del Webhook antes de probar." });
      return;
    }

    setTesting(true);
    setStatusMsg(null);
    onSaveWebhookUrl(finalUrl);

    try {
      const res = await fetch("/api/google-drive-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: finalUrl, mode: "test" }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Error al conectar con Google Drive.");
      }

      setStatusMsg({
        type: "success",
        text: "¡Conexión Exitosa! Se ha creado/actualizado la Hoja 'BD_Almacen_Papel' en tu Google Drive.",
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err.message || "Error al conectar. Verifica que desplegaste la Web App con acceso a 'Cualquiera'.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncAllHistory = async () => {
    if (!urlInput.trim()) {
      setStatusMsg({ type: "error", text: "Configura primero la URL del Webhook." });
      return;
    }

    setSyncingAll(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/google-drive-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: urlInput.trim(), mode: "sync_all" }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Error sincronizando datos.");
      }

      setStatusMsg({ type: "success", text: data.message });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Error durante la sincronización." });
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#ccd1da] rounded-2xl p-6 sm:p-8 max-w-3xl w-full text-[#1e1e1e] shadow-2xl relative my-auto max-h-[90vh] flex flex-col animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#666666] hover:text-[#1e1e1e] p-1.5 rounded-full hover:bg-[#f7fafc] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#ccd1da]/60">
          <div className="w-10 h-10 rounded-xl bg-[#f7fafc] border border-[#ccd1da] flex items-center justify-center text-[#0098f2]">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1e1e1e] tracking-tight">Conexión con Google Drive</h2>
            <p className="text-xs text-[#666666]">
              Sincroniza automáticamente los albaranes y bobinas con tu hoja <span className="font-semibold text-[#1e1e1e]">BD_Almacen_Papel</span>
            </p>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`mb-5 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${
              statusMsg.type === "success"
                ? "bg-[rgba(93,156,6,0.08)] border-[rgba(93,156,6,0.3)] text-[#5d9c06]"
                : "bg-[rgba(255,99,99,0.08)] border-[rgba(255,99,99,0.3)] text-[#ff6363]"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-[#5d9c06] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#ff6363] shrink-0 mt-0.5" />
            )}
            <div>{statusMsg.text}</div>
          </div>
        )}

        {/* Pasos de Configuración */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* PASO 1: Copiar Script de Google */}
          <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase text-[#1e1e1e] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0098f2]" /> PASO 1: Copiar el Script de Google
              </span>
              <button
                onClick={handleCopyCode}
                className="acctual-btn-primary px-3 py-1.5 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#0098f2]" /> : <Copy className="w-3.5 h-3.5 text-[#0098f2]" />}
                <span>{copied ? "¡Copiado!" : "Copiar Script"}</span>
              </button>
            </div>

            <ol className="text-xs text-[#666666] space-y-1.5 list-decimal list-inside font-medium leading-relaxed">
              <li>
                Abre{" "}
                <a
                  href="https://script.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0098f2] hover:underline font-semibold inline-flex items-center gap-0.5"
                >
                  script.google.com <ExternalLink className="w-3 h-3" />
                </a>{" "}
                e inicia sesión con tu cuenta de Google.
              </li>
              <li>Haz clic en <strong>"Nuevo proyecto"</strong> y pega el código copiado arriba.</li>
              <li>Haz clic en <strong>"Ejecutar"</strong> la función <code className="bg-white px-1.5 py-0.5 rounded border border-[#ccd1da] text-[#1e1e1e]">setupDatabase</code>.</li>
              <li>Haz clic en <strong>"Desplegar"</strong> &rarr; <strong>"Nuevo despliegue"</strong> &rarr; Tipo <strong>"Aplicación web"</strong>.</li>
              <li>En <em>"Quién tiene acceso"</em> selecciona <strong>"Cualquiera" (Anyone)</strong> y pulsa Desplegar.</li>
            </ol>
          </div>

          {/* PASO 2: Pegar la URL del Webhook */}
          <div className="bg-[#f7fafc] border border-[#ccd1da] rounded-xl p-5 space-y-4">
            <span className="text-xs font-bold uppercase text-[#1e1e1e] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#0098f2]" /> PASO 2: Pegar la URL de la Aplicación Web
            </span>

            <div>
              <label className="block text-xs font-semibold text-[#666666] uppercase mb-1.5">
                URL del Webhook (Google Apps Script):
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full bg-white border border-[#ccd1da] focus:border-[#0098f2] rounded-xl px-4 py-2.5 text-xs font-mono text-[#1e1e1e] focus:outline-none shadow-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="acctual-btn-primary px-4 py-2 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#0098f2]" />}
                <span>Probar Conexión</span>
              </button>

              <button
                onClick={handleSyncAllHistory}
                disabled={syncingAll || !urlInput.trim()}
                className="acctual-btn-secondary px-4 py-2 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {syncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0098f2]" /> : <RefreshCw className="w-3.5 h-3.5 text-[#0098f2]" />}
                <span>Subir Histórico a Drive</span>
              </button>

              <button
                onClick={handleSaveUrl}
                className="acctual-btn-secondary px-4 py-2 text-xs font-semibold shadow-sm"
              >
                Guardar URL
              </button>
            </div>
          </div>
        </div>

        {/* Cierre */}
        <div className="flex justify-end pt-4 border-t border-[#ccd1da]/60 mt-4 shrink-0">
          <button
            onClick={onClose}
            className="acctual-btn-ghost px-5 py-2 text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

