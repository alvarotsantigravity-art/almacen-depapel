import { GoogleGenAI, Type } from "@google/genai";

export interface OCRBobinaItem {
  identificador_bobina: string;
  peso_kg: number | null;
}

export interface OCRResult {
  numero_albaran: string;
  fecha: string;
  nombre_cliente: string;
  fabricante: string;
  marca_papel: string;
  tipo_papel: string;
  ancho_papel_mm: number;
  gramaje_papel_gsm: number;
  certificacion_tipo?: "PEFC" | "FSC" | "SIN_CERTIFICACION";
  certificacion_codigo?: string | null;
  certificacion_porcentaje?: number | null;
  bobinas: OCRBobinaItem[];
}

/**
 * Normaliza el ancho del papel a milímetros (mm)
 */
export function normalizeAnchoToMM(anchoRaw: number, unidadOriginal?: string): number {
  if (!anchoRaw || anchoRaw <= 0) return 0;

  // Si el valor recibido es menor a 30, probablemente viene en metros (ej. 1.45m -> 1450mm)
  if (anchoRaw < 30) {
    return Math.round(anchoRaw * 1000);
  }
  // Si el valor está entre 30 y 300, probablemente viene en centímetros (ej. 145cm -> 1450mm)
  if (anchoRaw >= 30 && anchoRaw <= 300) {
    return Math.round(anchoRaw * 10);
  }

  // Si ya está en milímetros (ej. 1450mm)
  return Math.round(anchoRaw);
}

// Lista de modelos a probar en orden por si uno está sobrecargado (503)
const CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-2.5-pro",
  "gemini-flash-latest",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Procesa un archivo PDF o Imagen con Google Gemini Vision para extraer los datos del albarán y su desglose completo de bobinas.
 * Cuenta con sistema de conmutación automática de modelos y reintentos en caso de alta demanda (Error 503).
 */
export async function processAlbaranOCR(fileBuffer: Buffer, mimeType: string, apiKey?: string): Promise<OCRResult> {
  const customKey = apiKey && apiKey.trim() && !apiKey.includes("tu_clave") ? apiKey.trim() : undefined;
  const envKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() && !process.env.GEMINI_API_KEY.includes("tu_clave") ? process.env.GEMINI_API_KEY.trim() : undefined;
  const key = customKey || envKey;
  
  if (!key) {
    throw new Error("No has configurado tu clave de Google Gemini API. Haz clic en el icono de la llave (🔑) en la barra superior e introduce tu API Key gratuita obtenida en https://aistudio.google.com/app/apikey.");
  }

  const ai = new GoogleGenAI({ apiKey: key });

  const promptText = `
Eres un sistema experto en extracción de datos de albaranes de imprenta de papel offset.
Analiza detenidamente el documento/imagen adjunto y extrae:
1. La cabecera del albarán.
2. La certificación forestal / de sostenibilidad del papel (PEFC o FSC) si aplica.
3. El desglose completo de TODAS las bobinas de papel listadas en el documento (código de código de barras COMPLETO de cada bobina y su peso en kg).

REGLAS CRÍTICAS DE EXTRACCIÓN:
- "numero_albaran": Número o código de identificación del albarán/remisión.
- "fecha": Fecha del documento en formato YYYY-MM-DD.
- "nombre_cliente": Nombre exacto de la empresa receptora/cliente.
- "fabricante": Nombre del proveedor o fabricante de papel (ej. UPM, Holmen, Perlen Papier, Stora Enso, Copasegur, etc.).
- "marca_papel": Marca comercial del papel (ej. UPM Star, Holmen XL, etc.).
- "tipo_papel": Tipo de papel o acabado (ej. LWC, Offset, Rotativa, SC, etc.).
- "ancho_papel_mm": Ancho de la bobina en MILÍMETROS (número). Si en el documento viene en cm o m, conviértelo a mm.
- "gramaje_papel_gsm": Gramaje del papel en gramos por metro cuadrado GSM (número, ej. 54, 60, 70, 80, 90).
- "certificacion_tipo": Si el papel especifica certificación PEFC o FSC (ej: PEFC, FSC Mix, FSC Recycled, FSC 100%), devuelve "PEFC" o "FSC". Si no tiene o no consta, devuelve "SIN_CERTIFICACION".
- "certificacion_codigo": Código de la licencia o certificado (ej: "PEFC/14-38-00001", "CU-PEFC-812345", "FSC-C012345", "SA-COC-001234"). Si no aparece, pon null.
- "certificacion_porcentaje": Porcentaje % de materia certificada (número, ej: 70, 100). Si no aparece, pon null.
- "bobinas": Array con cada bobina individual especificada en las tablas o códigos de barra del albarán, indicando:
  * "identificador_bobina": CÓDIGO DE BARRAS COMPLETO EXACTO impreso debajo o sobre la imagen del código de barras (ej: "3251375910001073"). DEBES extraer la secuencia numérica o alfanumérica larga COMPLETA tal y como la leería una pistola láser de código de barras. NO truncar, NO acortar, NO extraer números cortos de posición o número de fila. Elimina guiones y espacios para devolver únicamente la cadena completa continua.
  * "peso_kg": Peso bruto (Gross Weight / Peso Bruto) de la bobina en kilogramos (número, ej: 1160). Si en el albarán/documento existen dos columnas de peso ("Gross Weight" / "Peso Bruto" y "Net Weight" / "Peso Neto"), extrae SIEMPRE el "Gross Weight" (Peso Bruto), ya que coincide exactamente con la cantidad de kilogramos codificada en la etiqueta y en el código de barras de la bobina (ej: 1160 kg). Si solo consta un peso, extrae ese valor.

Devuelve únicamente la estructura JSON especificada.
`;

  const base64Data = fileBuffer.toString("base64");

  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType || "application/pdf",
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              numero_albaran: { type: Type.STRING },
              fecha: { type: Type.STRING },
              nombre_cliente: { type: Type.STRING },
              fabricante: { type: Type.STRING },
              marca_papel: { type: Type.STRING },
              tipo_papel: { type: Type.STRING },
              ancho_papel_mm: { type: Type.NUMBER },
              gramaje_papel_gsm: { type: Type.NUMBER },
              certificacion_tipo: { type: Type.STRING },
              certificacion_codigo: { type: Type.STRING, nullable: true },
              certificacion_porcentaje: { type: Type.NUMBER, nullable: true },
              bobinas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    identificador_bobina: { type: Type.STRING },
                    peso_kg: { type: Type.NUMBER, nullable: true },
                  },
                  required: ["identificador_bobina"],
                },
              },
            },
            required: [
              "numero_albaran",
              "fecha",
              "nombre_cliente",
              "fabricante",
              "marca_papel",
              "tipo_papel",
              "ancho_papel_mm",
              "gramaje_papel_gsm",
              "bobinas",
            ],
          },
        },
      });

      const responseText = response.text?.trim() || "{}";
      const cabecera = JSON.parse(responseText);

      const anchoNormalizado = normalizeAnchoToMM(cabecera.ancho_papel_mm);

      const bobinasNormalizadas: OCRBobinaItem[] = Array.isArray(cabecera.bobinas)
        ? cabecera.bobinas
            .map((b: any) => {
              const idClean = String(b.identificador_bobina || "").replace(/[-_ ]/g, "").trim();
              let pesoKg = b.peso_kg !== null && b.peso_kg !== undefined ? parseFloat(b.peso_kg) : null;
              if (isNaN(pesoKg as number)) pesoKg = null as any;

              // AUTO-CORRECCIÓN DETERMINISTA DE PESO BRUTO EMBEBIDO EN CÓDIGOS DE BARRAS DE 16 DÍGITOS
              if (idClean.length >= 15 && /^\d+$/.test(idClean)) {
                const embeddedWeightStr = idClean.slice(8, 12);
                const embeddedWeight = parseInt(embeddedWeightStr, 10);
                if (!isNaN(embeddedWeight) && embeddedWeight >= 300 && embeddedWeight <= 3500) {
                  pesoKg = embeddedWeight;
                }
              }

              return {
                identificador_bobina: idClean,
                peso_kg: pesoKg,
              };
            })
            .filter((b: OCRBobinaItem) => b.identificador_bobina.length > 0)
        : [];

      let certTipo: "PEFC" | "FSC" | "SIN_CERTIFICACION" = "SIN_CERTIFICACION";
      const rawCertTipo = String(cabecera.certificacion_tipo || "").toUpperCase();
      if (rawCertTipo.includes("PEFC")) certTipo = "PEFC";
      else if (rawCertTipo.includes("FSC")) certTipo = "FSC";

      return {
        numero_albaran: cabecera.numero_albaran || "ALB-SIN-NUMERO",
        fecha: cabecera.fecha || new Date().toISOString().split("T")[0],
        nombre_cliente: cabecera.nombre_cliente || "Cliente Genérico",
        fabricante: cabecera.fabricante || "Fabricante Desconocido",
        marca_papel: cabecera.marca_papel || "Estándar",
        tipo_papel: cabecera.tipo_papel || "Offset",
        ancho_papel_mm: anchoNormalizado,
        gramaje_papel_gsm: cabecera.gramaje_papel_gsm || 0,
        certificacion_tipo: certTipo,
        certificacion_codigo: cabecera.certificacion_codigo || null,
        certificacion_porcentaje: typeof cabecera.certificacion_porcentaje === "number" ? cabecera.certificacion_porcentaje : null,
        bobinas: bobinasNormalizadas,
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || "");

      // Si la clave no es válida, no tiene sentido reintentar otros modelos
      if (
        err?.status === "INVALID_ARGUMENT" ||
        errMsg.includes("API_KEY_INVALID") ||
        errMsg.includes("API key not valid") ||
        errMsg.includes("API_KEY_SERVICE_BLOCKED")
      ) {
        throw new Error(
          "La clave API de Google Gemini no es válida o ha caducado. Por favor, haz clic en el icono de la llave (🔑) en la barra superior e introduce una clave válida generada en https://aistudio.google.com/app/apikey."
        );
      }

      // Si la cuota se agotó
      if (err?.status === "RESOURCE_EXHAUSTED" || err?.code === 429 || errMsg.includes("quota")) {
        throw new Error(
          "Se ha superado la cuota de tu clave Gemini API (Error 429). Por favor, espera unos instantes o introduce una clave de otra cuenta en el icono de la llave (🔑)."
        );
      }

      const isHighDemand =
        err?.status === "UNAVAILABLE" ||
        err?.code === 503 ||
        errMsg.includes("high demand") ||
        errMsg.includes("overloaded");

      if (isHighDemand) {
        console.warn(`[OCR] El modelo ${modelName} está experimentando alta demanda (503). Conmutando al siguiente modelo...`);
        await sleep(1000);
        continue;
      }
      
      console.warn(`[OCR] Error con el modelo ${modelName}:`, errMsg);
      continue;
    }
  }

  throw new Error(`Los servidores de Google Gemini están experimentando alta demanda temporal en sus modelos. Detalles: ${lastError?.message || "Error 503"}`);
}
