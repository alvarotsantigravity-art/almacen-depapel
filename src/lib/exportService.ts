import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportBobina {
  id?: string;
  codigo_barras_raw?: string;
  identificador_bobina: string;
  peso_kg: number | null;
  estado: string;
  fecha_escaneo: string;
}

export interface ExportAlbaran {
  id: string;
  numero_albaran: string;
  fecha: string;
  fabricante: string;
  marca_papel: string;
  tipo_papel: string;
  ancho_papel_mm: number;
  gramaje_papel_gsm: number;
  almacen?: string;
  calle?: string;
  certificacion_tipo?: string | null;
  certificacion_codigo?: string | null;
  certificacion_porcentaje?: number | null;
  cliente: {
    nombre_empresa: string;
  };
  es_personalizado?: boolean;
  campos_modificados?: string | null;
  cliente_original?: string | null;
  pdf_nombre?: string | null;
  pdf_data?: string | null;
  pdf_url?: string | null;
  bobinas: ExportBobina[];
}

/**
 * Exporta el conjunto de albaranes y bobinas filtrados a un archivo Excel (.xlsx)
 */
export function exportToExcel(albaranes: ExportAlbaran[], filename = "Informe_Entradas_Papel.xlsx") {
  // Construir filas para la hoja de cálculo
  const rows: any[] = [];

  albaranes.forEach((alb) => {
    const certTexto = alb.certificacion_tipo && alb.certificacion_tipo !== "SIN_CERTIFICACION"
      ? `${alb.certificacion_tipo}${alb.certificacion_porcentaje ? ` (${alb.certificacion_porcentaje}%)` : ""}`
      : "Sin Certificación";

    const almacenTexto = alb.almacen || "ROTOMADRID";
    const calleTexto = alb.calle !== undefined && alb.calle !== null ? String(alb.calle) : "0";

    if (alb.bobinas.length === 0) {
      rows.push({
        "Cliente": alb.cliente.nombre_empresa,
        "N° Albarán": alb.numero_albaran,
        "Fecha Entrada": alb.fecha,
        "Almacén": almacenTexto,
        "Calle": calleTexto,
        "Fabricante": alb.fabricante,
        "Marca Papel": alb.marca_papel,
        "Tipo Papel": alb.tipo_papel,
        "Ancho (mm)": alb.ancho_papel_mm,
        "Gramaje (gsm)": alb.gramaje_papel_gsm,
        "Certificación": certTexto,
        "Código Certificado": alb.certificacion_codigo || "-",
        "ID Bobina": "Sin Bobinas",
        "Peso (kg)": "-",
        "Estado": "-",
        "Hora Registro": "-",
      });
    } else {
      alb.bobinas.forEach((b) => {
        rows.push({
          "Cliente": alb.cliente.nombre_empresa,
          "N° Albarán": alb.numero_albaran,
          "Fecha Entrada": alb.fecha,
          "Almacén": almacenTexto,
          "Calle": calleTexto,
          "Fabricante": alb.fabricante,
          "Marca Papel": alb.marca_papel,
          "Tipo Papel": alb.tipo_papel,
          "Ancho (mm)": alb.ancho_papel_mm,
          "Gramaje (gsm)": alb.gramaje_papel_gsm,
          "Certificación": certTexto,
          "Código Certificado": alb.certificacion_codigo || "-",
          "ID Bobina": b.identificador_bobina,
          "Peso (kg)": b.peso_kg !== null ? b.peso_kg : "Pendiente",
          "Estado": b.estado,
          "Hora Registro": b.fecha_escaneo ? new Date(b.fecha_escaneo).toLocaleString() : "-",
        });
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico Papel");

  // Ajustar anchos de columnas automáticamente
  const columnWidths = [
    { wch: 25 }, // Cliente
    { wch: 18 }, // N° Albarán
    { wch: 14 }, // Fecha
    { wch: 18 }, // Almacén
    { wch: 10 }, // Calle
    { wch: 20 }, // Fabricante
    { wch: 18 }, // Marca
    { wch: 14 }, // Tipo
    { wch: 12 }, // Ancho
    { wch: 14 }, // Gramaje
    { wch: 18 }, // Certificación
    { wch: 22 }, // Código Certificado
    { wch: 20 }, // ID Bobina
    { wch: 12 }, // Peso
    { wch: 22 }, // Estado
    { wch: 20 }, // Hora
  ];
  worksheet["!cols"] = columnWidths;

  XLSX.writeFile(workbook, filename);
}

/**
 * Genera y descarga un informe en PDF profesional para enviar al cliente o guardar en archivo
 */
export function exportToPDF(albaranOrList: ExportAlbaran | ExportAlbaran[], filename?: string) {
  const doc = new jsPDF();
  const list = Array.isArray(albaranOrList) ? albaranOrList : [albaranOrList];
  if (list.length === 0) return;

  list.forEach((albaran, albIndex) => {
    if (albIndex > 0) doc.addPage();

    // Encabezado del documento PDF
    doc.setFillColor(13, 17, 27); // Acctual Midnight
    doc.rect(0, 0, 210, 38, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("INFORME DE RECEPCIÓN DE PAPEL", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 152, 242); // Acctual Electric Blue
    doc.text("ALMACÉN DE PAPEL - IMPRENTA OFFSET", 14, 28);

    doc.setFontSize(9);
    doc.setTextColor(204, 209, 218);
    doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 145, 20);
    doc.text(`Doc Ref: ALB-${albaran.numero_albaran}`, 145, 26);

    // Cuadro Metadatos del Cliente y Albarán
    doc.setLineWidth(0.5);
    doc.setDrawColor(204, 209, 218);
    doc.setFillColor(247, 250, 252);
    doc.roundedRect(14, 45, 182, 46, 3, 3, "FD");

    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`CLIENTE: ${albaran.cliente.nombre_empresa.toUpperCase()}`, 20, 54);

    const certTexto = albaran.certificacion_tipo && albaran.certificacion_tipo !== "SIN_CERTIFICACION"
      ? `${albaran.certificacion_tipo}${albaran.certificacion_porcentaje ? ` (${albaran.certificacion_porcentaje}%)` : ""} - ${albaran.certificacion_codigo || "Certificado"}`
      : "Sin Certificación";

    const almacenTexto = albaran.almacen || "ROTOMADRID";
    const calleTexto = albaran.calle !== undefined && albaran.calle !== null ? String(albaran.calle) : "0";

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.text(`N° Albarán: ${albaran.numero_albaran}`, 20, 62);
    doc.text(`Almacén: ${almacenTexto}  |  Calle: ${calleTexto}`, 20, 70);
    doc.text(`Fabricante: ${albaran.fabricante}`, 20, 78);
    doc.text(`Certificación: ${certTexto}`, 20, 86);
    doc.text(`Marca / Tipo: ${albaran.marca_papel} (${albaran.tipo_papel})`, 105, 62);
    doc.text(`Ancho: ${albaran.ancho_papel_mm} mm  |  Gramaje: ${albaran.gramaje_papel_gsm} gsm`, 105, 70);

    // Totales
    const totalBobinas = albaran.bobinas.length;
    const pesoTotalKg = albaran.bobinas.reduce((acc, b) => acc + (b.peso_kg || 0), 0);
    const verificadas = albaran.bobinas.filter((b) => b.estado === "VERIFICADA").length;

    doc.setFillColor(240, 243, 246);
    doc.rect(14, 96, 182, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`RESUMEN: ${totalBobinas} Bobinas Recibidas  |  Peso Acumulado: ${pesoTotalKg.toLocaleString()} kg  |  Verificadas: ${verificadas}/${totalBobinas}`, 20, 103);

    // Tabla de Bobinas con autoTable
    const tableData = albaran.bobinas.map((b, idx) => [
      (idx + 1).toString(),
      b.identificador_bobina,
      b.peso_kg !== null ? `${b.peso_kg} kg` : "Pendiente",
      b.estado,
      b.fecha_escaneo ? new Date(b.fecha_escaneo).toLocaleDateString() + " " + new Date(b.fecha_escaneo).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
    ]);

    autoTable(doc, {
      startY: 113,
      head: [["#", "ID Bobina", "Peso (kg)", "Estado Verificación", "Fecha / Hora Escaneo"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [13, 17, 27],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [247, 250, 252],
      },
    });

    // Pie de página con firma
    const finalY = (doc as any).lastAutoTable?.finalY || 160;
    if (finalY + 30 < 280) {
      doc.setDrawColor(204, 209, 218);
      doc.line(130, finalY + 25, 185, finalY + 25);
      doc.setFontSize(8);
      doc.setTextColor(102, 102, 102);
      doc.text("Conformidad Recepción de Almacén", 130, finalY + 30);
    }
  });

  const finalName = filename || (list.length === 1 ? `Informe_${list[0].cliente.nombre_empresa}_ALB_${list[0].numero_albaran}.pdf` : "Informe_Historico_Albaranes.pdf");
  doc.save(finalName);
}


