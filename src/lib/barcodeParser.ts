export interface ParsedBarcode {
  identificador_bobina: string;
  peso_kg: number | null;
  formato_detectado: "GS1-128" | "DELIMITADOR_PROPIO" | "FALLBACK";
}

/**
 * Parsea una cadena leída por la pistola láser de código de barras.
 * Mantiene SIEMPRE la secuencia numérica/alfanumérica COMPLETA sin truncar dígitos (ej: 3251375910001073).
 * @param rawCode Código escaneado por el lector láser en planta.
 * @param fabricanteNombre Nombre opcional del fabricante detectado en el albarán.
 */
export function parseBarcode(rawCode: string, fabricanteNombre?: string): ParsedBarcode {
  const code = rawCode.trim();
  if (!code) {
    return {
      identificador_bobina: "",
      peso_kg: null,
      formato_detectado: "FALLBACK",
    };
  }

  // Limpiar guiones, guiones bajos y espacios para obtener la cadena continua COMPLETA exacta
  const fullCodeClean = code.replace(/[-_ ]/g, "");

  // 1. Estándar GS1-128 (Contiene 3102 - Indicador de Peso Neto en kg con 1 decimal, p.ej. UPM, Stora Enso)
  // Ej: 3102045650... -> extrae peso 456.5 kg manteniendo el identificador_bobina COMPLETO exacto escaneado
  const gs1Index = code.indexOf("3102");
  if (gs1Index !== -1 && code.length >= gs1Index + 10) {
    const weightStr = code.substring(gs1Index + 4, gs1Index + 10);
    const weightRaw = parseInt(weightStr, 10);
    
    if (!isNaN(weightRaw)) {
      const peso_kg = weightRaw / 10;
      return {
        identificador_bobina: fullCodeClean, // CÓDIGO COMPLETO EXACTO SIN TRUNCAR
        peso_kg: Math.round(peso_kg * 10) / 10,
        formato_detectado: "GS1-128",
      };
    }
  }

  // 2. Formato Propio con delimitadores de peso (ej: IDP1250)
  const delimitadorMatch = code.match(/^(.+?)[-_][pP](\d+)$/);
  if (delimitadorMatch) {
    const pesoRaw = parseInt(delimitadorMatch[2], 10);
    return {
      identificador_bobina: fullCodeClean,
      peso_kg: isNaN(pesoRaw) ? null : pesoRaw,
      formato_detectado: "DELIMITADOR_PROPIO",
    };
  }

  // 3. Fallback: Devolver SIEMPRE el número completo exacto continuo sin guiones
  return {
    identificador_bobina: fullCodeClean,
    peso_kg: null,
    formato_detectado: "FALLBACK",
  };
}
