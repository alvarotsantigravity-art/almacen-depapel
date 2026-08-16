/**
 * GOOGLE APPS SCRIPT - BASE DE DATOS UNIFICADA 'BD_Almacen_Papel'
 * 
 * REGLA DE NOMBRADO ESTANDARIZADO DE PDFs:
 * Formato: [DD][MM][YYYY][CLIENTE_LIMPIO][ANCHO]_[NUMERO_ALBARAN].pdf
 * Ejemplo: 15082026ALTAVIAIBERICACFA1200_95348.pdf
 * 
 * MAPEO DE COLUMNAS EXACTO (18 COLUMNAS: A - R):
 * Col A (1):  Fecha Registro
 * Col B (2):  Cliente
 * Col C (3):  N° Albarán (Click PDF - Hipervínculo Permanente)
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

  var lastCol = sheetAlbaranes.getLastColumn();
  if (lastCol > 18) {
    sheetAlbaranes.getRange(1, 19, 1, lastCol - 18).clearContent().setBackground(null);
  }
}

/**
 * Genera el nombre estandarizado de archivo PDF:
 * [DD][MM][YYYY][CLIENTE_LIMPIO][ANCHO]_[NUMERO_ALBARAN].pdf
 */
function formatStandardPdfName(fechaStr, clienteNombre, anchoMm, numAlbaran) {
  var d = new Date();
  if (fechaStr) {
    var parts = String(fechaStr).trim().split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // Formato YYYY-MM-DD
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else if (parts[2].length === 4) {
        // Formato DD-MM-YYYY
        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }

  var day = ("0" + d.getDate()).slice(-2);
  var month = ("0" + (d.getMonth() + 1)).slice(-2);
  var year = String(d.getFullYear());
  var datePrefix = day + month + year;

  // Limpiar cliente: sin acentos, mayúsculas, solo caracteres alfanuméricos
  var cleanCliente = String(clienteNombre || "CLIENTE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  if (!cleanCliente) cleanCliente = "CLIENTE";

  var cleanAncho = String(Math.round(parseFloat(anchoMm) || 0));
  var cleanNum = String(numAlbaran || "").trim();

  return datePrefix + cleanCliente + cleanAncho + "_" + cleanNum + ".pdf";
}

function extractAlbaranNumber(cellVal) {
  if (cellVal === null || cellVal === undefined) return "";
  var str = String(cellVal).trim();
  if (!str) return "";
  var match = str.match(/,\s*"([^"]+)"\s*\)$/) || str.match(/;\s*"([^"]+)"\s*\)$/) || str.match(/"([^"]+)"/);
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
    var albFormulas = sheetAlbaranes ? sheetAlbaranes.getDataRange().getFormulas() : [];
    var albaranesMap = {};

    for (var i = 1; i < albRows.length; i++) {
      var r = albRows[i];
      var numAlbaran = extractAlbaranNumber(r[2]) || extractAlbaranNumber(r[3]);

      if (!numAlbaran || !String(r[1] || "").trim()) continue;

      var certTipo = String(r[9] || "SIN_CERTIFICACION");
      if (certTipo.includes("PEFC")) certTipo = "PEFC";
      else if (certTipo.includes("FSC")) certTipo = "FSC";
      else certTipo = "SIN_CERTIFICACION";

      var almacenVal = String(r[16] || r[18] || "ROTOMADRID").trim();
      var rawCalle = (r[17] !== undefined && r[17] !== null && String(r[17]).trim() !== "")
        ? r[17]
        : (r[19] !== undefined && r[19] !== null && String(r[19]).trim() !== "" ? r[19] : "0");
      var calleVal = String(rawCalle).trim();

      // Extraer URL del hipervínculo de la Columna C si existe fórmula
      var cellFormula = (albFormulas[i] && albFormulas[i][2]) ? albFormulas[i][2] : "";
      var matchUrl = cellFormula.match(/HYPERLINK\(\s*"([^"]+)"/i);
      var pdfUrlFromFormula = matchUrl && matchUrl[1] ? matchUrl[1] : "";

      var stdPdfName = formatStandardPdfName(r[3], r[1], r[7], numAlbaran);

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
          pdf_url: pdfUrlFromFormula || null,
          pdf_nombre: stdPdfName,
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
    var standardPdfName = formatStandardPdfName(data.fecha, clienteNombre, data.ancho_papel_mm, numAlbaran);

    // BUSCAR FILAS EXISTENTES DEL MISMO ALBARÁN Y EXTRAER ENLACE PREVIO SI EXISTE
    var dataRange = sheetAlbaranes.getDataRange().getValues();
    var formulasRange = sheetAlbaranes.getDataRange().getFormulas();
    var matchingRowIndices = [];
    var existingPdfUrl = "";

    for (var i = 1; i < dataRange.length; i++) {
      var cellValC = extractAlbaranNumber(dataRange[i][2]);
      var cellValD = extractAlbaranNumber(dataRange[i][3]);

      if ((cellValC && cellValC.toUpperCase() === numAlbaran.toUpperCase()) ||
          (cellValD && cellValD.toUpperCase() === numAlbaran.toUpperCase())) {
        matchingRowIndices.push(i + 1);

        if (!existingPdfUrl && formulasRange[i] && formulasRange[i][2]) {
          var matchForm = formulasRange[i][2].match(/HYPERLINK\(\s*"([^"]+)"/i);
          if (matchForm && matchForm[1]) {
            existingPdfUrl = matchForm[1];
          }
        }
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

    // GESTIÓN DEL ARCHIVO PDF Y REGLA DE NOMBRADO ESTANDARIZADO
    var pdfFolder = getOrCreateFolder(FOLDER_NAME_PDFS);
    var pdfUrl = data.pdf_url || existingPdfUrl || "";

    // Caso A: Se envía el binario nuevo del PDF (base64)
    if (data.pdf_data && data.pdf_data.indexOf("data:") === 0) {
      try {
        var base64Parts = data.pdf_data.split(",");
        var mimeType = base64Parts[0].split(":")[1].split(";")[0];
        var bytes = Utilities.base64Decode(base64Parts[1]);
        var blob = Utilities.newBlob(bytes, mimeType, standardPdfName);
        
        var pdfFile = pdfFolder.createFile(blob);
        pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        pdfUrl = pdfFile.getUrl();
      } catch (errPdf) {
        Logger.log("Error guardando archivo PDF nuevo: " + errPdf);
      }
    } else {
      // Caso B: Modificación de metadatos -> Renombrar el archivo existente en Drive al nuevo estándar
      if (pdfUrl) {
        try {
          var idMatch = pdfUrl.match(/[-\w]{25,}/);
          if (idMatch && idMatch[0]) {
            var existingFile = DriveApp.getFileById(idMatch[0]);
            if (existingFile) {
              existingFile.setName(standardPdfName);
            }
          }
        } catch (errRename) {
          Logger.log("Error renombrando archivo PDF existente: " + errRename);
        }
      }
    }

    var now = new Date().toLocaleString();
    var certTexto = data.certificacion_tipo && data.certificacion_tipo !== "SIN_CERTIFICACION"
      ? data.certificacion_tipo
      : "Sin Certificación";

    // FÓRMULA DE HIPERVÍNCULO PERMANENTE
    var albaranCellVal = pdfUrl ? '=HYPERLINK("' + pdfUrl + '", "' + numAlbaran + '")' : numAlbaran;

    var bobinasList = Array.isArray(data.bobinas) && data.bobinas.length > 0
      ? data.bobinas
      : [{ identificador_bobina: "Sin Bobinas", peso_kg: 0, estado: "N/A" }];

    var totalBobinas = bobinasList.length;

    // ESCRIBIR LAS FILAS DE BOBINAS ACTUALIZADAS (18 COLUMNAS EXACTAS A hasta R)
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
      pdf_url: pdfUrl,
      pdf_nombre: standardPdfName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
