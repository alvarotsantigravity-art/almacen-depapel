/**
 * Servicio de Sincronización con Google Drive / Google Sheets
 * 
 * Permite registrar de forma secuencial cada albarán validado en una base de datos central en Google Drive (Google Sheets),
 * guardando el PDF original en la carpeta 'ALBARANES PDF' y creando hipervínculos automáticos.
 */

export interface GoogleDriveAlbaranPayload {
  numero_albaran: string;
  fecha: string;
  nombre_cliente: string;
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
  pdf_nombre?: string | null;
  pdf_data?: string | null;
  pdf_url?: string | null;
  allow_overwrite?: boolean;
  bobinas: {
    identificador_bobina: string;
    peso_kg: number | null;
    estado?: string;
  }[];
}

/**
 * Genera el nombre estandarizado de archivo PDF:
 * [DD][MM][YYYY][CLIENTE_LIMPIO][ANCHO]_[NUMERO_ALBARAN].pdf
 * Ejemplo: 15082026ALTAVIAIBERICACFA1200_95348.pdf
 */
export function generateStandardPdfName(
  fecha: string,
  nombreCliente: string,
  anchoMm: number | string,
  numeroAlbaran: string
): string {
  let d = new Date();
  if (fecha) {
    const parts = String(fecha).trim().split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  const datePrefix = `${day}${month}${year}`;

  const cleanCliente = String(nombreCliente || "CLIENTE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  const cleanAncho = String(Math.round(parseFloat(String(anchoMm)) || 0));
  const cleanNum = String(numeroAlbaran || "").trim();

  return `${datePrefix}${cleanCliente || "CLIENTE"}${cleanAncho}_${cleanNum}.pdf`;
}

/**
 * Normaliza cualquier formato de entrada (ya sea el ID del despliegue o la URL completa)
 * a la URL ejecutable válida de Google Apps Script.
 */
export function normalizeWebhookUrl(input: string): string {
  let trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  // Si introdujo únicamente el ID del despliegue (ej. AKfycb...)
  return `https://script.google.com/macros/s/${trimmed}/exec`;
}

/**
 * Registra un albarán validado en la base de datos de Google Drive (Google Sheets).
 */
export async function syncAlbaranToGoogleDrive(
  payload: GoogleDriveAlbaranPayload,
  overrideUrl?: string
): Promise<{ success: boolean; is_duplicate?: boolean; message?: string; pdf_url?: string }> {
  try {
    const rawUrl = overrideUrl || process.env.GOOGLE_DRIVE_WEBHOOK_URL || "";
    const webHookUrl = normalizeWebhookUrl(rawUrl);

    if (!webHookUrl) {
      console.log("[GoogleDriveSync] GOOGLE_DRIVE_WEBHOOK_URL no configurado. Guardado únicamente en Base de Datos Local.");
      return {
        success: true,
        message: "Guardado localmente. Configura la URL de Google Drive para sincronizar.",
      };
    }

    const response = await fetch(webHookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Google Drive Webhook devolvió el código HTTP ${response.status}`);
    }

    const resData = await response.json().catch(() => ({ success: true }));
    return resData;
  } catch (error: any) {
    console.error("[GoogleDriveSync] Error al sincronizar con Google Drive:", error);
    return { success: false, message: error?.message || "Error al sincronizar con Google Drive." };
  }
}
